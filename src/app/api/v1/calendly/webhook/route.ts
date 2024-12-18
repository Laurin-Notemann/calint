import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log("heher")
  return NextResponse.json("ok");
}

