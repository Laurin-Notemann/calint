import { CalendlyUser, querier } from "@/db/queries";
import { env } from "./env"
import dayjs from "dayjs";


export class CalendlyClient {
  accessToken: string;
  refreshToken: string;
  constructor({ accessToken, refreshToken }: { accessToken?: string, refreshToken?: string }) {
    this.accessToken = accessToken ? accessToken : ""
    this.refreshToken = refreshToken ? refreshToken : ""
  }

  async refreshAccessToken() {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: this.refreshToken
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

      const whatisthisdate =  dayjs().add(data.expires_in, 'second').toDate()

      console.log(whatisthisdate)

      const credentials = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: whatisthisdate,
      };
      const [dbErr, _] = await querier.loginWithCalendly(data.owner, credentials)
      if (dbErr)
        return [{
          message: "could not update db creds" + dbErr.message,
          error: dbErr.error
        }, null] as const

      return [null, data] as const
    } catch (error) {

      return [{
        message: "Could not get auth code",
        error
      }, null] as const
    }

  }

  async getAllEventTypes() {
    const [err, token] = await this.refreshAccessToken();
    if (err)
      return [{
        message: "Could not refresh token",
        error: new Error("could not refresh token" + err.message) as any
      }, null] as const
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + this.accessToken
      },
    };

    try {
      const res = await fetch('https://api.calendly.com/event_types?organization=' + token.organization, options);
      const body: CalendlyResponse = await res.json();
      if (res.status !== 200) {
        return [{
          message: "Could not get EventTypes",
          error: body as any
        }, null] as const
      }
      console.log("event type: ", body);

      return [null, body] as const;
    } catch (error) {
      console.error("Event types error", error);

      return [{
        message: "Could not get EventTypes",
        error: error as any
      }, null] as const
    }

  }

  async createWebhookSubscription(organization: string, user: string) {
    const [err, _] = await this.refreshAccessToken();
    if (err)
      return [{
        message: "Could not refresh token",
        error: new Error("could not refresh token") as any
      }, null] as const
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
      if (res.status !== 201) {
        return [{
          message: "Could not create webhook",
          error: body as any
        }, null] as const
      }
      return [null, body] as const;
    } catch (error) {
      return [{
        message: "Could not create webhook_subscriptions",
        error: error as any
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
    const [err, _] = await this.refreshAccessToken();
    if (err)
      return [{
        message: "Could not refresh token",
        error: new Error("could not refresh token") as any
      }, null] as const
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

export interface CalendlyWebhookSubscription {
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

export interface CalendlyResponse {
  collection: EventType[];
  pagination: Pagination;
}

export interface EventType {
  uri: string;
  name: string;
  active: boolean;
  booking_method: string;
  slug: string;
  scheduling_url: string;
  duration: number;
  duration_options: number[];
  kind: string;
  pooling_type: string;
  type: string;
  color: string;
  created_at: string;
  updated_at: string;
  internal_note: string;
  description_plain: string;
  description_html: string;
  profile: Profile;
  secret: boolean;
  deleted_at: null | string;
  admin_managed: boolean;
  locations: Location[];
  position: number;
  custom_questions: CustomQuestion[];
}

export interface Profile {
  type: string;
  name: string;
  owner: string;
}

export interface Location {
  kind: string;
  phone_number: number;
  additional_info: string;
}

export interface CustomQuestion {
  name: string;
  type: 'string' | 'text' | 'single_select' | 'multi_select' | 'phone_number';
  position: number;
  enabled: boolean;
  required: boolean;
  answer_choices: string[];
  include_other: boolean;
}

export interface Pagination {
  count: number;
  next_page: string;
  previous_page: string;
  next_page_token: string;
  previous_page_token: string;
}

