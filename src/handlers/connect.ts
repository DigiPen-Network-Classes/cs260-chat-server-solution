import Log from "../logger";
import type { ConnectPacket, Message, SocketData } from "../types";
import { send, broadcast, systemMessage } from "../utils";
import { MAX_NAME_LENGTH, MessageHistory } from "../state";
import { ConnectedClients } from "../state";

const AUTH_TOKEN = process.env.AUTH_TOKEN || "";

export const connect = (socket: Bun.Socket<SocketData>, packet: ConnectPacket) => {
    if (!packet.token || !packet.name) {
        Log.warning(`${socket.remoteAddress} sent incomplete CONNECT packet`);
        send(socket, { type: "ERROR", reason: "Missing token or name" });
        socket.end();
        return;
    }

    packet.name = packet.name.trim();

    // check if the name is valid
    if (!packet.name || packet.name.trim().length === 0) {
        Log.warning(`${socket.remoteAddress} rejected - empty name`);
        send(socket, { type: "ERROR", reason: "Name cannot be empty" });
        socket.end();
        return;
    }

    if (packet.name.length > MAX_NAME_LENGTH) {
        Log.warning(`${socket.remoteAddress} rejected - name too long (${packet.name.length}/${MAX_NAME_LENGTH})`);
        send(socket, { type: "ERROR", reason: `Name cannot exceed ${MAX_NAME_LENGTH} characters` });
        socket.end();
        return;
    }

    // check token
    if (packet.token !== AUTH_TOKEN) {
        Log.warning(`${socket.remoteAddress} failed auth - invalid token`);
        send(socket, { type: "ERROR", reason: "Invalid token" });
        socket.end();
        return;
    }

    // check if name is unique
    const nameIsTaken = [ ...ConnectedClients.values() ].some(client => { return client.data.name === packet.name });
    if (nameIsTaken || packet.name.toLowerCase().includes("system")) {
        Log.warning(`${socket.remoteAddress} failed auth - name "${packet.name}" already taken`);
        send(socket, { type: "ERROR", reason: "Name already taken" });
        socket.end();
        return;
    }

    // success
    socket.data.name = packet.name;
    ConnectedClients.set(socket.data.uuid, socket);

    Log.success(`${packet.name} connected (${socket.remoteAddress}) - ${ConnectedClients.size} client(s) online`);

    send(socket, { type: "HELLO" });
    setTimeout(() => {
        broadcast({ type: "CONNECTED_USERS", users: [ ...ConnectedClients.values() ].map((client) => { return client.data.name || "ERROR_NAME" }) });
        systemMessage(`${socket.data.name} has joined`);
        send(socket, { type: "MESSAGE_HISTORY", messages: MessageHistory });
    }, 500)
}