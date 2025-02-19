import { DatabaseQueries, PromiseReturn } from "@/db/queries";
import { CalendlyController } from "./calendly/calendly-controller";
import createLogger, { logError } from "@/utils/logger";
import { PipedriveController } from "./pipedrive/pipedrive-controller";
import {
  CalEventType,
  NewCalendlyEvent,
  NewPipedriveActivity,
  PipedriveActivity,
  PipedriveActivityType,
  PipedriveDeal,
  TypeMappingType,
} from "@/db/schema";
import { InviteePayload, WebhookPayload } from "./calendly-client";
import { BaseUser } from "pipedrive/v1";

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

    const createdMappings = dbTypeMappings.find(
      (mapping) => mapping.type === "created",
    );
    if (!createdMappings)
      return [
        {
          message: "Die hütte brennt (kein create mapping found",
          error: new Error("oops"),
        },
        null,
      ] as const;
    const [errDeal, deal] = await this.pipedriveController.getDeal(
      body.payload,
      pipedriveUser.companyId,
    );
    if (errDeal) return [errDeal, null] as const;
    // New Event
    if (body.event === "invitee.created" && !body.payload.old_invitee)
      return await this.webhookCreate(
        createdMappings,
        body.payload,
        deal,
        fetchActivityUser,
      );

    // canceled event
    if (body.event === "invitee.canceled" && !body.payload.rescheduled)
      return await this.webhookCanceled();

    // canceled and rescheduled -> change activity in pipedrive to rescheduled
    if (body.event === "invitee.canceled" && body.payload.rescheduled)
      return await this.webhookRescheduledChangeActivityType();

    // new event but from a rescheduled one -> create new acitvity
    if (body.event === "invitee.created" && body.payload.old_invitee)
      return await this.webhookRescheduledCreateNewActivity();

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
    };
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
  }

  //check for old_invitee in the create webhook and rescheduled field
  //check the canceled for rescheduled = true
  // and the created event if it has a rescheduled link
  private async webhookRescheduledChangeActivityType(): PromiseReturn<boolean> {
    return [null, true] as const;
  }
  private async webhookRescheduledCreateNewActivity(): PromiseReturn<boolean> {
    return [null, true] as const;
  }
  private async webhookCanceled(): PromiseReturn<boolean> {
    return [null, true] as const;
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

    //const sharedEventTypesStartTime = Date.now();
    //const [eventTypesErrTwo] =
    //  await this.calendlyController.findSharedEventTypes(
    //    pipedriveUser.id,
    //    pipedriveUser.companyId,
    //  );
    //logElapsedTime(
    //  this.logger,
    //  sharedEventTypesStartTime,
    //  "Finding shared event types",
    //);
    //if (eventTypesErrTwo) {
    //  logError(this.logger, eventTypesErrTwo.error, {
    //    context: "getAndSaveAllEventTypesAndActivityTypes",
    //    userId,
    //  });
    //  return [getUserErr, null] as const;
    //}

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

    this.logger.warn("Hallo");

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
