import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const test = new URL(request.referrer)

  console.log(test)

  console.log(test.searchParams.get("userId"))

  return NextResponse.json("Ok");
}
