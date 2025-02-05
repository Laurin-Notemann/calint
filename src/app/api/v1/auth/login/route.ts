import { querier } from "@/db/queries";
import { PipedriveController } from "@/lib/pipedrive/pipedrive-controller";
import { NextResponse } from "next/server";

export async function GET() {
  const pipeController = new PipedriveController(querier);
  return NextResponse.redirect(pipeController.oauth2.authorizationUrl);
}
