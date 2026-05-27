import type { ChatPacket, SocketData, Message } from "../types";
import Log from "../logger";
import { broadcast, checkRateLimit, pushHistory, send } from "../utils";
import { MessageHistory, MAX_MESSAGE_LENGTH, MAX_HISTORY_LENGTH } from "../state";

export const chat = (socket: Bun.Socket<SocketData>, packet: ChatPacket) => {
    if (!checkRateLimit(socket)) return;

    if (!packet.content || packet.content.trim().length === 0) return;

    if (packet.content.length > MAX_MESSAGE_LENGTH) {
        Log.warning(`${socket.data.name} sent oversized message (${packet.content.length}/${MAX_MESSAGE_LENGTH})`);
        send(socket, { type: "ERROR", reason: `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters` });
        return;
    }

    const newMessage: Message = {
        content: packet.content,
        user: socket.data.name || "",
        timestamp: Date.now()
    };

    pushHistory(newMessage);
    
    Log.info(`${socket.data.name}: ${packet.content}`);
    broadcast({ type: "MESSAGE", ...newMessage });
}