import { type Message, type SocketData } from './types';

// message limits
export const MAX_NAME_LENGTH    = Number(process.env.MAX_NAME_LENGTH)    || 32;
export const MAX_MESSAGE_LENGTH = Number(process.env.MAX_MESSAGE_LENGTH) || 500;
export const MAX_HISTORY_LENGTH = Number(process.env.MAX_HISTORY_LENGTH) || 50;

// rate limiting
export const RATE_LIMIT_MAX      = Number(process.env.RATE_LIMIT_MAX) || 20;  // messages
export const RATE_LIMIT_WINDOW   = Number(process.env.RATE_LIMIT_WINDOW) || 10;  // seconds
export const RATE_LIMIT_COOLDOWN = Number(process.env.RATE_LIMIT_COOLDOWN) || 5;   // seconds penalty

// heartbeat: PING each client every interval; disconnect if no PONG since the last one
export const HEARTBEAT_INTERVAL = Number(process.env.HEARTBEAT_INTERVAL) || 30;  // seconds

// UUID -> Socket map
export const ConnectedClients = new Map<string, Bun.Socket<SocketData>>();

// In memory message history
export const MessageHistory = new Array<Message>();