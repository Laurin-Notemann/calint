import { eq, inArray, sql } from "drizzle-orm";
import db from "./db";
import {
  calendlyAccs,
  CalEventType,
  calEventTypes,
  companies,
  Company,
  eventActivityTypesMapping,
  NewCalEventType,
  NewCompany,
  NewPipedriveActivityType,
  pipedriveActivityTypes,
  TypeMappingType,
  User,
  UserCalendly,
  users,
} from "./schema";
import { logDBError, logDBOperation } from "@/utils/db-logger";
import { GetCurrentUserResponseAllOfData, TokenResponse } from "pipedrive/v1";

import { ERROR_MESSAGES } from "@/lib/constants";

export type PromiseReturn<T> = Promise<
  Readonly<[CalIntError, null] | [null, T]>
>;

export class DatabaseQueries {
  constructor() {}

  private createError = (
    message: string,
    error: any,
    context?: any,
  ): CalIntError => {
    logDBError(message, error, context);
    return {
      message,
      error,
    };
  };
  private async withErrorHandling<T>(
    operation: DatabaseOperation<T>,
    operationName: string,
    ...args: any[]
  ): PromiseReturn<T> {
    try {
      logDBOperation(operationName, ...args);
      const result = await operation(...args);
      return [null, result] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: operationName,
          ...args,
        }),
        null,
      ] as const;
    }
  }

  async getAllTypeMappings(
    companyId: string,
  ): PromiseReturn<TypeMappingType[]> {
    return this.withErrorHandling(
      async () => {
        return await db
          .select()
          .from(eventActivityTypesMapping)
          .where(eq(eventActivityTypesMapping.companyId, companyId));
      },
      "getAllTypeMappings",
      { companyId },
    );
  }

  async getAllEventTypes(companyId: string): PromiseReturn<CalEventType[]> {
    try {
      logDBOperation("getAllEventTypes", { companyId });
      const res = await db
        .select()
        .from(calEventTypes)
        .where(eq(calEventTypes.companyId, companyId));
      return [null, res] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "getAllEventTypes",
          companyId,
        }),
        null,
      ] as const;
    }
  }

  async addAllEventTypes(
    eventTypes: NewCalEventType[],
  ): PromiseReturn<{ message: string; added: number; skipped?: number }> {
    try {
      logDBOperation("addAllEventTypes", { eventTypes });
      const [checkError, result] =
        await this.checkExistingEventTypes(eventTypes);

      if (checkError) {
        return [checkError, null] as const;
      }

      if (!result.new.length) {
        return [
          null,
          {
            message: ERROR_MESSAGES.ALL_EVENT_TYPES_EXIST,
            added: 0,
          },
        ] as const;
      }

      await db.insert(calEventTypes).values(result.new);

      return [
        null,
        {
          message: ERROR_MESSAGES.EVENT_TYPES_ADDED_SUCCESS,
          added: result.new.length,
          skipped: result.existing.length,
        },
      ] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "addAllEventTypes",
          eventTypes,
        }),
        null,
      ] as const;
    }
  }

  async checkExistingEventTypes(eventTypes: NewCalEventType[]): PromiseReturn<{
    existing: CalEventType[];
    new: NewCalEventType[];
    hasConflicts: boolean;
  }> {
    try {
      logDBOperation("checkExistingEventTypes", { eventTypes });
      const existingTypes = await db
        .select()
        .from(calEventTypes)
        .where(
          inArray(
            calEventTypes.uri,
            eventTypes.map((et) => et.uri),
          ),
        );

      const existingNames = new Set(existingTypes.map((et) => et.name));
      const newEventTypes = eventTypes.filter(
        (et) => !existingNames.has(et.name),
      );

      return [
        null,
        {
          existing: existingTypes,
          new: newEventTypes,
          hasConflicts: existingTypes.length > 0,
        },
      ] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "checkExistingEventTypes",
          eventTypes,
        }),
        null,
      ] as const;
    }
  }

  async addAllActivityTypes(
    activityTypes: NewPipedriveActivityType[],
  ): PromiseReturn<{ message: string; added: number; skipped?: number }> {
    try {
      logDBOperation("addAllActivityTypes", { activityTypes });
      const [checkError, result] =
        await this.checkExistingActivityTypes(activityTypes);

      if (checkError) {
        return [checkError, null] as const;
      }

      if (!result.new.length) {
        return [
          null,
          {
            message: ERROR_MESSAGES.ALL_ACTIVITY_TYPES_EXIST,
            added: 0,
          },
        ] as const;
      }

      await db.insert(pipedriveActivityTypes).values(result.new);

      return [
        null,
        {
          message: ERROR_MESSAGES.ACTIVITY_TYPES_ADDED_SUCCESS,
          added: result.new.length,
          skipped: result.existing.length,
        },
      ] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "addAllActivityTypes",
          activityTypes,
        }),
        null,
      ] as const;
    }
  }

  async checkExistingActivityTypes(
    activityTypes: NewPipedriveActivityType[],
  ): PromiseReturn<{
    existing: any[];
    new: NewPipedriveActivityType[];
    hasConflicts: boolean;
  }> {
    try {
      logDBOperation("checkExistingActivityTypes", { activityTypes });
      const existingTypes = await db
        .select()
        .from(pipedriveActivityTypes)
        .where(
          inArray(
            sql`(${pipedriveActivityTypes.pipedriveId}, ${pipedriveActivityTypes.companyId})`,
            activityTypes.map((at) => [at.pipedriveId, at.companyId]),
          ),
        );

      const existingIdPairs = new Set(
        existingTypes.map((at) => `${at.pipedriveId}-${at.companyId}`),
      );

      const newActivityTypes = activityTypes.filter(
        (at) => !existingIdPairs.has(`${at.pipedriveId}-${at.companyId}`),
      );

      return [
        null,
        {
          existing: existingTypes,
          new: newActivityTypes,
          hasConflicts: existingTypes.length > 0,
        },
      ] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "checkExistingActivityTypes",
          activityTypes,
        }),
        null,
      ] as const;
    }
  }

  async getUser(userId: number): PromiseReturn<User> {
    try {
      logDBOperation("getUser", { userId });
      const user = await db.select().from(users).where(eq(users.id, userId));

      if (user.length !== 1) {
        return [
          this.createError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            new Error("No user found"),
            { userId },
          ),
          null,
        ] as const;
      }

      return [null, user[0]] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "getUser",
          userId,
        }),
        null,
      ] as const;
    }
  }

  async getUserAndCalendlyAcc(userId: number): PromiseReturn<UserCalendly> {
    try {
      logDBOperation("getUserAndCalendlyAcc", { userId });
      const res = await db
        .select()
        .from(users)
        .innerJoin(calendlyAccs, eq(users.id, calendlyAccs.userId))
        .where(eq(users.id, userId));

      if (res.length != 1) {
        return [
          this.createError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            new Error("No user or calendly acc found"),
            { userId },
          ),
          null,
        ] as const;
      }

      return [null, res[0]] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "getUserAndCalendlyAcc",
          userId,
        }),
        null,
      ] as const;
    }
  }

  async getCompanyById(companyId: string): PromiseReturn<Company> {
    try {
      logDBOperation("getCompanyById", { companyId });
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId));

      if (company.length < 1) {
        return [
          this.createError(
            ERROR_MESSAGES.COMPANY_NOT_FOUND,
            new Error("Company not found"),
            { companyId },
          ),
          null,
        ] as const;
      } else if (company.length > 1) {
        return [
          this.createError(
            ERROR_MESSAGES.TOO_MANY_COMPANIES_FOUND,
            new Error("Too many companies found"),
            { companyId },
          ),
          null,
        ] as const;
      }

      return [null, company[0]] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "getCompanyById",
          companyId,
        }),
        null,
      ] as const;
    }
  }

  async getCompany(companyDomain: string): PromiseReturn<Company> {
    try {
      logDBOperation("getCompany", { companyDomain });
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.domain, companyDomain));

      if (company.length < 1) {
        return [
          this.createError(
            ERROR_MESSAGES.COMPANY_NOT_FOUND,
            new Error("Company not found"),
            { companyDomain },
          ),
          null,
        ] as const;
      } else if (company.length > 1) {
        return [
          this.createError(
            ERROR_MESSAGES.TOO_MANY_COMPANIES_FOUND,
            new Error("Too many companies found"),
            { companyDomain },
          ),
          null,
        ] as const;
      }

      return [null, company[0]] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "getCompany",
          companyDomain,
        }),
        null,
      ] as const;
    }
  }

  async createCompany(companyValues: NewCompany): PromiseReturn<Company> {
    try {
      logDBOperation("createCompany", { companyValues });
      const company = await db
        .insert(companies)
        .values(companyValues)
        .returning();

      if (company.length !== 1) {
        return [
          this.createError(
            ERROR_MESSAGES.COMPANY_CREATION_ERROR,
            new Error("Error when creating company"),
            { companyValues },
          ),
          null,
        ] as const;
      }

      return [null, company[0]] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "createCompany",
          companyValues,
        }),
        null,
      ] as const;
    }
  }

  async createCompanyOrReturnCompany(
    companyValues: NewCompany,
  ): PromiseReturn<Company> {
    try {
      logDBOperation("createCompanyOrReturnCompany", { companyValues });
      const [_, company] = await this.getCompany(companyValues.domain);

      if (company) return [null, company] as const;

      return await this.createCompany(companyValues);
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "createCompanyOrReturnCompany",
          companyValues,
        }),
        null,
      ] as const;
    }
  }

  async updateCompany(company: Company): PromiseReturn<Company> {
    try {
      logDBOperation("updateCompany", { company });
      const [err, updatedCompany] = await db
        .update(companies)
        .set(company)
        .where(eq(companies.id, company.id));

      if (err) {
        return [
          this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, err, {
            operation: "updateCompany",
            company,
          }),
          null,
        ] as const;
      }

      return [null, updatedCompany] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "updateCompany",
          company,
        }),
        null,
      ] as const;
    }
  }

  async createUser(
    user: GetCurrentUserResponseAllOfData,
    {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: expiresIn,
      token_type: tokenType,
      scope,
      api_domain: apiDomain,
    }: TokenResponse,
  ): Promise<Readonly<[null, boolean] | [CalIntError, null]>> {
    try {
      logDBOperation("createUser", { userId: user.id });

      if (!user.id || !user.name) {
        return [
          this.createError(
            ERROR_MESSAGES.MISSING_REQUIRED_FIELDS,
            new Error("id and name are required"),
            { user },
          ),
          null,
        ] as const;
      }

      const [error, company] = await this.createCompanyOrReturnCompany({
        name: user.company_name,
        domain: user.company_domain!,
      });

      if (error) {
        return [error, null] as const;
      }

      const createdUserList = await db
        .insert(users)
        .values({
          id: user.id,
          name: user.name,
          accessToken,
          refreshToken,
          expiresIn,
          tokenType,
          scope,
          apiDomain,
          companyId: company.id,
        })
        .returning();

      if (createdUserList.length < 1) {
        return [
          this.createError(
            ERROR_MESSAGES.USER_CREATION_FAILED,
            new Error("No user created"),
            { user },
          ),
          null,
        ] as const;
      }

      return [null, true] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "createUser",
          user,
        }),
        null,
      ] as const;
    }
  }

  async loginWithPipedrive(
    pipedriveAccId: number,
    logins: TokenResponse,
  ): Promise<Readonly<[CalIntError, null] | [null, boolean]>> {
    try {
      logDBOperation("loginWithPipedrive", { pipedriveAccId });
      await db.update(users).set(logins).where(eq(users.id, pipedriveAccId));

      return [null, true] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.LOGIN_FAILED, error, {
          operation: "loginWithPipedrive",
          pipedriveAccId,
        }),
        null,
      ] as const;
    }
  }

  async addCalendlyAccountToUser(
    userId: number,
    calendlyUser: CalendlyUser,
    { accessToken, refreshToken, expiresAt }: AccountLogin,
  ): PromiseReturn<User> {
    try {
      logDBOperation("addCalendlyAccountToUser", {
        userId,
        calendlyUri: calendlyUser.uri,
      });
      await db.insert(calendlyAccs).values({
        userId,
        uri: calendlyUser.uri,
        name: calendlyUser.name,
        organization: calendlyUser.current_organization,
        accessToken,
        refreshToken,
        expiresAt,
      });

      const [err, user] = await this.getUser(userId);

      if (err) {
        return [
          this.createError(ERROR_MESSAGES.USER_NOT_FOUND, err, {
            userId,
            calendlyUri: calendlyUser.uri,
          }),
          null,
        ] as const;
      }

      return [null, user] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "addCalendlyAccountToUser",
          userId,
          calendlyUser,
        }),
        null,
      ] as const;
    }
  }

  async loginWithCalendly(
    calendlyUri: string,
    creds: AccountLogin,
  ): PromiseReturn<boolean> {
    try {
      logDBOperation("loginWithCalendly", { calendlyUri });
      const formattedCreds = {
        ...creds,
        expiresAt: new Date(creds.expiresAt),
      };

      if (isNaN(formattedCreds.expiresAt.getTime())) {
        throw new Error("Invalid expiration date");
      }

      await db
        .update(calendlyAccs)
        .set(formattedCreds)
        .where(eq(calendlyAccs.uri, calendlyUri));

      return [null, true] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.LOGIN_FAILED, error, {
          operation: "loginWithCalendly",
          calendlyUri,
        }),
        null,
      ] as const;
    }
  }

  async checkUserExists(
    userId: number,
  ): Promise<Readonly<[CalIntError, null] | [null, User[]]>> {
    try {
      logDBOperation("checkUserExists", { userId });
      const user = await db.select().from(users).where(eq(users.id, userId));

      return [null, user] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "checkUserExists",
          userId,
        }),
        null,
      ] as const;
    }
  }

  async checkCalendlyUserExist(userId: number): PromiseReturn<any[]> {
    try {
      logDBOperation("checkCalendlyUserExist", { userId });
      const res = await db
        .select()
        .from(users)
        .innerJoin(calendlyAccs, eq(users.id, calendlyAccs.userId))
        .where(eq(users.id, userId))
        .limit(1);

      return [null, res] as const;
    } catch (error) {
      return [
        this.createError(ERROR_MESSAGES.DB_OPERATION_ERROR, error, {
          operation: "checkCalendlyUserExist",
          userId,
        }),
        null,
      ] as const;
    }
  }
}

export type CalIntError = {
  message: string;
  error: any;
};

export type UserPipedriveUnion = {
  users: {
    id: string;
    name: string | null;
  };
  pipedrive_acc: {
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: Date | null;
    id: number;
    userId: string;
    companyDomain: string | null;
  };
};

export type AccountLogin = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
};

export type CalendlyUser = {
  uri: string;
  name: string;
  slug: string;
  email: string;
  scheduling_url: string;
  timezone: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
  current_organization: string;
  resource_type: string;
  locale: string;
};

export const querier = new DatabaseQueries();

type DatabaseOperation<T> = (...args: any[]) => Promise<T>;
