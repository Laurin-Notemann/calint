import { and, eq, inArray, sql } from "drizzle-orm";
import db from "./db";
import {
  calendlyAccs,
  CalendlyEvent,
  calendlyEvents,
  CalEventType,
  calEventTypes,
  companies,
  Company,
  eventActivityTypesMapping,
  NewCalendlyEvent,
  NewCalEventType,
  NewCompany,
  NewPipedriveActivity,
  NewPipedriveActivityType,
  NewPipedriveDeal,
  NewPipedrivePerson,
  NewTypeMappingType,
  pipedriveActivities,
  PipedriveActivity,
  PipedriveActivityType,
  pipedriveActivityTypes,
  pipedriveDeals,
  pipedrivePeople,
  TypeMappingType,
  User,
  UserCalendly,
  users,
} from "./schema";
import { logDBError, logDBOperation } from "@/utils/db-logger";
import {
  Activity,
  GetCurrentUserResponseAllOfData,
  TokenResponse,
} from "pipedrive/v1";

import { ERROR_MESSAGES } from "@/lib/constants";

export type PromiseReturn<T> = Promise<
  Readonly<[CalIntError, null] | [null, T]>
>;

export class DatabaseQueries {
  constructor() { }

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

  async getCalendlyEventsAndPipeDriveActivitiesByPipedriveActivities(
    activities: Activity[],
    companyId: string,
    dealId: number,
  ): PromiseReturn<
    { calendlyEvent: CalendlyEvent; pipedriveActivity: PipedriveActivity }[]
  > {
    return this.withErrorHandling(
      () => {
        const activityIds = activities.map((activity) => activity.id);

        return db
          .select({
            calendlyEvent: calendlyEvents,
            pipedriveActivity: pipedriveActivities,
          })
          .from(pipedriveActivities)
          .innerJoin(
            pipedriveDeals,
            eq(pipedriveActivities.pipedriveDealId, pipedriveDeals.id),
          )
          .innerJoin(
            calendlyEvents,
            eq(pipedriveActivities.calendlyEventId, calendlyEvents.id),
          )
          .where(
            and(
              inArray(pipedriveActivities.pipedriveId, activityIds),
              eq(pipedriveDeals.companyId, companyId),
              eq(pipedriveDeals.pipedriveId, dealId),
            ),
          );
      },
      "getCalendlyEventsByPipedriveActivities",
      { activities, companyId, dealId },
    );
  }

  async updateCalendlyEvent(
    event: CalendlyEvent,
  ): PromiseReturn<CalendlyEvent> {
    return this.withErrorHandling(
      async () => {
        const updatedEvent = await db
          .update(calendlyEvents)
          .set(event)
          .where(eq(calendlyEvents.uri, event.uri))
          .returning();

        if (updatedEvent.length === 0) {
          throw new Error(ERROR_MESSAGES.CALENDLY_EVENT_UPDATE_FAILED);
        }

        return updatedEvent[0];
      },
      "updateCalendlyEvent",
      { event },
    );
  }

  async updatePipedriveActivity(
    activity: PipedriveActivity,
  ): PromiseReturn<PipedriveActivity> {
    return this.withErrorHandling(
      async () => {
        const updatedActivity = await db
          .update(pipedriveActivities)
          .set(activity)
          .where(eq(pipedriveActivities.id, activity.id))
          .returning();

        if (updatedActivity.length === 0) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_UPDATE_FAILED);
        }

        return updatedActivity[0];
      },
      "updatePipedriveActivity",
      { activity },
    );
  }

  async getPipedriveActivityByEventId(eventId: string) {
    return this.withErrorHandling(
      async () => {
        const activity = await db
          .select()
          .from(pipedriveActivities)
          .where(eq(pipedriveActivities.calendlyEventId, eventId));

        if (activity.length === 0) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_NOT_FOUND);
        } else if (activity.length > 1)
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_TOO_MANY_FOUND);

        return activity[0];
      },
      "getPipedriveActivityById",
      { eventId },
    );
  }

  async getPipedriveActivityById(id: string) {
    return this.withErrorHandling(
      async () => {
        const activity = await db
          .select()
          .from(pipedriveActivities)
          .where(eq(pipedriveActivities.id, id));

        if (activity.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_NOT_FOUND);
        }

        return activity[0];
      },
      "getPipedriveActivityById",
      { id },
    );
  }

  async getPipedriveActivityTypeById(id: string) {
    return this.withErrorHandling(
      async () => {
        const activityType = await db
          .select()
          .from(pipedriveActivityTypes)
          .where(eq(pipedriveActivityTypes.id, id));

        if (activityType.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_TYPE_NOT_FOUND);
        }

        return activityType[0];
      },
      "getPipedriveActivityTypeById",
      { id },
    );
  }

  async getPipedriveDealByPersonId(companyId: string, personId: string) {
    return this.withErrorHandling(
      async () => {
        const deal = await db
          .select()
          .from(pipedriveDeals)
          .where(
            and(
              eq(pipedriveDeals.companyId, companyId),
              eq(pipedriveDeals.pipedrivePeopleId, personId),
            ),
          );

        if (deal.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND);
        }

        return deal[0];
      },
      "getPipedriveDealByDealId",
      { companyId, personId },
    );
  }

  async getPipedriveDealByDealId(companyId: string, dealId: number) {
    return this.withErrorHandling(
      async () => {
        const deal = await db
          .select()
          .from(pipedriveDeals)
          .where(
            and(
              eq(pipedriveDeals.companyId, companyId),
              eq(pipedriveDeals.pipedriveId, dealId),
            ),
          );

        if (deal.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND);
        }

        return deal[0];
      },
      "getPipedriveDealByDealId",
      { companyId, dealId },
    );
  }

  async getPipedrivePersonById(id: string) {
    return this.withErrorHandling(
      async () => {
        const person = await db
          .select()
          .from(pipedrivePeople)
          .where(eq(pipedrivePeople.id, id));

        if (person.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND);
        }

        return person[0];
      },
      "getPipedrivePersonById",
      { id },
    );
  }

  async getPipedrivePersonByPipedriveId(
    companyId: string,
    pipedriveId: number,
  ) {
    return this.withErrorHandling(
      async () => {
        const person = await db
          .select()
          .from(pipedrivePeople)
          .where(
            and(
              eq(pipedrivePeople.companyId, companyId),
              eq(pipedrivePeople.pipedriveId, pipedriveId),
            ),
          );

        if (person.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND);
        }

        return person[0];
      },
      "getPipedrivePersonByPipedriveId",
      { companyId, pipedriveId },
    );
  }

  async getPipedrivePersonByEmail(companyId: string, email: string) {
    return this.withErrorHandling(
      async () => {
        const person = await db
          .select()
          .from(pipedrivePeople)
          .where(
            and(
              eq(pipedrivePeople.companyId, companyId),
              eq(pipedrivePeople.email, email),
            ),
          );

        if (person.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND);
        }

        return person[0];
      },
      "getPipedrivePersonByEmail",
      { companyId, email },
    );
  }

  async createPipedriveDeal(newDeal: NewPipedriveDeal) {
    return this.withErrorHandling(
      async () => {
        const deal = await db
          .insert(pipedriveDeals)
          .values(newDeal)
          .returning();

        if (deal.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_DEAL_CREATION_FAILED);
        }

        return deal[0];
      },
      "createPipedriveDeal",
      { newDeal },
    );
  }

  async createPipedrivePerson(newPerson: NewPipedrivePerson) {
    return this.withErrorHandling(
      async () => {
        const person = await db
          .insert(pipedrivePeople)
          .values(newPerson)
          .returning();

        if (person.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_PERSON_CREATION_FAILED);
        }

        return person[0];
      },
      "createPipedrivePerson",
      { newPerson },
    );
  }

  async createCalendlyEvent(
    newEvent: NewCalendlyEvent,
  ): PromiseReturn<CalendlyEvent> {
    return this.withErrorHandling(
      async () => {
        const calendlyEvent = await db
          .insert(calendlyEvents)
          .values(newEvent)
          .returning();

        if (calendlyEvent.length !== 1) {
          throw new Error(ERROR_MESSAGES.CALENDLY_EVENT_CREATION_FAILED);
        }

        return calendlyEvent[0];
      },
      "createCalendlyEvent",
      { newEvent },
    );
  }

  async createPipedriveActivity(
    newActivity: NewPipedriveActivity,
  ): PromiseReturn<PipedriveActivity> {
    return this.withErrorHandling(
      async () => {
        const activity = await db
          .insert(pipedriveActivities)
          .values(newActivity)
          .returning();

        if (activity.length !== 1) {
          throw new Error(ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_CREATION_FAILED);
        }

        return activity[0];
      },
      "createPipedriveActivity",
      { newActivity },
    );
  }

  async getEventByUri(uri: string): PromiseReturn<CalendlyEvent> {
    return this.withErrorHandling(
      async () => {
        const event = await db
          .select()
          .from(calendlyEvents)
          .where(eq(calendlyEvents.uri, uri));

        if (event.length === 0) {
          throw new Error(ERROR_MESSAGES.CALENDLY_EVENT_NOT_FOUND);
        } else if (event.length > 1) {
          throw new Error(ERROR_MESSAGES.CALENDLY_EVENT_NOT_FOUND);
        }

        return event[0];
      },
      "getEventByUri",
      { uri },
    );
  }

  async getEventTypeByUri(uri: string): PromiseReturn<CalEventType> {
    return this.withErrorHandling(
      async () => {
        const eventType = await db
          .select()
          .from(calEventTypes)
          .where(eq(calEventTypes.uri, uri));

        if (eventType.length !== 1) {
          throw new Error(ERROR_MESSAGES.EVENT_TYPE_NOT_FOUND);
        }

        return eventType[0];
      },
      "getEventTypeByUri",
      { uri },
    );
  }

  async getTypeMappingsByEventTypeId(
    calendlyEventTypeId: string,
  ): PromiseReturn<TypeMappingType[]> {
    return this.withErrorHandling(
      () => {
        return db
          .select()
          .from(eventActivityTypesMapping)
          .where(
            eq(
              eventActivityTypesMapping.calendlyEventTypeId,
              calendlyEventTypeId,
            ),
          );
      },
      "getTypeMapping",
      { calendlyEventTypeId },
    );
  }

  async getTypeMapping(
    type: TypeMappingType["type"],
    companyId: string,
    calendlyEventTypeId: string,
  ): PromiseReturn<TypeMappingType | null> {
    return this.withErrorHandling(
      async () => {
        const mapping = await db
          .select()
          .from(eventActivityTypesMapping)
          .where(
            and(
              eq(eventActivityTypesMapping.type, type),
              eq(eventActivityTypesMapping.companyId, companyId),
              eq(
                eventActivityTypesMapping.calendlyEventTypeId,
                calendlyEventTypeId,
              ),
            ),
          );

        return mapping.length > 0 ? mapping[0] : null;
      },
      "getTypeMapping",
      { type, companyId, calendlyEventTypeId },
    );
  }

  async updateTypeMapping(
    typeMapping: NewTypeMappingType,
  ): PromiseReturn<TypeMappingType> {
    return this.withErrorHandling(
      async () => {
        const updatedMapping = await db
          .update(eventActivityTypesMapping)
          .set(typeMapping)
          .where(
            and(
              eq(eventActivityTypesMapping.type, typeMapping.type),
              eq(eventActivityTypesMapping.companyId, typeMapping.companyId),
              eq(
                eventActivityTypesMapping.calendlyEventTypeId,
                typeMapping.calendlyEventTypeId,
              ),
            ),
          )
          .returning();

        if (updatedMapping.length === 0) {
          throw new Error(ERROR_MESSAGES.TYPE_MAPPING_UPDATE_FAILED);
        }

        return updatedMapping[0];
      },
      "updateTypeMapping",
      { typeMapping },
    );
  }

  async createTypeMapping(
    typeMapping: NewTypeMappingType,
  ): PromiseReturn<TypeMappingType> {
    return this.withErrorHandling(
      async () => {
        const newMapping = await db
          .insert(eventActivityTypesMapping)
          .values(typeMapping)
          .returning();

        if (newMapping.length === 0) {
          throw new Error(ERROR_MESSAGES.TYPE_MAPPING_CREATION_FAILED);
        }

        return newMapping[0];
      },
      "createTypeMapping",
      { typeMapping },
    );
  }

  async updateOrCreateTypeMapping(
    typeMapping: NewTypeMappingType,
  ): PromiseReturn<TypeMappingType> {
    return this.withErrorHandling(
      async () => {
        const [existingMappingError, existingMapping] =
          await this.getTypeMapping(
            typeMapping.type,
            typeMapping.companyId,
            typeMapping.calendlyEventTypeId,
          );

        if (existingMappingError) throw existingMappingError;

        if (existingMapping) {
          const [updateError, updatedMapping] =
            await this.updateTypeMapping(typeMapping);
          if (updateError) throw updateError;
          return updatedMapping;
        }
        const [createError, newMapping] =
          await this.createTypeMapping(typeMapping);
        if (createError) throw createError;
        return newMapping;
      },
      "updateOrCreateTypeMapping",
      { typeMapping },
    );
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

  async getAllActivityTypes(
    companyId: string,
  ): PromiseReturn<PipedriveActivityType[]> {
    return this.withErrorHandling(
      () => {
        return db
          .select()
          .from(pipedriveActivityTypes)
          .where(eq(pipedriveActivityTypes.companyId, companyId));
      },
      "getAllActivityTypes",
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

  async checkExistingEventTypes(eventTypes: NewCalEventType[]): PromiseReturn<{
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

  async getUserAndCalendlyAccByCalendlyEmail(
    email: string,
  ): PromiseReturn<UserCalendly> {
    return this.withErrorHandling(
      async () => {
        const res = await db
          .select()
          .from(users)
          .innerJoin(calendlyAccs, eq(users.id, calendlyAccs.userId))
          .where(eq(calendlyAccs.email, email));

        if (res.length != 1) {
          throw new Error(ERROR_MESSAGES.USER_NOT_FOUND);
        }

        return res[0];
      },
      "getUserAndCalendlyAccByCalendlyEmail",
      { email },
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

        if (error) {
          if (
            error.error.toString().includes(ERROR_MESSAGES.COMPANY_NOT_FOUND)
          ) {
            const [createError, createdCompany] =
              await this.createCompany(companyValues);
            if (createError) throw createError;
            return createdCompany;
          } else {
            throw error;
          }
        }

        if (company) return company;

        throw new Error("Unexpected state: No company and no error");
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
          pipedriveId: user.company_id!,
        });

        if (error) throw error;

        const createdUserList = await db
          .insert(users)
          .values({
            id: user.id,
            email: user.email!,
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
          email: calendlyUser.email,
          name: calendlyUser.name,
          organization: calendlyUser.current_organization,
          accessToken,
          refreshToken,
          expiresAt,
        });

        const [err, user] = await this.getUser(userId);

        if (err) throw err.error;

        return user;
      },
      "addCalendlyAccountToUser",
      { userId, calendlyUser },
    );
  }

  async loginWithCalendly(
    calendlyUri: string,
    creds: AccountLogin,
    userId?: number,
  ): PromiseReturn<User | null> {
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

        if (!userId)
          return null;

        const [err, user] = await this.getUser(userId);
        if (err) throw err.error;

        return user;
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
