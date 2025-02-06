import { DatabaseQueries } from "@/db/queries";
import { CalendlyController } from "./calendly/calendly-controller";
import createLogger, { logError } from "@/utils/logger";
import { PipedriveController } from "./pipedrive/pipedrive-controller";
import { ActivityType } from "pipedrive/v1";
import { CalEventType } from "@/db/schema";

export type SettingsDataRes = {
  data: {
    calendlyEventTypes: CalEventType[];
    pipedriveAcitvityTypes: ActivityType[];
  };
};

export class CalintSetup {
  private logger = createLogger("CalintSetup");
  calendlyController: CalendlyController;
  pipedriveController: PipedriveController;
  querier: DatabaseQueries;
  constructor(
    calendlyController: CalendlyController,
    pipedriveController: PipedriveController,
    querier: DatabaseQueries,
  ) {
    this.calendlyController = calendlyController;
    this.querier = querier;
    this.pipedriveController = pipedriveController;
  }

  async getAndSaveAllEventTypesAndActivityTypes(userId: number) {
    const [getUserErr, user] = await this.querier.getUserAndCalendlyAcc(userId);
    if (getUserErr) {
      logError(this.logger, getUserErr, {
        context: "getAndSaveAllEventTypesAndActivityTypes",
        userId,
      });
      return [getUserErr, null] as const;
    }

    const pipedriveUser = user.users;
    const calAcc = user.calendly_accs;

    await this.pipedriveController.triggerTokenUpdate(pipedriveUser.id);

    const [activityTypesErr, activityTypes] =
      await this.pipedriveController.getAndSaveActiviyTypes(
        pipedriveUser.id,
        pipedriveUser.companyId,
      );
    if (activityTypesErr) {
      logError(this.logger, activityTypesErr, {
        context: "getAndSaveAllEventTypesAndActivityTypes",
        userId,
      });
      return [getUserErr, null] as const;
    }

    this.calendlyController.setCalendlyClient(
      calAcc.accessToken,
      calAcc.refreshToken,
    );

    const [eventTypesErr, eventTypes] =
      await this.calendlyController.getAndSaveAllEventTypes(
        pipedriveUser.id,
        pipedriveUser.companyId,
      );
    if (eventTypesErr) {
      logError(this.logger, eventTypesErr.error, {
        context: "getAndSaveAllEventTypesAndActivityTypes",
        userId,
      });
      return [getUserErr, null] as const;
    }

    const [eventTypesErrTwo] =
      await this.calendlyController.findSharedEventTypes(
        pipedriveUser.id,
        pipedriveUser.companyId,
      );
    if (eventTypesErrTwo) {
      logError(this.logger, eventTypesErrTwo.error, {
        context: "getAndSaveAllEventTypesAndActivityTypes",
        userId,
      });
      return [getUserErr, null] as const;
    }

    const [err, dbEventTypes] = await this.querier.getAllEventTypes(
      pipedriveUser.companyId,
    );
    if (err) {
      logError(this.logger, err.error, {
        context: "getAndSaveAllEventTypesAndActivityTypes",
        userId,
      });
      return [getUserErr, null] as const;
    }

    const responseData: SettingsDataRes = {
      data: {
        calendlyEventTypes: dbEventTypes,
        pipedriveAcitvityTypes: activityTypes,
      },
    };

    return [null, responseData] as const;
  }
}
