import { querier } from "@/db/queries";
import { CalendlyClient } from "@/lib/calendly-client";
import dayjs from "dayjs";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {

    const code = request.nextUrl.searchParams.get('code');
    if (!code)
      return NextResponse.redirect(new URL('/error', request.url));


    const pipedriveId = request.nextUrl.searchParams.get('pipedriveid');
    if (!pipedriveId)
      return NextResponse.redirect(new URL('/error', request.url));

    const calClient = new CalendlyClient({}) // important need new client for every request

    const [tokenErr, token] = await calClient.getAccessToken(code);

    console.log("TOKENS:", token);

    if (tokenErr) {
      console.error("TokenError: ", tokenErr.error);

      return NextResponse.redirect(new URL('/error', request.url));
    }

    const [error, user] = await calClient.getUserInfo()

    if (error)
      return NextResponse.redirect(new URL('/error', request.url));

    console.log("USER: ", user);

    const credentials = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: dayjs().add(token.expires_in, 'second').toDate(),
    };

    const [getUserErr, pipedriveUser] = await querier.checkUserExists(parseInt(pipedriveId))

    if (getUserErr)
      return NextResponse.redirect(new URL('/error', request.url));


    // If there is no pipedrive user error
    if (pipedriveUser.length > 0) {
      const [getCalendlyAccErr, calendlyAcc] = await querier.checkCalendlyUserExist(pipedriveUser[0].id)
      if (getCalendlyAccErr)
        return NextResponse.redirect(new URL('/error', request.url));

      //if there is no calendly acc create a new one
      if (calendlyAcc.length > 0) {
        const [err, _] = await querier.loginWithCalendly(calendlyAcc[0].calendly_acc.uri, credentials)
        if (err)
          return NextResponse.redirect(new URL('/error', request.url));

      } else {
        const [err, _] = await querier.addCalendlyAccountToUser(pipedriveUser[0].id, user.resource, credentials)
        if (err)
          return NextResponse.redirect(new URL('/error', request.url));
      }

    } else
      return NextResponse.redirect(new URL('/error', request.url));

    const [webhookError, res] = await calClient.createWebhookSubscription(user.resource.current_organization, user.resource.uri);
    if (webhookError) {
      console.error("WebhookError", webhookError.error);
      if (webhookError.error.title === "") {
        const response = NextResponse.redirect(new URL('/error', request.url));
        response.headers.set("error-msg", "Your Calendly account needs at least a Standard subscription in order do create a webhook");
        console.log("Response", response)
        return response;
      }

      if (webhookError.error.title !== "Already Exists")
        return NextResponse.redirect(new URL('/error', request.url));
    }

    console.log("CALENDLY WEBHOOK", res);


    return NextResponse.redirect(new URL('/topipedrive', request.url));
    // doesn't work right now
    //return NextResponse.redirect('https://company.pipedrive.com');
  } catch (error) {
    console.log("ERROR CALENDLY: " + error)
    return NextResponse.redirect(new URL('/error', request.url));
  }
} 
