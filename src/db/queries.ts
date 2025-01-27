import { eq } from "drizzle-orm";
import db from "./db";
import { BaseUserMe } from "./pipedrive-types";
import { calendlyAcc, companies, Company, NewCompany, User, UserCalendly, users } from "./schema";
import { logDBError, logDBOperation } from '@/utils/db-logger';

export type PromiseReturn<T> = Promise<Readonly<[QuerierError, null] | [null, T]>>

export class DatabaseQueries {
  constructor() {
  }

  async getUser(userId: number): PromiseReturn<User> {
    try {
      logDBOperation('getUser', { userId });
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))

      if (user.length !== 1) {
        const error = new Error("No user found");
        logDBError('getUser', error, { userId });
        return [{
          message: "No user found",
          error
        }, null] as const
      }

      return [null, user[0]] as const
    } catch (error) {
      logDBError('getUser', error, { userId });
      return [{
        message: "Database error trying to find user",
        error
      }, null] as const;
    }
  }

  async getUserAndCalendlyAcc(userId: number): PromiseReturn<UserCalendly> {
    try {
      logDBOperation('getUserAndCalendlyAcc', { userId });
      const res = await db
        .select()
        .from(users)
        .innerJoin(calendlyAcc, eq(users.id, calendlyAcc.userId))
        .where(eq(users.id, userId))

      if (res.length != 1) {
        const error = new Error("No user or calendly acc found");
        logDBError('getUserAndCalendlyAcc', error, { userId });
        return [{
          message: "No user or calendly acc found",
          error
        }, null] as const
      }

      return [null, res[0]]
    } catch (error) {
      logDBError('getUserAndCalendlyAcc', error, { userId });
      return [{
        message: "Database error trying to find user and calendly acc",
        error
      }, null] as const;
    }
  }

  async getCompany(companyDomain: string): PromiseReturn<Company> {
    try {
      logDBOperation('getCompany', { companyDomain });
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.domain, companyDomain));

      if (company.length < 1) {
        const error = new Error("Company not found");
        logDBError('getCompany', error, { companyDomain });
        return [{
          message: "Company not found",
          error
        }, null] as const;
      } else if (company.length > 1) {
        const error = new Error("Too many companies found");
        logDBError('getCompany', error, { companyDomain });
        return [{
          message: "Too many companies found",
          error
        }, null] as const;
      }

      return [null, company[0]] as const;
    } catch (error) {
      logDBError('getCompany', error, { companyDomain });
      return [{
        message: "Database error when trying to find company",
        error
      }, null] as const;
    }
  }

  async createCompany(companyValues: NewCompany): PromiseReturn<Company> {
    try {
      logDBOperation('createCompany', { companyValues });
      const company = await db.insert(companies).values(companyValues).returning()

      if (company.length < 1 || company.length > 1) {
        const error = new Error("Error when creating company");
        logDBError('createCompany', error, { companyValues });
        return [{
          message: "Error when creating company",
          error
        }, null] as const;
      }

      return [null, company[0]] as const;
    } catch (error) {
      logDBError('createCompany', error, { companyValues });
      return [{
        message: "Database error when trying to create company",
        error
      }, null] as const;
    }
  }

  async createCompanyOrReturnCompany(companyValues: NewCompany): PromiseReturn<Company> {
    try {
      logDBOperation('createCompanyOrReturnCompany', { companyValues });
      const [_, company] = await this.getCompany(companyValues.domain);

      if (company)
        return [null, company] as const;

      const [createError, createdCompany] = await this.createCompany(companyValues)

      if (createError) {
        logDBError('createCompanyOrReturnCompany', createError, { companyValues });
        return [createError, null]
      }

      return [null, createdCompany] as const;
    } catch (error) {
      logDBError('createCompanyOrReturnCompany', error, { companyValues });
      return [{
        message: "Database error when trying to create company",
        error
      }, null] as const;
    }
  }

  async createUser(user: BaseUserMe, { accessToken, refreshToken, expiresAt }: AccountLogin): Promise<Readonly<[null, boolean] | [QuerierError, null]>> {
    try {
      logDBOperation('createUser', { userId: user.id });
      const [error, company] = await this.createCompanyOrReturnCompany({
        name: user.company_name,
        domain: user.company_domain,
      })

      if (error) {
        logDBError('createUser', error, { userId: user.id });
        return [error, null]
      }

      const createdUserList = await db.insert(users).values({
        id: user.id,
        name: user.name,
        accessToken,
        refreshToken,
        expiresAt,
        companyId: company.id
      }).returning()

      if (createdUserList.length < 1) {
        const error = new Error("No user");
        logDBError('createUser', error, { userId: user.id });
        return [{
          message: "could not create user",
          error
        }, null] as const
      }

      return [null, true] as const
    } catch (error) {
      logDBError('createUser', error, { userId: user.id });
      return [{
        message: "Account could not be created: ",
        error
      }, null] as const
    }
  }

  async loginWithPipedrive(pipedriveAccId: number, logins: AccountLogin): Promise<Readonly<[QuerierError, null] | [null, boolean]>> {
    try {
      logDBOperation('loginWithPipedrive', { pipedriveAccId });
      await db.update(users).set(logins).where(eq(users.id, pipedriveAccId))

      return [null, true] as const
    } catch (error) {
      logDBError('loginWithPipedrive', error, { pipedriveAccId });
      return [{
        message: "Account not found",
        error
      }, null] as const
    }
  }

  async addCalendlyAccountToUser(userId: number, calendlyUser: CalendlyUser, { accessToken, refreshToken, expiresAt }: AccountLogin) {
    try {
      logDBOperation('addCalendlyAccountToUser', { userId, calendlyUri: calendlyUser.uri });
      await db.insert(calendlyAcc).values({
        userId,
        uri: calendlyUser.uri,
        name: calendlyUser.name,
        organization: calendlyUser.current_organization,
        accessToken,
        refreshToken,
        expiresAt
      })
      return [null, true] as const
    } catch (error) {
      logDBError('addCalendlyAccountToUser', error, { userId, calendlyUri: calendlyUser.uri });
      return ["Account could not be created: " + error, null] as const
    }
  }

  async loginWithCalendly(calendlyUri: string, creds: AccountLogin) {
    try {
      logDBOperation('loginWithCalendly', { calendlyUri });
      const formattedCreds = {
        ...creds,
        expiresAt: new Date(creds.expiresAt)
      }

      if (isNaN(formattedCreds.expiresAt.getTime())) {
        const error = new Error('Invalid expiration date');
        logDBError('loginWithCalendly', error, { calendlyUri });
        throw error;
      }

      await db.update(calendlyAcc)
        .set(formattedCreds)
        .where(eq(calendlyAcc.uri, calendlyUri));

      return [null, true] as const
    } catch (error) {
      logDBError('loginWithCalendly', error, { calendlyUri });
      return [{
        message: "Could not login into Calendly",
        error
      }, null] as const
    }
  }

  async checkUserExists(userId: number): Promise<Readonly<[QuerierError, null] | [null, User[]]>> {
    try {
      logDBOperation('checkUserExists', { userId });
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))

      return [null, user] as const
    } catch (error) {
      logDBError('checkUserExists', error, { userId });
      return [{
        message: "DB: User could not be found",
        error
      }, null] as const
    }
  }

  async checkCalendlyUserExist(userId: number) {
    try {
      logDBOperation('checkCalendlyUserExist', { userId });
      const res = await db
        .select()
        .from(users)
        .innerJoin(calendlyAcc, eq(users.id, calendlyAcc.userId))
        .where(eq(users.id, userId))
        .limit(1)

      return [null, res] as const
    } catch (error) {
      logDBError('checkCalendlyUserExist', error, { userId });
      return [{
        message: "Account could not be found",
        error
      }, null] as const
    }
  }
}

type QuerierError = {
  message: string;
  error: any
}

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
}

export type AccountLogin = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

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
}


export const querier = new DatabaseQueries();
