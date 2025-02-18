import createLogger from "@/utils/logger";
import { NextRequest, NextResponse } from "next/server";

const logger = createLogger("jsonpipedrive");

export async function GET(request: NextRequest) {
  logger.warn(JSON.stringify(request))

  logger.warn("test")

  const lala = {
    data: {
      id: "leo Leler",
      header: "Hello",
    },
  };

  return NextResponse.json(lala);
}
