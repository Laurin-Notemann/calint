import { MappingSelections } from "@/components/pipedrive-setup";
import { querier } from "@/db/queries";
import { NewTypeMappingType, TypeMappingType } from "@/db/schema";
import { PipedriveController } from "@/lib/pipedrive/pipedrive-controller";
import createLogger, { logError } from "@/utils/logger";
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
    logError(logger, new Error("No userId provided in request"));
    return NextResponse.json({ error: "No UserID" }, { status: 400 });
  }

  const pipedriveController = new PipedriveController(querier);

  const userId = parseInt(stringUserId);
  const [getUserErr, user] = await querier.getUserAndCalendlyAcc(userId);
  if (getUserErr) {
    logError(logger, getUserErr, {
      context: "getUserAndCalendlyAcc",
      userId,
    });
    return NextResponse.json(
      {
        success: false,
        error: "" + getUserErr.error,
        data: [],
      },
      { status: 500 },
    );
  }

  const pipedriveUser = user.users;

  await pipedriveController.triggerTokenUpdate(pipedriveUser.id);

  try {
    const body: MappingsRequestBody = await request.json();
    logger.warn(body);
    const newTypeMappings = remapMappingsToNewTypeMappingType(
      body,
      pipedriveUser.companyId,
    );
    logger.warn(2);

    for (const mapping of newTypeMappings) {
      const [upsertErr] = await querier.updateOrCreateTypeMapping(mapping);
      if (upsertErr) {
        return NextResponse.json(
          {
            success: false,
            error: "upserMapping: " + upsertErr,
            data: [],
          },
          { status: 500 },
        );
      }
    }
    logger.warn(3);

    const [err, allMappings] = await querier.getAllTypeMappings(
      pipedriveUser.companyId,
    );
    if (err)
      return NextResponse.json(
        { success: false, error: "getAllTypeMappings: " + err, data: [] },
        { status: 500 },
      );
    logger.warn(4);

    return NextResponse.json(
      { success: true, error: null, data: JSON.stringify(allMappings) },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "CatchBlock: " + error, data: [] },
      { status: 400 },
    );
  }
}

function remapMappingsToNewTypeMappingType(
  body: MappingsRequestBody,
  companyId: string,
): NewTypeMappingType[] {
  const { mappings, eventTypeId } = body;

  const typeMappings: NewTypeMappingType[] = [];

  (Object.keys(mappings) as Array<keyof MappingSelections>).forEach((type) => {
    const activityType = mappings[type];
    if (activityType !== undefined) {
      typeMappings.push({
        type: type as TypeMappingType["type"],
        companyId,
        calendlyEventTypeId: eventTypeId,
        pipedriveActivityTypeId: activityType ? activityType.id : null,
      });
    }
  });

  return typeMappings;
}
