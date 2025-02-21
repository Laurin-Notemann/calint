import { querier } from "@/db/queries";
import { NextRequest, NextResponse } from "next/server";
import { createLogger, logMessage } from "@/utils/logger";
import { PipedriveController } from "@/lib/pipedrive/pipedrive-controller";
import { CalendlyController } from "@/lib/calendly/calendly-controller";
import { CalintSetup } from "@/lib/calint-setup";

const logger = createLogger("settings-modal");

export async function GET(request: NextRequest) {
  const stringUserId = request.nextUrl.searchParams.get("userId");
  if (!stringUserId) {
    logMessage(logger, "error", "No userId provided in request");
    return NextResponse.json({ error: "No UserID" }, { status: 400 });
  }

  const userId = parseInt(stringUserId);

  const pipedriveController = new PipedriveController(querier);
  const calendlyController = new CalendlyController(querier);

  const calintSetup = new CalintSetup(
    calendlyController,
    pipedriveController,
    querier,
  );

  const [err, res] =
    await calintSetup.getAndSaveAllEventTypesAndActivityTypes(userId);
  if (err) {
    logMessage(logger, "error", err.message);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  return NextResponse.json(res);
}
