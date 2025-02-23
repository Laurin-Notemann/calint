import pino, { Logger } from "pino";

const defaultLogger = pino({
  level: process.env.LOG_LEVEL || "info",
});

export const createLogger = (name: string): Logger => {
  return defaultLogger.child({ module: name });
};

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

export const logMessage = (
  logger: Logger,
  level: LogLevel,
  message: string,
  context?: object,
) => {
  const logObj = {
    message,
    ...context,
  };
  logger[level](logObj);
};

type Operation<T> = (...args: any[]) => Promise<T>;

export const ERROR_MESSAGES = {
  DB_OPERATION_ERROR: "Database error occurred during operation.",
  USER_NOT_FOUND: "User not found.",
  USER_CREATION_FAILED: "Failed to create user.",
  COMPANY_NOT_FOUND: "Company not found.",
  TOO_MANY_COMPANIES_FOUND: "Too many companies found.",
  COMPANY_CREATION_ERROR: "Error occurred while creating company.",
  EVENT_TYPE_NOT_FOUND: "EventType not found.",
  ALL_EVENT_TYPES_EXIST: "All event types already exist.",
  EVENT_TYPES_ADDED_SUCCESS: "Successfully added new event types.",
  ALL_ACTIVITY_TYPES_EXIST: "All activity types already exist.",
  ACTIVITY_TYPES_ADDED_SUCCESS: "Successfully added new activity types.",
  ACCOUNT_NOT_FOUND: "Account not found.",
  ACCOUNT_CREATION_FAILED: "Failed to create account.",
  LOGIN_FAILED: "Login failed.",
  MISSING_REQUIRED_FIELDS: "Missing required fields.",
  TYPE_MAPPING_CREATION_FAILED: "Failed to create type mapping.",
  TYPE_MAPPING_UPDATE_FAILED: "Failed to update type mapping.",
  CALENDLY_EVENT_UPDATE_FAILED: "Failed to update calendly event.",
  CALENDLY_EVENT_NOT_FOUND: "Calendly Event not found.",
  CALENDLY_EVENT_TOO_MANY_FOUND: "Too many calendly events found.",
  PIPEDRIVE_ACTIVITY_UPDATE_FAILED: "Failed to update pipedrive activity.",
  PIPEDRIVE_ACTIVITY_CREATION_FAILED: "Failed to pipedrive activity in DB.",
  CALENDLY_EVENT_CREATION_FAILED: "Failed to calendly event in DB.",
  PIPEDRIVE_PERSON_CREATION_FAILED: "Failed to pipedrive person in DB.",
  PIPEDRIVE_PERSON_NOT_FOUND: "Pipedrive person not found.",
  PIPEDRIVE_DEAL_CREATION_FAILED: "Failed to pipedrive person in DB.",
  PIPEDRIVE_DEAL_NOT_FOUND: "Pipedrive deal not found.",
  PIPEDRIVE_ACTIVITY_TYPE_NOT_FOUND: "Pipedrive activity type not found.",
  PIPEDRIVE_ACTIVITY_NOT_FOUND: "Pipedrive activity not found.",
  PIPEDRIVE_ACTIVITY_TOO_MANY_FOUND: "Too many pipdrive activities found.",
  PIPEDRIVE_PERSON_TOO_MANY_FOUND: "Too many pipdrive people found.",
  COMPANY_UPDATE_FAILED: "Failed to update company.",
  INVALID_EXPIRATION_DATE: "Invalid expiration date.",
  CALENDLY_TOKEN_REFRESH_FAILED: "Failed to refresh Calendly access token.",
  CALENDLY_API_REQUEST_FAILED: "Calendly API request failed.",
  CALENDLY_WEBHOOK_CREATION_FAILED:
    "Failed to create Calendly webhook subscription.",
  CALENDLY_USER_INFO_FETCH_FAILED: "Failed to fetch Calendly user information.",
  CALENDLY_EVENT_TYPES_FETCH_FAILED: "Failed to fetch Calendly event types.",
  CALENDLY_ORGANIZATION_MEMBERSHIPS_FETCH_FAILED:
    "Failed to fetch Calendly organization memberships.",

  CLIENT_NOT_INITIALIZED:
    "Calendly client not initialized (call setCalendlyClient first).",
  EVENT_TYPE_NAME_REQUIRED: "Event type name and slug are required.",
  MISSING_USER_OR_PROFILE_INFO:
    "Either calUserUri and calUsername or eventType.profile must be provided.",
  CALENDLY_API_ERROR: "Error occurred while communicating with Calendly API.",
  EVENT_TYPE_MAPPING_ERROR:
    "Error occurred while mapping event type to database format.",
  EVENT_TYPE_SAVE_ERROR: "Error occurred while saving event types to database.",
  USER_RETRIEVAL_ERROR: "Error occurred while retrieving Calendly users.",
  SHARED_EVENT_TYPES_ERROR: "Error occurred while finding shared event types.",
  TYPE_MAPPING_NOT_FOUND: "No type mapping found for pipedrive activity.",
  NO_CREATE_MAPPING_FOUND: "No create mapping found for the event type.",
  NO_NO_SHOW_MAPPING_FOUND: "No noshow mapping found for the activity.",
  NO_CANCELLED_MAPPING_FOUND: "No cancelled mapping found for the event type.",
  NO_RESCHEDULED_MAPPING_FOUND:
    "No rescheduled mapping found for the event type.",
  WEBHOOK_NO_FUNCTION_TRIGGERED: "Webhook did not trigger any functions.",
  DB_USER_GL_NOT_SET: "DBUserGl not set.",
  UNEXPECTED_ERROR: "An unexpected error occurred.",
  CONFIG_NOT_SET: "Configuration not set.",
};

type ErrorCode = keyof typeof ERROR_MESSAGES;

export class CalIntError extends Error {
  public readonly code: ErrorCode;
  public readonly isPlanned: boolean;
  public readonly context?: Record<string, any>;

  constructor(
    message: string,
    code: ErrorCode,
    isPlanned: boolean = false,
    context?: Record<string, any>,
  ) {
    super(message);
    this.name = "CalIntError";
    this.code = code;
    this.isPlanned = isPlanned;
    this.context = context;

    Object.setPrototypeOf(this, CalIntError.prototype);
  }
}

export type PromiseReturn<T> = Promise<
  Readonly<[CalIntError, null] | [null, T]>
>;

type LogType = "db" | "api" | "general";

interface LogContext {
  operation: string;
  service?: string;
  method?: string;
  endpoint?: string;
  duration?: number;
  status?: number;
  statusText?: string;
  response?: unknown;
  args: any[];
}

const createLogContext = (
  logType: LogType,
  operationName: string,
  args: any[],
  extraContext?: Partial<LogContext>,
): LogContext => {
  const baseContext: LogContext = {
    operation: operationName,
    args,
  };

  if (logType === "api") {
    return {
      ...baseContext,
      service: extraContext?.service,
      method: extraContext?.method,
      endpoint: extraContext?.endpoint,
      duration: extraContext?.duration,
      status: extraContext?.status,
      statusText: extraContext?.statusText,
      response: extraContext?.response,
    };
  }

  return baseContext;
};

export const withLogging = async <T>(
  logger: Logger,
  logLevel: LogLevel,
  operation: Operation<T>,
  operationName: string,
  logType: LogType,
  extraContext?: Partial<LogContext>,
  ...args: any[]
): PromiseReturn<T> => {
  const startTime = Date.now();
  const logContext = createLogContext(
    logType,
    operationName,
    args,
    extraContext,
  );

  try {
    logMessage(logger, logLevel, `Starting ${operationName}`, {
      type: `${logType}_operation`,
      ...logContext,
    });

    const result = await operation(...args);

    const duration = Date.now() - startTime;
    logMessage(logger, logLevel, `Successfully completed ${operationName}`, {
      type: `${logType}_operation`,
      ...logContext,
      duration,
      result,
    });

    return [null, result];
  } catch (error: unknown) {
    const duration = Date.now() - startTime;

    if (error instanceof CalIntError) {
      const logLevel = error.isPlanned ? "info" : "error";

      logMessage(logger, logLevel, `Error in ${operationName}`, {
        type: `${logType}_error`,
        ...logContext,
        duration,
        errorCode: error.code,
        errorMessage: error.message,
        isPlanned: error.isPlanned,
        context: error.context,
      });

      return [error, null];
    } else {
      const unexpectedError = new CalIntError(
        error instanceof Error ? error.message : String(error),
        "UNEXPECTED_ERROR",
      );

      logMessage(logger, "error", `Unexpected error in ${operationName}`, {
        type: `${logType}_error`,
        ...logContext,
        duration,
        errorCode: unexpectedError.code,
        errorMessage: unexpectedError.message,
        isPlanned: unexpectedError.isPlanned,
        context: unexpectedError.context,
      });

      return [unexpectedError, null];
    }
  }
};

export default createLogger;
