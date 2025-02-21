import { MappingSelections } from "@/components/pipedrive-setup";
import { querier } from "@/db/queries";
import { TypeMappingType } from "@/db/schema";
import { CalendlyController } from "@/lib/calendly/calendly-controller";
import { CalintSetup } from "@/lib/calint-setup";
import { PipedriveController } from "@/lib/pipedrive/pipedrive-controller";
import createLogger, { logMessage } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

export type MappingsResponse = {
  success: boolean;
  error: string | null;
  data: TypeMappingType[];
};

const logger = createLogger("create-mapping");

export type MappingsRequestBody = {
  mappings: MappingSelections;
  eventTypeId: string;
};

export async function POST(request: NextRequest) {
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

  const [err, res] = await calintSetup.createMapping(userId, request);
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
    { status: 201 },
  );
}
