import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  console.warn(JSON.stringify(request))

  const lala = {
    data: {
      id: "leo Leler",
      header: "Hello",
    },
  };

  return NextResponse.json(lala);
}
