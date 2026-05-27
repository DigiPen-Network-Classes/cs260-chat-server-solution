import { data  } from './data';
import { open  } from './open';
import { close } from './close';
import { error } from './error';

import Log from '../logger';

export const socketHandlers = { data, open, close, drain() {}, error };