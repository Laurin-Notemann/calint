import { createLogger, logError } from "./logger";

const logger = createLogger("database");

export const logDBError = (operation: string, error: any, context?: object) => {
  logError(logger, error, {
    type: "database_error",
    operation,
    ...context,
  });
};

export const logDBOperation = (operation: string, details?: object) => {
  logger.info({
    type: "database_operation",
    operation,
    ...details,
  });
};
