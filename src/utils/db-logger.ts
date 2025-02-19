import { createLogger, logError } from "./logger";

export const dbLogger = createLogger("database");

export const logDBError = (operation: string, error: any, context?: object) => {
  logError(dbLogger, error, {
    type: "database_error",
    operation,
    ...context,
  });
};

export const logDBOperation = (operation: string, details?: object) => {
  dbLogger.info({
    type: "database_operation",
    operation,
    ...details,
  });
};
