import { querier } from "@/db/queries";
import { NextRequest, NextResponse } from "next/server";
import { createLogger, logMessage } from "@/utils/logger";
import { CalendlyController } from "@/lib/calendly/calendly-controller";

export const dynamic = "force-dynamic";

const logger = createLogger("calendly-callback");

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    logMessage(logger, "error", "Missing Code parameter");
    return NextResponse.redirect(new URL("/error", request.url));
  }
  const pipedriveIdString = request.nextUrl.searchParams.get("pipedriveid");
  if (!pipedriveIdString) {
    logMessage(logger, "error", "Missing pipedriveid parameter");
    return NextResponse.redirect(new URL("/error", request.url));
  }

  const pipedriveId = parseInt(pipedriveIdString);

  const calendlyController = new CalendlyController(querier);

  const [err] = await calendlyController.callback(code, pipedriveId);
  if (err) {
    logMessage(logger, "error", err.message);
    const errorUrl = new URL("/error", request.url);
    errorUrl.searchParams.set("error-msg", err.message);
    return NextResponse.redirect(errorUrl);
  }

  return NextResponse.redirect(new URL("/topipedrive", request.url));
}
