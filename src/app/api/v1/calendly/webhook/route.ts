import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log("heher")
  return NextResponse.json("ok");
}

