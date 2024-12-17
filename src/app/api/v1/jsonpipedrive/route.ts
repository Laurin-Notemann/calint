import dayjs from 'dayjs';
import { NextResponse } from 'next/server';

type visitData = {
  visitTime: string;  // date-time format
  company: string;
  source: string;
  landingPage: string;
  pageViews: number;
  duration: string;
}

export async function GET(request: NextResponse) {
  console.log(request);
  
  return NextResponse.json([{
    company: "test",
    source: "test",
    landingPage: "dongs",
  }]);
}
