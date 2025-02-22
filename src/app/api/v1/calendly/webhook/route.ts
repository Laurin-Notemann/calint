import { NextRequest, NextResponse } from "next/server";
import { createLogger, logMessage } from "@/utils/logger";
import { WebhookPayload } from "@/lib/calendly-client";
import { PipedriveController } from "@/lib/pipedrive/pipedrive-controller";
import { CalendlyController } from "@/lib/calendly/calendly-controller";
import { CalintSetup } from "@/lib/calint-setup";
import { querier } from "@/db/queries";

const logger = createLogger("calendly-webhook");

export async function POST(request: NextRequest) {
  const body: WebhookPayload = await request.json();

  const pipedriveController = new PipedriveController(querier);
  const calendlyController = new CalendlyController(querier);

  const calintSetup = new CalintSetup(
    calendlyController,
    pipedriveController,
    querier,
  );

  const [err] = await calintSetup.handleCalendlyWebhook(body);

  if (err) {
    logMessage(logger, "error", err.message);
    return NextResponse.json({ error: err.message }, { status: 202 });
  }

  //return NextResponse.json(res);
  return NextResponse.json("Ok");
}
