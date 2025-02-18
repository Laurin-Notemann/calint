import { NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/utils/logger";

const logger = createLogger("calendly-webhook");

export async function POST(request: NextRequest) {
  logger.info(JSON.stringify(await request.json()))
  logger.info(JSON.stringify(request.headers))
  logger.info(JSON.stringify(request.nextUrl))
  logger.info("Received Calendly webhook");
  return NextResponse.json("ok");
}
