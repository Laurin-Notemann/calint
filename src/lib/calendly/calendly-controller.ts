import { DatabaseQueries, PromiseReturn } from "@/db/queries";
import { CalendlyClient } from "../calendly-client";
import createLogger, { logError } from "@/utils/logger";
import {
  ActivityType,
  ActivityTypesApi,
  GetActivityTypesResponse,
} from "pipedrive/v1";
import { initAPIClient } from "../oauth";
import { NewCalEventType, NewPipedriveActivityType } from "@/db/schema";
import { SettingsDataRes } from "@/app/api/v1/settings-modal/route";

class CalendlyController {
  private logger = createLogger("CalendlyController");
  calClient: CalendlyClient;
  querier: DatabaseQueries;
  constructor(calClient: CalendlyClient, querier: DatabaseQueries) {
    this.calClient = calClient;
    this.querier = querier;
  }

  async getAndSaveAllEventTypes(
    userId: number,
  ): PromiseReturn<SettingsDataRes> {
    const [getUserErr, userCalendly] =
      await this.querier.getUserAndCalendlyAcc(userId);
    if (getUserErr) {
      logError(this.logger, getUserErr, {
        context: "getUserAndCalendlyAcc",
        userId,
      });
      return [getUserErr, null] as const;
    }

    const user = userCalendly.users;

    const pipedriveClient = initAPIClient({
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
    });

    const apiInstance = new ActivityTypesApi(pipedriveClient);

    let data: ActivityType[];

    try {
      const res: GetActivityTypesResponse =
        await apiInstance.getActivityTypes();
      data = res.data;
    } catch (error) {
      logError(this.logger, error, { context: "getActivityTypes", userId });
      return [
        {
          message: "Could not get ActivityTypes",
          error: error as any,
        },
        null,
      ] as const;
    }

    const calendlyAcc = userCalendly.calendly_accs;

    const calendlyClient = new CalendlyClient({
      accessToken: calendlyAcc.accessToken,
      refreshToken: calendlyAcc.refreshToken,
    });

    const [eventTypesErr, eventTypes] = await calendlyClient.getAllEventTypes();

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
          companyId: user.companyId,
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

    const dbActivityTypes: NewPipedriveActivityType[] = data.map(
      (activityType) => {
        return {
          name: activityType.name,
          pipedriveId: activityType.id,
          companyId: user.companyId,
        };
      },
    );

    const [addActivityTypesErr, __] =
      await this.querier.addAllActivityTypes(dbActivityTypes);

    if (addActivityTypesErr) {
      logError(this.logger, addActivityTypesErr.error, {
        context: "addActivityTypes",
        details: addActivityTypesErr.error.details,
        userId,
      });
      return [addActivityTypesErr, null] as const;
    }

    console.log(JSON.stringify(eventTypes));
    console.log(JSON.stringify(data));

    const responseData: SettingsDataRes = {
      data: {
        calendlyEventTypes: eventTypes,
        pipedriveAcitvityTypes: data,
      },
    };

    return [null, responseData] as const;
  }
}

const calendlyController = new CalendlyController();
