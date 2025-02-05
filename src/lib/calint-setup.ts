import { DatabaseQueries } from "@/db/queries";
import { CalendlyController } from "./calendly/calendly-controller";
import createLogger, { logError } from "@/utils/logger";
import { PipedriveController } from "./pipedrive/pipedrive-controller";
import { CalendlyResponse } from "./calendly-client";
import { ActivityType } from "pipedrive/v1";

export type SettingsDataRes = {
  data: {
    calendlyEventTypes: CalendlyResponse;
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

    this.logger.info(this.pipedriveController.config)

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
      logError(this.logger, eventTypesErr, {
        context: "getAndSaveAllEventTypesAndActivityTypes",
        userId,
      });
      return [getUserErr, null] as const;
    }

    const responseData: SettingsDataRes = {
      data: {
        calendlyEventTypes: eventTypes,
        pipedriveAcitvityTypes: activityTypes,
      },
    };

    return [null, responseData] as const;
  }
}
