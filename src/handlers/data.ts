import type { SocketData, ClientPacket } from '../types';
import { connect } from './connect';
import Log from '../logger';
import { chat } from './chat';
import { pong } from './pong';
import { disconnect } from './disconnect';
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
        case "CONNECT":    connect(socket, packet); break;
        case "CHAT":       chat(socket, packet); break;
        case "PONG":       pong(socket); break;
        case "DISCONNECT": disconnect(socket); break;
        default:
            // `packet` is `never` here since the union is exhausted, but a client
            // can still send an arbitrary type string at runtime
            const unknownType = (packet as { type: string }).type;
            Log.warning(`${socket.remoteAddress} sent unknown packet type: "${unknownType}"`);
            send(socket, { type: "ERROR", reason: `Unknown packet type: "${unknownType}"` });
            break;
    }
}