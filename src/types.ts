export type SocketData = {
    uuid: string;
    name: string | null;
    awaitingPong: boolean;
    rateLimit: {
        count: number;
        windowStart: number;
        cooldown: boolean;
    }
}

interface BasePacket {
    type: string;
}

// Client -> Server
export interface ConnectPacket extends BasePacket {
    type: "CONNECT";
    name: string;
    token: string;
}

export interface ChatPacket extends BasePacket {
    type: "CHAT";
    content: string;
}

interface DisconnectPacket extends BasePacket {
    type: "DISCONNECT";
}

interface PongPacket extends BasePacket {
    type: "PONG";
}

// Server -> Client
interface HelloPacket extends BasePacket {
    type: "HELLO";
}

interface ConnectedUsersPacket extends BasePacket {
    type: "CONNECTED_USERS";
    users: string[];
}

interface MessagePacket extends BasePacket {
    type: "MESSAGE";
    content: string;
    user: string;
    timestamp: number;
}

interface SystemPacket extends BasePacket {
    type: "SYSTEM";
    content: string;
    timestamp: number;
}

interface MessageHistoryPacket extends BasePacket {
    type: "MESSAGE_HISTORY";
    messages: Message[];
}

interface ErrorPacket extends BasePacket {
    type: "ERROR";
    reason: string;
}

interface PingPacket extends BasePacket {
    type: "PING";
}

// Unions
export type ClientPacket = ConnectPacket | ChatPacket | DisconnectPacket | PongPacket;
export type ServerPacket = HelloPacket | ConnectedUsersPacket | MessagePacket | SystemPacket | ErrorPacket | PingPacket | MessageHistoryPacket;

export interface Message {
    content: string;
    user: string;
    timestamp: number;
}