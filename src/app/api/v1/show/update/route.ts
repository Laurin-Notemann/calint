import { querier } from "@/db/queries";
import { CalendlyController } from "@/lib/calendly/calendly-controller";
import { CalintSetup } from "@/lib/calint-setup";
import { PipedriveController } from "@/lib/pipedrive/pipedrive-controller";
import createLogger, { logMessage } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

const logger = createLogger("update-show-status");

export async function POST(request: NextRequest) {
  const pipedriveController = new PipedriveController(querier);
  const calendlyController = new CalendlyController(querier);

  const calintSetup = new CalintSetup(
    calendlyController,
    pipedriveController,
    querier,
  );

  const [err, res] = await calintSetup.updateShowStatus(request);
  if (err) {
    logMessage(logger, "error", err.message);
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        data: [],
      },
      { status: 400 },
    );
  }

  return NextResponse.json(
    { success: true, error: null, data: JSON.stringify(res) },
    { status: 200 },
  );
}
