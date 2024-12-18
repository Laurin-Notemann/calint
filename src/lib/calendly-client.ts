import { CalendlyUser } from "@/db/queries";
import { env } from "./env"


export class CalendlyClient {
  accessToken: string;
  refreshToken: string;
  constructor({ accessToken, refreshToken }: { accessToken?: string, refreshToken?: string }) {
    this.accessToken = accessToken ? accessToken : ""
    this.refreshToken = refreshToken ? refreshToken : ""
  }

  async createWebhookSubscripton(organization: string, user: string) {
    const body = {
      url: "https://calint.laurinnotemann.dev/api/v1/calendly/webhook",
      events: [
        "invitee.created",
        "invitee.canceled",
        "invitee_no_show.created",
        "invitee_no_show.deleted"
      ],
      organization,
      user,
      scope: "organization",
    }
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.accessToken
      },
      body: JSON.stringify(body)
    };

    try {
      const res = await fetch('https://api.calendly.com/webhook_subscriptions', options);
      const body: CalendlyWebhookSubscription = await res.json();
      return [null, body] as const;
    } catch (error) {
      return [{
        message: "Could create webhook_subscriptions",
        error
      }, null] as const
    }
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

interface CalendlyWebhookSubscription {
  resource: {
    uri: string;
    callback_url: string;
    created_at: string;  // ISO 8601 datetime string
    updated_at: string;  // ISO 8601 datetime string
    retry_started_at: string;  // ISO 8601 datetime string
    state: 'active' | string;  // You might want to add other possible states
    events: string[];
    scope: 'user' | string;    // You might want to add other possible scopes
    organization: string;
    user: string;
    group: string;
    creator: string;
  }
}

