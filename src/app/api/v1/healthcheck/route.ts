import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const test = new URL(request.referrer)

  console.error(test)

  console.error(test.searchParams.get("userId"))

  return NextResponse.json("Ok");
}
