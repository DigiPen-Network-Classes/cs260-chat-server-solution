import Log from "../logger";
import { ConnectedClients } from "../state";
import type { SocketData } from "../types";
import { broadcast } from "../utils";

export const error = (socket: Bun.Socket<SocketData>, error: Error) => {
    Log.error(`Socket error from ${socket.data.name ?? socket.remoteAddress}: ${error.message}`);
    ConnectedClients.delete(socket.data.uuid);
    broadcast({ type: "CONNECTED_USERS", users: [...ConnectedClients.values()].map(c => c.data.name || "ERROR_NAME") });
}