# Chat Server

A TCP chat server built on the [Bun](https://bun.com) runtime. Clients connect
over a raw TCP socket and exchange newline-terminated JSON messages.

## Running

```bash
bun install
cp .env.example .env   # set AUTH_TOKEN, PORT, HTTP_PORT
bun run start
```

A health-check endpoint is served separately at `GET http://<host>:<HTTP_PORT>/health` → `200 OK`.
Note that as of now there are no other HTTP endpoints.

## Protocol

This section is for anyone implementing their own client.

### Framing

- **Transport:** raw TCP.
- **Encoding:** UTF-8 JSON, **one packet per message, terminated with a newline (`\n`)**.
- The server appends `\n` to every packet it sends. Clients should send one
  complete JSON object followed by `\n`, and should split incoming data on `\n`
  to separate packets.
- Every packet is an object with a `"type"` field that identifies it.

### Connection flow

1. Client opens a TCP connection.
2. The **first packet must be `LOGIN`**. Sending anything other than `LOGIN` or
   `CONNECT` before authenticating results in an `ERROR` (`"Not authenticated"`)
   and the connection is closed.
3. The server replies with `AUTHENTICATE`, which carries a one-time `nonce`
   generated for that connection.
4. The client sends `CONNECT` with `token` set to
   `sha256(name + AUTH_TOKEN + nonce)` (hex). The server recomputes the hash; if
   it matches, the client is authenticated.
5. On a successful `CONNECT`, the server immediately replies with `HELLO`. Shortly
   after (~500 ms) it broadcasts an updated `CONNECTED_USERS` list and a `SYSTEM`
   join notice to everyone, and sends the new client the `MESSAGE_HISTORY`.
6. The client may then send `CHAT` packets, which are broadcast to all clients as
   `MESSAGE` packets.
7. When a client disconnects, the server broadcasts a `SYSTEM` leave notice and an
   updated `CONNECTED_USERS` list.

```
Client                          Server
  |  ── LOGIN ────────────────▶  |
  |  ◀──────── AUTHENTICATE ───  |  (carries nonce)
  |  ── CONNECT ──────────────▶  |  (token = sha256(name + secret + nonce))
  |  ◀────────────── HELLO ────  |
  |  ◀──── CONNECTED_USERS ────  |  (broadcast, ~500ms later)
  |  ◀──────────── SYSTEM ─────  |  ("<name> has joined")
  |  ◀──── MESSAGE_HISTORY ────  |
  |  ── CHAT ─────────────────▶  |
  |  ◀─────────── MESSAGE ─────  |  (broadcast to all)
```

### Client → Server packets

#### `LOGIN`
Begin the authentication handshake. Must be the first packet sent. The server
replies with `AUTHENTICATE` (which carries a `nonce`).

```json
{ "type": "LOGIN" }
```

#### `CONNECT`
Complete authentication and join. Sent after receiving an `AUTHENTICATE` nonce.

```json
{ "type": "CONNECT", "name": "alice", "token": "<hex sha256 digest>" }
```

| Field   | Type   | Rules |
|---------|--------|-------|
| `name`  | string | Trimmed; non-empty; ≤ `MAX_NAME_LENGTH` (default 32); must be unique among connected clients; may not contain `"system"` (case-insensitive). |
| `token` | string | The hex SHA-256 digest of `name + AUTH_TOKEN + nonce`, where `name` is the (trimmed) name above, `AUTH_TOKEN` is the shared secret, and `nonce` is the value from the preceding `AUTHENTICATE`. Requires a prior `LOGIN`. |

Any rule violation returns an `ERROR` and closes the connection.

#### `CHAT`
Send a chat message (only valid after a successful `CONNECT`).

```json
{ "type": "CHAT", "content": "hello world" }
```

| Field     | Type   | Rules |
|-----------|--------|-------|
| `content` | string | Ignored silently if empty/whitespace; must be ≤ `MAX_MESSAGE_LENGTH` (default 500). Subject to rate limiting. |

On success the message is broadcast to all clients as a `MESSAGE` packet (the
sender included). It does **not** receive a separate acknowledgement.

#### `PONG`
Reply to a server `PING` (see [Heartbeat](#heartbeat)). Only valid after a
successful `CONNECT`.

```json
{ "type": "PONG" }
```

#### `DISCONNECT`
Leave the chat gracefully. The server closes the connection; other clients
receive a `SYSTEM` leave notice and an updated `CONNECTED_USERS` list. Only valid
after a successful `CONNECT`.

```json
{ "type": "DISCONNECT" }
```

A well-behaved client **should send `DISCONNECT` before closing its socket.**
Closing the TCP connection directly still works, but the server logs a warning
that the client is not implementing the protocol correctly.

### Server → Client packets

#### `AUTHENTICATE`
Sent in response to `LOGIN`. Carries a one-time `nonce` (unique per connection)
that the client folds into its `CONNECT` token.
```json
{ "type": "AUTHENTICATE", "nonce": "0190f3a2-..." }
```

#### `HELLO`
Sent once, immediately after a successful `CONNECT`.
```json
{ "type": "HELLO" }
```

#### `CONNECTED_USERS`
The current roster of connected user names. Broadcast whenever someone joins or leaves.
```json
{ "type": "CONNECTED_USERS", "users": ["alice", "bob"] }
```

#### `MESSAGE`
A chat message from another user (or yourself), broadcast to everyone.
```json
{ "type": "MESSAGE", "content": "hello world", "user": "alice", "timestamp": 1718136000000 }
```
`timestamp` is Unix epoch milliseconds.

#### `SYSTEM`
A server-generated notice (joins, leaves, shutdown).
```json
{ "type": "SYSTEM", "content": "alice has joined", "timestamp": 1718136000000 }
```

#### `MESSAGE_HISTORY`
Recent message history, sent to a client right after it joins. Bounded to
`MAX_HISTORY_LENGTH` (default 50) entries. `SYSTEM` notices appear here with
`user` set to `"SYSTEM"`.
```json
{
  "type": "MESSAGE_HISTORY",
  "messages": [
    { "content": "hello", "user": "bob", "timestamp": 1718135990000 },
    { "content": "alice has joined", "user": "SYSTEM", "timestamp": 1718136000000 }
  ]
}
```

#### `PING`
A heartbeat probe. The client must reply with a `PONG` packet (see [Heartbeat](#heartbeat)).
```json
{ "type": "PING" }
```

#### `ERROR`
An error occurred. Depending on the cause, the connection may be closed (see below).
```json
{ "type": "ERROR", "reason": "Invalid token" }
```

### Error reasons

| `reason`                          | Cause                                              | Connection closed? |
|-----------------------------------|----------------------------------------------------|:------------------:|
| `Malformed JSON`                  | Packet was not valid JSON                           | Yes |
| `Not authenticated`               | Sent a packet other than `LOGIN`/`CONNECT` before joining | Yes |
| `Missing token or name`           | `CONNECT` missing `name` or `token`                 | Yes |
| `Must LOGIN before CONNECT`       | `CONNECT` sent without a prior `LOGIN` (no nonce issued) | Yes |
| `Name cannot be empty`            | Empty/whitespace name                               | Yes |
| `Name cannot exceed N characters` | Name longer than `MAX_NAME_LENGTH`                  | Yes |
| `Invalid token`                   | `token` did not match `AUTH_TOKEN`                  | Yes |
| `Name already taken`              | Name in use or contains `"system"`                  | Yes |
| `Message cannot exceed N characters` | `CHAT` content over `MAX_MESSAGE_LENGTH`         | No |
| `Rate limited - please wait N seconds before trying again` | Exceeded the rate limit       | No |
| `Unknown packet type: "X"`        | Unrecognized `type`                                 | No |

### Rate limiting

Each client may send up to `RATE_LIMIT_MAX` (default 20) `CHAT` messages per
`RATE_LIMIT_WINDOW` (default 10s). Exceeding the limit triggers a cooldown of
`RATE_LIMIT_COOLDOWN` (default 5s) during which `CHAT` packets are rejected with
an `ERROR`. All limits are configurable via environment variables (see `.env.example`).

### Heartbeat

Every `HEARTBEAT_INTERVAL` (default 30s) the server sends a `PING` to each
connected client. The client **must** reply with a `PONG`. If a client has not
sent a `PONG` by the time the next `PING` round fires, the server considers the
connection dead and closes it. A client therefore has up to one full interval to
respond.