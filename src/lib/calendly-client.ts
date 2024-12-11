import { CalendlyUser } from "@/db/queries";
import { env } from "./env"


export class CalendlyClient {
  accessToken: string;
  refreshToken: string;
  constructor({ accessToken, refreshToken }: { accessToken?: string, refreshToken?: string }) {
    this.accessToken = accessToken ? accessToken : ""
    this.refreshToken = refreshToken ? refreshToken : ""
  }

  async getAccessToken(code: string) {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: env.CALENDLY_REDIRECT_URL
    });
    try {
      const res = await fetch("https://auth.calendly.com/oauth/token", {
        headers: {
          "Authorization": "Basic " + btoa(env.CALENDLY_CLIENT_ID + ":" + env.CALENDLY_CLIENT_SECRET),
          "Content-Type": "application/x-www-form-urlencoded"
        },
        method: "POST",
        body: body,
      })

      const data: GetAccessTokenRes = await res.json();

      this.updateCalendlyTokens(data)

      return [null, data] as const
    } catch (error) {

      return [{
        message: "Could not get auth code",
        error
      }, null] as const
    }
  }

  updateCalendlyTokens(tokens: GetAccessTokenRes) {
    this.accessToken = tokens.access_token
    this.refreshToken = tokens.refresh_token
  }

  async getUserInfo(): Promise<Readonly<[CalendlyError, null] | [null, CalendlyGetUserMeRes]>> {
    try {
      const res = await fetch("https://api.calendly.com/users/me", {
        headers: {
          "Authorization": "Bearer " + this.accessToken
        }
      })

      const data: CalendlyGetUserMeRes = await res.json()
      return [null, data] as const
    } catch (error) {
      return [{
        message: "could not get user info",
        error
      }, null] as const
    }
  }
}

export type CalendlyError = {
  message: string;
  error: any
}

export type GetAccessTokenRes = {
  token_type: 'Bearer';
  access_token: string;
  refresh_token: string;
  scope?: string;
  created_at: number;
  expires_in: number;
  owner: string;
  organization: string;
}

export type CalendlyGetUserMeRes = {
  resource: CalendlyUser
};
