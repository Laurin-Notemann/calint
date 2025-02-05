import { AccountLogin, DatabaseQueries, PromiseReturn } from "@/db/queries";
import { CalendlyClient, CalendlyResponse } from "../calendly-client";
import createLogger, { logError } from "@/utils/logger";
import { NewCalEventType } from "@/db/schema";

export class CalendlyController {
  private logger = createLogger("CalendlyController");
  calClient: CalendlyClient | null = null;
  querier: DatabaseQueries;
  constructor(querier: DatabaseQueries) {
    this.querier = querier;
  }

  async setCalendlyClient(accessToken: string, refreshToken: string) {
    this.calClient = new CalendlyClient({
      accessToken,
      refreshToken,
    });
  }

  async getAndSaveAllEventTypes(
    userId: number,
    companyId: string,
  ): PromiseReturn<CalendlyResponse> {
    if (!this.calClient) {
      const err = new Error(
        "this.calClient was not set (call setCalendlyClient before using getAndSaveAllEventTypes",
      );
      logError(this.logger, err, { context: "getAndSaveAllEventTypes" });
      return [
        {
          message: "" + err,
          error: err,
        },
        null,
      ] as const;
    }
    const [eventTypesErr, eventTypes] = await this.calClient.getAllEventTypes();

    if (eventTypesErr) {
      logError(this.logger, eventTypesErr.error, {
        context: "getEventTypes",
        details: eventTypesErr.error.details,
        userId,
      });
      return [eventTypesErr, null] as const;
    }

    const dbEventTypes: NewCalEventType[] = eventTypes.collection.map(
      (eventType) => {
        return {
          name: eventType.name,
          slug: eventType.slug,
          scheduleUri: eventType.scheduling_url,
          uri: eventType.uri,
          calUserUri: eventType.profile.owner,
          calUsername: eventType.profile.name,
          companyId,
        };
      },
    );

    const [addEventTypesErr, _] =
      await this.querier.addAllEventTypes(dbEventTypes);

    if (addEventTypesErr) {
      logError(this.logger, addEventTypesErr.error, {
        context: "addEventTypes",
        details: addEventTypesErr.error.details,
        userId,
      });
      return [addEventTypesErr, null] as const;
    }

    return [null, eventTypes] as const;
  }
}
