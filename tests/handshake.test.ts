// Integration tests for the LOGIN -> AUTHENTICATE -> CONNECT challenge-response
// handshake. Each test spins up a real server subprocess on an ephemeral port,
// talks to it over a TCP socket, and asserts on the packets it sends back.
//
//   bun test
import { afterAll, beforeAll, expect, test } from "bun:test";
import type { Subprocess } from "bun";

const AUTH_TOKEN = "test-secret";
const PORT = 34100 + Math.floor(Math.random() * 500);
const HTTP_PORT = PORT + 1;

let server: Subprocess;

function sha256(s: string) {
    return new Bun.CryptoHasher("sha256").update(s).digest("hex");
}

// Open a connection, run `script` (which sends packets and resolves with the
// first "terminal" packet — HELLO or ERROR), then tear the socket down.
function exchange(
    onAuthenticate: (nonce: string) => Record<string, unknown>,
    opener: (s: Bun.Socket) => void,
): Promise<{ type: string; reason?: string }> {
    return new Promise((resolve, reject) => {
        let buf = "";
        const timer = setTimeout(() => reject(new Error("timed out waiting for HELLO/ERROR")), 4000);

        Bun.connect({
            hostname: "127.0.0.1",
            port: PORT,
            socket: {
                open: opener,
                data(socket, chunk) {
                    buf += chunk.toString();
                    let i;
                    while ((i = buf.indexOf("\n")) >= 0) {
                        const line = buf.slice(0, i);
                        buf = buf.slice(i + 1);
                        const pkt = JSON.parse(line);
                        if (pkt.type === "AUTHENTICATE") {
                            socket.write(JSON.stringify(onAuthenticate(pkt.nonce)) + "\n");
                        } else if (pkt.type === "HELLO" || pkt.type === "ERROR") {
                            clearTimeout(timer);
                            socket.end();
                            resolve(pkt);
                            return;
                        }
                    }
                },
                error: (_s, err) => { clearTimeout(timer); reject(err); },
            },
        });
    });
}

beforeAll(async () => {
    server = Bun.spawn(["bun", "./src/index.ts"], {
        env: { ...process.env, AUTH_TOKEN, PORT: String(PORT), HTTP_PORT: String(HTTP_PORT) },
        stdout: "pipe",
        stderr: "pipe",
    });

    // Wait for the HTTP health endpoint to come up before running tests.
    const deadline = Date.now() + 5000;
    for (;;) {
        try {
            await fetch(`http://127.0.0.1:${HTTP_PORT}/health`);
            break;
        } catch {
            if (Date.now() > deadline) throw new Error("server did not start");
            await Bun.sleep(50);
        }
    }
});

afterAll(() => {
    server?.kill();
});

test("LOGIN -> AUTHENTICATE -> valid CONNECT yields HELLO", async () => {
    const result = await exchange(
        (nonce) => ({ type: "CONNECT", name: "alice", token: sha256("alice" + AUTH_TOKEN + nonce) }),
        (s) => s.write(JSON.stringify({ type: "LOGIN" }) + "\n"),
    );
    expect(result.type).toBe("HELLO");
});

test("CONNECT with a wrong token is rejected", async () => {
    const result = await exchange(
        () => ({ type: "CONNECT", name: "bob", token: "not-the-right-hash" }),
        (s) => s.write(JSON.stringify({ type: "LOGIN" }) + "\n"),
    );
    expect(result.type).toBe("ERROR");
    expect(result.reason).toBe("Invalid token");
});

test("CONNECT without a prior LOGIN is rejected", async () => {
    const result = await exchange(
        () => ({ type: "CONNECT", name: "carol", token: "x" }), // never called: no AUTHENTICATE arrives
        (s) => s.write(JSON.stringify({ type: "CONNECT", name: "carol", token: "x" }) + "\n"),
    );
    expect(result.type).toBe("ERROR");
    expect(result.reason).toBe("Must LOGIN before CONNECT");
});