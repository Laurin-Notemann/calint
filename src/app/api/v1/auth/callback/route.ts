import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createLogger, logMessage } from "@/utils/logger";
import { PipedriveController } from "@/lib/pipedrive/pipedrive-controller";
import { querier } from "@/db/queries";

const logger = createLogger("pipedrive-callback");

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    logMessage(logger, "error", "No pipedrive code provided");
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const pipedriveController = new PipedriveController(querier);

  const [err, user] = await pipedriveController.authorize(code);

  if (err) {
    logMessage(logger, "error", err.message);
    const errorUrl = new URL("/error", request.url);
    errorUrl.searchParams.set("error-msg", JSON.stringify(err.message));
    return NextResponse.redirect(errorUrl);
  }

  const calendlyLink = `https://auth.calendly.com/oauth/authorize?client_id=${env.CALENDLY_CLIENT_ID}&response_type=code&redirect_uri=${env.CALENDLY_REDIRECT_URL}`;
  const response = NextResponse.redirect(calendlyLink);

  response.cookies.set("userId", String(user.id), {
    httpOnly: false,
    secure: true,
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 30 * 12, // 1 year
    path: "/",
  });

  return response;
}
