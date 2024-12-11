import { relations } from 'drizzle-orm';
import { integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid("id").primaryKey().defaultRandom().notNull(),
  name: text('name'), // uses pipedrive name
});

export const calendlyAcc = pgTable("calendly_acc", {
  uri: varchar("uri").primaryKey(),
  name: text('name'),
  organization: text("organization"),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at'),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
})

export const pipedriveAcc = pgTable("pipedrive_acc", {
  id: integer('id').primaryKey(),
  companyDomain: text('company_domain'),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  expiresAt: timestamp('expires_at'),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
})

export const userRelations = relations(users, ({ many }) => ({
  calendlyAccs: many(calendlyAcc),
  pipedriveAccs: many(pipedriveAcc),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
