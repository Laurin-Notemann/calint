import { initAPIClient, getLoggedInUser, updateTokens } from '@/lib/oauth';
import { NextRequest, NextResponse } from 'next/server';
import { querier } from '@/db/queries';
import { BaseUserMe } from '@/db/pipedrive-types';
import dayjs from 'dayjs';

type GetAccessTokenPipedrive = {
  access_token: string;
  token_type: 'bearer';
  refresh_token: string;
  scope: string;
  expires_in: number;
  api_domain: string;
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    if (!code) {
      return NextResponse.json({ error: 'No code provided' }, { status: 400 });
    }

    const client = initAPIClient({});

    const token: GetAccessTokenPipedrive = await client.authorize(code);
    updateTokens(client, token);

    const user = await getLoggedInUser(client);
    const me: BaseUserMe = user.data;


    const credentials = {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: dayjs().add(token.expires_in, 'second').toDate(),
    };

    const [checkUserErr, exUser] = await querier.checkPipedriveUserExist(me.id)

    if (checkUserErr)
      return NextResponse.redirect(new URL('/error', request.url));

    if (exUser.length > 0) {
      const [err, _] = await querier.loginWithPipedrive(me.id, credentials)
      if (err)
        return NextResponse.redirect(new URL('/error', request.url));

    } else {
      const [err, _] = await querier.createPipedriveUser(me, credentials)
      if (err)
        return NextResponse.redirect(new URL('/error', request.url));
    }

    const response = NextResponse.redirect(new URL('/topipedrive', request.url));

    response.cookies.set('userId', String(me.id), {
      httpOnly: false,
      secure: true,
      sameSite: 'strict',
      maxAge: 60 * 60 * 24 * 30 * 12, // 1 year
      path: '/',
    });
    return response
  } catch (error) {
    console.log("ERROR " + error);

    return NextResponse.redirect(new URL('/error', request.url));
  }
} 
