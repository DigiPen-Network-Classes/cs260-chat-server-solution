import { randomUUIDv7 } from "bun";
import type { SocketData } from "../types";
import { send } from "../utils";
import Log from "../logger";

// Step 1 of the challenge-response handshake: the client announces it wants to
// authenticate, and the server replies with a fresh per-connection nonce. The
// client then hashes name + shared-secret + nonce into the CONNECT token.
export const login = (socket: Bun.Socket<SocketData>) => {
    const nonce = randomUUIDv7();
    socket.data.nonce = nonce;

    Log.debug(`Issued nonce to ${socket.remoteAddress}`);
    send(socket, { type: "AUTHENTICATE", nonce });
}