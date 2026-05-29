import { sqliteTable, text, integer, blob, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  saltKdf: blob('salt_kdf', { mode: 'buffer' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const fcuAccounts = sqliteTable(
  'fcu_accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    fcuNid: text('fcu_nid').notNull(),
    nonce: blob('nonce', { mode: 'buffer' }).notNull(),
    ciphertext: blob('ciphertext', { mode: 'buffer' }).notNull(),
    authTag: blob('auth_tag', { mode: 'buffer' }).notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('fcu_accounts_user_idx').on(t.userId)],
);

export const clockinLogs = sqliteTable(
  'clockin_logs',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    fcuAccountId: text('fcu_account_id')
      .notNull()
      .references(() => fcuAccounts.id, { onDelete: 'cascade' }),
    mode: text('mode', {
      enum: ['class_qr', 'parttime_code', 'active_code', 'assistant_code'],
    }).notNull(),
    status: text('status', { enum: ['success', 'failed'] }).notNull(),
    errorSummary: text('error_summary'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('clockin_logs_user_idx').on(t.userId, t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type FcuAccount = typeof fcuAccounts.$inferSelect;
export type NewFcuAccount = typeof fcuAccounts.$inferInsert;
export type ClockinLog = typeof clockinLogs.$inferSelect;
export type NewClockinLog = typeof clockinLogs.$inferInsert;
