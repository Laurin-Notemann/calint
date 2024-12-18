// @ts-expect-error because pipedrive sucks
import { ApiClient, UsersApi } from 'pipedrive';
import logger from '@/utils/logger';
import { env } from './env';

const log = logger('OAuth 🔒');

interface APIClientConfig {
  accessToken?: string;
  refreshToken?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

interface SessionData {
  auth: boolean;
  id?: string;
  name?: string,
  token?: string,
}

// Initialize the API client
export const initAPIClient = ({ accessToken = '', refreshToken = '' }: APIClientConfig): ApiClient => {
  const client = new ApiClient();
  const oAuth2 = client.authentications.oauth2;

  oAuth2.clientId = env.PIPEDRIVE_CLIENT_ID;
  oAuth2.clientSecret = env.PIPEDRIVE_CLIENT_SECRET;
  oAuth2.redirectUri = env.PIPEDRIVE_REDIRECT_URL;
  if (accessToken) oAuth2.accessToken = accessToken;
  if (refreshToken) oAuth2.refreshToken = refreshToken;

  return client;
};

// Generate the authorization URL for the 1st step
export const getAuthorizationUrl = (client: ApiClient): string => {
  const authUrl = client.buildAuthorizationUrl();
  log.info('Authorization URL generated');
  return authUrl;
};

// Get the currently authorized user details
export const getLoggedInUser = async (client: ApiClient) => {
  const api = new UsersApi(client);
  const data = await api.getCurrentUser();
  log.info('Currently logged-in user details obtained');
  return data;
};

// Update Access and Refresh tokens
export const updateTokens = (client: ApiClient, token: TokenResponse): void => {
  log.info('Updating access + refresh token details');
  const oAuth2 = client.authentications.oauth2;
  oAuth2.accessToken = token.access_token;
  oAuth2.refreshToken = token.refresh_token;
};

// Get Session Details
//export const initializeSession = async (userId: string): Promise<SessionData> => {
//  try {
//    const cookieStore = await cookies();
//    const sessionCookie = cookieStore.get('session');
//
//    if (!sessionCookie) {
//      log.info('Session cookie is not found. Checking the database for OAuth details');
//      const [account] = await db
//        .select()
//        .from(users)
//        .where(eq(users.accountId, String(userId)));
//
//      if (!account) {
//        log.info('No matching account found. You need to authorize the app 🔑');
//        return { auth: false };
//      }
//
//      if (Date.now() > parseInt(account.expiresAt)) {
//        log.info('Account details found. Access token has expired');
//        const client = initAPIClient({
//          accessToken: account.accessToken,
//          refreshToken: account.refreshToken,
//        });
//        const refreshed = await client.refreshToken();
//        log.info('Token successfully refreshed');
//
//        await db
//          .update(users)
//          .set({
//            accessToken: refreshed.access_token,
//            refreshToken: refreshed.refresh_token,
//            expiresAt: String(Date.now() + 59 * 60 * 1000),
//          })
//          .where(eq(users.accountId, userId));
//
//        log.info('Database updated. Session cookie set 🍪');
//        return setSessionCookie(
//          true,
//          String(account.accountId),
//          account.name,
//          refreshed.access_token,
//          String(Date.now() + 59 * 60 * 1000)
//        );
//      }
//
//      log.info('Access token is valid. Session cookie set 🍪');
//      return setSessionCookie(
//        true,
//        account.accountId,
//        account.name,
//        account.accessToken,
//        account.expiresAt 
//      );
//    }
//
//    log.info('Session cookie found 🍪');
//    return JSON.parse(sessionCookie.value);
//  } catch (error) {
//    log.error("Couldn't create session :[");
//    log.error(error);
//    return { auth: false };
//  }
//};
//
//// Set cookies
//const setSessionCookie = async (
//  auth: boolean,
//  id: string,
//  name: string,
//  token: string,
//  expiry: string
//): Promise<SessionData> => {
//  const cookieStore = await cookies();
//  const newSession: SessionData = {
//    auth,
//    id,
//    name,
//    token,
//  };
//
//  cookieStore.set('session', JSON.stringify(newSession), {
//    maxAge: Math.round((parseInt(expiry) - Date.now()) / 1000),
//    sameSite: 'none',
//    secure: true,
//  });
//
//  return newSession;
//}; 
