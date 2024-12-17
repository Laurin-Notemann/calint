import { eq } from "drizzle-orm";
import db from "./db";
import { BaseUserMe } from "./pipedrive-types";
import { calendlyAcc, companies, Company, NewCompany, User, users } from "./schema";

export type PromiseReturn<T> = Promise<Readonly<[QuerierError, null] | [null, T]>>

export class DatabaseQueries {
  constructor() {
  }

  async getCompany(companyDomain: string): PromiseReturn<Company> {
    try {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.domain, companyDomain));

      if (company.length < 1)
        return [{
          message: "Company not found",
          error: new Error("Company not found")
        }, null] as const;
      else if (company.length > 1)
        return [{
          message: "Too many companies found",
          error: new Error("Too many companies found")
        }, null] as const;

      return [null, company[0]] as const;
    } catch (error) {
      return [{
        message: "Database error when trying to find company",
        error
      }, null] as const;
    }
  }

  async createCompany(companyValues: NewCompany): PromiseReturn<Company> {
    try {
      const company = await db.insert(companies).values(companyValues).returning()

      if (company.length < 1 || company.length > 1)
        return [{
          message: "Error when creating company",
          error: new Error("Error when creating company")
        }, null] as const;

      return [null, company[0]] as const;
    } catch (error) {
      return [{
        message: "Database error when trying to create company",
        error
      }, null] as const;
    }
  }

  async createCompanyOrReturnCompany(companyValues: NewCompany): PromiseReturn<Company> {
    try {
      const [_, company] = await this.getCompany(companyValues.domain);

      if (company)
        return [null, company] as const;

      const [createError, createdCompany] = await this.createCompany(companyValues)

      if (createError)
        return [createError, null]

      return [null, createdCompany] as const;
    } catch (error) {
      return [{
        message: "Database error when trying to create company",
        error
      }, null] as const;
    }
  }

  async createUser(user: BaseUserMe, { accessToken, refreshToken, expiresAt }: AccountLogin): Promise<Readonly<[null, boolean] | [QuerierError, null]>> {
    try {
      const [error, company] = await this.createCompanyOrReturnCompany({
        name: user.company_name,
        domain: user.company_domain,
      })

      if (error)
        return [error, null]

      const createdUserList = await db.insert(users).values({
        id: user.id,
        name: user.name,
        accessToken,
        refreshToken,
        expiresAt,
        companyId: company.id
      }).returning()

      if (createdUserList.length < 1)
        return [{
          message: "could not create user",
          error: new Error("No user")
        }, null] as const

      return [null, true] as const
    } catch (error) {
      return [{
        message: "Account could not be created: ",
        error
      }, null] as const
    }
  }

  async loginWithPipedrive(pipedriveAccId: number, logins: AccountLogin): Promise<Readonly<[QuerierError, null] | [null, boolean]>> {
    try {
      await db.update(users).set(logins).where(eq(users.id, pipedriveAccId))

      return [null, true] as const
    } catch (error) {
      return [{
        message: "Account not found",
        error
      }, null] as const
    }
  }

  async addCalendlyAccountToUser(userId: number, calendlyUser: CalendlyUser, { accessToken, refreshToken, expiresAt }: AccountLogin) {
    try {
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
      return ["Account could not be created: " + error, null] as const
    }
  }

  async loginWithCalendly(calendlyUri: string, creds: AccountLogin) {
    try {
      await db.update(calendlyAcc).set(creds).where(eq(calendlyAcc.uri, calendlyUri))

      return [null, true] as const
    } catch (error) {
      return [{
        message: "Could not login into Calendly",
        error
      }, null] as const
    }
  }

  async checkUserExists(userId: number): Promise<Readonly<[QuerierError, null] | [null, User[]]>> {
    try {
      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))

      return [null, user] as const
    } catch (error) {
      return [{
        message: "DB: User could not be found",
        error
      }, null] as const
    }
  }
  async checkCalendlyUserExist(userId: number) {
    try {
      const res = await db
        .select()
        .from(users)
        .innerJoin(calendlyAcc, eq(users.id, calendlyAcc.userId))
        .where(eq(users.id, userId))
        .limit(1)

      return [null, res] as const
    } catch (error) {
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
