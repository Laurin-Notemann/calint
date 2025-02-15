import { eq, inArray } from "drizzle-orm";
import db from "./db";
import {
  calendlyAccs,
  CalEventType,
  calEventTypes,
  companies,
  Company,
  NewCalEventType,
  NewCompany,
  NewPipedriveActivityType,
  pipedriveActivityTypes,
  User,
  UserCalendly,
  users,
} from "./schema";
import { logDBError, logDBOperation } from "@/utils/db-logger";
import { GetCurrentUserResponseAllOfData, TokenResponse } from "pipedrive/v1";

export type PromiseReturn<T> = Promise<
  Readonly<[CalIntError, null] | [null, T]>
>;

export class DatabaseQueries {
  constructor() {}

  async getAllEventTypes(companyId: string): PromiseReturn<CalEventType[]> {
    try {
      logDBOperation("getAllEventTypes", { companyId });

      const res = await db
        .select()
        .from(calEventTypes)
        .where(eq(calEventTypes.companyId, companyId));

      return [null, res];
    } catch (error) {
      logDBError("getAllEventTypes", error, { companyId });
      return [
        {
          message: "Database error trying get all event types",
          error: error as any,
        },
        null,
      ] as const;
    }
  }

  async addAllEventTypes(eventTypes: NewCalEventType[]) {
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
            message: "All event types already exist",
            added: 0,
          },
        ] as const;
      }

      await db.insert(calEventTypes).values(result.new);

      return [
        null,
        {
          message: "Successfully added new event types",
          added: result.new.length,
          skipped: result.existing.length,
        },
      ] as const;
    } catch (error) {
      logDBError("addAllEventTypes", error, { eventTypes });
      return [
        {
          message: "Database error trying insert all eventTypes",
          error: error as any,
        },
        null,
      ] as const;
    }
  }

  async checkExistingEventTypes(eventTypes: NewCalEventType[]) {
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
      logDBError("checkExistingEventTypes", error, { eventTypes });
      return [
        {
          message: "Database error checking existing eventTypes",
          error,
        },
        null,
      ] as const;
    }
  }

  async addAllActivityTypes(activityTypes: NewPipedriveActivityType[]) {
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
            message: "All activity types already exist",
            added: 0,
          },
        ] as const;
      }

      await db.insert(pipedriveActivityTypes).values(result.new);

      return [
        null,
        {
          message: "Successfully added new activity types",
          added: result.new.length,
          skipped: result.existing.length,
        },
      ] as const;
    } catch (error) {
      logDBError("addAllActivityTypes", error, { activityTypes });
      return [
        {
          message: "Database error trying insert all activityTypes",
          error: error as any,
        },
        null,
      ] as const;
    }
  }

  async checkExistingActivityTypes(activityTypes: NewPipedriveActivityType[]) {
    try {
      logDBOperation("checkExistingActivityTypes", { activityTypes });

      const existingTypes = await db
        .select()
        .from(pipedriveActivityTypes)
        .where(
          inArray(
            pipedriveActivityTypes.pipedriveId,
            activityTypes.map((at) => at.pipedriveId),
          ),
        );

      const existingIds = new Set(existingTypes.map((at) => at.pipedriveId));
      const newActivityTypes = activityTypes.filter(
        (at) => !existingIds.has(at.pipedriveId),
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
      logDBError("checkExistingActivityTypes", error, { activityTypes });
      return [
        {
          message: "Database error checking existing activityTypes",
          error,
        },
        null,
      ] as const;
    }
  }

  async getUser(userId: number): PromiseReturn<User> {
    try {
      logDBOperation("getUser", { userId });
      const user = await db.select().from(users).where(eq(users.id, userId));

      if (user.length !== 1) {
        const error = new Error("No user found");
        logDBError("getUser", error, { userId });
        return [
          {
            message: "No user found",
            error,
          },
          null,
        ] as const;
      }

      return [null, user[0]] as const;
    } catch (error) {
      logDBError("getUser", error, { userId });
      return [
        {
          message: "Database error trying to find user",
          error,
        },
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
        const error = new Error("No user or calendly acc found");
        logDBError("getUserAndCalendlyAcc", error, { userId });
        return [
          {
            message: "No user or calendly acc found",
            error,
          },
          null,
        ] as const;
      }

      return [null, res[0]];
    } catch (error) {
      logDBError("getUserAndCalendlyAcc", error, { userId });
      return [
        {
          message: "Database error trying to find user and calendly acc",
          error,
        },
        null,
      ] as const;
    }
  }

  async getCompanyById(companyId: string): PromiseReturn<Company> {
    try {
      logDBOperation("getCompanyById", { companyDomain: companyId });
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId));

      if (company.length < 1) {
        const error = new Error("Company not found");
        logDBError("getCompanyById", error, { companyId });
        return [
          {
            message: "Company not found",
            error,
          },
          null,
        ] as const;
      } else if (company.length > 1) {
        const error = new Error("Too many companies found");
        logDBError("getCompanyById", error, { companyId });
        return [
          {
            message: "Too many companies found",
            error,
          },
          null,
        ] as const;
      }

      return [null, company[0]] as const;
    } catch (error) {
      logDBError("getCompanyById", error, { companyId });
      return [
        {
          message: "Database error when trying to find company",
          error,
        },
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
        const error = new Error("Company not found");
        logDBError("getCompany", error, { companyDomain });
        return [
          {
            message: "Company not found",
            error,
          },
          null,
        ] as const;
      } else if (company.length > 1) {
        const error = new Error("Too many companies found");
        logDBError("getCompany", error, { companyDomain });
        return [
          {
            message: "Too many companies found",
            error,
          },
          null,
        ] as const;
      }

      return [null, company[0]] as const;
    } catch (error) {
      logDBError("getCompany", error, { companyDomain });
      return [
        {
          message: "Database error when trying to find company",
          error,
        },
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

      if (company.length < 1 || company.length > 1) {
        const error = new Error("Error when creating company");
        logDBError("createCompany", error, { companyValues });
        return [
          {
            message: "Error when creating company",
            error,
          },
          null,
        ] as const;
      }

      return [null, company[0]] as const;
    } catch (error) {
      logDBError("createCompany", error, { companyValues });
      return [
        {
          message: "Database error when trying to create company",
          error,
        },
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

      const [createError, createdCompany] =
        await this.createCompany(companyValues);

      if (createError) {
        logDBError("createCompanyOrReturnCompany", createError, {
          companyValues,
        });
        return [createError, null];
      }

      return [null, createdCompany] as const;
    } catch (error) {
      logDBError("createCompanyOrReturnCompany", error, { companyValues });
      return [
        {
          message: "Database error when trying to create company",
          error,
        },
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
        logDBError("updateCompany", err, {
          company,
        });
        return [err, null];
      }

      return [null, updatedCompany] as const;
    } catch (error) {
      logDBError("updateCompany", error, { company });
      return [
        {
          message: "Database error when trying to update company",
          error,
        },
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
          {
            message: "Missing required user fields",
            error: new Error("id and name are required"),
          },
          null,
        ] as const;
      }

      const [error, company] = await this.createCompanyOrReturnCompany({
        name: user.company_name,
        domain: user.company_domain!,
      });

      if (error) {
        logDBError("createUser", error, { userId: user.id });
        return [error, null];
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
        const error = new Error("No user");
        logDBError("createUser", error, { userId: user.id });
        return [
          {
            message: "could not create user",
            error,
          },
          null,
        ] as const;
      }

      return [null, true] as const;
    } catch (error) {
      logDBError("createUser", error, { userId: user.id });
      return [
        {
          message: "Account could not be created: ",
          error,
        },
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
      logDBError("loginWithPipedrive", error, { pipedriveAccId });
      return [
        {
          message: "Account not found",
          error,
        },
        null,
      ] as const;
    }
  }

  async addCalendlyAccountToUser(
    userId: number,
    calendlyUser: CalendlyUser,
    { accessToken, refreshToken, expiresAt }: AccountLogin,
  ) {
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
        logDBError("addCalendlyAccountToUser", err, {
          userId,
          calendlyUri: calendlyUser.uri,
        });
        return [
          {
            message: "User was not found",
            error: err,
          },
          null,
        ] as const;
      }

      return [null, user] as const;
    } catch (error) {
      logDBError("addCalendlyAccountToUser", error, {
        userId,
        calendlyUri: calendlyUser.uri,
      });
      return [
        {
          message: "Account could not be created",
          error: error,
        },
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
        const error = new Error("Invalid expiration date");
        logDBError("loginWithCalendly", error, { calendlyUri });
        throw error;
      }

      await db
        .update(calendlyAccs)
        .set(formattedCreds)
        .where(eq(calendlyAccs.uri, calendlyUri));

      return [null, true] as const;
    } catch (error) {
      logDBError("loginWithCalendly", error, { calendlyUri });
      return [
        {
          message: "Could not login into Calendly",
          error,
        },
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
      logDBError("checkUserExists", error, { userId });
      return [
        {
          message: "DB: User could not be found",
          error,
        },
        null,
      ] as const;
    }
  }

  async checkCalendlyUserExist(userId: number) {
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
      logDBError("checkCalendlyUserExist", error, { userId });
      return [
        {
          message: "Account could not be found",
          error,
        },
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
