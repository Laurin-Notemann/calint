import { querier } from '@/db/queries';
import { CalendlyClient, EventType } from '@/lib/calendly-client';
import { initAPIClient } from '@/lib/oauth';
import { NextRequest, NextResponse } from 'next/server';
// @ts-expect-error because pipedrive sucks
import { ActivityTypesApi } from "pipedrive"


interface ActivityType {
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

export async function GET(request: NextRequest) {
  const stringUserId = request.nextUrl.searchParams.get("userId")
  if (!stringUserId)
    return NextResponse.json({ error: "No UserID" }, { status: 400 })

  const userId = parseInt(stringUserId)

  const [getUserErr, userCalendly] = await querier.getUserAndCalendlyAcc(userId)
  if (getUserErr) {
    return NextResponse.json({ error: getUserErr.message }, { status: 400 })
  }

  const user = userCalendly.users

  const pipedriveClient = initAPIClient({ accessToken: user.accessToken, refreshToken: user.refreshToken })

  const apiInstance = new ActivityTypesApi(pipedriveClient)

  let data: ActivityType[];
  try {

    const res: ActivityTypesResponse = await apiInstance.getActivityTypes()
    data = res.data

  } catch (error) {
    console.error("Getting Activity Types", error);

    return NextResponse.json({ error: "Could not get Activity types" }, { status: 400 })
  }

  const activityTypeNames = data.map((activityType, index) => {
    return {
      label: activityType.name,
      value: index + 1
    }
  })

  const calendlyAcc = userCalendly.calendly_acc;

  const calendlyClient = new CalendlyClient({
    accessToken: calendlyAcc.accessToken,
    refreshToken: calendlyAcc.refreshToken
  });

  const [eventTypesErr, eventTypes] = await calendlyClient.getAllEventTypes();

  if (eventTypesErr) {
    console.error("EventType Error", eventTypesErr.error);
    console.error("lala", eventTypesErr.error.details);

    return NextResponse.json({ error: "Could not get Event types" + eventTypesErr.error }, { status: 400 })
  }

  const responseData: SettingsDataRes = {
    data: {
      calendlyEventTypes: eventTypes,
      pipedriveAcitvityTypes: data
    }
  }

  return NextResponse.json(responseData);
}

export type SettingsDataRes = {
  data: {
    calendlyEventTypes: EventType[];
    pipedriveAcitvityTypes: ActivityType[];
  }
}
