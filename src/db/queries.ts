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
import {
  Activity,
  GetCurrentUserResponseAllOfData,
  TokenResponse,
} from "pipedrive/v1";

import { Logger } from "pino";
import createLogger, {
  withLogging,
  CalIntError,
  ERROR_MESSAGES,
  PromiseReturn,
} from "@/utils/logger";

export class DatabaseQueries {
  private logger: Logger;

  constructor() {
    this.logger = createLogger("DatabaseQueries");
  }

  async returnActivitiesWithActiveMapping(
    activities: Activity[],
    companyId: string,
  ) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const typeKeyStrings = activities.map((activity) => activity.type);

        const mappings = await db
          .select()
          .from(eventActivityTypesMapping)
          .innerJoin(
            pipedriveActivityTypes,
            eq(
              pipedriveActivityTypes.id,
              eventActivityTypesMapping.pipedriveActivityTypeId,
            ),
          )
          .where(
            and(
              inArray(pipedriveActivityTypes.keyString, typeKeyStrings),
              eq(eventActivityTypesMapping.companyId, companyId),
            ),
          );

        const mappingsKeyString = mappings.map(
          (mapping) => mapping.pipedrive_activity_types.keyString,
        );

        return activities.filter((activity) =>
          mappingsKeyString.includes(activity.type),
        );
      },
      "returnActivitiesWithActiveMapping",
      "db",
      undefined,
      { activities, companyId },
    );
  }

  async getCalendlyEventsAndPipeDriveActivitiesByPipedriveActivities(
    activities: Activity[],
    companyId: string,
    dealId: number,
  ) {
    return withLogging(
      this.logger,
      "info",
      () => {
        const activityIds = activities.map((activity) => activity.id);

        return db
          .select({
            calendlyEvent: calendlyEvents,
            pipedriveActivity: pipedriveActivities,
            pipedriveActivityType: pipedriveActivityTypes,
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
          .innerJoin(
            pipedriveActivityTypes,
            eq(pipedriveActivityTypes.id, pipedriveActivities.activityTypeId),
          )
          .where(
            and(
              inArray(pipedriveActivities.pipedriveId, activityIds),
              eq(pipedriveDeals.companyId, companyId),
              eq(pipedriveDeals.pipedriveId, dealId),
            ),
          );
      },
      "getCalendlyEventsAndPipeDriveActivitiesByPipedriveActivities",
      "db",
      undefined,
      { activities, companyId, dealId },
    );
  }

  async updateCalendlyEvent(
    event: CalendlyEvent,
  ): PromiseReturn<CalendlyEvent> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const updatedEvent = await db
          .update(calendlyEvents)
          .set(event)
          .where(eq(calendlyEvents.uri, event.uri))
          .returning();

        if (updatedEvent.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.CALENDLY_EVENT_UPDATE_FAILED,
            "CALENDLY_EVENT_UPDATE_FAILED",
          );
        }

        return updatedEvent[0];
      },
      "updateCalendlyEvent",
      "db",
      undefined,
      { event },
    );
  }

  async updatePipedriveActivity(
    activity: PipedriveActivity,
  ): PromiseReturn<PipedriveActivity> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const updatedActivity = await db
          .update(pipedriveActivities)
          .set(activity)
          .where(eq(pipedriveActivities.id, activity.id))
          .returning();

        if (updatedActivity.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_UPDATE_FAILED,
            "PIPEDRIVE_ACTIVITY_UPDATE_FAILED",
          );
        }

        return updatedActivity[0];
      },
      "updatePipedriveActivity",
      "db",
      undefined,
      { activity },
    );
  }

  async getPipedriveActivityByDealIdAndPipedriveId(
    dealId: number,
    companyId: string,
    id: number,
  ) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const activity = await db
          .select()
          .from(pipedriveActivities)
          .innerJoin(
            pipedriveDeals,
            and(
              eq(pipedriveDeals.id, pipedriveActivities.pipedriveDealId),
              eq(pipedriveDeals.companyId, companyId),
              eq(pipedriveDeals.pipedriveId, dealId),
            ),
          )
          .where(eq(pipedriveActivities.pipedriveId, id))
          .innerJoin(
            calendlyEvents,
            eq(calendlyEvents.id, pipedriveActivities.calendlyEventId),
          );

        if (activity.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_NOT_FOUND,
            "PIPEDRIVE_ACTIVITY_NOT_FOUND",
          );
        }

        return activity[0];
      },
      "getPipedriveActivityByDealIdAndPipedriveId",
      "db",
      undefined,
      { dealId, companyId, id },
    );
  }

  async getPipedriveActivityByEventId(eventId: string) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const activity = await db
          .select()
          .from(pipedriveActivities)
          .where(eq(pipedriveActivities.calendlyEventId, eventId));

        if (activity.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_NOT_FOUND,
            "PIPEDRIVE_ACTIVITY_NOT_FOUND",
          );
        } else if (activity.length > 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_TOO_MANY_FOUND,
            "PIPEDRIVE_ACTIVITY_TOO_MANY_FOUND",
          );
        }

        return activity[0];
      },
      "getPipedriveActivityById",
      "db",
      undefined,
      { eventId },
    );
  }

  async getPipedriveActivityById(id: string) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const activity = await db
          .select()
          .from(pipedriveActivities)
          .where(eq(pipedriveActivities.id, id));

        if (activity.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_NOT_FOUND,
            "PIPEDRIVE_ACTIVITY_NOT_FOUND",
          );
        }

        return activity[0];
      },
      "getPipedriveActivityById",
      "db",
      undefined,
      { id },
    );
  }

  async getPipedriveActivityTypeById(id: string) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const activityType = await db
          .select()
          .from(pipedriveActivityTypes)
          .where(eq(pipedriveActivityTypes.id, id));

        if (activityType.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_TYPE_NOT_FOUND,
            "PIPEDRIVE_ACTIVITY_TYPE_NOT_FOUND",
          );
        }

        return activityType[0];
      },
      "getPipedriveActivityTypeById",
      "db",
      undefined,
      { id },
    );
  }

  async getPipedriveDealByPersonId(companyId: string, personId: string) {
    return withLogging(
      this.logger,
      "info",
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

        if (deal.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND,
            "PIPEDRIVE_DEAL_NOT_FOUND",
            true,
          );
        } else if (deal.length > 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_TOO_MANY_FOUND,
            "PIPEDRIVE_ACTIVITY_TOO_MANY_FOUND",
          );
        }

        return deal[0];
      },
      "getPipedriveDealByDealId",
      "db",
      undefined,
      { companyId, personId },
    );
  }

  async getPipedriveDealByDealId(companyId: string, dealId: number) {
    return withLogging(
      this.logger,
      "info",
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

        if (deal.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND,
            "PIPEDRIVE_DEAL_NOT_FOUND",
            true,
          );
        } else if (deal.length > 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_TOO_MANY_FOUND,
            "PIPEDRIVE_ACTIVITY_TOO_MANY_FOUND",
          );
        }

        return deal[0];
      },
      "getPipedriveDealByDealId",
      "db",
      undefined,
      { companyId, dealId },
    );
  }

  async getPipedrivePersonById(id: string) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const person = await db
          .select()
          .from(pipedrivePeople)
          .where(eq(pipedrivePeople.id, id));

        if (person.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND,
            "PIPEDRIVE_PERSON_NOT_FOUND",
          );
        }

        return person[0];
      },
      "getPipedrivePersonById",
      "db",
      undefined,
      { id },
    );
  }

  async getPipedrivePersonByPipedriveId(
    companyId: string,
    pipedriveId: number,
  ) {
    return withLogging(
      this.logger,
      "info",
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

        if (person.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND,
            "PIPEDRIVE_PERSON_NOT_FOUND",
            true,
          );
        } else if (person.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_PERSON_TOO_MANY_FOUND,
            "PIPEDRIVE_PERSON_TOO_MANY_FOUND",
          );
        }

        return person[0];
      },
      "getPipedrivePersonByPipedriveId",
      "db",
      undefined,
      { companyId, pipedriveId },
    );
  }

  async getPipedrivePersonByEmail(companyId: string, email: string) {
    return withLogging(
      this.logger,
      "info",
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

        if (person.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND,
            "PIPEDRIVE_PERSON_NOT_FOUND",
            true,
          );
        } else if (person.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_PERSON_TOO_MANY_FOUND,
            "PIPEDRIVE_PERSON_TOO_MANY_FOUND",
          );
        }

        return person[0];
      },
      "getPipedrivePersonByEmail",
      "db",
      undefined,
      { companyId, email },
    );
  }

  async createPipedriveDeal(newDeal: NewPipedriveDeal) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const deal = await db
          .insert(pipedriveDeals)
          .values(newDeal)
          .returning();

        if (deal.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_DEAL_CREATION_FAILED,
            "PIPEDRIVE_DEAL_CREATION_FAILED",
          );
        }

        return deal[0];
      },
      "createPipedriveDeal",
      "db",
      undefined,
      { newDeal },
    );
  }

  async createPipedrivePerson(newPerson: NewPipedrivePerson) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const person = await db
          .insert(pipedrivePeople)
          .values(newPerson)
          .returning();

        if (person.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_PERSON_CREATION_FAILED,
            "PIPEDRIVE_PERSON_CREATION_FAILED",
          );
        }

        return person[0];
      },
      "createPipedrivePerson",
      "db",
      undefined,
      { newPerson },
    );
  }

  async createCalendlyEvent(
    newEvent: NewCalendlyEvent,
  ): PromiseReturn<CalendlyEvent> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const calendlyEvent = await db
          .insert(calendlyEvents)
          .values(newEvent)
          .returning();

        if (calendlyEvent.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.CALENDLY_EVENT_CREATION_FAILED,
            "CALENDLY_EVENT_CREATION_FAILED",
          );
        }

        return calendlyEvent[0];
      },
      "createCalendlyEvent",
      "db",
      undefined,
      { newEvent },
    );
  }

  async createPipedriveActivity(
    newActivity: NewPipedriveActivity,
  ): PromiseReturn<PipedriveActivity> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const activity = await db
          .insert(pipedriveActivities)
          .values(newActivity)
          .returning();

        if (activity.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_CREATION_FAILED,
            "PIPEDRIVE_ACTIVITY_CREATION_FAILED",
          );
        }

        return activity[0];
      },
      "createPipedriveActivity",
      "db",
      undefined,
      { newActivity },
    );
  }

  async getEventByUri(uri: string): PromiseReturn<CalendlyEvent> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const event = await db
          .select()
          .from(calendlyEvents)
          .where(eq(calendlyEvents.uri, uri));

        if (event.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.CALENDLY_EVENT_NOT_FOUND,
            "CALENDLY_EVENT_NOT_FOUND",
            true,
          );
        } else if (event.length > 1) {
          throw new CalIntError(
            ERROR_MESSAGES.CALENDLY_EVENT_TOO_MANY_FOUND,
            "CALENDLY_EVENT_TOO_MANY_FOUND",
          );
        }

        return event[0];
      },
      "getEventByUri",
      "db",
      undefined,
      { uri },
    );
  }

  async getEventTypeByUri(uri: string): PromiseReturn<CalEventType> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const eventType = await db
          .select()
          .from(calEventTypes)
          .where(eq(calEventTypes.uri, uri));

        if (eventType.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.EVENT_TYPE_NOT_FOUND,
            "EVENT_TYPE_NOT_FOUND",
          );
        }

        return eventType[0];
      },
      "getEventTypeByUri",
      "db",
      undefined,
      { uri },
    );
  }

  async getTypeMappingsByActivityId(companyId: string, keyString: string) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const firstMapping = await db
          .select({
            eventTypeId: eventActivityTypesMapping.calendlyEventTypeId,
          })
          .from(eventActivityTypesMapping)
          .innerJoin(
            pipedriveActivityTypes,
            and(
              eq(
                pipedriveActivityTypes.id,
                eventActivityTypesMapping.pipedriveActivityTypeId,
              ),
              eq(pipedriveActivityTypes.companyId, companyId),
            ),
          )
          .where(eq(pipedriveActivityTypes.keyString, keyString));

        if (firstMapping.length !== 1)
          throw new CalIntError(
            ERROR_MESSAGES.TYPE_MAPPING_NOT_FOUND,
            "TYPE_MAPPING_NOT_FOUND",
          );

        const [err, res] = await this.getTypeMappingsByEventTypeId(
          firstMapping[0].eventTypeId,
        );
        if (err) throw err;

        return res;
      },
      "getTypeMappingsByActivityId",
      "db",
      undefined,
      { companyId, keyString },
    );
  }

  async getTypeMappingsByEventTypeId(
    calendlyEventTypeId: string,
  ): PromiseReturn<TypeMappingType[]> {
    return withLogging(
      this.logger,
      "info",
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
      "getTypeMappingsByEventTypeId",
      "db",
      undefined,
      { calendlyEventTypeId },
    );
  }

  async getTypeMapping(
    type: TypeMappingType["type"],
    companyId: string,
    calendlyEventTypeId: string,
  ): PromiseReturn<TypeMappingType | null> {
    return withLogging(
      this.logger,
      "info",
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
      "db",
      undefined,
      { type, companyId, calendlyEventTypeId },
    );
  }

  async updateTypeMapping(
    typeMapping: NewTypeMappingType,
  ): PromiseReturn<TypeMappingType> {
    return withLogging(
      this.logger,
      "info",
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
          throw new CalIntError(
            ERROR_MESSAGES.TYPE_MAPPING_UPDATE_FAILED,
            "TYPE_MAPPING_UPDATE_FAILED",
          );
        }

        return updatedMapping[0];
      },
      "updateTypeMapping",
      "db",
      undefined,
      { typeMapping },
    );
  }

  async createTypeMapping(
    typeMapping: NewTypeMappingType,
  ): PromiseReturn<TypeMappingType> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const newMapping = await db
          .insert(eventActivityTypesMapping)
          .values(typeMapping)
          .returning();

        if (newMapping.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.TYPE_MAPPING_CREATION_FAILED,
            "TYPE_MAPPING_CREATION_FAILED",
          );
        }

        return newMapping[0];
      },
      "createTypeMapping",
      "db",
      undefined,
      { typeMapping },
    );
  }

  async updateOrCreateTypeMapping(
    typeMapping: NewTypeMappingType,
  ): PromiseReturn<TypeMappingType> {
    return withLogging(
      this.logger,
      "info",
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
      "db",
      undefined,
      { typeMapping },
    );
  }

  async getAllTypeMappings(
    companyId: string,
  ): PromiseReturn<TypeMappingType[]> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        return await db
          .select()
          .from(eventActivityTypesMapping)
          .where(eq(eventActivityTypesMapping.companyId, companyId));
      },
      "getAllTypeMappings",
      "db",
      undefined,
      { companyId },
    );
  }

  async getAllEventTypes(companyId: string): PromiseReturn<CalEventType[]> {
    return withLogging(
      this.logger,
      "info",
      () => {
        return db
          .select()
          .from(calEventTypes)
          .where(eq(calEventTypes.companyId, companyId));
      },
      "getAllEventTypes",
      "db",
      undefined,
      { companyId },
    );
  }

  async getAllActivityTypes(
    companyId: string,
  ): PromiseReturn<PipedriveActivityType[]> {
    return withLogging(
      this.logger,
      "info",
      () => {
        return db
          .select()
          .from(pipedriveActivityTypes)
          .where(eq(pipedriveActivityTypes.companyId, companyId));
      },
      "getAllActivityTypes",
      "db",
      undefined,
      { companyId },
    );
  }

  async addAllEventTypes(
    eventTypes: NewCalEventType[],
  ): PromiseReturn<{ message: string; added: number; skipped?: number }> {
    return withLogging(
      this.logger,
      "info",
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
      "db",
      undefined,
      { eventTypes },
    );
  }

  async checkExistingEventTypes(eventTypes: NewCalEventType[]): PromiseReturn<{
    existing: CalEventType[];
    new: NewCalEventType[];
    hasConflicts: boolean;
  }> {
    return withLogging(
      this.logger,
      "info",
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
      "db",
      undefined,
      { eventTypes },
    );
  }

  async addAllActivityTypes(
    activityTypes: NewPipedriveActivityType[],
  ): PromiseReturn<{ message: string; added: number; skipped?: number }> {
    return withLogging(
      this.logger,
      "info",
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
      "db",
      undefined,
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
    return withLogging(
      this.logger,
      "info",
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
      "db",
      undefined,
      { activityTypes },
    );
  }

  async getAllUsersByCompanyId(id: string): PromiseReturn<UserCalendly[]> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const user = await db
          .select()
          .from(users)
          .innerJoin(calendlyAccs, eq(users.id, calendlyAccs.userId))
          .where(eq(users.companyId, id));

        if (user.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            "USER_NOT_FOUND",
          );
        }

        return user;
      },
      "getAllUsersByCompanyId",
      "db",
      undefined,
      { companyId: id },
    );
  }

  async getUser(userId: number): PromiseReturn<User> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const user = await db.select().from(users).where(eq(users.id, userId));

        if (user.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            "USER_NOT_FOUND",
          );
        }

        return user[0];
      },
      "getUser",
      "db",
      undefined,
      { userId },
    );
  }

  async getUserAndCalendlyAccByCalendlyEmail(
    email: string,
  ): PromiseReturn<UserCalendly> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const res = await db
          .select()
          .from(users)
          .innerJoin(calendlyAccs, eq(users.id, calendlyAccs.userId))
          .where(eq(calendlyAccs.email, email));

        if (res.length != 1) {
          throw new CalIntError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            "USER_NOT_FOUND",
          );
        }

        return res[0];
      },
      "getUserAndCalendlyAccByCalendlyEmail",
      "db",
      undefined,
      { email },
    );
  }

  async getUserAndCalendlyAcc(userId: number): PromiseReturn<UserCalendly> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const res = await db
          .select()
          .from(users)
          .innerJoin(calendlyAccs, eq(users.id, calendlyAccs.userId))
          .where(eq(users.id, userId));

        if (res.length != 1) {
          throw new CalIntError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            "USER_NOT_FOUND",
          );
        }

        return res[0];
      },
      "getUserAndCalendlyAcc",
      "db",
      undefined,
      { userId },
    );
  }

  async getCompanyById(companyId: string): PromiseReturn<Company> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const company = await db
          .select()
          .from(companies)
          .where(eq(companies.id, companyId));

        if (company.length < 1) {
          throw new CalIntError(
            ERROR_MESSAGES.COMPANY_NOT_FOUND,
            "COMPANY_NOT_FOUND",
          );
        } else if (company.length > 1) {
          throw new CalIntError(
            ERROR_MESSAGES.TOO_MANY_COMPANIES_FOUND,
            "TOO_MANY_COMPANIES_FOUND",
          );
        }

        return company[0];
      },
      "getCompanyById",
      "db",
      undefined,
      { companyId },
    );
  }

  async getCompanyByEventTypeUri(eventTypeUri: string) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const company = await db
          .select()
          .from(companies)
          .innerJoin(calEventTypes, eq(calEventTypes.companyId, companies.id))
          .where(eq(calEventTypes.uri, eventTypeUri));

        if (company.length !== 1)
          throw new CalIntError(
            ERROR_MESSAGES.COMPANY_NOT_FOUND,
            "COMPANY_NOT_FOUND",
          );

        return company[0].companies;
      },
      "getCompanyByCalendlyOrgUri",
      "db",
      undefined,
      { orgUri: eventTypeUri },
    );
  }

  async getCompany(companyDomain: string): PromiseReturn<Company> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const company = await db
          .select()
          .from(companies)
          .where(eq(companies.domain, companyDomain));

        if (company.length < 1) {
          throw new CalIntError(
            ERROR_MESSAGES.COMPANY_NOT_FOUND,
            "COMPANY_NOT_FOUND",
            true,
          );
        } else if (company.length > 1) {
          throw new CalIntError(
            ERROR_MESSAGES.TOO_MANY_COMPANIES_FOUND,
            "TOO_MANY_COMPANIES_FOUND",
          );
        }

        return company[0];
      },
      "getCompany",
      "db",
      undefined,
      { companyDomain },
    );
  }

  async createCompany(companyValues: NewCompany): PromiseReturn<Company> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const company = await db
          .insert(companies)
          .values(companyValues)
          .returning();

        if (company.length !== 1) {
          throw new CalIntError(
            ERROR_MESSAGES.COMPANY_CREATION_ERROR,
            "COMPANY_CREATION_ERROR",
          );
        }

        return company[0];
      },
      "createCompany",
      "db",
      undefined,
      { companyValues },
    );
  }

  async createCompanyOrReturnCompany(
    companyValues: NewCompany,
  ): PromiseReturn<Company> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const [error, company] = await this.getCompany(companyValues.domain);

        if (error) {
          if (error.code === "COMPANY_NOT_FOUND") {
            const [createError, createdCompany] =
              await this.createCompany(companyValues);
            if (createError) throw createError;
            return createdCompany;
          } else {
            throw error;
          }
        }

        if (company) return company;

        throw new CalIntError(
          "Unexpected state: No company and no error",
          "UNEXPECTED_ERROR",
        );
      },
      "createCompanyOrReturnCompany",
      "db",
      undefined,
      { companyValues },
    );
  }

  async updateCompany(company: Company): PromiseReturn<Company> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const updatedCompany = await db
          .update(companies)
          .set(company)
          .where(eq(companies.id, company.id))
          .returning();

        if (updatedCompany.length === 0) {
          throw new CalIntError(
            ERROR_MESSAGES.COMPANY_UPDATE_FAILED,
            "COMPANY_UPDATE_FAILED",
          );
        }

        return updatedCompany[0];
      },
      "updateCompany",
      "db",
      undefined,
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
  ): PromiseReturn<boolean> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!user.id || !user.name) {
          throw new CalIntError(
            ERROR_MESSAGES.MISSING_REQUIRED_FIELDS,
            "MISSING_REQUIRED_FIELDS",
          );
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
          throw new CalIntError(
            ERROR_MESSAGES.USER_CREATION_FAILED,
            "USER_CREATION_FAILED",
          );
        }

        return true;
      },
      "createUser",
      "db",
      undefined,
      { user },
    );
  }

  async loginWithPipedrive(
    pipedriveAccId: number,
    logins: TokenResponse,
  ): PromiseReturn<boolean> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        await db.update(users).set(logins).where(eq(users.id, pipedriveAccId));
        return true;
      },
      "loginWithPipedrive",
      "db",
      undefined,
      { pipedriveAccId },
    );
  }

  async addCalendlyAccountToUser(
    userId: number,
    calendlyUser: CalendlyUser,
    { accessToken, refreshToken, expiresAt }: AccountLogin,
  ): PromiseReturn<User> {
    return withLogging(
      this.logger,
      "info",
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

        if (err) throw err;

        return user;
      },
      "addCalendlyAccountToUser",
      "db",
      undefined,
      { userId, calendlyUser },
    );
  }

  async loginWithCalendly(
    calendlyUri: string,
    creds: AccountLogin,
    userId?: number,
  ): PromiseReturn<User | null> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const formattedCreds = {
          ...creds,
          expiresAt: new Date(creds.expiresAt),
        };

        if (isNaN(formattedCreds.expiresAt.getTime())) {
          throw new CalIntError(
            "Invalid expiration date",
            "INVALID_EXPIRATION_DATE",
          );
        }

        await db
          .update(calendlyAccs)
          .set(formattedCreds)
          .where(eq(calendlyAccs.uri, calendlyUri));

        if (!userId) return null;

        const [err, user] = await this.getUser(userId);
        if (err) throw err;

        return user;
      },
      "loginWithCalendly",
      "db",
      undefined,
      { calendlyUri, userId },
    );
  }

  async checkUserExists(userId: number): PromiseReturn<User[]> {
    return withLogging(
      this.logger,
      "info",
      () => {
        return db.select().from(users).where(eq(users.id, userId));
      },
      "checkUserExists",
      "db",
      undefined,
      { userId },
    );
  }

  async checkCalendlyUserExist(userId: number): PromiseReturn<any[]> {
    return withLogging(
      this.logger,
      "info",
      () => {
        return db
          .select()
          .from(users)
          .innerJoin(calendlyAccs, eq(users.id, calendlyAccs.userId))
          .where(eq(users.id, userId))
          .limit(1);
      },
      "checkCalendlyUserExist",
      "db",
      undefined,
      { userId },
    );
  }
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
