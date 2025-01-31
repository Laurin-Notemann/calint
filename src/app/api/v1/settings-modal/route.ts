import { querier } from "@/db/queries";
import {
  CalendlyClient,
  CalendlyResponse,
  EventType,
} from "@/lib/calendly-client";
import { initAPIClient } from "@/lib/oauth";
import { NextRequest, NextResponse } from "next/server";
// @ts-expect-error because pipedrive sucks
import { ActivityTypesApi } from "pipedrive";
import { createLogger, logError } from "@/utils/logger";
import { NewCalEventType } from "@/db/schema";

export interface ActivityType {
  id: number;
  order_nr: number;
  name: string;
  key_string: string;
  icon_key: string;
  active_flag: boolean;
  color: string;
  is_custom_flag: boolean;
  add_time: string;
  update_time: string;
}

interface ActivityTypesResponse {
  success: boolean;
  data: ActivityType[];
}

const logger = createLogger("settings-modal");

export async function GET(request: NextRequest) {
  const stringUserId = request.nextUrl.searchParams.get("userId");
  if (!stringUserId) {
    logError(logger, new Error("No userId provided in request"));
    return NextResponse.json({ error: "No UserID" }, { status: 400 });
  }

  const userId = parseInt(stringUserId);

  const [getUserErr, userCalendly] =
    await querier.getUserAndCalendlyAcc(userId);
  if (getUserErr) {
    logError(logger, getUserErr, { context: "getUserAndCalendlyAcc", userId });
    return NextResponse.json({ error: getUserErr.message }, { status: 400 });
  }

  const user = userCalendly.users;

  const pipedriveClient = initAPIClient({
    accessToken: user.accessToken,
    refreshToken: user.refreshToken,
  });

  const apiInstance = new ActivityTypesApi(pipedriveClient);

  let data: ActivityType[];
  try {
    const res: ActivityTypesResponse = await apiInstance.getActivityTypes();
    data = res.data;
  } catch (error) {
    logError(logger, error, { context: "getActivityTypes", userId });
    return NextResponse.json(
      { error: "Could not get Activity types" },
      { status: 400 },
    );
  }

  const activityTypeNames = data.map((activityType, index) => {
    return {
      label: activityType.name,
      value: index + 1,
    };
  });

  const calendlyAcc = userCalendly.calendly_accs;

  const calendlyClient = new CalendlyClient({
    accessToken: calendlyAcc.accessToken,
    refreshToken: calendlyAcc.refreshToken,
  });

  const [eventTypesErr, eventTypes] = await calendlyClient.getAllEventTypes();


  if (eventTypesErr) {
    logError(logger, eventTypesErr.error, {
      context: "getEventTypes",
      details: eventTypesErr.error.details,
      userId,
    });
    return NextResponse.json(
      { error: "Could not get Event types" + eventTypesErr.error },
      { status: 400 },
    );
  }

  const dbEventTypes: NewCalEventType[] = eventTypes.collection.map((eventType) => {
    return {
      name: eventType.name,
      slug: eventType.slug,
      scheduleUri: eventType.scheduling_url,
      uri: eventType.uri,
      calUserUri: eventType.profile.owner,
      companyId: user.companyId
    }
  })

  const [addEventTypesErr, _] = await querier.addAllEventTypes(dbEventTypes)

  if (addEventTypesErr) {
    logError(logger, addEventTypesErr.error, {
      context: "getEventTypes",
      userId,
    });
    return NextResponse.json(
      { error: "Could not get Event types" + addEventTypesErr.error },
      { status: 400 },
    );
  }

  console.log(JSON.stringify(eventTypes));

  const responseData: SettingsDataRes = {
    data: {
      calendlyEventTypes: eventTypes,
      pipedriveAcitvityTypes: data,
    },
  };

  return NextResponse.json(responseData);
}

export type SettingsDataRes = {
  data: {
    calendlyEventTypes: CalendlyResponse;
    pipedriveAcitvityTypes: ActivityType[];
  };
};
