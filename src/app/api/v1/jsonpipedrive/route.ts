import createLogger, { logError } from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

const logger = createLogger("jsonpipedrive");

export async function GET(request: NextRequest) {
  logger.warn(JSON.stringify(request.nextUrl))
  const stringUserId = request.nextUrl.searchParams.get("userId");
  if (!stringUserId) {
    logError(logger, new Error("No userId provided in request"));
    return NextResponse.json({ error: "No UserID" }, { status: 400 });
  }

  logger.warn("test")

  const lala = {
    data: {
      id: "leo Leler",
      header: "Hello",
    },
  };

  return NextResponse.json(lala);
}
