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

docker compose up --build   # run via Docker (reads .env)
```

There is **no test suite, linter, or build step** — Bun executes the TypeScript
directly. `tsconfig.json` is configured for type-checking/IDE only
(`noEmit`, bundler resolution).

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
Client→server types currently handled: `CONNECT`, `CHAT`, `PONG`. Server→client:
`HELLO`, `CONNECTED_USERS`, `MESSAGE`, `SYSTEM`, `MESSAGE_HISTORY`, `PING`,
`ERROR` (`DISCONNECT` is defined but not handled).

**Socket lifecycle / handler dispatch** (`src/handlers/`): `socketHandlers` in
`handlers/index.ts` wires Bun's socket callbacks (`open`, `data`, `close`,
`error`, `drain`). The router is `handlers/data.ts` — it JSON-parses each
buffer, enforces that the first packet must be `CONNECT` (otherwise disconnect),
then switches to per-type handlers (`connect.ts`, `chat.ts`). To add a protocol
message: define the packet type in `types.ts`, add a handler file, and add a
`case` in `data.ts`.

**Per-connection state** lives on `socket.data` (typed `SocketData`),
initialized in `open.ts` with a generated UUID and rate-limit counters.
Authentication = a successful `CONNECT` sets `socket.data.name`; the presence of
`name` is what marks a socket as authenticated throughout the code.

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