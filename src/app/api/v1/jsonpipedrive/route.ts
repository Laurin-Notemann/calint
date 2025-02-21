import { querier } from "@/db/queries";
import { CalendlyController } from "@/lib/calendly/calendly-controller";
import { CalintSetup } from "@/lib/calint-setup";
import { PipedriveController } from "@/lib/pipedrive/pipedrive-controller";
import createLogger, { logError } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

const logger = createLogger("jsonpipedrive");

export type JsonPanel = {
  data: {
    id: number;
    header: string;
    join_meeting: {
      markdown: boolean;
      value: string;
    };
    cancel_meeting: {
      markdown: boolean;
      value: string;
    };
    reschedule_meeting: {
      markdown: boolean;
      value: string;
    };
  }[];
};

export async function GET(request: NextRequest) {
  const stringUserId = request.nextUrl.searchParams.get("userId");
  const stringDealId = request.nextUrl.searchParams.get("selectedIds");
  if (!stringUserId || !stringDealId) {
    logError(logger, new Error("No userId or selectedIds provided in request"));
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
    logError(logger, errJsonPanel, { context: "/jsonpipdrive", userId });
    return NextResponse.json({ error: errJsonPanel.message }, { status: 400 });
  }

  logger.info("jsonPanel: " + jsonPanel);

  return NextResponse.json(jsonPanel);
}
