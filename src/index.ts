import Log from './logger';
import { socketHandlers } from './handlers';
import type { SocketData } from './types';
import { broadcast, startHeartbeat } from './utils';
import { ConnectedClients, HEARTBEAT_INTERVAL, MessageHistory } from './state';

const AUTH_TOKEN = process.env.AUTH_TOKEN;
const PORT       = process.env.PORT;
const HTTP_PORT  = process.env.HTTP_PORT;

if (!AUTH_TOKEN) {
    Log.fatal("AUTH_TOKEN is not set");
    process.exit(1);
}

if (!PORT || isNaN(Number(PORT))) {
    Log.fatal("PORT is not set or is not a number");
    process.exit(1);
}

if (!HTTP_PORT || isNaN(Number(HTTP_PORT))) {
    Log.fatal("HTTP_PORT is not set or is not a number");
    process.exit(1);
}

// TCP Server
Bun.listen<SocketData>({
    hostname: "0.0.0.0",
    port: Number(PORT),
    socket: socketHandlers
});

// http server (health check)
Bun.serve({
    port: Number(HTTP_PORT),
    fetch(req) {
        const url  = new URL(req.url);

        if (url.pathname === "/health") {
            return new Response("OK", { status: 200 });
        }

        return new Response("Not Found", { status: 404 });
    }
});

const heartbeat = startHeartbeat();

const shutdown = (signal: string) => {
    Log.warning(`Received ${signal}, shutting down...`);

    clearInterval(heartbeat);

    broadcast({ type: "SYSTEM", content: "Server is shutting down", timestamp: Date.now() });

    for (const [, socket] of ConnectedClients) {
        socket.data.disconnecting = true;
        socket.end();
    }

    Log.info("All clients disconnected, exiting");
    setTimeout(() => process.exit(0), 500);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

Log.info(`TCP:  Listening on port ${PORT}`);
Log.info(`HTTP: Listening on port ${HTTP_PORT}`);
Log.info(`Heartbeat: PING every ${HEARTBEAT_INTERVAL}s`);