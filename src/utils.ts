import { type SocketData, type ServerPacket, type Message } from './types';
import { ConnectedClients, HEARTBEAT_INTERVAL, MAX_HISTORY_LENGTH, MessageHistory, RATE_LIMIT_COOLDOWN, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW } from './state';
import Log from './logger';

// send a packet to a specific client
export const send = (socket: Bun.Socket<SocketData>, packet: ServerPacket) => {
    const stringifiedPacket = JSON.stringify(packet);

    if (stringifiedPacket.length >= 200) {
        Log.debug(`→ ${socket.remoteAddress} ${JSON.stringify(packet).substring(0, 200)}...`);
    } else {
        Log.debug(`→ ${socket.remoteAddress} ${JSON.stringify(packet)}`);
    }

    socket.write(stringifiedPacket + "\n");
}

// send a packet to every connected client
export const broadcast = (packet: ServerPacket) => {
    for (const [, socket] of ConnectedClients) {
        send(socket, packet);
    }
}

// ratelimiter
export const checkRateLimit = (socket: Bun.Socket<SocketData>): boolean => {
    const ratelimit = socket.data.rateLimit;
    const now = Date.now();

    if (ratelimit.cooldown) {
        if (now - ratelimit.windowStart >= RATE_LIMIT_COOLDOWN * 1000) {
            ratelimit.cooldown = false;
            ratelimit.count = 0;
            ratelimit.windowStart = now;
        } else {
            const remaining = Math.ceil((RATE_LIMIT_COOLDOWN * 1000 - (now - ratelimit.windowStart)) / 1000);
            send(socket, { type: "ERROR", reason: `Rate limited - please wait ${remaining} seconds before trying again` });
            return false
        }
    }

    if (now - ratelimit.windowStart >= RATE_LIMIT_WINDOW * 1000) {
        ratelimit.count = 0;
        ratelimit.windowStart = now;
    }

    ratelimit.count++;

    if (ratelimit.count > RATE_LIMIT_MAX) {
        ratelimit.cooldown = true;
        ratelimit.windowStart = now;
        Log.warning(`${socket.data.name} is being rate limited`);
        send(socket, { type: "ERROR", reason: `Rate limited - please wait ${RATE_LIMIT_COOLDOWN} seconds before trying again` });
        return false;
    }

    return true;
}

export const pushHistory = (message: Message) => {
    if (MessageHistory.length >= MAX_HISTORY_LENGTH) MessageHistory.shift();
    MessageHistory.push(message);
}

// periodically PING every authenticated client; drop any that didn't PONG since the last round
export const startHeartbeat = () => {
    return setInterval(() => {
        for (const [, socket] of ConnectedClients) {
            if (socket.data.awaitingPong) {
                Log.warning(`${socket.data.name} did not respond to PING - disconnecting`);
                socket.end();
                continue;
            }

            socket.data.awaitingPong = true;
            send(socket, { type: "PING" });
        }
    }, HEARTBEAT_INTERVAL * 1000);
}

export const systemMessage = (content: string) => {
    const message: Message = {
        content,
        user:      "SYSTEM",
        timestamp: Date.now()
    };

    pushHistory(message);

    broadcast({ type: "SYSTEM", ...message });
}