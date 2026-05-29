import { sqliteTable, text, integer, blob } from 'drizzle-orm/sqlite-core';

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

export type FcuAccount = typeof fcuAccounts.$inferSelect;
export type NewFcuAccount = typeof fcuAccounts.$inferInsert;
