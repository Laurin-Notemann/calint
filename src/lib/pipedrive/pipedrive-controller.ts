import {
  ActivityTypesApi,
  BaseUser,
  Configuration,
  GetCurrentUserResponseAllOfData,
  OAuth2Configuration,
  TokenResponse,
  DealsApi as DealsApiV1,
  UsersApi,
  PersonsApi,
} from "pipedrive/v1";
import {
  Configuration as ConfigurationV2,
  ActivitiesApi,
  ActivitiesApiAddActivityRequest,
  DealsApi,
  OAuth2Configuration as OAuth2ConfigurationV2,
} from "pipedrive/v2";
import { env } from "../env";
import { DatabaseQueries } from "@/db/queries";
import createLogger, {
  withLogging,
  PromiseReturn,
  CalIntError,
  ERROR_MESSAGES,
} from "@/utils/logger";
import {
  CalendlyEvent,
  NewPipedriveActivity,
  NewPipedriveActivityType,
  NewPipedriveDeal,
  NewPipedrivePerson,
  PipedriveActivity,
  PipedriveDeal,
  PipedrivePerson,
  TypeMappingType,
} from "@/db/schema";
import { InviteePayload } from "../calendly-client";
import dayjs from "dayjs";

export class PipedriveController {
  oauth2: OAuth2Configuration;
  oauth2V2: OAuth2ConfigurationV2;
  config: Configuration | null = null;
  configV2: ConfigurationV2 | null = null;
  querier: DatabaseQueries;
  private logger = createLogger("PipedriveController");
  private tokens: TokenResponse | null = null;
  private tokensV2: TokenResponse | null = null;
  private userId: number | null = null;

  constructor(querier: DatabaseQueries) {
    this.oauth2 = new OAuth2Configuration({
      clientId: env.PIPEDRIVE_CLIENT_ID,
      clientSecret: env.PIPEDRIVE_CLIENT_SECRET,
      redirectUri: env.PIPEDRIVE_REDIRECT_URL,
    });
    this.oauth2V2 = new OAuth2ConfigurationV2({
      clientId: env.PIPEDRIVE_CLIENT_ID,
      clientSecret: env.PIPEDRIVE_CLIENT_SECRET,
      redirectUri: env.PIPEDRIVE_REDIRECT_URL,
    });
    this.querier = querier;
  }

  async getActivityByPipedriveDealId(dealId: number): PromiseReturn<any> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.config) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const api = new DealsApiV1(this.config);

        const res = await api.getDealActivities({
          id: dealId,
          done: 0,
        });

        if (!res.success || !res.data) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_NOT_FOUND,
            "PIPEDRIVE_ACTIVITY_NOT_FOUND",
          );
        }

        return res.data;
      },
      "getActivityByPipedriveDealId",
      "api",
      {
        service: "Pipedrive",
        method: "GET",
        endpoint: `/v1/deals/${dealId}/activities`,
      },
      { dealId },
    );
  }

  async updateActivityShow(activityId: number) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.configV2) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const api = new ActivitiesApi(this.configV2);

        const res = await api.updateActivity({
          id: activityId,
          AddActivityRequest: {
            done: true,
          },
        });

        if (!res.success || !res.data) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_UPDATE_FAILED,
            "PIPEDRIVE_ACTIVITY_UPDATE_FAILED",
          );
        }

        return res.data;
      },
      "updateActivityShow",
      "api",
      {
        service: "Pipedrive",
        method: "PATCH",
        endpoint: `/api/v2/activities/{id}`,
      },
      { activityId },
    );
  }

  async updateActivityNoShow(
    activityId: number,
    dealId: number,
    companyId: string,
    mapping: TypeMappingType,
  ) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.configV2) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const [errActivityGet, dbActivityGet] =
          await this.querier.getPipedriveActivityByDealIdAndPipedriveId(
            dealId,
            companyId,
            activityId,
          );
        if (errActivityGet) throw errActivityGet;

        const [errActivityTypeGet, dbActivityTypeGet] =
          await this.querier.getPipedriveActivityTypeById(
            mapping.pipedriveActivityTypeId,
          );
        if (errActivityTypeGet) throw errActivityTypeGet;

        const api = new ActivitiesApi(this.configV2);

        const res = await api.updateActivity({
          id: activityId,
          AddActivityRequest: {
            subject: dbActivityTypeGet.name,
            type: dbActivityTypeGet.keyString,
            done: true,
          },
        });

        if (!res.success || !res.data) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_UPDATE_FAILED,
            "PIPEDRIVE_ACTIVITY_UPDATE_FAILED",
          );
        }

        const activity = dbActivityGet.pipedrive_activities;

        activity.activityTypeId = mapping.pipedriveActivityTypeId;
        const [errActivityUpdate] =
          await this.querier.updatePipedriveActivity(activity);
        if (errActivityUpdate) throw errActivityUpdate;

        return dbActivityGet.calendly_events;
      },
      "updateActivityNoShow",
      "api",
      {
        service: "Pipedrive",
        method: "PATCH",
        endpoint: `/api/v2/activities/{id}`,
      },
      { activityId, dealId, companyId, mapping },
    );
  }

  async updateActivity(
    dbEvent: CalendlyEvent,
    mapping: TypeMappingType,
  ): PromiseReturn<any> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.configV2) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const [errActivityGet, dbActivityGet] =
          await this.querier.getPipedriveActivityByEventId(dbEvent.id);
        if (errActivityGet) throw errActivityGet;

        const api = new ActivitiesApi(this.configV2);

        const [errActivityTypeGet, dbActivityTypeGet] =
          await this.querier.getPipedriveActivityTypeById(
            mapping.pipedriveActivityTypeId,
          );
        if (errActivityTypeGet) throw errActivityTypeGet;

        const res = await api.updateActivity({
          id: dbActivityGet.pipedriveId,
          AddActivityRequest: {
            subject: dbActivityTypeGet.name,
            type: dbActivityTypeGet.keyString,
            done: true,
          },
        });

        if (!res.success || !res.data) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_UPDATE_FAILED,
            "PIPEDRIVE_ACTIVITY_UPDATE_FAILED",
          );
        }

        dbActivityGet.activityTypeId = mapping.pipedriveActivityTypeId;
        const [errActivityUpdate, dbActivityUpdate] =
          await this.querier.updatePipedriveActivity(dbActivityGet);
        if (errActivityUpdate) throw errActivityUpdate;

        return dbActivityUpdate;
      },
      "updateActivity",
      "api",
      {
        service: "Pipedrive",
        method: "PATCH",
        endpoint: `/api/v2/activities/{id}`,
      },
      { dbEvent, mapping },
    );
  }

  async getDeal(
    payload: InviteePayload,
    companyId: string,
  ): PromiseReturn<PipedriveDeal> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (payload.tracking.salesforce_uuid) {
          const dealId = parseInt(payload.tracking.salesforce_uuid);
          const [error, deal] = await this.getDealByPipedriveIdAndCompanyId(
            companyId,
            dealId,
          );
          if (error) throw error;
          return deal;
        }

        const email = payload.email;
        const [errPerson, person] = await this.getAndSavePersonByEmail(
          companyId,
          email,
        );
        if (errPerson) throw errPerson;

        const [errDeal, deal] = await this.getDealByPerson(companyId, person);
        if (errDeal) throw errDeal;
        return deal;
      },
      "getDeal",
      "general",
      undefined,
      { payload, companyId },
    );
  }

  async getDealByPerson(
    companyId: string,
    person: PipedrivePerson,
  ): PromiseReturn<PipedriveDeal> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.configV2) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }
        const [errDbDeal, dbDeal] =
          await this.querier.getPipedriveDealByPersonId(companyId, person.id);

        if (errDbDeal && errDbDeal.code !== "PIPEDRIVE_DEAL_NOT_FOUND") {
          throw errDbDeal;
        }

        if (
          (errDbDeal && errDbDeal.code === "PIPEDRIVE_DEAL_NOT_FOUND") ||
          !dbDeal
        ) {
          const api = new DealsApi(this.configV2);

          const res = await api.getDeals({
            person_id: person.pipedriveId,
            limit: 15,
            sort_by: "add_time",
            sort_direction: "desc",
          });

          if (!res.success || !res.data || res.data.length === 0) {
            throw new CalIntError(
              ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND,
              "PIPEDRIVE_DEAL_NOT_FOUND",
            );
          }

          const dealData = res.data[0];

          const newDeal: NewPipedriveDeal = {
            companyId,
            pipedriveId: dealData.id!,
            name: dealData.title!,
            pipedrivePeopleId: person.id,
          };

          const [errSave, savedDeal] =
            await this.querier.createPipedriveDeal(newDeal);
          if (errSave) throw errSave;

          return savedDeal;
        }

        return dbDeal;
      },
      "getDealByPerson",
      "api",
      {
        service: "Pipedrive",
        method: "GET",
        endpoint: `/api/v2/deals`,
      },
      { companyId, personId: person.id },
    );
  }

  async getDealByPipedriveIdAndCompanyId(
    companyId: string,
    dealId: number,
  ): PromiseReturn<PipedriveDeal> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.configV2) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const [errDbDeal, dbDeal] = await this.querier.getPipedriveDealByDealId(
          companyId,
          dealId,
        );
        if (errDbDeal && errDbDeal.code !== "PIPEDRIVE_DEAL_NOT_FOUND") {
          throw errDbDeal;
        }

        if (errDbDeal && errDbDeal.code === "PIPEDRIVE_DEAL_NOT_FOUND") {
          const api = new DealsApi(this.configV2);

          const res = await api.getDeal({
            id: dealId,
          });

          if (!res.success || !res.data) {
            throw new CalIntError(
              ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND,
              "PIPEDRIVE_DEAL_NOT_FOUND",
            );
          }

          const [errPerson, person] = await this.getAndSavePersonByPipedriveId(
            companyId,
            res.data.person_id!,
          );
          if (errPerson) throw errPerson;

          const newDeal: NewPipedriveDeal = {
            companyId,
            pipedriveId: res.data.id!,
            name: res.data.title!,
            pipedrivePeopleId: person.id,
          };

          const [errSave, savedDeal] =
            await this.querier.createPipedriveDeal(newDeal);
          if (errSave) throw errSave;

          return savedDeal;
        }

        if (!dbDeal) {
          throw new CalIntError(
            ERROR_MESSAGES.UNEXPECTED_ERROR,
            "UNEXPECTED_ERROR",
          );
        }

        return dbDeal;
      },
      "getDealByPipedriveIdAndCompanyId",
      "api",
      {
        service: "Pipedrive",
        method: "GET",
        endpoint: `/api/v2/deals`,
      },
      { companyId, dealId },
    );
  }

  async getAndSavePersonByPipedriveId(
    companyId: string,
    personId: number,
  ): PromiseReturn<PipedrivePerson> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.config) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const [errDbPerson, dbPerson] =
          await this.querier.getPipedrivePersonByPipedriveId(
            companyId,
            personId,
          );
        if (errDbPerson && errDbPerson.code !== "PIPEDRIVE_PERSON_NOT_FOUND") {
          throw errDbPerson;
        }

        if (errDbPerson && errDbPerson.code === "PIPEDRIVE_PERSON_NOT_FOUND") {
          const api = new PersonsApi(this.config);

          const res = await api.getPerson({
            id: personId,
          });

          if (!res.success || !res.data) {
            throw new CalIntError(
              ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND,
              "PIPEDRIVE_PERSON_NOT_FOUND",
            );
          }

          const personData = res.data;

          const newPerson: NewPipedrivePerson = {
            companyId,
            pipedriveId: personData.id!,
            name: personData.name!,
            email:
              personData.email && personData.email.length > 0
                ? personData.email[0].value!
                : "",
          };

          const [errSave, savedPerson] =
            await this.querier.createPipedrivePerson(newPerson);
          if (errSave) throw errSave;

          return savedPerson;
        }

        if (!dbPerson) {
          throw new CalIntError(
            ERROR_MESSAGES.UNEXPECTED_ERROR,
            "UNEXPECTED_ERROR",
          );
        }

        return dbPerson;
      },
      "getAndSavePersonByPipedriveId",
      "api",
      {
        service: "Pipedrive",
        method: "GET",
        endpoint: `/v1/persons`,
      },
      { companyId, personId },
    );
  }

  async getAndSavePersonByEmail(
    companyId: string,
    email: string,
  ): PromiseReturn<PipedrivePerson> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.configV2) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const [errDbPerson, dbPerson] =
          await this.querier.getPipedrivePersonByEmail(companyId, email);
        if (errDbPerson && errDbPerson.code !== "PIPEDRIVE_PERSON_NOT_FOUND") {
          throw errDbPerson;
        }

        if (errDbPerson && errDbPerson.code === "PIPEDRIVE_PERSON_NOT_FOUND") {
          const api = new PersonsApi(this.configV2);

          const res = await api.searchPersons({
            term: email.toLowerCase(),
            fields: "email",
            exact_match: true,
          });

          if (
            !res.success ||
            !res.data ||
            !res.data.items ||
            res.data.items.length === 0 ||
            !res.data.items[0].item
          ) {
            throw new CalIntError(
              ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND,
              "PIPEDRIVE_PERSON_NOT_FOUND",
            );
          }

          const personData = res.data.items[0].item;

          const newPerson: NewPipedrivePerson = {
            companyId,
            pipedriveId: personData.id!,
            name: personData.name!,
            email: email,
          };

          const [errSave, savedPerson] =
            await this.querier.createPipedrivePerson(newPerson);
          if (errSave) throw errSave;

          return savedPerson;
        }

        if (!dbPerson) {
          throw new CalIntError(
            ERROR_MESSAGES.UNEXPECTED_ERROR,
            "UNEXPECTED_ERROR",
          );
        }

        return dbPerson;
      },
      "getAndSavePersonByEmail",
      "api",
      {
        service: "Pipedrive",
        method: "GET",
        endpoint: `/api/v2/persons/search`,
      },
      { companyId, email },
    );
  }

  async createAndSaveActivity(
    deal: PipedriveDeal,
    eventPayload: InviteePayload,
    mapping: TypeMappingType,
    user: BaseUser,
    event: CalendlyEvent,
  ): PromiseReturn<PipedriveActivity> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.configV2) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const [errActivityGet, dbActivityGet] =
          await this.querier.getPipedriveActivityByEventId(event.id);
        if (errActivityGet) {
          if (errActivityGet.code === "PIPEDRIVE_ACTIVITY_NOT_FOUND") {
            const [errActivityType, activityType] =
              await this.querier.getPipedriveActivityTypeById(
                mapping.pipedriveActivityTypeId,
              );
            if (errActivityType) throw errActivityType;

            const [errPerson, person] =
              await this.querier.getPipedrivePersonById(deal.pipedrivePeopleId);
            if (errPerson) throw errPerson;

            const api = new ActivitiesApi(this.configV2);

            const startTime = dayjs(eventPayload.scheduled_event.start_time);
            const endTime = dayjs(eventPayload.scheduled_event.end_time);

            const formattedDueDate = startTime.format("YYYY-MM-DD");
            const formattedDueTime = startTime.format("HH:mm");

            const durationHours = endTime.diff(startTime, "hour");
            const durationMinutes = endTime.diff(startTime, "minute") % 60;
            const formattedDuration = `${durationHours.toString().padStart(2, "0")}:${durationMinutes.toString().padStart(2, "0")}`;

            const body: ActivitiesApiAddActivityRequest = {
              AddActivityRequest: {
                subject: activityType.name,
                type: activityType.keyString,
                due_date: formattedDueDate,
                due_time: formattedDueTime,
                duration: formattedDuration,
                deal_id: deal.pipedriveId,
                //owner_id: user.id,
                participants: [
                  {
                    person_id: person.pipedriveId,
                    primary: true,
                  },
                ],
              },
            };

            const res = await api.addActivity(body);

            if (!res.success || !res.data) {
              throw new CalIntError(
                ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_CREATION_FAILED,
                "PIPEDRIVE_ACTIVITY_CREATION_FAILED",
              );
            }

            const dbNewActivity: NewPipedriveActivity = {
              name: res.data.subject!,
              pipedriveId: res.data.id!,
              pipedriveDealId: deal.id,
              calendlyEventId: event.id,
              activityTypeId: mapping.pipedriveActivityTypeId,
            };

            const [errCreateActivity, createdActivity] =
              await this.querier.createPipedriveActivity(dbNewActivity);
            if (errCreateActivity) throw errCreateActivity;

            return createdActivity;
          } else {
            throw errActivityGet;
          }
        }
        return dbActivityGet;
      },
      "createAndSaveActivity",
      "api",
      {
        service: "Pipedrive",
        method: "POST",
        endpoint: `/api/v2/activities`,
      },
      { deal, eventPayload, mapping, user, event },
    );
  }

  async getAndSaveActivityTypes(userId: number, companyId: string) {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.config) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const api = new ActivityTypesApi(this.config);

        const res = await api.getActivityTypes();

        if (!res.success) {
          throw new CalIntError(
            ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_TYPE_NOT_FOUND,
            "PIPEDRIVE_ACTIVITY_TYPE_NOT_FOUND",
          );
        }

        const dbActivityTypes: NewPipedriveActivityType[] = res.data.map(
          (activityType) => ({
            name: activityType.name,
            keyString: activityType.key_string,
            pipedriveId: activityType.id,
            companyId,
          }),
        );

        const [addActivityTypesErr] =
          await this.querier.addAllActivityTypes(dbActivityTypes);

        if (addActivityTypesErr) {
          throw addActivityTypesErr;
        }

        return res.data;
      },
      "getAndSaveActivityTypes",
      "api",
      {
        service: "Pipedrive",
        method: "GET",
        endpoint: `/v1/activityTypes`,
      },
      { userId, companyId },
    );
  }

  async triggerTokenUpdate(userId: number): PromiseReturn<void> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        this.userId = userId;
        await this.updateConfig();
      },
      "triggerTokenUpdate",
      "general",
      undefined,
      userId,
    );
  }

  async authorize(
    code: string,
  ): PromiseReturn<GetCurrentUserResponseAllOfData> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        let res;
        try {
          res = await this.oauth2.authorize(code);
        } catch (error) {
          throw new CalIntError(
            ERROR_MESSAGES.LOGIN_FAILED,
            "LOGIN_FAILED",
            false,
            { originalError: error },
          );
        }

        const [configErr] = await this.updateConfig(res);
        if (configErr) throw configErr;

        const [err, user] = await this.getUser();
        if (err) throw err;

        const [saveErr] = await this.saveUserToDB(user);
        if (saveErr) throw saveErr;

        return user;
      },
      "authorize",
      "general",
      undefined,
      { code },
    );
  }

  private async saveUserToDB(
    user: GetCurrentUserResponseAllOfData,
  ): PromiseReturn<GetCurrentUserResponseAllOfData> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.tokens) {
          throw new CalIntError(
            ERROR_MESSAGES.UNEXPECTED_ERROR,
            "UNEXPECTED_ERROR",
            false,
            { details: "Tokens not set" },
          );
        }

        const [checkUserErr, exUser] = await this.querier.checkUserExists(
          user.id!,
        );
        if (checkUserErr) throw checkUserErr;

        if (exUser.length > 0) {
          const [err] = await this.querier.loginWithPipedrive(
            user.id!,
            this.tokens,
          );
          if (err) throw err;
        } else {
          const [err] = await this.querier.createUser(user, this.tokens);
          if (err) throw err;
        }

        return user;
      },
      "saveUserToDB",
      "general",
      undefined,
      { user },
    );
  }

  async getUserByEmail(email: string): PromiseReturn<BaseUser> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.config) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const api = new UsersApi(this.config);
        const data = await api.getUsers();

        if (!data.data) {
          throw new CalIntError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            "USER_NOT_FOUND",
          );
        }

        const user = data.data.find((user) => user.email === email);
        if (!user) {
          throw new CalIntError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            "USER_NOT_FOUND",
          );
        }

        return user;
      },
      "getUserByEmail",
      "api",
      {
        service: "Pipedrive",
        method: "GET",
        endpoint: `/v1/users`,
      },
      { email },
    );
  }

  async getUser(): PromiseReturn<GetCurrentUserResponseAllOfData> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.config) {
          throw new CalIntError(
            ERROR_MESSAGES.CONFIG_NOT_SET,
            "CONFIG_NOT_SET",
          );
        }

        const api = new UsersApi(this.config);
        const data = await api.getCurrentUser();

        if (!data.data) {
          throw new CalIntError(
            ERROR_MESSAGES.USER_NOT_FOUND,
            "USER_NOT_FOUND",
          );
        }

        this.userId = data.data.id!;

        return data.data;
      },
      "getUser",
      "api",
      {
        service: "Pipedrive",
        method: "GET",
        endpoint: `/v1/users/me`,
      },
    );
  }

  private async setTokenFromDB(): PromiseReturn<boolean> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (!this.userId) {
          throw new CalIntError(
            ERROR_MESSAGES.UNEXPECTED_ERROR,
            "UNEXPECTED_ERROR",
            false,
            { details: "UserId not set" },
          );
        }

        const [err, user] = await this.querier.getUser(this.userId);

        if (err) throw err;

        this.tokens = {
          access_token: user.accessToken,
          refresh_token: user.refreshToken,
          expires_in: user.expiresIn,
          scope: user.scope,
          api_domain: user.apiDomain,
          token_type: user.tokenType,
        };

        return true;
      },
      "setTokenFromDB",
      "general",
    );
  }

  private async updateConfig(tokens?: TokenResponse): PromiseReturn<boolean> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        if (tokens) {
          this.tokens = { ...tokens };
          this.tokensV2 = { ...tokens };
          this.oauth2.updateToken(tokens);
          this.oauth2V2.updateToken(tokens);
        } else {
          const [err] = await this.setTokenFromDB();
          if (err) throw err;

          this.oauth2.updateToken(this.tokens!);
          this.oauth2V2.updateToken(this.tokens!);

          try {
            const newToken = await this.oauth2.tokenRefresh();
            const newTokenV2 = await this.oauth2V2.tokenRefresh();
            this.tokens = newToken;
            this.tokensV2 = newTokenV2;
          } catch (error) {
            throw new CalIntError(
              ERROR_MESSAGES.LOGIN_FAILED,
              "LOGIN_FAILED",
              false,
              { originalError: error },
            );
          }
        }

        if (!this.tokens) {
          throw new CalIntError(
            ERROR_MESSAGES.UNEXPECTED_ERROR,
            "UNEXPECTED_ERROR",
            false,
            { details: "Tokens not set after update" },
          );
        }

        const accessToken = this.oauth2.getAccessToken;
        const basePath = this.oauth2.basePath;

        this.config = new Configuration({
          accessToken,
          basePath,
        });

        const accessTokenV2 = this.oauth2V2.getAccessToken;
        const basePathV2 = this.oauth2V2.basePath;

        this.configV2 = new ConfigurationV2({
          accessToken: accessTokenV2,
          basePath: basePathV2,
        });

        return true;
      },
      "updateConfig",
      "general",
      undefined,
      tokens,
    );
  }
}
