import type { SocketData } from "../types";
import Log from "../logger";

export const pong = (socket: Bun.Socket<SocketData>) => {
    socket.data.awaitingPong = false;
    Log.debug(`♥ PONG from ${socket.data.name}`);
}