import pino from "pino";

const defaultLogger = pino({
  level: process.env.LOG_LEVEL || "info",
});

export const createLogger = (name: string) => {
  return defaultLogger.child({ module: name });
};

export const logError = (logger: pino.Logger, error: any, context?: object) => {
  const errorObj = {
    message: error.message || "Unknown error",
    stack: error.stack,
    ...context,
  };
  logger.error(errorObj);
};

export function logElapsedTime(
  logger: pino.Logger,
  startTime: number,
  operation: string,
) {
  const elapsedTime = Date.now() - startTime;
  logger.warn(
    { type: "performance", operation, duration: elapsedTime },
    `${operation} took ${elapsedTime}ms`,
  );
}

export const logAPICall = (
  logger: pino.Logger,
  {
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
  },
) => {
  logger.info({
    type: "api_call",
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
