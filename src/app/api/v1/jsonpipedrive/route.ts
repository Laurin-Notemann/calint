import { querier } from "@/db/queries";
import { CalendlyController } from "@/lib/calendly/calendly-controller";
import { CalintSetup } from "@/lib/calint-setup";
import { PipedriveController } from "@/lib/pipedrive/pipedrive-controller";
import createLogger, { logMessage } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

const logger = createLogger("jsonpipedrive");

export type JsonPanel = {
  data: JsonPanelData[];
};

export type JsonPanelData = {
  id: number;
  header: string;
  join_meeting?: string;
  cancel_meeting?: string;
  reschedule_meeting?: string;
  typeKeyString: string;
  isDb: boolean;
};

export async function GET(request: NextRequest) {
  const stringUserId = request.nextUrl.searchParams.get("userId");
  const stringDealId = request.nextUrl.searchParams.get("selectedIds");
  if (!stringUserId || !stringDealId) {
    logMessage(logger, "error", "userId or selectedIds missing");
    return NextResponse.json(
      { error: "No UserID or selectedIds" },
      { status: 400 },
    );
  }

  const userId = parseInt(stringUserId);
  const dealId = parseInt(stringDealId);

  const pipedriveController = new PipedriveController(querier);
  const calendlyController = new CalendlyController(querier);

  const calintSetup = new CalintSetup(
    calendlyController,
    pipedriveController,
    querier,
  );

  const [errJsonPanel, jsonPanel] = await calintSetup.getJsonPanelData(
    userId,
    dealId,
  );
  if (errJsonPanel) {
    logMessage(logger, "error", errJsonPanel.message);
    return NextResponse.json({ error: errJsonPanel.message }, { status: 400 });
  }

  return NextResponse.json(jsonPanel);
}
