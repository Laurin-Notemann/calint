import { DatabaseQueries, PromiseReturn } from "@/db/queries";
import { CalendlyController } from "./calendly/calendly-controller";
import createLogger, { logError } from "@/utils/logger";
import { PipedriveController } from "./pipedrive/pipedrive-controller";
import {
  CalEventType,
  NewCalendlyEvent,
  PipedriveActivity,
  PipedriveActivityType,
  PipedriveDeal,
  TypeMappingType,
} from "@/db/schema";
import { InviteePayload, WebhookPayload } from "./calendly-client";
import { BaseUser } from "pipedrive/v1";
import { ERROR_MESSAGES } from "./constants";
import { JsonPanel } from "@/app/api/v1/jsonpipedrive/route";

export type SettingsDataRes = {
  data: {
    calendlyEventTypes: CalEventType[];
    pipedriveAcitvityTypes: PipedriveActivityType[];
    typeMappings: TypeMappingType[];
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

  async getJsonPanelData(
    userId: number,
    dealId: number,
  ): PromiseReturn<JsonPanel> {
    const [getUserErr, user] = await this.querier.getUserAndCalendlyAcc(userId);
    if (getUserErr) {
      logError(this.logger, getUserErr, {
        context: "getAndSaveAllEventTypesAndActivityTypes",
        userId,
      });
      return [getUserErr, null] as const;
    }

    const pipedriveUser = user.users;

    await this.pipedriveController.triggerTokenUpdate(pipedriveUser.id);

    const [errActivityGetApi, apiActivityGet] =
      await this.pipedriveController.getActivityByPipedriveDealId(dealId);
    if (errActivityGetApi) return [errActivityGetApi, null] as const;

    const [errActivitiesEventsGet, dbActivitiesEventsGet] =
      await this.querier.getCalendlyEventsAndPipeDriveActivitiesByPipedriveActivities(
        apiActivityGet,
        pipedriveUser.companyId,
        dealId,
      );

    if (errActivitiesEventsGet) return [errActivitiesEventsGet, null] as const;

    const panelData: JsonPanel = {
      data: dbActivitiesEventsGet.map((res) => {
        return {
          id: res.pipedriveActivity.pipedriveId,
          header: res.pipedriveActivity.name,
          join_meeting: res.calendlyEvent.joinUrl, // TODO: The string could be empty, possibly add an error text here
          reschedule_meeting: res.calendlyEvent.rescheduleUrl,
          cancel_meeting: res.calendlyEvent.cancelUrl
        };
      }),
    };

    return [null, panelData] as const;
  }

  async handleCalendlyWebhook(
    body: WebhookPayload,
  ): PromiseReturn<PipedriveActivity> {
    const email = body.payload.scheduled_event.event_memberships[0].user_email;
    const [getUserErr, user] =
      await this.querier.getUserAndCalendlyAccByCalendlyEmail(email);
    if (getUserErr) {
      logError(this.logger, getUserErr, {
        context: "getAndSaveAllEventTypesAndActivityTypes",
        email,
      });
      return [getUserErr, null] as const;
    }

    const pipedriveUser = user.users;

    // Possibly will have to loop through other org users
    await this.pipedriveController.triggerTokenUpdate(pipedriveUser.id);

    const [errFetchActivityUser, fetchActivityUser] =
      await this.pipedriveController.getUserByEmail(email);
    if (errFetchActivityUser) return [errFetchActivityUser, null] as const;

    const [errGetEventType, dbEventType] = await this.querier.getEventTypeByUri(
      body.payload.scheduled_event.event_type,
    );
    if (errGetEventType) return [errGetEventType, null] as const;

    const [errGetTypeMappings, dbTypeMappings] =
      await this.querier.getTypeMappingsByEventTypeId(dbEventType.id);
    if (errGetTypeMappings) return [errGetTypeMappings, null] as const;

    const [errDeal, deal] = await this.pipedriveController.getDeal(
      body.payload,
      pipedriveUser.companyId,
    );
    if (errDeal) return [errDeal, null] as const;

    if (body.event === "invitee.created" && !body.payload.old_invitee) {
      const createdMapping = dbTypeMappings.find(
        (mapping) => mapping.type === "created",
      );
      if (!createdMapping)
        return [
          {
            message: "Die hütte brennt (kein create mapping found)",
            error: new Error("oops"),
          },
          null,
        ] as const;
      return await this.webhookCreate(
        createdMapping,
        body.payload,
        deal,
        fetchActivityUser,
      );
    }

    // canceled event
    if (body.event === "invitee.canceled" && !body.payload.rescheduled) {
      const cancelledMapping = dbTypeMappings.find(
        (mapping) => mapping.type === "cancelled",
      );
      if (!cancelledMapping)
        return [
          {
            message: "Die hütte brennt (kein cancelled mapping found)",
            error: new Error("oops"),
          },
          null,
        ] as const;
      return await this.webhookCancelled(body.payload, cancelledMapping);
    }

    // canceled and rescheduled -> change activity in pipedrive to rescheduled
    if (body.event === "invitee.canceled" && body.payload.rescheduled) {
      const rescheduledMapping = dbTypeMappings.find(
        (mapping) => mapping.type === "rescheduled",
      );
      if (!rescheduledMapping)
        return [
          {
            message: "Die hütte brennt (kein rescheduled mapping found)",
            error: new Error("oops"),
          },
          null,
        ] as const;
      return await this.webhookCancelled(body.payload, rescheduledMapping);
    }

    // new event but from a rescheduled one -> create new acitvity
    if (body.event === "invitee.created" && body.payload.old_invitee) {
      const rescheduledMapping = dbTypeMappings.find(
        (mapping) => mapping.type === "created", // TODO: should this be created or still rescheduled
      );
      if (!rescheduledMapping)
        return [
          {
            message: "Die hütte brennt (kein rescheduledMapping mapping found)",
            error: new Error("oops"),
          },
          null,
        ] as const;
      return await this.webhookCreate(
        rescheduledMapping,
        body.payload,
        deal,
        fetchActivityUser,
      );
    }

    return [
      {
        message: "Webhook did not trigger any functions",
        error: new Error("Webhook did not trigger any functions"),
      },
      null,
    ] as const;
  }

  private async webhookCreate(
    mapping: TypeMappingType,
    payload: InviteePayload,
    deal: PipedriveDeal,
    user: BaseUser,
  ): PromiseReturn<PipedriveActivity> {
    const newEvent: NewCalendlyEvent = {
      uri: payload.uri,
      status: mapping.type,
      joinUrl:
        payload.scheduled_event.location.type === "google_conference"
          ? payload.scheduled_event.location.join_url
            ? payload.scheduled_event.location.join_url
            : ""
          : "",
      rescheduleUrl: payload.reschedule_url,
      cancelUrl: payload.cancel_url,
    };

    const [errEventGet, dbEventGet] = await this.querier.getEventByUri(
      newEvent.uri,
    );
    if (
      errEventGet &&
      errEventGet.error
        .toString()
        .includes(ERROR_MESSAGES.CALENDLY_EVENT_NOT_FOUND)
    ) {
      const [errEventDb, dbEvent] =
        await this.querier.createCalendlyEvent(newEvent);
      if (errEventDb) return [errEventDb, null] as const;

      const [errActivityPipedrive, pipedriveActivity] =
        await this.pipedriveController.createAndSaveActivity(
          deal,
          payload,
          mapping,
          user,
          dbEvent,
        );
      if (errActivityPipedrive) return [errActivityPipedrive, null] as const;

      return [null, pipedriveActivity] as const;
    } else if (errEventGet || !dbEventGet) {
      return [errEventGet, null] as const;
    }

    const [errActivityPipedrive, pipedriveActivity] =
      await this.pipedriveController.createAndSaveActivity(
        deal,
        payload,
        mapping,
        user,
        dbEventGet,
      );

    if (errActivityPipedrive) return [errActivityPipedrive, null] as const;

    return [null, pipedriveActivity] as const;
  }

  private async webhookCancelled(
    payload: InviteePayload,
    mapping: TypeMappingType,
  ): PromiseReturn<PipedriveActivity> {
    const [errGetEvent, dbEventGet] = await this.querier.getEventByUri(
      payload.uri,
    );
    if (errGetEvent) return [errGetEvent, null] as const;

    dbEventGet.status = mapping.type;

    const [errEventUpdate, dbEventUpdate] =
      await this.querier.updateCalendlyEvent(dbEventGet);
    if (errEventUpdate) return [errEventUpdate, null] as const;

    const [errActivityUpdateApi, apiActivityUpdate] =
      await this.pipedriveController.updateActivity(dbEventUpdate, mapping);
    if (errActivityUpdateApi) return [errActivityUpdateApi, null] as const;

    return [null, apiActivityUpdate] as const;
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

    const [activityTypesErr] =
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
      return [err, null] as const;
    }

    const [errMappings, dbMappings] = await this.querier.getAllTypeMappings(
      pipedriveUser.companyId,
    );
    if (errMappings) {
      logError(this.logger, errMappings.error, {
        context: "getAllTypeMappings from DB",
        userId,
      });
      return [errMappings, null] as const;
    }

    const [errActivityTypes, dbActivityTypes] =
      await this.querier.getAllActivityTypes(pipedriveUser.companyId);
    if (errActivityTypes) {
      logError(this.logger, errActivityTypes.error, {
        context: "getAllActivityTypes from DB",
        userId,
      });
      return [errActivityTypes, null] as const;
    }

    const responseData: SettingsDataRes = {
      data: {
        calendlyEventTypes: dbEventTypes,
        pipedriveAcitvityTypes: dbActivityTypes,
        typeMappings: dbMappings,
      },
    };

    return [null, responseData] as const;
  }
}
