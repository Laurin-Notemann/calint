import { DatabaseQueries } from "@/db/queries";
import {
  CalendlyClient,
  GetEventTypesResponse,
  EventType,
} from "../calendly-client";
import createLogger, {
  withLogging,
  CalIntError,
  PromiseReturn,
  ERROR_MESSAGES,
} from "@/utils/logger";
import { NewCalEventType, User } from "@/db/schema";
import dayjs from "dayjs";
import { NextRequest } from "next/server";

export class CalendlyController {
  private logger = createLogger("CalendlyController");
  private calClient: CalendlyClient | null = null;
  private querier: DatabaseQueries;
  private eventTypeMap: Map<string, NewCalEventType>;

  constructor(querier: DatabaseQueries) {
    this.querier = querier;
    this.eventTypeMap = new Map<string, NewCalEventType>();
  }

  async callback(code: string, pipedriveId: number) {
    return withLogging(
      this.logger,
      async () => {
        this.calClient = new CalendlyClient({}); // important need new client for every request

        const [tokenErr, token] = await this.calClient.getAccessToken(code);
        if (tokenErr) throw tokenErr;

        this.calClient.updateCalendlyTokens(token);

        const [error, user] = await this.calClient.getUserInfo();
        if (error) throw error;

        const credentials = {
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: dayjs().add(token.expires_in, "second").toDate(),
        };

        const [getUserErr, pipedriveUser] =
          await this.querier.checkUserExists(pipedriveId);
        if (getUserErr) throw getUserErr;

        let dbUserGl: User | null = null;

        // If there is no pipedrive user error
        if (pipedriveUser.length > 0) {
          const [getCalendlyAccErr, calendlyAcc] =
            await this.querier.checkCalendlyUserExist(pipedriveUser[0].id);
          if (getCalendlyAccErr) throw getCalendlyAccErr;

          const userId = pipedriveUser[0].id;

          //if there is no calendly acc create a new one
          if (calendlyAcc.length > 0) {
            const [err, dbUser] = await this.querier.loginWithCalendly(
              calendlyAcc[0].calendly_accs.uri,
              credentials,
              userId,
            );
            if (err) throw err;
            dbUserGl = dbUser;
          } else {
            const [addAccErr, dbUser] =
              await this.querier.addCalendlyAccountToUser(
                userId,
                user.resource,
                credentials,
              );
            if (addAccErr) throw addAccErr;

            dbUserGl = dbUser;
          }
        } else
          throw new CalIntError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            "USER_NOT_FOUND",
          );

        const [webhookError] = await this.calClient.createWebhookSubscription(
          user.resource.current_organization,
          user.resource.uri,
        );
        if (webhookError && !webhookError.context?.response.title.includes("Already exists")) {
          this.logger.warn(JSON.stringify(webhookError))
          this.logger.warn(webhookError.context?.response.title)
          throw webhookError;
        }

        if (!dbUserGl)
          throw new CalIntError("dbUserGl was not set", "DB_USER_GL_NOT_SET");

        const [companyErr, getCompany] = await this.querier.getCompanyById(
          dbUserGl.companyId,
        );
        if (companyErr) throw companyErr;

        if (!getCompany.calendlyOrgUri) {
          getCompany.calendlyOrgUri = user.resource.current_organization;

          const [updateErr] = await this.querier.updateCompany(getCompany);

          if (updateErr) return updateErr;
        }

        return true;
      },
      "callback",
      "general",
      undefined,
      { code, pipedriveId },
    );
  }

  async setCalendlyClient(
    accessToken: string,
    refreshToken: string,
  ): PromiseReturn<void> {
    return withLogging(
      this.logger,
      async () => {
        this.calClient = new CalendlyClient({
          accessToken,
          refreshToken,
        });
      },
      "setCalendlyClient",
      "general",
      undefined,
      { accessToken, refreshToken },
    );
  }

  private checkClientInitialized(): PromiseReturn<CalendlyClient> {
    return withLogging(
      this.logger,
      async () => {
        if (!this.calClient) {
          throw new CalIntError(
            "CLIENT_NOT_INITIALIZED",
            "CLIENT_NOT_INITIALIZED",
          );
        }
        return this.calClient;
      },
      "checkClientInitialized",
      "general",
    );
  }

  private mapEventTypeToDb(
    eventType: EventType,
    companyId: string,
    calUserUri?: string,
    calUsername?: string,
  ): PromiseReturn<NewCalEventType> {
    return withLogging(
      this.logger,
      async () => {
        if (!eventType.name) {
          throw new CalIntError(
            "EVENT_TYPE_NAME_REQUIRED",
            "EVENT_TYPE_NAME_REQUIRED",
          );
        }

        if (!calUserUri && !calUsername && !eventType.profile) {
          throw new CalIntError(
            "MISSING_USER_OR_PROFILE_INFO",
            "MISSING_USER_OR_PROFILE_INFO",
          );
        }

        return {
          name: eventType.name,
          slug: eventType.slug || "",
          scheduleUri: eventType.scheduling_url,
          uri: eventType.uri,
          calUserUri: calUserUri || eventType.profile?.owner || "",
          calUsername: calUsername || eventType.profile?.name || "",
          companyId,
        };
      },
      "mapEventTypeToDb",
      "general",
      undefined,
      { eventType, companyId, calUserUri, calUsername },
    );
  }

  private async saveEventTypes(
    eventTypes: NewCalEventType[],
    userId?: number,
  ): PromiseReturn<void> {
    return withLogging(
      this.logger,
      async () => {
        const [error, result] = await this.querier.addAllEventTypes(eventTypes);
        if (error) throw error;
        return undefined;
      },
      "saveEventTypes",
      "db",
      undefined,
      { eventTypes, userId },
    );
  }

  async getAndSaveAllEventTypes(
    userId: number,
    companyId: string,
  ): PromiseReturn<GetEventTypesResponse> {
    return withLogging(
      this.logger,
      async () => {
        const [clientErr, client] = await this.checkClientInitialized();
        if (clientErr) throw clientErr;

        const [eventTypesErr, eventTypes] = await client.getAllEventTypes();
        if (eventTypesErr)
          throw new CalIntError(
            "CALENDLY_API_ERROR",
            "CALENDLY_API_ERROR",
            false,
            { originalError: eventTypesErr },
          );

        const dbEventTypes: NewCalEventType[] = [];
        for (const et of eventTypes.collection) {
          const [mapErr, dbEventType] = await this.mapEventTypeToDb(
            et,
            companyId,
          );
          if (mapErr)
            throw new CalIntError(
              "EVENT_TYPE_MAPPING_ERROR",
              "EVENT_TYPE_MAPPING_ERROR",
              false,
              { originalError: mapErr },
            );
          dbEventTypes.push(dbEventType);
        }

        const [saveErr] = await this.saveEventTypes(dbEventTypes, userId);
        if (saveErr)
          throw new CalIntError(
            "EVENT_TYPE_SAVE_ERROR",
            "EVENT_TYPE_SAVE_ERROR",
            false,
            { originalError: saveErr },
          );

        return eventTypes;
      },
      "getAndSaveAllEventTypes",
      "general",
      undefined,
      { userId, companyId },
    );
  }

  private getUsers(): PromiseReturn<{ uri: string; name: string }[]> {
    return withLogging(
      this.logger,
      async () => {
        const [clientErr, client] = await this.checkClientInitialized();
        if (clientErr) throw clientErr;

        const [err, res] = await client.getOrganizationMemberships();
        if (err)
          throw new CalIntError(
            "USER_RETRIEVAL_ERROR",
            "USER_RETRIEVAL_ERROR",
            false,
            { originalError: err },
          );

        return res.collection.map((m) => ({
          uri: m.user.uri,
          name: m.user.name,
        }));
      },
      "getUsers",
      "api",
    );
  }

  async findSharedEventTypes(
    userId: number,
    companyId: string,
  ): PromiseReturn<boolean> {
    return withLogging(
      this.logger,
      async () => {
        const [clientErr, client] = await this.checkClientInitialized();
        if (clientErr) throw clientErr;

        const [usersErr, users] = await this.getUsers();
        if (usersErr) throw usersErr;

        const userPromises = users.map(async (user) => {
          const [eventErr, eventTypes] = await client.getEventTypesByUserId(
            user.uri,
          );
          if (eventErr)
            throw new CalIntError(
              "CALENDLY_API_ERROR",
              "CALENDLY_API_ERROR",
              false,
              { originalError: eventErr },
            );

          const dbEventTypes: NewCalEventType[] = await Promise.all(
            eventTypes.collection.map(async (et) => {
              const [mapErr, dbEventType] = await this.mapEventTypeToDb(
                et,
                companyId,
                user.uri,
                user.name,
              );
              if (mapErr)
                throw new CalIntError(
                  "EVENT_TYPE_MAPPING_ERROR",
                  "EVENT_TYPE_MAPPING_ERROR",
                  false,
                  { originalError: mapErr },
                );
              return dbEventType;
            }),
          );

          return dbEventTypes;
        });

        const results = await Promise.all(userPromises);
        const allEventTypes = results.flat();
        this.removeDuplicateEventTypes(allEventTypes);

        const uniqueEventTypes = Array.from(this.eventTypeMap.values());
        const [saveErr] = await this.saveEventTypes(uniqueEventTypes, userId);
        if (saveErr)
          throw new CalIntError(
            "EVENT_TYPE_SAVE_ERROR",
            "EVENT_TYPE_SAVE_ERROR",
            false,
            { originalError: saveErr },
          );

        return true;
      },
      "findSharedEventTypes",
      "general",
      undefined,
      { userId, companyId },
    );
  }

  private removeDuplicateEventTypes(eventTypes: NewCalEventType[]): void {
    for (const eventType of eventTypes) {
      if (!this.eventTypeMap.has(eventType.uri)) {
        this.eventTypeMap.set(eventType.uri, eventType);
      }
    }
  }
}
