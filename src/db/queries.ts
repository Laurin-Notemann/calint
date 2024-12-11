import { eq } from "drizzle-orm";
import db from "./db";
import { BaseUserMe } from "./pipedrive-types";
import { calendlyAcc, pipedriveAcc, users } from "./schema";

export class DatabaseQueries {
  constructor() {
  }

  async createPipedriveUser(user: BaseUserMe, { accessToken, refreshToken, expiresAt }: AccountLogin): Promise<Readonly<[null, boolean] | [QuerierError, null]>> {
    try {
      const createdUserList = await db.insert(users).values({
        name: user.name
      }).returning()

      if (createdUserList.length < 0)
        return [{
          message: "could not create user",
          error: new Error("No user")
        }, null] as const

      const createdUser = createdUserList[0]

      await db.insert(pipedriveAcc).values({
        id: user.id,
        userId: createdUser.id,
        companyDomain: user.company_domain,
        accessToken,
        refreshToken,
        expiresAt
      })

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

      await db.update(pipedriveAcc).set(logins).where(eq(pipedriveAcc.id, pipedriveAccId))

      return [null, true] as const
    } catch (error) {
      return [{
        message: "Account not found",
        error
      }, null] as const
    }
  }

  async addCalendlyAccountToUser(userId: string, calendlyUser: CalendlyUser, { accessToken, refreshToken, expiresAt }: AccountLogin) {
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

  async checkPipedriveUserExist(pipedriveAccId: number): Promise<Readonly<[QuerierError, null] | [null, UserPipedriveUnion[]]>> {
    try {
      const res = await db
        .select()
        .from(users)
        .innerJoin(pipedriveAcc, eq(users.id, pipedriveAcc.userId))
        .where(eq(pipedriveAcc.id, pipedriveAccId))
        .limit(1)

      return [null, res] as const
    } catch (error) {
      return [{
        message: "Account could not be found",
        error
      }, null] as const
    }
  }
  async checkCalendlyUserExist(userId: string) {
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
