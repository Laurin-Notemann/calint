import { CalendlyUser, CalIntError, querier } from "@/db/queries";
import { env } from "./env";
import dayjs from "dayjs";
import {
  createLogger,
  logAPICall,
  logElapsedTime,
  logError,
} from "@/utils/logger";

export class CalendlyClient {
  private logger = createLogger("CalendlyClient");
  private accessToken: string;
  refreshToken: string;
  private baseUrl = "https://api.calendly.com";
  private authUrl = "https://auth.calendly.com";
  private lastTokenRefresh: number = 0;
  private readonly TOKEN_REFRESH_INTERVAL = 10000;
  private organization: string = "";

  constructor({
    accessToken,
    refreshToken,
  }: {
    accessToken?: string;
    refreshToken?: string;
  }) {
    this.accessToken = accessToken ?? "";
    this.refreshToken = refreshToken ?? "";
  }

  private async makeRequest<T>(
    endpoint: string,
    options: {
      method: "GET" | "POST" | "PUT" | "DELETE";
      body?: any;
      params?: Record<string, string>;
      requiresAuth?: boolean;
      isAuthEndpoint?: boolean;
    },
  ): Promise<readonly [CalIntError, null] | readonly [null, T]> {
    const {
      method,
      body,
      params,
      requiresAuth = true,
      isAuthEndpoint = false,
    } = options;

    try {
      if (requiresAuth && !isAuthEndpoint) {
        const [refreshErr] = await this.refreshAccessToken();
        if (refreshErr) {
          return [
            {
              message: "Could not refresh token",
              error: new Error("could not refresh token" + refreshErr.message),
            },
            null,
          ] as const;
        }
      }

      const baseUrl = isAuthEndpoint ? this.authUrl : this.baseUrl;
      const url = new URL(endpoint, baseUrl);
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          url.searchParams.append(key, value);
        });
      }

      const headers: Record<string, string> = {
        "Content-Type": isAuthEndpoint
          ? "application/x-www-form-urlencoded"
          : "application/json",
      };

      if (requiresAuth) {
        if (isAuthEndpoint) {
          headers.Authorization =
            "Basic " +
            btoa(env.CALENDLY_CLIENT_ID + ":" + env.CALENDLY_CLIENT_SECRET);
        } else {
          headers.Authorization = `Bearer ${this.accessToken}`;
        }
      }

      const res = await fetch(url.toString(), {
        method,
        headers,
        ...(body && {
          body: isAuthEndpoint
            ? body instanceof URLSearchParams
              ? body
              : new URLSearchParams(body)
            : JSON.stringify(body),
        }),
      });

      const data = await res.json();

      logAPICall(this.logger, {
        service: "Calendly",
        method,
        endpoint,
        status: res.status,
        statusText: res.statusText,
        response: data,
      });

      if (!res.ok) {
        logError(this.logger, data, {
          operation: endpoint,
          status: res.status,
          statusText: res.statusText,
          response: data,
        });
        return [
          {
            message: `Request failed: ${endpoint}`,
            error: data,
          },
          null,
        ] as const;
      }

      return [null, data] as const;
    } catch (error) {
      logError(this.logger, error, {
        operation: endpoint,
      });
      return [
        {
          message: `Request failed: ${endpoint}`,
          error,
        },
        null,
      ] as const;
    }
  }

  async getAccessToken(code: string) {
    return await this.makeRequest<GetAccessTokenRes>("/oauth/token", {
      method: "POST",
      body: {
        grant_type: "authorization_code",
        code: code,
        redirect_uri: env.CALENDLY_REDIRECT_URL,
      },
      isAuthEndpoint: true,
      requiresAuth: true,
    });
  }

  async refreshAccessToken() {
    const now = Date.now();
    if (now - this.lastTokenRefresh < this.TOKEN_REFRESH_INTERVAL) {
      this.logger.info(`Token refresh skipped: too soon since last refresh`);
      return [null, null] as const;
    }

    this.logger.warn("TOKEN: " + this.refreshToken)

    const [err, data] = await this.makeRequest<GetAccessTokenRes>(
      "/oauth/token",
      {
        method: "POST",
        body: {
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
        },
        isAuthEndpoint: true,
      },
    );

    if (err) return [err, null] as const;

    const expirationDate = dayjs().add(data.expires_in, "second").toDate();
    const credentials = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: expirationDate,
    };

    const [dbErr] = await querier.loginWithCalendly(data.owner, credentials);
    if (dbErr) {
      logError(this.logger, dbErr, {
        operation: "refreshAccessToken",
        owner: data.owner,
      });
      return [dbErr, null] as const;
    }

    this.updateCalendlyTokens(data);
    this.organization = data.organization;
    this.lastTokenRefresh = now;

    return [null, data] as const;
  }

  async getOrganizationMemberships() {
    const [err] = await this.refreshAccessToken();
    if (err) return [err, null] as const;

    return await this.makeRequest<GetOrganizationMembershipResponse>(
      "/organization_memberships",
      {
        method: "GET",
        params: {
          organization: this.organization,
          count: "100",
        },
      },
    );
  }

  async getAllEventTypes() {
    const [err] = await this.refreshAccessToken();
    if (err) return [err, null] as const;

    const result = await this.makeRequest<GetEventTypesResponse>(
      "/event_types",
      {
        method: "GET",
        params: {
          organization: this.organization,
          count: "100",
        },
      },
    );
    return result;
  }

  async getEventTypesByUserId(userId: string) {
    const [err] = await this.refreshAccessToken();
    if (err) return [err, null] as const;

    return await this.makeRequest<GetEventTypesResponse>("/event_types", {
      method: "GET",
      params: {
        user: userId,
        count: "100",
      },
    });
  }

  async createWebhookSubscription(organization: string, user: string) {
    return await this.makeRequest<CalendlyWebhookSubscription>(
      "/webhook_subscriptions",
      {
        method: "POST",
        body: {
          url: env.BASE_URL + "/api/v1/calendly/webhook",
          events: [
            "invitee.created",
            "invitee.canceled",
            "invitee_no_show.created",
            "invitee_no_show.deleted",
          ],
          organization,
          user,
          scope: "organization",
        },
      },
    );
  }

  async getUserInfo() {
    return await this.makeRequest<CalendlyGetUserMeRes>("/users/me", {
      method: "GET",
    });
  }

  updateCalendlyTokens(tokens: GetAccessTokenRes) {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    this.organization = tokens.organization;
  }
}

export type GetAccessTokenRes = {
  token_type: "Bearer";
  access_token: string;
  refresh_token: string;
  scope?: string;
  created_at: number;
  expires_in: number;
  owner: string;
  organization: string;
};

export type CalendlyGetUserMeRes = {
  resource: CalendlyUser;
};

export interface CalendlyWebhookSubscription {
  resource: {
    uri: string;
    callback_url: string;
    created_at: string; // ISO 8601 datetime string
    updated_at: string; // ISO 8601 datetime string
    retry_started_at: string; // ISO 8601 datetime string
    state: "active" | string; // You might want to add other possible states
    events: string[];
    scope: "user" | string; // You might want to add other possible scopes
    organization: string;
    user: string;
    group: string;
    creator: string;
  };
}

export interface GetEventTypesResponse {
  collection: EventType[];
  pagination: Pagination;
}

interface Profile {
  type: "User" | "Team";
  name: string;
  owner: string;
}

interface CustomQuestion {
  name: string;
  type: "string" | "text" | "phone_number" | "single_select" | "multi_select";
  position: number;
  enabled: boolean;
  required: boolean;
  answer_choices: string[];
  include_other: boolean;
}

interface Location {
  kind: string;
  phone_number: number;
  additional_info: string;
}

export interface EventType {
  uri: string;
  name: string | null;
  active: boolean;
  slug: string | null;
  scheduling_url: string;
  duration: number;
  duration_options: number[] | null;
  kind: "solo" | "group";
  pooling_type: "round_robin" | "collective" | "multi_pool" | null;
  type: "StandardEventType" | "AdhocEventType";
  color: string;
  created_at: string;
  updated_at: string;
  internal_note: string | null;
  description_plain: string | null;
  description_html: string | null;
  profile: Profile | null;
  secret: boolean;
  booking_method: "instant" | "poll";
  custom_questions: CustomQuestion[];
  deleted_at: string | null;
  admin_managed: boolean;
  locations: Location[] | null;
  position: number;
}

export interface Pagination {
  count: number;
  next_page: string;
  previous_page: string;
  next_page_token: string;
  previous_page_token: string;
}

interface OrganizationMembershipUser {
  uri: string;
  name: string;
  slug: string;
  email: string;
  scheduling_url: string;
  timezone: string;
  avatar_url: string;
  locale: string;
  created_at: string;
  updated_at: string;
}

interface OrganizationMembership {
  uri: string;
  role: "admin" | string; // You might want to add other possible roles
  user: OrganizationMembershipUser;
  organization: string;
  updated_at: string;
  created_at: string;
}

interface GetOrganizationMembershipResponse {
  collection: OrganizationMembership[];
  pagination: Pagination;
}

export type WebhookPayload = {
  event:
  | "invitee.created"
  | "invitee.canceled"
  | "invitee_no_show.created"
  | "invitee_no_show.deleted"
  | "routing_form_submission.created";
  created_at: string;
  created_by: string;
  payload: InviteePayload;
};

export type InviteePayload = {
  uri: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  name: string;
  status: "active" | "canceled";
  questions_and_answers: InviteeQuestionAndAnswer[];
  timezone: string | null;
  event: string;
  created_at: string;
  updated_at: string;
  tracking: InviteeTracking;
  text_reminder_number: string | null;
  rescheduled: boolean;
  old_invitee: string | null;
  new_invitee: string | null;
  cancel_url: string;
  reschedule_url: string;
  routing_form_submission: string | null;
  payment: {
    external_id: string;
    provider: "stripe" | "paypal";
    amount: number;
    currency: "AUD" | "CAD" | "EUR" | "GBP" | "USD";
    terms: string | null;
    successful: boolean;
  } | null;
  no_show: {
    uri: string;
    created_at: string;
  } | null;
  reconfirmation: {
    created_at: string;
    confirmed_at: string | null;
  } | null;
  scheduling_method: "instant_book" | null;
  invitee_scheduled_by: string | null;
  scheduled_event: {
    uri: string;
    name: string | null;
    meeting_notes_plain: string | null;
    meeting_notes_html: string | null;
    status: "active" | "canceled";
    start_time: string;
    end_time: string;
    event_type: string;
    location: Location;
    invitees_counter: {
      total: number;
      active: number;
      limit: number;
    };
    created_at: string;
    updated_at: string;
    event_memberships: {
      user: string;
      user_email: string;
      user_name: string;
    }[];
    event_guests: Guest[];
    cancellation?: Cancellation;
  };
};

export type RoutingFormSubmission = {
  uri: string;
  routing_form: string;
  questions_and_answers: SubmissionQuestionAndAnswer[];
  tracking: SubmissionTracking;
  result: SubmissionResult;
  submitter: string | null;
  submitter_type: "Invitee" | null;
  created_at: string;
  updated_at: string;
};

export type InviteeQuestionAndAnswer = {
  success: boolean;
};

export type InviteeTracking = {
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_term: string | null;
  salesforce_uuid: string | null;
};

export type Guest = {
  email: string;
  created_at: string;
  updated_at: string;
};

export type Cancellation = {
  canceled_by: string;
  reason: string | null;
  canceler_type: "host" | "invitee";
  created_at: string;
};

export type SubmissionQuestionAndAnswer = {
  question_uuid: string;
  question: string;
  answer: string;
};

export type SubmissionTracking = {
  utm_campaign: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  utm_term: string | null;
  salesforce_uuid: string | null;
};

export type SubmissionResult = {
  type: string;
  value: string;
};
