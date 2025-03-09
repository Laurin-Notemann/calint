import { CalendlyUser, querier } from "@/db/queries";
import { env } from "./env";
import dayjs from "dayjs";
import {
  createLogger,
  withLogging,
  CalIntError,
  PromiseReturn,
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
      skipTokenRefresh?: boolean;
      skipLogging?: boolean;
    },
  ): PromiseReturn<T> {
    const {
      method,
      body,
      params,
      requiresAuth = true,
      isAuthEndpoint = false,
      skipTokenRefresh = false,
      skipLogging = false,
    } = options;

    const makeRequestLogic = async () => {
      if (requiresAuth && !isAuthEndpoint && !skipTokenRefresh) {
        const [refreshErr] = await this.refreshAccessToken();
        if (refreshErr) throw refreshErr;
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

      if (!res.ok) {
        throw new CalIntError(
          `Request failed: ${endpoint}`,
          "UNEXPECTED_ERROR",
          false,
          { status: res.status, statusText: res.statusText, response: data },
        );
      }

      return data;
    };

    if (skipLogging) {
      return makeRequestLogic().then(
        (data) => Promise.resolve([null, data] as const) as PromiseReturn<T>,
        (error) =>
          Promise.resolve([
            error instanceof CalIntError
              ? error
              : new CalIntError(
                error instanceof Error ? error.message : String(error),
                "UNEXPECTED_ERROR",
              ),
            null,
          ] as const) as PromiseReturn<T>,
      );
    } else {
      return withLogging(
        this.logger,
        "info",
        makeRequestLogic,
        `makeRequest_${endpoint}`,
        "api",
        {
          service: "Calendly",
          method,
          endpoint,
        },
        options,
      );
    }
  }

  async getAccessToken(code: string): PromiseReturn<GetAccessTokenRes> {
    return this.makeRequest<GetAccessTokenRes>("/oauth/token", {
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

  async refreshAccessToken(): PromiseReturn<GetAccessTokenRes | null> {
    return withLogging(
      this.logger,
      "info",
      async () => {
        const now = Date.now();
        if (now - this.lastTokenRefresh < this.TOKEN_REFRESH_INTERVAL) {
          return null;
        }

        const [err, data] = await this.makeRequest<GetAccessTokenRes>(
          "/oauth/token",
          {
            method: "POST",
            body: {
              grant_type: "refresh_token",
              refresh_token: this.refreshToken,
            },
            isAuthEndpoint: true,
            skipLogging: true,
          },
        );
        if (err) throw err;

        const expirationDate = dayjs().add(data.expires_in, "second").toDate();
        const credentials = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token,
          expiresAt: expirationDate,
        };

        const [dbErr] = await querier.loginWithCalendly(
          data.owner,
          credentials,
        );
        if (dbErr) throw dbErr;

        this.updateCalendlyTokens(data);
        this.organization = data.organization;
        this.lastTokenRefresh = now;

        return data;
      },
      "refreshAccessToken",
      "api",
      {
        service: "Calendly",
        method: "POST",
        endpoint: "/oauth/token",
      },
      this.refreshToken,
    );
  }

  async getOrganizationMemberships(): PromiseReturn<GetOrganizationMembershipResponse> {
    const [err] = await this.refreshAccessToken();
    if (err) return [err, null] as const;

    return this.makeRequest<GetOrganizationMembershipResponse>(
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

  async getAllEventTypes(): PromiseReturn<GetEventTypesResponse> {
    const [err] = await this.refreshAccessToken();
    if (err) return [err, null] as const;
    return this.makeRequest<GetEventTypesResponse>("/event_types", {
      method: "GET",
      params: {
        organization: this.organization,
        count: "100",
      },
    });
  }

  async getEventTypesByUserId(
    userId: string,
  ): PromiseReturn<GetEventTypesResponse> {
    return this.makeRequest<GetEventTypesResponse>("/event_types", {
      method: "GET",
      params: {
        user: userId,
        count: "100",
      },
    });
  }

  async createWebhookSubscription(
    organization: string,
    user: string,
  ): PromiseReturn<CalendlyWebhookSubscription> {
    return this.makeRequest<CalendlyWebhookSubscription>(
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

  async getUserInfo(): PromiseReturn<CalendlyGetUserMeRes> {
    return this.makeRequest<CalendlyGetUserMeRes>("/users/me", {
      method: "GET",
      requiresAuth: true,
      skipTokenRefresh: true,
    });
  }

  async getUsersOrgMembership(
    id: string,
  ): PromiseReturn<GetOrganizationMembershipResponse> {
    return this.makeRequest<GetOrganizationMembershipResponse>(
      "/organization_memberships?user=" + id,
      {
        method: "GET",
        requiresAuth: true,
        skipTokenRefresh: true,
      },
    );
  }

  updateCalendlyTokens(tokens: GetAccessTokenRes) {
    this.accessToken = tokens.access_token;
    this.refreshToken = tokens.refresh_token;
    this.organization = tokens.organization;
  }
}

export type CalendlyOrganizationMembershipResource = {
  uri: string;
  role: "user" | "admin" | "owner";
  user: CalendlyUser;
  organization: string;
  updated_at: string;
  created_at: string;
};

export type CalendlyOrganizationMembership = {
  resource: CalendlyOrganizationMembershipResource;
};

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

type Location =
  | InPersonMeeting
  | OutboundCall
  | InboundCall
  | GoogleConference
  | ZoomConference
  | GoToMeetingConference
  | MicrosoftTeamsConference
  | CustomLocation
  | InviteeSpecifiedLocation
  | WebExConference;

type InPersonMeeting = {
  type: "physical";
  location: string;
  additional_info?: string;
};

type OutboundCall = {
  type: "outbound_call";
  location: string | null;
};

type InboundCall = {
  type: "inbound_call";
  location: string;
  additional_info?: string;
};

type GoogleConference = {
  type: "google_conference";
  status: "processing" | "initiated" | "pushed" | "failed" | null;
  join_url: string | null;
};

type ZoomConference = {
  type: "zoom";
  status: "processing" | "initiated" | "pushed" | "failed" | null;
  join_url: string | null;
  data: {
    id: string;
    settings: {
      global_dial_in_numbers: Array<{
        number: string;
        country: string;
        type: string;
        city: string;
        country_name: string;
      }>;
    };
    extra: {
      intl_numbers_url: string;
    };
    password: string;
  } | null;
};

type GoToMeetingConference = {
  type: "gotomeeting";
  status: "initiated" | "processing" | "pushed" | "failed" | null;
  join_url: string | null;
  data: {
    uniqueMeetingId: number;
    conferenceCallInfo: string;
  } | null;
};

type MicrosoftTeamsConference = {
  type: "microsoft_teams_conference";
  status: "processing" | "initiated" | "pushed" | "failed" | null;
  join_url: string | null;
  data: {
    id: string;
    audioConferencing: {
      conferenceId: string;
      dialinUrl: string;
      tollNumber: string;
    } | null;
  } | null;
};

type CustomLocation = {
  type: "custom";
  location: string | null;
};

type InviteeSpecifiedLocation = {
  type: "ask_invitee";
  location: string;
};

type WebExConference = {
  type: "webex_conference";
  status: "processing" | "initiated" | "pushed" | "failed" | null;
  join_url: string | null;
  data: {
    id: string;
    telephony: {
      callInNumbers: Array<{
        label: string;
        callInNumber: string;
        tollType: string;
      }>;
    };
    password: string;
  } | null;
};

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
