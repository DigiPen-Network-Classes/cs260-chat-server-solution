# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A TCP chat server built on the **Bun** runtime (not Node). It is the reference
("solution") server for the CS260 chat project at DigiPen. Clients connect over
a raw TCP socket and exchange newline-terminated JSON packets; a separate HTTP
server exposes only a `/health` endpoint.

## Commands

```bash
bun install            # install dependencies
bun run start          # run the server (src/index.ts); requires env vars below
bun ./src/index.ts     # equivalent direct run
bun test               # run the integration tests in tests/

docker compose up --build   # run via Docker (reads .env)
```

There is **no linter or build step** — Bun executes the TypeScript directly.
`tsconfig.json` is configured for type-checking/IDE only (`noEmit`, bundler
resolution). Tests live in `tests/` and use `bun test`; each test spawns a real
server subprocess on an ephemeral port and exercises the wire protocol over TCP
(no mocking), so they double as documentation of the handshake.

### Required environment

Copy `.env.example` to `.env`. The server calls `process.exit(1)` on startup if
`AUTH_TOKEN`, `PORT`, or `HTTP_PORT` are missing/invalid. Other vars
(`MAX_*`, `RATE_LIMIT_*`) fall back to defaults in `src/state.ts`.

## Architecture

**Two servers, one process** (`src/index.ts`): `Bun.listen` for the TCP chat
protocol and `Bun.serve` for the HTTP health check. Both ports must be set.

**Wire protocol** is JSON, one packet per line (`\n`-terminated, added in
`send`). Packet shapes and the `ClientPacket`/`ServerPacket` discriminated
unions live in `src/types.ts` — this is the source of truth for the protocol.
Client→server types currently handled: `LOGIN`, `CONNECT`, `CHAT`, `PONG`,
`DISCONNECT`. Server→client: `AUTHENTICATE`, `HELLO`, `CONNECTED_USERS`,
`MESSAGE`, `SYSTEM`, `MESSAGE_HISTORY`, `PING`, `ERROR`. The full `ClientPacket`/`ServerPacket` unions
are now exhaustively handled, so the `default` case in `data.ts` casts `packet`
(typed `never`) to read the runtime `type` string.

**Socket lifecycle / handler dispatch** (`src/handlers/`): `socketHandlers` in
`handlers/index.ts` wires Bun's socket callbacks (`open`, `data`, `close`,
`error`, `drain`). The router is `handlers/data.ts` — it JSON-parses each
buffer, enforces that before authentication only `LOGIN`/`CONNECT` are allowed
(otherwise disconnect), then switches to per-type handlers (`login.ts`,
`connect.ts`, `chat.ts`). To add a protocol message: define the packet type in
`types.ts`, add a handler file, and add a `case` in `data.ts`.

**Per-connection state** lives on `socket.data` (typed `SocketData`),
initialized in `open.ts` with a generated UUID and rate-limit counters.
Authentication is a two-step challenge-response: the client sends `LOGIN`,
`login.ts` issues a one-time `nonce` (stored on `socket.data.nonce`) via an
`AUTHENTICATE` reply, then the client sends `CONNECT` whose `token` must equal
`sha256(name + AUTH_TOKEN + nonce)` (hex). `connect.ts` recomputes and compares
the hash, consuming the nonce (set back to `null`) on use. A successful `CONNECT`
sets `socket.data.name`; the presence of `name` is what marks a socket as
authenticated throughout the code. The
`disconnecting` flag is set whenever the *server* intentionally ends a socket
(DISCONNECT handler, heartbeat timeout, shutdown); the `close` handler uses it to
warn when an authenticated client closes its own TCP connection cleanly without
having sent a `DISCONNECT` packet (a client-side protocol violation). Any code
that calls `socket.end()` on a live, named client should set this flag first to
avoid a false warning.

**Global state** (`src/state.ts`): `ConnectedClients` is a `Map<uuid, socket>`
(the authoritative roster) and `MessageHistory` is an in-memory bounded array.
**All state is in-memory and lost on restart** — there is no persistence.

**Shared helpers** (`src/utils.ts`): `send` (one client), `broadcast` (all
clients), `systemMessage` (broadcast + record in history), `pushHistory`
(bounded append), `checkRateLimit` (sliding window + cooldown, mutates
`socket.data.rateLimit`), and `startHeartbeat` (returns a `setInterval` handle).

**Heartbeat** (`startHeartbeat` in `utils.ts`, started in `index.ts`): every
`HEARTBEAT_INTERVAL` it `PING`s each client in `ConnectedClients` and sets
`socket.data.awaitingPong`. A client's `PONG` (`handlers/pong.ts`) clears the
flag; if the flag is still set when the next round fires, the socket is `end()`ed
as a dead connection. The interval is cleared on shutdown.

**Logging** (`src/logger.ts`): use the default-exported `Log` with severity
methods (`Log.info`, `Log.warning`, `Log.fatal`, etc.) rather than `console.log`
directly. Note: severity levels are defined but **not filtered** — every call
prints regardless of level.

## Gotchas

- `data.ts` assumes each TCP `data` event contains exactly one complete JSON
  packet. There is **no buffering/reframing**, so coalesced or split TCP
  segments will break parsing — keep this in mind before relying on multi-packet
  batching.
- `connect.ts` reserves any name containing "system" (case-insensitive) and
  enforces uniqueness against `ConnectedClients`.
- Several broadcasts in `connect.ts` are deferred with `setTimeout(..., 500)`;
  ordering of `HELLO` vs. `CONNECTED_USERS`/history is intentional.