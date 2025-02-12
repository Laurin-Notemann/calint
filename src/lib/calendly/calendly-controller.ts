import { CalIntError, DatabaseQueries, PromiseReturn } from "@/db/queries";
import {
  CalendlyClient,
  GetEventTypesResponse,
  EventType,
} from "../calendly-client";
import createLogger, { logError } from "@/utils/logger";
import { NewCalEventType } from "@/db/schema";

export class CalendlyController {
  private logger = createLogger("CalendlyController");
  private calClient: CalendlyClient | null = null;
  private querier: DatabaseQueries;

  constructor(querier: DatabaseQueries) {
    this.querier = querier;
  }

  async setCalendlyClient(accessToken: string, refreshToken: string) {
    this.calClient = new CalendlyClient({
      accessToken,
      refreshToken,
    });
  }

  private checkClientInitialized() {
    if (!this.calClient) {
      const err = new Error(
        "this.calClient was not set (call setCalendlyClient first)",
      );
      logError(this.logger, err, { context: "checkClientInitialized" });
      return [{ message: "" + err, error: err } as CalIntError, null] as const;
    }
    return [null, this.calClient] as const;
  }

  private mapEventTypeToDb(
    eventType: EventType,
    companyId: string,
    calUserUri?: string,
    calUsername?: string,
  ) {
    if (!eventType.name || !eventType.slug) {
      const err = new Error('Event type name and slug are required');
      logError(this.logger, err, { context: "mapEventTypeToDb" });
      return [{ message: "" + err, error: err } as CalIntError, null] as const;
    }

    if (!calUserUri && !calUsername && !eventType.profile) {
      const err = new Error('Either calUserUri and calUsername or eventType.profile must be provided');
      logError(this.logger, err, { context: "mapEventTypeToDb" });
      return [{ message: "" + err, error: err } as CalIntError, null] as const;
    }

    return [null, {
      name: eventType.name,
      slug: eventType.slug,
      scheduleUri: eventType.scheduling_url,
      uri: eventType.uri,
      calUserUri: calUserUri || eventType.profile?.owner || '',
      calUsername: calUsername || eventType.profile?.name || '',
      companyId,
    }] as const;
  }

  private async saveEventTypes(eventTypes: NewCalEventType[], userId?: number) {
    const [err, result] = await this.querier.addAllEventTypes(eventTypes);
    if (err) {
      logError(this.logger, err.error, {
        context: "addEventTypes",
        details: err.error.details,
        userId,
      });
      return [err, null] as const;
    }
    return [null, result] as const;
  }

  async getAndSaveAllEventTypes(
    userId: number,
    companyId: string,
  ): PromiseReturn<GetEventTypesResponse> {
    const [clientErr, client] = this.checkClientInitialized();
    if (clientErr) return [clientErr, null];

    const [eventTypesErr, eventTypes] = await client.getAllEventTypes();
    if (eventTypesErr) {
      logError(this.logger, eventTypesErr.error, {
        context: "getEventTypes",
        details: eventTypesErr.error.details,
        userId,
      });
      return [eventTypesErr, null];
    }

    const dbEventTypes: NewCalEventType[] = [];
    for (const et of eventTypes.collection) {
      const [mapErr, dbEventType] = this.mapEventTypeToDb(et, companyId);
      if (mapErr) return [mapErr, null];
      dbEventTypes.push(dbEventType);
    }

    const [saveErr] = await this.saveEventTypes(dbEventTypes, userId);
    if (saveErr) return [saveErr, null];

    return [null, eventTypes];
  }

  private async getUsers() {
    const [clientErr, client] = this.checkClientInitialized();
    if (clientErr) return [clientErr, null] as const;

    const [err, res] = await client.getOrganizationMemberships();
    if (err) {
      logError(this.logger, err.error, {
        context: "getUsers",
        details: err.error.details,
      });
      return [err, null] as const;
    }

    return [null, res.collection.map((m) => ({ uri: m.user.uri, name: m.user.name }))] as const;
  }

  async findSharedEventTypes(userId: number, companyId: string) {
    const [clientErr, client] = this.checkClientInitialized();
    if (clientErr) return [clientErr, null] as const;

    const [usersErr, users] = await this.getUsers();
    if (usersErr) return [usersErr, null] as const;

    for (const user of users) {
      const [eventErr, eventTypes] = await client.getEventTypesByUserId(
        user.uri,
      );
      if (eventErr) {
        logError(this.logger, eventErr.error, {
          context: "findSharedEventTypes",
          details: eventErr.error.details,
        });
        return [eventErr, null] as const;
      }

      const dbEventTypes: NewCalEventType[] = [];
      for (const et of eventTypes.collection) {
        const [mapErr, dbEventType] = this.mapEventTypeToDb(et, companyId, user.uri, user.name);
        if (mapErr) return [mapErr, null];
        dbEventTypes.push(dbEventType);
      }

      const [saveErr] = await this.saveEventTypes(dbEventTypes, userId);
      if (saveErr) return [saveErr, null] as const;
    }

    return [null, true] as const;
  }
}
