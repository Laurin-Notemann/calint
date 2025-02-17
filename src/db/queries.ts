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
    return this.withErrorHandling(
      async () => {
        return await db
          .select()
          .from(calEventTypes)
          .where(eq(calEventTypes.companyId, companyId));
      },
      "getAllEventTypes",
      { companyId },
    );
  }

  async addAllEventTypes(
    eventTypes: NewCalEventType[],
  ): PromiseReturn<{ message: string; added: number; skipped?: number }> {
    return this.withErrorHandling(
      async () => {
        const [checkError, result] =
          await this.checkExistingEventTypes(eventTypes);

        if (checkError) {
          throw checkError;
        }

        if (!result.new.length) {
          return {
            message: ERROR_MESSAGES.ALL_EVENT_TYPES_EXIST,
            added: 0,
          };
        }

        await db.insert(calEventTypes).values(result.new);

        return {
          message: ERROR_MESSAGES.EVENT_TYPES_ADDED_SUCCESS,
          added: result.new.length,
          skipped: result.existing.length,
        };
      },
      "addAllEventTypes",
      { eventTypes },
    );
  }

  async checkExistingEventTypes(
    eventTypes: NewCalEventType[],
  ): PromiseReturn<{
    existing: CalEventType[];
    new: NewCalEventType[];
    hasConflicts: boolean;
  }> {
    return this.withErrorHandling(
      async () => {
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

        return {
          existing: existingTypes,
          new: newEventTypes,
          hasConflicts: existingTypes.length > 0,
        };
      },
      "checkExistingEventTypes",
      { eventTypes },
    );
  }

  async addAllActivityTypes(
    activityTypes: NewPipedriveActivityType[],
  ): PromiseReturn<{ message: string; added: number; skipped?: number }> {
    return this.withErrorHandling(
      async () => {
        const [checkError, result] =
          await this.checkExistingActivityTypes(activityTypes);

        if (checkError) {
          throw checkError;
        }

        if (!result.new.length) {
          return {
            message: ERROR_MESSAGES.ALL_ACTIVITY_TYPES_EXIST,
            added: 0,
          };
        }

        await db.insert(pipedriveActivityTypes).values(result.new);

        return {
          message: ERROR_MESSAGES.ACTIVITY_TYPES_ADDED_SUCCESS,
          added: result.new.length,
          skipped: result.existing.length,
        };
      },
      "addAllActivityTypes",
      { activityTypes },
    );
  }

  async checkExistingActivityTypes(
    activityTypes: NewPipedriveActivityType[],
  ): PromiseReturn<{
    existing: any[];
    new: NewPipedriveActivityType[];
    hasConflicts: boolean;
  }> {
    return this.withErrorHandling(
      async () => {
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

        return {
          existing: existingTypes,
          new: newActivityTypes,
          hasConflicts: existingTypes.length > 0,
        };
      },
      "checkExistingActivityTypes",
      { activityTypes },
    );
  }

  async getUser(userId: number): PromiseReturn<User> {
    return this.withErrorHandling(
      async () => {
        const user = await db.select().from(users).where(eq(users.id, userId));

        if (user.length !== 1) {
          throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        return user[0];
      },
      "getUser",
      { userId },
    );
  }

  async getUserAndCalendlyAcc(userId: number): PromiseReturn<UserCalendly> {
    return this.withErrorHandling(
      async () => {
        const res = await db
          .select()
          .from(users)
          .innerJoin(calendlyAccs, eq(users.id, calendlyAccs.userId))
          .where(eq(users.id, userId));

        if (res.length != 1) {
          throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        return res[0];
      },
      "getUserAndCalendlyAcc",
      { userId },
    );
  }

  async getCompanyById(companyId: string): PromiseReturn<Company> {
    return this.withErrorHandling(
      async () => {
        const company = await db
          .select()
          .from(companies)
          .where(eq(companies.id, companyId));

        if (company.length < 1) {
          throw new Error(ERROR_MESSAGES.COMPANY_NOT_FOUND);
        } else if (company.length > 1) {
          throw new Error(ERROR_MESSAGES.TOO_MANY_COMPANIES_FOUND);
        }

        return company[0];
      },
      "getCompanyById",
      { companyId },
    );
  }

  async getCompany(companyDomain: string): PromiseReturn<Company> {
    return this.withErrorHandling(
      async () => {
        const company = await db
          .select()
          .from(companies)
          .where(eq(companies.domain, companyDomain));

        if (company.length < 1) {
          throw new Error(ERROR_MESSAGES.COMPANY_NOT_FOUND);
        } else if (company.length > 1) {
          throw new Error(ERROR_MESSAGES.TOO_MANY_COMPANIES_FOUND);
        }

        return company[0];
      },
      "getCompany",
      { companyDomain },
    );
  }

  async createCompany(companyValues: NewCompany): PromiseReturn<Company> {
    return this.withErrorHandling(
      async () => {
        const company = await db
          .insert(companies)
          .values(companyValues)
          .returning();

        if (company.length !== 1) {
          throw new Error(ERROR_MESSAGES.COMPANY_CREATION_ERROR);
        }

        return company[0];
      },
      "createCompany",
      { companyValues },
    );
  }

  async createCompanyOrReturnCompany(
    companyValues: NewCompany,
  ): PromiseReturn<Company> {
    return this.withErrorHandling(
      async () => {
        const [error, company] = await this.getCompany(companyValues.domain);

        if (error) throw error;
        if (company) return company;

        const [createError, createdCompany] =
          await this.createCompany(companyValues);
        if (createError) throw createError;
        return createdCompany;
      },
      "createCompanyOrReturnCompany",
      { companyValues },
    );
  }

  async updateCompany(company: Company): PromiseReturn<Company> {
    return this.withErrorHandling(
      async () => {
        const [err, updatedCompany] = await db
          .update(companies)
          .set(company)
          .where(eq(companies.id, company.id));

        if (err) {
          throw err;
        }

        return updatedCompany;
      },
      "updateCompany",
      { company },
    );
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
    return this.withErrorHandling(
      async () => {
        if (!user.id || !user.name) {
          throw new Error(ERROR_MESSAGES.MISSING_REQUIRED_FIELDS);
        }

        const [error, company] = await this.createCompanyOrReturnCompany({
          name: user.company_name,
          domain: user.company_domain!,
        });

        if (error) throw error;

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
          throw new Error(ERROR_MESSAGES.USER_CREATION_FAILED);
        }

        return true;
      },
      "createUser",
      { user },
    );
  }

  async loginWithPipedrive(
    pipedriveAccId: number,
    logins: TokenResponse,
  ): Promise<Readonly<[CalIntError, null] | [null, boolean]>> {
    return this.withErrorHandling(
      async () => {
        await db.update(users).set(logins).where(eq(users.id, pipedriveAccId));
        return true;
      },
      "loginWithPipedrive",
      { pipedriveAccId },
    );
  }

  async addCalendlyAccountToUser(
    userId: number,
    calendlyUser: CalendlyUser,
    { accessToken, refreshToken, expiresAt }: AccountLogin,
  ): PromiseReturn<User> {
    return this.withErrorHandling(
      async () => {
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

        if (err) throw err;

        return user;
      },
      "addCalendlyAccountToUser",
      { userId, calendlyUser },
    );
  }

  async loginWithCalendly(
    calendlyUri: string,
    creds: AccountLogin,
  ): PromiseReturn<boolean> {
    return this.withErrorHandling(
      async () => {
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

        return true;
      },
      "loginWithCalendly",
      { calendlyUri },
    );
  }

  async checkUserExists(
    userId: number,
  ): Promise<Readonly<[CalIntError, null] | [null, User[]]>> {
    return this.withErrorHandling(
      async () => {
        return await db.select().from(users).where(eq(users.id, userId));
      },
      "checkUserExists",
      { userId },
    );
  }

  async checkCalendlyUserExist(userId: number): PromiseReturn<any[]> {
    return this.withErrorHandling(
      async () => {
        return await db
          .select()
          .from(users)
          .innerJoin(calendlyAccs, eq(users.id, calendlyAccs.userId))
          .where(eq(users.id, userId))
          .limit(1);
      },
      "checkCalendlyUserExist",
      { userId },
    );
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
