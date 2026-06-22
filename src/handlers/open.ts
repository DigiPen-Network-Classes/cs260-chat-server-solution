import Bun, { randomUUIDv7 } from 'bun';
import { type SocketData } from '../types';
import Log from '../logger';

export const open = (socket: Bun.Socket<SocketData>) => {
    socket.data = {
        uuid: randomUUIDv7(),
        name: null,
        nonce: null,
        awaitingPong: false,
        disconnecting: false,
        rateLimit: {
            count:       0,
            windowStart: Date.now(),
            cooldown:    false,
        }
    }

    Log.debug(`New TCP connection from ${socket.remoteAddress}`);
}