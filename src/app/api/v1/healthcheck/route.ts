import createLogger from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

const loggerr = createLogger("Healthcheck")
export async function GET(request: NextRequest) {
  loggerr.error("Hallo?")
  const test = new URL(request.referrer)

  loggerr.error(test)

  loggerr.error(test.searchParams.get("userId"))

  return NextResponse.json("Ok" + test.searchParams.get("userId") + test);
}
