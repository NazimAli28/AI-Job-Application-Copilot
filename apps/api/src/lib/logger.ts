import { pino, type LoggerOptions } from 'pino'

export function createLogger(level: LoggerOptions['level'], pretty: boolean) {
  return pino({
    level,
    // Never log credentials, cookies or tokens.
    redact: {
      paths: [
        'req.headers.cookie',
        'req.headers.authorization',
        'res.headers["set-cookie"]',
        '*.password',
        '*.token',
        '*.passwordHash',
      ],
      censor: '[redacted]',
    },
    transport: pretty ? { target: 'pino-pretty', options: { colorize: true } } : undefined,
  })
}

export type Logger = ReturnType<typeof createLogger>
