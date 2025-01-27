import pino from 'pino';

const defaultLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'UTC:yyyy-mm-dd HH:MM:ss.l o',
    },
  },
});

export const createLogger = (name: string) => {
  return defaultLogger.child({ module: name });
};

export const logError = (logger: pino.Logger, error: any, context?: object) => {
  const errorObj = {
    message: error.message || 'Unknown error',
    stack: error.stack,
    ...context,
  };
  logger.error(errorObj);
};

export const logAPICall = (logger: pino.Logger, {
  service,
  method,
  endpoint,
  duration,
  status,
  statusText,
  response,
}: {
  service: string;
  method: string;
  endpoint: string;
  duration?: number;
  status?: number;
  statusText?: string;
  response?: unknown;
}) => {
  logger.info({
    type: 'api_call',
    service,
    method,
    endpoint,
    duration,
    status,
    statusText,
    response,
  });
};

export default createLogger; 