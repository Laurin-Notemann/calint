import { ApiClient, UsersApi } from "pipedrive/v1";
import logger from "@/utils/logger";
import { env } from "./env";

const log = logger("OAuth 🔒");

interface APIClientConfig {
  accessToken?: string;
  refreshToken?: string;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// Initialize the API client
export const initAPIClient = ({
  accessToken = "",
  refreshToken = "",
}: APIClientConfig): ApiClient => {
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
  log.info("Authorization URL generated");
  return authUrl;
};

// Get the currently authorized user details
export const getLoggedInUser = async (client: ApiClient) => {
  const api = new UsersApi(client);
  const data = await api.getCurrentUser();
  log.info("Currently logged-in user details obtained");
  return data;
};

// Update Access and Refresh tokens
export const updateTokens = (client: ApiClient, token: TokenResponse): void => {
  log.info("Updating access + refresh token details");
  const oAuth2 = client.authentications.oauth2;
  oAuth2.accessToken = token.access_token;
  oAuth2.refreshToken = token.refresh_token;
};
