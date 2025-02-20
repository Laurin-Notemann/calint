import {
  ActivityTypesApi,
  BaseUser,
  Configuration,
  GetCurrentUserResponseAllOfData,
  OAuth2Configuration,
  TokenResponse,
  UsersApi,
} from "pipedrive/v1";
import {
  Configuration as ConfigurationV2,
  ActivitiesApi,
  ActivitiesApiAddActivityRequest,
  DealsApi,
  PersonsApi,
  OAuth2Configuration as OAuth2ConfigurationV2,
} from "pipedrive/v2";
import { env } from "../env";
import { DatabaseQueries, PromiseReturn, querier } from "@/db/queries";
import createLogger, { logError } from "@/utils/logger";
import {
  CalendlyEvent,
  NewPipedriveActivity,
  NewPipedriveActivityType,
  NewPipedriveDeal,
  NewPipedrivePerson,
  PipedriveDeal,
  PipedrivePerson,
  TypeMappingType,
} from "@/db/schema";
import { InviteePayload } from "../calendly-client";
import { ERROR_MESSAGES } from "../constants";
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

  async updateActivity(dbEvent: CalendlyEvent, mapping: TypeMappingType) {
    const [errActivityGet, dbActivityGet] =
      await this.querier.getPipedriveActivityByEventId(dbEvent.id);
    if (errActivityGet) return [errActivityGet, null] as const;

    if (!this.configV2) {
      const err = new Error(
        "this.config was not set (call triggerTokenUpdate before using updateActivity)",
      );
      logError(this.logger, err, { context: "updateActivity" });
      return [
        {
          message: "",
          error: err,
        },
        null,
      ] as const;
    }

    const api = new ActivitiesApi(this.configV2);

    try {
      const [errActivityTypeGet, dbActivityTypeGet] =
        await this.querier.getPipedriveActivityTypeById(
          mapping.pipedriveActivityTypeId,
        );
      if (errActivityTypeGet) return [errActivityTypeGet, null] as const;

      const res = await api.updateActivity({
        id: dbActivityGet.pipedriveId,
        AddActivityRequest: {
          type: dbActivityTypeGet.name,
          done: true,
        },
      });

      if (!res.success || !res.data || res.data) {
        const err = new Error(
          "No deal found for the given person in Pipedrive",
        );
        logError(this.logger, err, { context: "updateActivity" });
        return [
          {
            message: "" + err,
            error: err,
          },
          null,
        ] as const;
      }

      this.logger.info(res.data[0]);

      dbActivityGet.activityTypeId = mapping.pipedriveActivityTypeId;
      const [errActivityUpdate, dbActivityUpdate] =
        await this.querier.updatePipedriveActivity(dbActivityGet);
      if (errActivityUpdate) return [errActivityUpdate, null] as const;

      return [null, dbActivityUpdate] as const;
    } catch (error) {
      const err = new Error("API call to update Activity failed.");
      logError(this.logger, err, {
        context: "updateActivity",
        originalError: error,
      });
      return [
        {
          message: "" + err,
          error: err,
        },
        null,
      ] as const;
    }
  }

  async getDeal(
    payload: InviteePayload,
    companyId: string,
  ): PromiseReturn<PipedriveDeal> {
    if (payload.tracking.salesforce_uuid) {
      const dealId = parseInt(payload.tracking.salesforce_uuid);
      return await this.getDealByPipedriveIdAndCompanyId(companyId, dealId);
    }

    const email = payload.email;
    const [errPerson, person] = await this.getAndSavePersonByEmail(
      companyId,
      email,
    );
    if (errPerson) return [errPerson, null] as const;

    return await this.getDealByPerson(companyId, person);
  }

  async getDealByPerson(
    companyId: string,
    person: PipedrivePerson,
  ): PromiseReturn<PipedriveDeal> {
    const [errDbDeal, dbDeal] = await this.querier.getPipedriveDealByPersonId(
      companyId,
      person.id,
    );

    if (
      errDbDeal &&
      !errDbDeal.error.toString().includes(ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND)
    ) {
      logError(this.logger, errDbDeal.error, { context: "getDealByPerson" });
      return [errDbDeal, null] as const;
    }

    if (
      (errDbDeal &&
        errDbDeal.error.toString().includes(ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND)) ||
      !dbDeal
    ) {
      if (!this.configV2) {
        const err = new Error(
          "this.config was not set (call triggerTokenUpdate before using getDealByPerson)",
        );
        logError(this.logger, err, { context: "getDealByPerson" });
        return [
          {
            message: "",
            error: err,
          },
          null,
        ] as const;
      }

      const api = new DealsApi(this.configV2);

      try {
        const res = await api.getDeals({
          person_id: person.pipedriveId,
          limit: 15, // We only need one deal
          sort_by: "add_time", // Get the most recently added deal
          sort_direction: "desc",
        });

        if (!res.success || !res.data || res.data.length === 0) {
          const err = new Error(
            "No deal found for the given person in Pipedrive",
          );
          logError(this.logger, err, { context: "getDealByPerson" });
          return [
            {
              message: "" + err,
              error: err,
            },
            null,
          ] as const;
        }

        this.logger.warn("GetDeal: " + JSON.stringify(res.data))

        const dealData = res.data[0];

        const newDeal: NewPipedriveDeal = {
          companyId,
          pipedriveId: dealData.id!,
          name: dealData.title!,
          pipedrivePeopleId: person.id,
        };

        const [errSave, savedDeal] =
          await this.querier.createPipedriveDeal(newDeal);
        if (errSave) {
          logError(this.logger, errSave.error, { context: "getDealByPerson" });
          return [errSave, null] as const;
        }

        return [null, savedDeal] as const;
      } catch (error) {
        const err = new Error("API call to get deals failed.");
        logError(this.logger, err, {
          context: "getDealByPerson",
          originalError: error,
        });
        return [
          {
            message: "" + err,
            error: err,
          },
          null,
        ] as const;
      }
    }

    return [null, dbDeal] as const;
  }

  async getDealByPipedriveIdAndCompanyId(
    companyId: string,
    dealId: number,
  ): PromiseReturn<PipedriveDeal> {
    const [errDbDeal, dbDeal] = await this.querier.getPipedriveDealByDealId(
      companyId,
      dealId,
    );
    if (
      errDbDeal &&
      !errDbDeal.error.toString().includes(ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND)
    ) {
      return [errDbDeal, null] as const;
    }

    if (
      errDbDeal &&
      errDbDeal.error.toString().includes(ERROR_MESSAGES.PIPEDRIVE_DEAL_NOT_FOUND)
    ) {
      if (!this.configV2) {
        const err = new Error(
          "this.config was not set (call triggerTokenUpdate before using getDealByPipedriveIdAndCompanyId)",
        );
        logError(this.logger, err, { context: "getDealByPipedriveIdAndCompanyId" });
        return [
          {
            message: "",
            error: err,
          },
          null,
        ] as const;
      }

      const api = new DealsApi(this.configV2);

      const res = await api.getDeal({
        id: dealId,
      });

      if (!res.success || !res.data) {
        const err = new Error("Deal not found in Pipedrive");
        logError(this.logger, err, {
          context: "getDealByPipedriveIdAndCompanyId",
        });
        return [
          {
            message: "" + err,
            error: err,
          },
          null,
        ] as const;
      }

      const [errPerson, person] = await this.getAndSavePersonByPipedriveId(
        companyId,
        res.data.person_id!,
      );
      if (errPerson) return [errPerson, null] as const;

      const newDeal: NewPipedriveDeal = {
        companyId,
        pipedriveId: res.data.id!,
        name: res.data.title!,
        pipedrivePeopleId: person.id,
      };

      const [errSave, savedDeal] =
        await this.querier.createPipedriveDeal(newDeal);
      if (errSave) return [errSave, null] as const;

      return [null, savedDeal] as const;
    }

    if (!dbDeal) {
      return [
        {
          message: "Something went wrong.",
          error: new Error("Something went wrong."),
        },
        null,
      ] as const;
    }

    return [null, dbDeal] as const;
  }

  async getAndSavePersonByPipedriveId(
    companyId: string,
    personId: number,
  ): PromiseReturn<PipedrivePerson> {
    const [errDbPerson, dbPerson] =
      await this.querier.getPipedrivePersonByPipedriveId(companyId, personId);
    if (
      errDbPerson &&
      !errDbPerson.error.toString().includes(ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND)
    ) {
      return [errDbPerson, null] as const;
    }

    if (
      errDbPerson &&
      errDbPerson.error.toString().includes(ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND)
    ) {
      if (!this.configV2) {
        const err = new Error(
          "this.config was not set (call triggerTokenUpdate before using getAndSavePersonByPipedriveId)",
        );
        logError(this.logger, err, {
          context: "getAndSavePersonByPipedriveId",
        });
        return [
          {
            message: "",
            error: err,
          },
          null,
        ] as const;
      }

      const api = new PersonsApi(this.configV2);

      try {
        const res = await api.getPerson({
          id: personId,
        });

        if (!res.success || !res.data) {
          const err = new Error("Person not found in Pipedrive.");
          logError(this.logger, err, {
            context: "getAndSavePersonByPipedriveId",
          });
          return [
            {
              message: "" + err,
              error: err,
            },
            null,
          ] as const;
        }

        const personData = res.data;

        const newPerson: NewPipedrivePerson = {
          companyId,
          pipedriveId: personData.id!,
          name: personData.name!,
          email:
            personData.emails && personData.emails.length > 0
              ? personData.emails[0].value!
              : "",
        };

        const [errSave, savedPerson] =
          await this.querier.createPipedrivePerson(newPerson);
        if (errSave) return [errSave, null] as const;

        return [null, savedPerson] as const;
      } catch (error) {
        const err = new Error("API call to get person failed.");
        logError(this.logger, err, {
          context: "getAndSavePersonByPipedriveId",
          originalError: error,
        });
        return [
          {
            message: "" + err,
            error: err,
          },
          null,
        ] as const;
      }
    }

    if (!dbPerson) {
      return [
        {
          message: "Something went wrong.",
          error: new Error("Something went wrong."),
        },
        null,
      ] as const;
    }

    return [null, dbPerson] as const;
  }

  async getAndSavePersonByEmail(
    companyId: string,
    email: string,
  ): PromiseReturn<PipedrivePerson> {
    const [errDbPerson, dbPerson] =
      await this.querier.getPipedrivePersonByEmail(companyId, email);
    if (
      errDbPerson &&
      !errDbPerson.error.toString().includes(ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND)
    ) {
      return [errDbPerson, null] as const;
    }

    if (
      errDbPerson &&
      errDbPerson.error.toString().includes(ERROR_MESSAGES.PIPEDRIVE_PERSON_NOT_FOUND)
    ) {
      if (!this.configV2) {
        const err = new Error(
          "this.config was not set (call triggerTokenUpdate before using getAndSavePersonByEmail)",
        );
        logError(this.logger, err, { context: "getAndSavePersonByEmail" });
        return [
          {
            message: "",
            error: err,
          },
          null,
        ] as const;
      }

      const api = new PersonsApi(this.configV2);

      try {
        const res = await api.searchPersons({
          term: email.toLowerCase(),
          fields: "email",
          exact_match: false,
        });

        if (
          !res.success ||
          !res.data ||
          !res.data.items ||
          res.data.items.length === 0 ||
          !res.data.items[0].item
        ) {
          const err = new Error("Person not found in Pipedrive.");
          logError(this.logger, err, { context: "getAndSavePersonByEmail" });
          return [
            {
              message: "" + err,
              error: err,
            },
            null,
          ] as const;
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
        if (errSave) return [errSave, null] as const;

        return [null, savedPerson] as const;
      } catch (error) {
        const err = new Error("API call to search person failed.");
        logError(this.logger, err, {
          context: "getAndSavePersonByEmail",
          originalError: error,
        });
        return [
          {
            message: "" + err,
            error: err,
          },
          null,
        ] as const;
      }
    }

    if (!dbPerson) {
      return [
        {
          message: "Something went wrong.",
          error: new Error("Something went wrong."),
        },
        null,
      ] as const;
    }

    return [null, dbPerson] as const;
  }

  async createAndSaveActivity(
    deal: PipedriveDeal,
    eventPayload: InviteePayload,
    mapping: TypeMappingType,
    user: BaseUser,
    event: CalendlyEvent,
  ) {
    if (!this.configV2) {
      const err = new Error(
        "this.config was not set (call triggerTokenUpdate before using createAndSaveActivity)",
      );
      logError(this.logger, err, { context: "createAndSaveActivity" });
      return [
        {
          message: "",
          error: err,
        },
        null,
      ] as const;
    }

    const [errActivityGet, dbActivityGet] = await this.querier.getPipedriveActivityByEventId(event.id)
    if (errActivityGet && errActivityGet.error.toString().includes(ERROR_MESSAGES.PIPEDRIVE_ACTIVITY_NOT_FOUND)) {
      const [errCompany, company] = await this.querier.getCompanyById(deal.companyId);
      if (errCompany) return [errCompany, null] as const;

      const [errActivityType, activityType] =
        await this.querier.getPipedriveActivityTypeById(
          mapping.pipedriveActivityTypeId,
        );
      if (errActivityType) return [errActivityType, null] as const;

      const api = new ActivitiesApi(this.configV2);

      const startTime = dayjs(eventPayload.scheduled_event.start_time);
      const endTime = dayjs(eventPayload.scheduled_event.end_time);

      this.logger.warn('StartDate: ' + eventPayload.scheduled_event.start_time)
      this.logger.warn('StartDate: ' + startTime.toString())
      this.logger.warn('StartDate: ' + startTime.toDate().toString())
      this.logger.warn('StartDate: ' + startTime.toDate().toJSON())
      this.logger.warn('StartDate: ' + startTime.toDate())

      const durationInSeconds = endTime.diff(startTime, "second");

      const [errPerson, person] = await this.querier.getPipedrivePersonById(
        deal.pipedrivePeopleId,
      );
      if (errPerson) return [errPerson, null] as const;

      const body: ActivitiesApiAddActivityRequest = {
        AddActivityRequest: {
          subject: activityType.name,
          type: activityType.keyString,
          due_date: startTime.toDate().toString(),
          //duration: durationInSeconds.toString(),
          deal_id: deal.pipedriveId,
          owner_id: user.id,
          //person_id: person.pipedriveId,
          participants: [{
            person_id: person.pipedriveId,
            primary: true
          }]
        },
      };

      const res = await api.addActivity(body);

      if (!res.success || !res.data) {
        const err = new Error("Api call addActivity failed.");
        logError(this.logger, err, { context: "createAndSaveActivity" });
        return [
          {
            message: "" + err,
            error: err,
          },
          null,
        ] as const;
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
      if (errCreateActivity) return [errCreateActivity, null] as const;

      return [null, createdActivity] as const;
    } else if (errActivityGet) {
      return [errActivityGet, null] as const;
    }
    return [null, dbActivityGet] as const
  }

  async getAndSaveActiviyTypes(userId: number, companyId: string) {
    if (!this.config) {
      const err = new Error(
        "this.config was not set (call triggerTokenUpdate before using getAndSaveActiviyTypes",
      );
      logError(this.logger, err, { context: "getAndSaveActiviyTypes" });
      return [
        {
          message: "",
          error: err,
        },
        null,
      ] as const;
    }

    const api = new ActivityTypesApi(this.config);

    const res = await api.getActivityTypes();

    if (!res.success) {
      const err = new Error("Api call getActivityTypes failed.");
      logError(this.logger, err, { context: "getAndSaveActiviyTypes" });
      return [
        {
          message: "" + err,
          error: err,
        },
        null,
      ] as const;
    }

    const dbActivityTypes: NewPipedriveActivityType[] = res.data.map(
      (activityType) => {
        return {
          name: activityType.name,
          keyString: activityType.key_string,
          pipedriveId: activityType.id,
          companyId,
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

    return [null, res.data] as const;
  }

  async triggerTokenUpdate(userId: number) {
    this.userId = userId;
    await this.updateConfig();
  }

  async authorize(code: string) {
    const res = await this.oauth2.authorize(code);
    const resV2 = await this.oauth2V2.authorize(code);

    const [configErr, _] = await this.updateConfig(res, resV2);
    if (configErr) {
      logError(this.logger, configErr, { context: "authorize" });
      return [configErr, null] as const;
    }

    const [err, user] = await this.getUser();
    if (err) {
      logError(this.logger, err, { context: "authorize" });
      return [err, null] as const;
    }

    const [saveErr, __] = await this.saveUserToDB(user);
    if (saveErr) {
      logError(this.logger, saveErr, { context: "authorize" });
      return [saveErr, null] as const;
    }

    return [null, user] as const;
  }

  private async saveUserToDB(user: GetCurrentUserResponseAllOfData) {
    if (!this.tokens) {
      const err = new Error("this.tokens is not set");
      logError(this.logger, err, { context: "saveUserToDB" });
      return [
        {
          message: "",
          error: err,
        },
        null,
      ] as const;
    }

    const [checkUserErr, exUser] = await querier.checkUserExists(user.id!);
    if (checkUserErr) {
      logError(this.logger, checkUserErr, { context: "checkUserExists" });
      return [checkUserErr, null] as const;
    }
    if (exUser.length > 0) {
      const [err, _] = await querier.loginWithPipedrive(user.id!, this.tokens);
      if (err) {
        logError(this.logger, err, { context: "loginWithPipedrive" });
        return [err, null] as const;
      }
    } else {
      const [err, _] = await querier.createUser(user, this.tokens);
      if (err) {
        logError(this.logger, err, { context: "createUser" });
        return [err, null] as const;
      }
    }

    return [null, user] as const;
  }
  async getUserByEmail(email: string): PromiseReturn<BaseUser> {
    if (!this.config) {
      return [
        {
          message: "",
          error: null,
        },
        null,
      ] as const;
    }

    const api = new UsersApi(this.config);
    const data = await api.getUsers();

    if (!data.data) {
      return [
        {
          message: "",
          error: null,
        },
        null,
      ] as const;
    }

    const user = data.data.find((user) => user.email === email);
    if (!user) {
      return [
        {
          message: "",
          error: null,
        },
        null,
      ] as const;
    }

    return [null, user] as const;
  }

  async getUser(): PromiseReturn<GetCurrentUserResponseAllOfData> {
    if (!this.config) {
      return [
        {
          message: "",
          error: null,
        },
        null,
      ] as const;
    }

    const api = new UsersApi(this.config);
    const data = await api.getCurrentUser();

    if (!data.data) {
      return [
        {
          message: "",
          error: null,
        },
        null,
      ] as const;
    }

    this.userId = data.data.id!;

    return [null, data.data] as const;
  }

  private async setTokenFromDB() {
    if (!this.userId) {
      const err = new Error("this.userId was not set.");
      logError(this.logger, err, { context: "setTokenFromDB" });
      return [
        {
          message: "",
          error: err,
        },
        null,
      ] as const;
    }

    const [err, user] = await this.querier.getUser(this.userId);

    if (err) {
      logError(this.logger, err, {
        context: "setTokenFromDB: Could not find user",
      });
      return [err, null] as const;
    }

    this.tokens = {
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
      expires_in: user.expiresIn,
      scope: user.scope,
      api_domain: user.apiDomain,
      token_type: user.tokenType,
    };

    return [null, true] as const;
  }

  private async updateConfig(tokens?: TokenResponse, tokensV2?: TokenResponse) {
    if (tokens && tokensV2) {
      this.tokens = { ...tokens };
      this.tokensV2 = { ...tokensV2 };
      this.oauth2.updateToken(tokens);
      this.oauth2V2.updateToken(tokensV2);
    } else {
      const [err, _] = await this.setTokenFromDB();

      if (err) {
        logError(this.logger, err, { context: "updateToken" });
        return [err, null] as const;
      }

      this.oauth2.updateToken(this.tokens);
      this.oauth2V2.updateToken(this.tokens);

      const newToken = await this.oauth2.tokenRefresh();
      const newTokenV2 = await this.oauth2V2.tokenRefresh();

      this.tokens = newToken;
      this.tokensV2 = newTokenV2;
    }

    if (!this.tokens) {
      const err = new Error("this.tokens is not set");
      logError(this.logger, err, { context: "updateToken" });
      return [
        {
          message: "",
          error: err,
        },
        null,
      ] as const;
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

    return [null, true] as const;
  }
}
