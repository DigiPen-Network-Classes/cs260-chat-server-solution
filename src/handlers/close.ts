import type { SocketData } from "../types";
import { ConnectedClients, MessageHistory } from "../state";
import { type Message } from "../types";
import { broadcast, systemMessage } from "../utils";
import Log from "../logger";

export const close = (socket: Bun.Socket<SocketData>, error: Error | undefined) => {
    ConnectedClients.delete(socket.data.uuid);

    if (error) Log.error(`${socket.data.name ?? socket.remoteAddress} disconnected with error: ${error.message}`);
    else Log.warning(`${socket.data.name ?? socket.remoteAddress} disconnected - ${ConnectedClients.size} client(s) online`);

    if (socket.data.name) {
        systemMessage(`${socket.data.name} has left`)
        broadcast({ type: "CONNECTED_USERS", users: [ ...ConnectedClients.values() ].map((client) => { return client.data.name || "ERROR_NAME" }) });
    }
}