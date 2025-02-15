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

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name"),
  domain: text("domain").notNull().unique(),
  calendlyOrgUri: text("calendly_org_uri").default(sql`NULL`),
});

export const calendlyAccs = pgTable("calendly_accs", {
  uri: varchar("uri").primaryKey(),
  name: text("name"),
  organization: text("organization"),
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

export const companyRelations = relations(companies, ({ many }) => ({
  users: many(users),
}));

export const userRelations = relations(users, ({ many }) => ({
  calendlyAccs: many(calendlyAccs),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const companySettings = pgTable("company_settings", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
});

export const calendlyEvents = pgTable("calendly_events", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  slug: text("slug").notNull(),
});

export const pipedriveActivities = pgTable("pipedrive_activities", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  slug: text("slug").notNull(),
  calendlyEventId: uuid("calendly_event_id")
    .notNull()
    .references(() => calendlyEvents.id, {
      onDelete: "cascade",
    }),
});

export const calEventTypes = pgTable("cal_event_types", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name").notNull(),
  uri: text("uri").notNull().unique(),
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
  pipedriveId: integer("pipedrive_id").notNull(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, {
      onDelete: "cascade",
    }),
});

export const typeMappings = pgEnum("type_mappings", [
  "created",
  "rescheduled",
  "cancelled",
  "noshow",
]);

export const eventActivityTypesMapping = pgTable(
  "event_activity_types_mapping",
  {
    id: uuid("id").primaryKey().defaultRandom().notNull(),
    type: typeMappings().notNull(),
    calendlyEventTypeId: uuid("calendly_event_type_id")
      .notNull()
      .references(() => calEventTypes.id, {
        onDelete: "cascade",
      }),
    pipedriveActivityTypeId: uuid("pipedrive_activity_type_id").references(
      () => pipedriveActivityTypes.id,
      {
        onDelete: "cascade",
      },
    ),
  },
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
