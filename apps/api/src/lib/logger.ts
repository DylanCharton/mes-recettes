import pino from 'pino';

export type Logger = pino.Logger;

export function createLogger(options: { level: string; pretty: boolean }): Logger {
  return pino({
    level: options.level,
    ...(options.pretty && {
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname', singleLine: true },
      },
    }),
  });
}
