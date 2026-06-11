import type { SocketData } from "../types";
import { ConnectedClients, MessageHistory } from "../state";
import { type Message } from "../types";
import { broadcast, systemMessage } from "../utils";
import Log from "../logger";

export const close = (socket: Bun.Socket<SocketData>, error: Error | undefined) => {
    ConnectedClients.delete(socket.data.uuid);

    if (error) Log.error(`${socket.data.name ?? socket.remoteAddress} disconnected with error: ${error.message}`);
    else Log.warning(`${socket.data.name ?? socket.remoteAddress} disconnected - ${ConnectedClients.size} client(s) online`);

    // an authenticated client that closed its own connection (clean FIN, not server-initiated)
    // without first sending a DISCONNECT packet is not following the protocol
    if (socket.data.name && !socket.data.disconnecting && !error) {
        Log.warning(`${socket.data.name} closed the connection without sending DISCONNECT - client is not implementing the protocol correctly`);
    }

    if (socket.data.name) {
        systemMessage(`${socket.data.name} has left`)
        broadcast({ type: "CONNECTED_USERS", users: [ ...ConnectedClients.values() ].map((client) => { return client.data.name || "ERROR_NAME" }) });
    }
}