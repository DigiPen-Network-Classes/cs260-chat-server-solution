import type { SocketData } from "../types";
import Log from "../logger";

export const disconnect = (socket: Bun.Socket<SocketData>) => {
    Log.debug(`${socket.data.name ?? socket.remoteAddress} requested disconnect`);

    // close gracefully; the `close` handler broadcasts the leave notice + roster
    socket.data.disconnecting = true;
    socket.end();
}