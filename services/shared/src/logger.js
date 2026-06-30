import pino from 'pino';
import { config } from './config.js';

export function createLogger(name) {
  return pino({
    name,
    level: config.logLevel,
    base: { service: name },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export default createLogger;
