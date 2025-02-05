import {
  ActivityTypesApi,
  Configuration,
  GetCurrentUserResponseAllOfData,
  OAuth2Configuration,
  TokenResponse,
  UsersApi,
} from "pipedrive/v1";
import { env } from "../env";
import { DatabaseQueries, PromiseReturn, querier } from "@/db/queries";
import createLogger, { logError } from "@/utils/logger";
import { NewPipedriveActivityType } from "@/db/schema";

export class PipedriveController {
  oauth2: OAuth2Configuration;
  config: Configuration | null = null;
  querier: DatabaseQueries;
  private logger = createLogger("PipedriveController");
  private tokens: TokenResponse | null = null;
  private userId: number | null = null;
  constructor(querier: DatabaseQueries) {
    this.oauth2 = new OAuth2Configuration({
      clientId: env.PIPEDRIVE_CLIENT_ID,
      clientSecret: env.PIPEDRIVE_CLIENT_SECRET,
      redirectUri: env.PIPEDRIVE_REDIRECT_URL,
    });
    this.querier = querier;
  }

  async getAndSaveActiviyTypes(userId: number, companyId: string) {
    this.logger.info(this.config)
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
    this.updateConfig();
  }

  async authorize(code: string) {
    const res = await this.oauth2.authorize(code);

    const [configErr, _] = await this.updateConfig(res);
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

  private async updateConfig(tokens?: TokenResponse) {
    if (tokens) {
      this.tokens = { ...tokens };
      this.oauth2.updateToken(tokens);
    } else {
      const [err, _] = await this.setTokenFromDB();

      if (err) {
        logError(this.logger, err, { context: "updateToken" });
        return [err, null] as const;
      }

      this.oauth2.updateToken(this.tokens);
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

    if (this.config) {
      this.config.accessToken = this.oauth2.getAccessToken;
      this.config.basePath = this.oauth2.basePath;
    } else {
      this.config = new Configuration({
        accessToken: this.oauth2.getAccessToken,
        basePath: this.oauth2.basePath,
      });
    }
    return [null, true] as const;
  }
}
