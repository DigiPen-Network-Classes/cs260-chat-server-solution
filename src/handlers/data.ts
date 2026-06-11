import type { SocketData, ClientPacket } from '../types';
import { connect } from './connect';
import Log from '../logger';
import { chat } from './chat';
import { pong } from './pong';
import { send } from '../utils';

export const data = (socket: Bun.Socket<SocketData>, data: Buffer<ArrayBufferLike>) => {
    // Incoming message
    let packet: ClientPacket;

    // json parse (safe)
    try {
        packet = JSON.parse(data.toString()) as ClientPacket;
    } catch {
        Log.warning(`${socket.remoteAddress} sent malformed JSON - disconnecting`);
        send(socket, { type: "ERROR", reason: "Malformed JSON" });
        socket.end();
        return;
    }

    Log.debug(`← ${socket.remoteAddress} ${data.toString()}`);

    if (packet.type !== "CONNECT" && !socket.data.name) {
        Log.warning(`${socket.remoteAddress} sent ${packet.type} before authenticating - disconnecting`);
        send(socket, { type: "ERROR", reason: "Not authenticated" });
        socket.end();
        return;
    }

    switch (packet.type) {
        case "CONNECT": connect(socket, packet); break;
        case "CHAT":    chat(socket, packet); break;
        case "PONG":    pong(socket); break;
        default:
            Log.warning(`${socket.remoteAddress} sent unknown packet type: "${packet.type}"`);
            send(socket, { type: "ERROR", reason: `Unknown packet type: "${packet.type}"` });
            break;
    }
}