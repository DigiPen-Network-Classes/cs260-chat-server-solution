export type SocketData = {
    uuid: string;
    name: string | null;
    nonce: string | null;    // per-connection challenge issued by AUTHENTICATE, consumed by CONNECT
    awaitingPong: boolean;
    disconnecting: boolean;  // set when the *server* intentionally ends the socket
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
export interface LoginPacket extends BasePacket {
    type: "LOGIN";
}

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
interface AuthenticatePacket extends BasePacket {
    type: "AUTHENTICATE";
    nonce: string;
}

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
export type ClientPacket = LoginPacket | ConnectPacket | ChatPacket | DisconnectPacket | PongPacket;
export type ServerPacket = AuthenticatePacket | HelloPacket | ConnectedUsersPacket | MessagePacket | SystemPacket | ErrorPacket | PingPacket | MessageHistoryPacket;

export interface Message {
    content: string;
    user: string;
    timestamp: number;
}