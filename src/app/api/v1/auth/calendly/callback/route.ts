import { querier } from "@/db/queries";
import { CalendlyClient } from "@/lib/calendly-client";
import dayjs from "dayjs";
import { NextRequest, NextResponse } from "next/server";
import { createLogger, logError } from "@/utils/logger";
import { User } from "@/db/schema";

export const dynamic = "force-dynamic";

const logger = createLogger("calendly-callback");

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) {
      logError(logger, { error: "Missing code parameter" });
      return NextResponse.redirect(new URL("/error", request.url));
    }

    const pipedriveId = request.nextUrl.searchParams.get("pipedriveid");
    if (!pipedriveId) {
      logError(logger, { error: "Missing pipedriveid parameter" });
      return NextResponse.redirect(new URL("/error", request.url));
    }

    const calClient = new CalendlyClient({}); // important need new client for every request

    const [tokenErr, token] = await calClient.getAccessToken(code);
    logger.info({ token }, "Received Calendly tokens");
    if (tokenErr) {
      logError(logger, tokenErr.error, { context: "getAccessToken" });
      return NextResponse.redirect(new URL("/error", request.url));
    }

    calClient.updateCalendlyTokens(token);

    const [error, user] = await calClient.getUserInfo();

    if (error) {
      logError(logger, error, { context: "Failed to get user info" });
      return NextResponse.redirect(new URL("/error", request.url));
    }

    logger.info({ user }, "Received Calendly user info");

    const credentials = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: dayjs().add(token.expires_in, "second").toDate(),
    };

    const [getUserErr, pipedriveUser] = await querier.checkUserExists(
      parseInt(pipedriveId),
    );

    if (getUserErr) {
      logError(logger, getUserErr, {
        context: "Failed to check if user exists",
      });
      return NextResponse.redirect(new URL("/error", request.url));
    }

    let dbUserGl: User | null = null;

    // If there is no pipedrive user error
    if (pipedriveUser.length > 0) {
      const [getCalendlyAccErr, calendlyAcc] =
        await querier.checkCalendlyUserExist(pipedriveUser[0].id);
      if (getCalendlyAccErr) {
        logError(logger, getCalendlyAccErr, {
          context: "Failed to check if Calendly account exists",
        });
        return NextResponse.redirect(new URL("/error", request.url));
      }

      const userId = pipedriveUser[0].id;

      //if there is no calendly acc create a new one
      if (calendlyAcc.length > 0) {
        const [err, dbUser] = await querier.loginWithCalendly(
          calendlyAcc[0].calendly_accs.uri,
          credentials,
          userId
        );
        if (err) {
          logError(logger, err, { context: "Failed to login with Calendly" });
          return NextResponse.redirect(new URL("/error", request.url));
        }
        dbUserGl = dbUser;
      } else {
        const [addAccErr, dbUser] = await querier.addCalendlyAccountToUser(
          userId,
          user.resource,
          credentials,
        );
        if (addAccErr) {
          logError(logger, addAccErr, {
            context: "Failed to add Calendly account to user",
          });
          return NextResponse.redirect(new URL("/error", request.url));
        }

        dbUserGl = dbUser;
      }
    } else {
      logError(logger, { error: "No Pipedrive user found" });
      return NextResponse.redirect(new URL("/error", request.url));
    }

    const [webhookError, res] = await calClient.createWebhookSubscription(
      user.resource.current_organization,
      user.resource.uri,
    );
    if (webhookError) {
      logError(logger, webhookError.error, {
        context: "createWebhookSubscription",
      });
      if (
        webhookError.error.message ===
        "Please upgrade your Calendly account to Standard"
      ) {
        const errorUrl = new URL("/error", request.url);
        errorUrl.searchParams.set(
          "error-msg",
          "Your Calendly account needs at least a Standard subscription in order do create a webhook",
        );
        return NextResponse.redirect(errorUrl);
      }

      if (webhookError.error.title !== "Already Exists")
        return NextResponse.redirect(new URL("/error", request.url));
    }

    logger.info({ webhook: res }, "Created Calendly webhook");

    if (!dbUserGl) {
      logError(logger, new Error("dbUserGl was not set"), {
        context: "dbuserGl was not set in calendly callback",
      });
      return NextResponse.redirect(new URL("/error", request.url));
    }

    const [companyErr, getCompany] = await querier.getCompanyById(
      dbUserGl.companyId,
    );

    if (companyErr) {
      logError(logger, companyErr, {
        context: "Failed to get users Company",
      });
      return NextResponse.redirect(new URL("/error", request.url));
    }

    if (getCompany.calendlyOrgUri) {
      logger.info(
        { uri: getCompany.calendlyOrgUri },
        "Calendly org already exists",
      );
      return NextResponse.redirect(new URL("/topipedrive", request.url));
    }

    getCompany.calendlyOrgUri = user.resource.current_organization;

    const [updateErr, _] = await querier.updateCompany(getCompany);

    if (updateErr) {
      logError(logger, updateErr, {
        context: "Failed to update company",
      });
      return NextResponse.redirect(new URL("/error", request.url));
    }

    return NextResponse.redirect(new URL("/topipedrive", request.url));
    // doesn't work right now
    //return NextResponse.redirect('https://company.pipedrive.com');
  } catch (error) {
    logError(logger, error, { context: "calendlyCallback" });
    return NextResponse.redirect(new URL("/error", request.url));
  }
}
