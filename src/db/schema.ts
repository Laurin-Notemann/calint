import { relations } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text("name"),
  domain: text("domain").notNull().unique(),
})

export const calendlyAcc = pgTable("calendly_acc", {
  uri: varchar("uri").primaryKey(),
  name: text('name'),
  organization: text("organization"),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at'),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
})

//Based on Pipedrive id and username
export const users = pgTable("users", {
  id: integer('id').primaryKey(),
  name: text('name'), // uses pipedrive name
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at'),
  companyId: uuid("company_id").notNull().references(() => companies.id, {
    onDelete: "cascade"
  })
})

export const companyRelations = relations(companies, ({ many }) => ({
  users: many(users)
}))

export const userRelations = relations(users, ({ many }) => ({
  calendlyAccs: many(calendlyAcc),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export const companySettings = pgTable("company_settings", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
})

export const calendlyEvent = pgTable("calendly_event", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  slug: text("slug").notNull(),
})

export const pipedriveActivity = pgTable("pipedrive_activity", {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  slug: text("slug").notNull(),
  calendlyEventId: uuid("calendly_event_id").notNull().references(() => calendlyEvent.id, {
    onDelete: "cascade"
  })
})

export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
