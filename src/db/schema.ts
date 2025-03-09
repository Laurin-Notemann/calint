import { relations, sql } from "drizzle-orm";
import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const typeMappings = pgEnum("type_mappings", [
  "created",
  "rescheduled",
  "cancelled",
  "noshow",
]);

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name"),
  domain: text("domain").notNull().unique(),
  pipedriveId: integer().notNull(),
  calendlyOrgUri: text("calendly_org_uri").default(sql`NULL`),
});

export const calendlyAccs = pgTable("calendly_accs", {
  uri: varchar("uri").primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  organization: text("organization"),
  role: text("role").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token").notNull(),
  expiresAt: timestamp("expires_at"),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
});

//Based on Pipedrive id and username
export const users = pgTable("users", {
  id: integer("id").primaryKey(),
  name: text("name").notNull(), // uses pipedrive name
  email: text("email").notNull(),
  refreshToken: text("refresh_token").notNull(),
  accessToken: text("access_token").notNull(),
  expiresIn: integer("expires_in").notNull(),
  scope: text("scope").notNull(),
  tokenType: text("token_type").notNull(),
  apiDomain: text("api_domain").notNull(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, {
      onDelete: "cascade",
    }),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const companySettings = pgTable("company_settings", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
});

export const calendlyEvents = pgTable("calendly_events", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  uri: text("uri").notNull(),
  joinUrl: text("join_url").notNull(),
  rescheduleUrl: text("reschedule_url").notNull(),
  cancelUrl: text("cancel_url").notNull(),
  status: typeMappings().notNull(),
});

export const pipedriveDeals = pgTable("pipedrive_deals", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name").notNull(),
  pipedriveId: integer().notNull(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, {
      onDelete: "cascade",
    }),
  pipedrivePeopleId: uuid("pipedrive_people_id")
    .notNull()
    .references(() => pipedrivePeople.id, {
      onDelete: "cascade",
    }),
});

export const pipedrivePeople = pgTable("pipedrive_people", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  email: text("email").notNull(),
  name: text("name").notNull(),
  pipedriveId: integer().notNull(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, {
      onDelete: "cascade",
    }),
});

export const pipedriveActivities = pgTable("pipedrive_activities", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name").notNull(),
  pipedriveId: integer("pipedrive_id").notNull(),
  calendlyEventId: uuid("calendly_event_id")
    .notNull()
    .references(() => calendlyEvents.id, {
      onDelete: "cascade",
    }),
  activityTypeId: uuid("activity_type_id")
    .notNull()
    .references(() => pipedriveActivityTypes.id, {
      onDelete: "cascade",
    }),
  pipedriveDealId: uuid("pipedrive_deal_id")
    .notNull()
    .references(() => pipedriveDeals.id, {
      onDelete: "cascade",
    }),
});

export const calEventTypes = pgTable("cal_event_types", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name").notNull(),
  uri: text("uri").notNull(),
  slug: text("slug").notNull(),
  scheduleUri: text("schedule_uri").notNull(),
  calUserUri: text("cal_user_uri").notNull(), // this is not a foreign key to calendlyAccs, because calendlyAccs are only accs that have already created an acc
  calUsername: text("cal_username").notNull(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, {
      onDelete: "cascade",
    }),
});

export const pipedriveActivityTypes = pgTable("pipedrive_activity_types", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name").notNull(),
  keyString: text("key_string").notNull(),
  pipedriveId: integer("pipedrive_id").notNull(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, {
      onDelete: "cascade",
    }),
});

export const eventActivityTypesMapping = pgTable(
  "event_activity_types_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    type: typeMappings().notNull(),
    calendlyEventTypeId: uuid("calendly_event_type_id")
      .notNull()
      .references(() => calEventTypes.id, {
        onDelete: "cascade",
      }),
    pipedriveActivityTypeId: uuid("pipedrive_activity_type_id")
      .notNull()
      .references(() => pipedriveActivityTypes.id, {
        onDelete: "cascade",
      }),
    calendlyAccUri: text("calendly_acc_uri")
      .notNull()
      .references(() => calendlyAccs.uri, {
        onDelete: "cascade",
      }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, {
        onDelete: "cascade",
      }),
  },
);

export const companyRelations = relations(companies, ({ many }) => ({
  users: many(users),
  calEventTypes: many(calEventTypes),
  pipedriveActivityTypes: many(pipedriveActivityTypes),
  eventActivityTypesMapping: many(eventActivityTypesMapping),
  pipedriveDeals: many(pipedriveDeals),
}));

export const userRelations = relations(users, ({ many }) => ({
  calendlyAccs: many(calendlyAccs),
}));

export const calendlyEventsRelations = relations(calendlyEvents, ({ one }) => ({
  pipedriveActivity: one(pipedriveActivities),
}));

export const eventTypeRelations = relations(calEventTypes, ({ many }) => ({
  typeMappings: many(eventActivityTypesMapping),
}));

export const pipedrivePeopleRelations = relations(
  pipedrivePeople,
  ({ many }) => ({
    pipedriveDeals: many(pipedriveDeals),
  }),
);

export const pipedriveDealRelations = relations(pipedriveDeals, ({ many }) => ({
  pipedriveActivities: many(pipedriveActivities),
}));

export const activityTypeRelations = relations(
  pipedriveActivityTypes,
  ({ many }) => ({
    typeMappings: many(eventActivityTypesMapping),
    pipedriveActivities: many(pipedriveActivities),
  }),
);

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;

export type CalendlyAcc = typeof calendlyAccs.$inferSelect;
export type NewCalendlyAcc = typeof calendlyAccs.$inferInsert;

export type UserCalendly = {
  calendly_accs: CalendlyAcc;
  users: User;
};

export type CalEventType = typeof calEventTypes.$inferSelect;
export type NewCalEventType = typeof calEventTypes.$inferInsert;

export type PipedriveActivityType = typeof pipedriveActivityTypes.$inferSelect;
export type NewPipedriveActivityType =
  typeof pipedriveActivityTypes.$inferInsert;

export type TypeMappingType = typeof eventActivityTypesMapping.$inferSelect;
export type NewTypeMappingType = typeof eventActivityTypesMapping.$inferInsert;

export type TypeEnum = typeof typeMappings.enumValues;

export type PipedriveActivity = typeof pipedriveActivities.$inferSelect;
export type NewPipedriveActivity = typeof pipedriveActivities.$inferInsert;

export type CalendlyEvent = typeof calendlyEvents.$inferSelect;
export type NewCalendlyEvent = typeof calendlyEvents.$inferInsert;

export type PipedriveDeal = typeof pipedriveDeals.$inferSelect;
export type NewPipedriveDeal = typeof pipedriveDeals.$inferInsert;

export type PipedrivePerson = typeof pipedrivePeople.$inferSelect;
export type NewPipedrivePerson = typeof pipedrivePeople.$inferInsert;
