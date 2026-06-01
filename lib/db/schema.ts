import { index, integer, sqliteTable, text, blob } from 'drizzle-orm/sqlite-core';

export const fcuAccounts = sqliteTable('fcu_accounts', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  fcuNid: text('fcu_nid').notNull(),
  nonce: blob('nonce', { mode: 'buffer' }).notNull(),
  ciphertext: blob('ciphertext', { mode: 'buffer' }).notNull(),
  authTag: blob('auth_tag', { mode: 'buffer' }).notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const clockinLogs = sqliteTable(
  'clockin_logs',
  {
    id: text('id').primaryKey(),
    accountId: text('account_id'),
    displayName: text('display_name').notNull(),
    fcuNid: text('fcu_nid').notNull(),
    token: text('token').notNull(),
    status: text('status', { enum: ['sent', 'failed'] }).notNull(),
    errorMessage: text('error_message'),
    verified: integer('verified', { mode: 'boolean' }),
    verifyMessage: text('verify_message'),
    verifyRawHtml: text('verify_raw_html'),
    verifyAt: integer('verify_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('clockin_logs_created_idx').on(t.createdAt)],
);

export const accountGroups = sqliteTable('account_groups', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  // JSON array of fcu_accounts.id. Dead ids (deleted accounts) are filtered on read.
  memberIds: text('member_ids', { mode: 'json' }).$type<string[]>().notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});

export const activityLogs = sqliteTable(
  'activity_logs',
  {
    id: text('id').primaryKey(),
    type: text('type', {
      enum: [
        'clockin',
        'account_add',
        'account_delete',
        'group_create',
        'group_update',
        'group_delete',
      ],
    }).notNull(),
    summary: text('summary').notNull(),
    detail: text('detail'), // optional JSON string
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (t) => [index('activity_logs_created_idx').on(t.createdAt)],
);

export type FcuAccount = typeof fcuAccounts.$inferSelect;
export type AccountGroup = typeof accountGroups.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewFcuAccount = typeof fcuAccounts.$inferInsert;
export type ClockinLog = typeof clockinLogs.$inferSelect;
export type NewClockinLog = typeof clockinLogs.$inferInsert;
