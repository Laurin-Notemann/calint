import { DatabaseQueries } from "@/db/queries";
import { CalendlyController } from "./calendly/calendly-controller";
import createLogger, {
  withLogging,
  CalIntError,
  ERROR_MESSAGES,
} from "@/utils/logger";
import { PipedriveController } from "./pipedrive/pipedrive-controller";
import {
  CalEventType,
  NewCalendlyEvent,
  NewTypeMappingType,
  PipedriveActivityType,
  PipedriveDeal,
  TypeMappingType,
} from "@/db/schema";
import { InviteePayload, WebhookPayload } from "./calendly-client";
import { BaseUser } from "pipedrive/v1";
import { JsonPanel } from "@/app/api/v1/jsonpipedrive/route";
import { MappingsRequestBody } from "@/app/api/v1/mapping/create/route";
import { MappingSelections } from "@/components/pipedrive-setup";
import { NextRequest } from "next/server";

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

  remapMappingsToNewTypeMappingType(
    body: MappingsRequestBody,
    companyId: string,
  ): NewTypeMappingType[] {
    const { mappings, eventTypeId } = body;

    const typeMappings: NewTypeMappingType[] = [];

    (Object.keys(mappings) as Array<keyof MappingSelections>).forEach(
      (type) => {
        const activityType = mappings[type];
        if (activityType) {
          typeMappings.push({
            type: type as TypeMappingType["type"],
            companyId,
            calendlyEventTypeId: eventTypeId,
            pipedriveActivityTypeId: activityType.id,
          });
        }
      },
    );

    return typeMappings;
  }

  async createMapping(userId: number, request: NextRequest) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const [getUserErr, user] =
          await this.querier.getUserAndCalendlyAcc(userId);
        if (getUserErr) throw getUserErr;

        const pipedriveUser = user.users;

        await this.pipedriveController.triggerTokenUpdate(pipedriveUser.id);

        const body: MappingsRequestBody = await request.json();

        const newTypeMappings = this.remapMappingsToNewTypeMappingType(
          body,
          pipedriveUser.companyId,
        );

        for (const mapping of newTypeMappings) {
          const [upsertErr] =
            await this.querier.updateOrCreateTypeMapping(mapping);
          if (upsertErr) throw upsertErr;
        }

        const [err, allMappings] = await this.querier.getAllTypeMappings(
          pipedriveUser.companyId,
        );
        if (err) throw err;

        return allMappings;
      },
      "createMapping",
      "general",
      undefined,
      { userId, request },
    );
  }

  async getJsonPanelData(userId: number, dealId: number) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const [getUserErr, user] =
          await this.querier.getUserAndCalendlyAcc(userId);
        if (getUserErr) throw getUserErr;

        const pipedriveUser = user.users;

        await this.pipedriveController.triggerTokenUpdate(pipedriveUser.id);

        const [errActivityGetApi, apiActivityGet] =
          await this.pipedriveController.getActivityByPipedriveDealId(dealId);
        if (errActivityGetApi) throw errActivityGetApi;

        const [errActivitiesEventsGet, dbActivitiesEventsGet] =
          await this.querier.getCalendlyEventsAndPipeDriveActivitiesByPipedriveActivities(
            apiActivityGet,
            pipedriveUser.companyId,
            dealId,
          );
        if (errActivitiesEventsGet) throw errActivitiesEventsGet;

        const panelData: JsonPanel = {
          data: dbActivitiesEventsGet.map((res) => ({
            id: res.pipedriveActivity.pipedriveId,
            header: res.pipedriveActivity.name,
            join_meeting: res.calendlyEvent.joinUrl,
            reschedule_meeting: res.calendlyEvent.rescheduleUrl,
            cancel_meeting: res.calendlyEvent.cancelUrl,
          })),
        };

        return panelData;
      },
      "getJsonPanelData",
      "general",
      undefined,
      { userId, dealId },
    );
  }

  async getAuthenticatedPiperiveUser(email: string, eventTypeUri: string) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const [_, user] =
          await this.querier.getUserAndCalendlyAccByCalendlyEmail(email);
        if (user) return user;

        const [err, company] =
          await this.querier.getCompanyByEventTypeUri(eventTypeUri);
        if (err) throw err;

        const [errGetUsers, users] = await this.querier.getAllUsersByCompanyId(
          company.id,
        );
        if (errGetUsers) throw errGetUsers;

        return users[0];
      },
      "getAuthenticatedPiperiveUser",
      "general",
      undefined,
      { email, eventTypeUri },
    );
  }

  async handleCalendlyWebhook(body: WebhookPayload) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const email =
          body.payload.scheduled_event.event_memberships[0].user_email;
        const eventTypeUri = body.payload.scheduled_event.event_type;

        const [getUserErr, user] = await this.getAuthenticatedPiperiveUser(
          email,
          eventTypeUri,
        );
        if (getUserErr) throw getUserErr;

        const pipedriveUser = user.users;

        await this.pipedriveController.triggerTokenUpdate(pipedriveUser.id);

        const [errFetchActivityUser, fetchActivityUser] =
          await this.pipedriveController.getUserByEmail(email);
        if (errFetchActivityUser) throw errFetchActivityUser;

        const [errGetEventType, dbEventType] =
          await this.querier.getEventTypeByUri(
            body.payload.scheduled_event.event_type,
          );
        if (errGetEventType) throw errGetEventType;

        const [errGetTypeMappings, dbTypeMappings] =
          await this.querier.getTypeMappingsByEventTypeId(dbEventType.id);
        if (errGetTypeMappings) throw errGetTypeMappings;

        const [errDeal, deal] = await this.pipedriveController.getDeal(
          body.payload,
          pipedriveUser.companyId,
        );
        if (errDeal) throw errDeal;

        if (body.event === "invitee.created" && !body.payload.old_invitee) {
          const createdMapping = dbTypeMappings.find(
            (mapping) => mapping.type === "created",
          );
          if (!createdMapping) {
            throw new CalIntError(
              ERROR_MESSAGES.NO_CREATE_MAPPING_FOUND,
              "NO_CREATE_MAPPING_FOUND",
              true,
            );
          }
          return await this.webhookCreate(
            createdMapping,
            body.payload,
            deal,
            fetchActivityUser,
          );
        }

        if (body.event === "invitee.canceled" && !body.payload.rescheduled) {
          const cancelledMapping = dbTypeMappings.find(
            (mapping) => mapping.type === "cancelled",
          );
          if (!cancelledMapping) {
            throw new CalIntError(
              ERROR_MESSAGES.NO_CANCELLED_MAPPING_FOUND,
              "NO_CANCELLED_MAPPING_FOUND",
              true,
            );
          }
          return await this.webhookCancelled(body.payload, cancelledMapping);
        }

        if (body.event === "invitee.canceled" && body.payload.rescheduled) {
          const rescheduledMapping = dbTypeMappings.find(
            (mapping) => mapping.type === "rescheduled",
          );
          if (!rescheduledMapping) {
            throw new CalIntError(
              ERROR_MESSAGES.NO_RESCHEDULED_MAPPING_FOUND,
              "NO_RESCHEDULED_MAPPING_FOUND",
              true,
            );
          }
          return await this.webhookCancelled(body.payload, rescheduledMapping);
        }

        if (body.event === "invitee.created" && body.payload.old_invitee) {
          const rescheduledMapping = dbTypeMappings.find(
            (mapping) => mapping.type === "created",
          );
          if (!rescheduledMapping) {
            throw new CalIntError(
              ERROR_MESSAGES.NO_RESCHEDULED_MAPPING_FOUND,
              "NO_RESCHEDULED_MAPPING_FOUND",
              true,
            );
          }
          return await this.webhookCreate(
            rescheduledMapping,
            body.payload,
            deal,
            fetchActivityUser,
          );
        }

        throw new CalIntError(
          ERROR_MESSAGES.WEBHOOK_NO_FUNCTION_TRIGGERED,
          "WEBHOOK_NO_FUNCTION_TRIGGERED",
          true,
        );
      },
      "handleCalendlyWebhook",
      "general",
      undefined,
      { body },
    );
  }

  private async webhookCreate(
    mapping: TypeMappingType,
    payload: InviteePayload,
    deal: PipedriveDeal,
    user: BaseUser,
  ) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const newEvent: NewCalendlyEvent = {
          uri: payload.uri,
          status: mapping.type,
          joinUrl:
            payload.scheduled_event.location.type === "google_conference"
              ? payload.scheduled_event.location.join_url || ""
              : "",
          rescheduleUrl: payload.reschedule_url,
          cancelUrl: payload.cancel_url,
        };

        const [errEventGet, dbEventGet] = await this.querier.getEventByUri(
          newEvent.uri,
        );
        if (errEventGet && errEventGet.code === "CALENDLY_EVENT_NOT_FOUND") {
          const [errEventDb, dbEvent] =
            await this.querier.createCalendlyEvent(newEvent);
          if (errEventDb) throw errEventDb;

          const [errActivityPipedrive, pipedriveActivity] =
            await this.pipedriveController.createAndSaveActivity(
              deal,
              payload,
              mapping,
              user,
              dbEvent,
            );
          if (errActivityPipedrive) throw errActivityPipedrive;

          return pipedriveActivity;
        } else if (errEventGet || !dbEventGet) {
          throw errEventGet;
        }

        const [errActivityPipedrive, pipedriveActivity] =
          await this.pipedriveController.createAndSaveActivity(
            deal,
            payload,
            mapping,
            user,
            dbEventGet,
          );

        if (errActivityPipedrive) throw errActivityPipedrive;

        return pipedriveActivity;
      },
      "webhookCreate",
      "general",
      undefined,
      { mapping, payload, deal, user },
    );
  }

  private async webhookCancelled(
    payload: InviteePayload,
    mapping: TypeMappingType,
  ) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const [errGetEvent, dbEventGet] = await this.querier.getEventByUri(
          payload.uri,
        );
        if (errGetEvent) throw errGetEvent;

        dbEventGet.status = mapping.type;

        const [errEventUpdate, dbEventUpdate] =
          await this.querier.updateCalendlyEvent(dbEventGet);
        if (errEventUpdate) throw errEventUpdate;

        const [errActivityUpdateApi, apiActivityUpdate] =
          await this.pipedriveController.updateActivity(dbEventUpdate, mapping);
        if (errActivityUpdateApi) throw errActivityUpdateApi;

        return apiActivityUpdate;
      },
      "webhookCancelled",
      "general",
      undefined,
      { payload, mapping },
    );
  }

  async getAndSaveAllEventTypesAndActivityTypes(userId: number) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const [getUserErr, user] =
          await this.querier.getUserAndCalendlyAcc(userId);
        if (getUserErr) {
          return getUserErr;
        }

        const pipedriveUser = user.users;
        const calAcc = user.calendly_accs;

        await this.pipedriveController.triggerTokenUpdate(pipedriveUser.id);

        const [activityTypesErr] =
          await this.pipedriveController.getAndSaveActivityTypes(
            pipedriveUser.id,
            pipedriveUser.companyId,
          );
        if (activityTypesErr) throw activityTypesErr;

        this.calendlyController.setCalendlyClient(
          calAcc.accessToken,
          calAcc.refreshToken,
        );

        const [eventTypesErrTwo] =
          await this.calendlyController.findSharedEventTypes(
            pipedriveUser.id,
            pipedriveUser.companyId,
          );
        if (eventTypesErrTwo) throw eventTypesErrTwo;

        const [err, dbEventTypes] = await this.querier.getAllEventTypes(
          pipedriveUser.companyId,
        );
        if (err) throw err;
        const [errMappings, dbMappings] = await this.querier.getAllTypeMappings(
          pipedriveUser.companyId,
        );
        if (errMappings) throw errMappings;

        const [errActivityTypes, dbActivityTypes] =
          await this.querier.getAllActivityTypes(pipedriveUser.companyId);
        if (errActivityTypes) throw errActivityTypes;

        const responseData: SettingsDataRes = {
          data: {
            calendlyEventTypes: dbEventTypes,
            pipedriveAcitvityTypes: dbActivityTypes,
            typeMappings: dbMappings,
          },
        };

        return responseData;
      },
      "getAndSaveAllEventTypesAndActivityTypes",
      "general",
      undefined,
      { userId },
    );
  }
}
