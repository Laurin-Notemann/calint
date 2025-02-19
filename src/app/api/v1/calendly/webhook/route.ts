import { NextRequest, NextResponse } from "next/server";
import { createLogger, logError } from "@/utils/logger";
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

  const [err, res] = await calintSetup.handleCalendlyWebhook(body);

  if (err) {
    logError(logger, err, { context: "/webhook post route" });
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  return NextResponse.json(res);
}
