import { createLogger, format, transports } from 'winston';

const consoleFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'DD-MM-YYYY HH:mm:ss' }),
  format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [${level}]: ${message}`;
  })
);

const fileFormat = format.combine(format.timestamp(), format.json());

const logger = createLogger({
  level: 'info',
  transports: [
    new transports.Console({
      format: consoleFormat,
    }),
    new transports.File({
      filename: 'logs/error.log',
      level: 'error',
      format: fileFormat,
    }),
    new transports.File({
      filename: 'logs/combined.log',
      format: fileFormat,
    }),
  ],
});

export default logger;
