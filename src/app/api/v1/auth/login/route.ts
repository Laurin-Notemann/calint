import { initAPIClient, getAuthorizationUrl } from '@/lib/oauth';
import { NextResponse } from 'next/server';

export async function GET() {
  const client = initAPIClient({});
  return NextResponse.redirect(getAuthorizationUrl(client));
} 