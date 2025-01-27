import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from "@/utils/logger";

const logger = createLogger('calendly-webhook');

export async function POST(request: NextRequest) {
  logger.info("Received Calendly webhook");
  return NextResponse.json("ok");
}

