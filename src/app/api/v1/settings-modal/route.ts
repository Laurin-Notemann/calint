import { querier } from '@/db/queries';
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
  console.log(request)

  const stringUserId = request.nextUrl.searchParams.get("userId")
  if (!stringUserId)
    return NextResponse.json({ error: "No UserID" }, { status: 400 })

  const userId = parseInt(stringUserId)

  const [getUserErr, user] = await querier.getUser(userId)
  if (getUserErr) {
    return NextResponse.json({ error: getUserErr.message }, { status: 400 })
  }

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

  const leler = {
    data: {
      blocks: {
        block_key_delivery_method: {
          value: 1,
          items: activityTypeNames
        },
      },
      actions: {}
    }
  }

  return NextResponse.json(leler);
}
