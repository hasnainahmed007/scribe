import { pgTable, serial, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table with SaaS plan & credit balances
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID or Sanctum unique identifier
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: text('role').notNull().default('user'), // 'superadmin' | 'user'
  status: text('status').notNull().default('active'), // 'active' | 'suspended'
  planId: text('plan_id').notNull().default('plan-free'),
  planName: text('plan_name').notNull().default('Free Starter'),
  creditsRemaining: integer('credits_remaining').notNull().default(30), // Minutes of free audio credits
  creditsTotal: integer('credits_total').notNull().default(30),
  creditsUsed: integer('credits_used').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// SaaS Subscription Plans managed by SuperAdmin
export const plans = pgTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  priceBdt: integer('price_bdt').notNull().default(0),
  priceUsd: integer('price_usd').notNull().default(0),
  interval: text('interval').notNull().default('monthly'), // 'monthly' | 'yearly'
  creditsGranted: integer('credits_granted').notNull().default(30), // Audio minutes quota
  features: text('features').notNull(), // JSON string of features array
  modules: text('modules').notNull().default('["subtitles_editor","voice_recorder"]'), // JSON string of enabled modules
  isPopular: boolean('is_popular').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// User Subscriptions table
export const subscriptions = pgTable('subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  userUid: text('user_uid').notNull(),
  planId: text('plan_id').notNull(),
  planName: text('plan_name').notNull(),
  billingCycle: text('billing_cycle').notNull().default('monthly'),
  amount: integer('amount').notNull().default(0),
  currency: text('currency').notNull().default('USD'),
  status: text('status').notNull().default('active'), // 'active' | 'canceled' | 'past_due'
  currentPeriodStart: timestamp('current_period_start').defaultNow(),
  currentPeriodEnd: timestamp('current_period_end').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Payment Transactions table
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  transactionId: text('transaction_id').notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  userEmail: text('user_email').notNull(),
  planName: text('plan_name').notNull(),
  amount: integer('amount').notNull(),
  currency: text('currency').notNull().default('USD'),
  method: text('method').notNull().default('card'), // 'card' | 'bkash' | 'nagad' | 'stripe'
  status: text('status').notNull().default('paid'), // 'paid' | 'refunded' | 'pending'
  createdAt: timestamp('created_at').defaultNow(),
});

// Transcription Audio Usage Logs
export const usageLogs = pgTable('usage_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  audioName: text('audio_name').notNull(),
  durationSeconds: integer('duration_seconds').notNull(),
  creditsDeducted: integer('credits_deducted').notNull(),
  transcribedAt: timestamp('transcribed_at').defaultNow(),
});

// Saved Transcript History table for creator workspace
export const transcripts = pgTable('transcripts', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  userUid: text('user_uid').notNull(),
  title: text('title').notNull(),
  audioName: text('audio_name').notNull(),
  durationSeconds: integer('duration_seconds').notNull().default(0),
  segmentsJson: text('segments_json').notNull(), // JSON array of TranscriptSegment
  fullTranscript: text('full_transcript').notNull(),
  summary: text('summary').default(''),
  wordCount: integer('word_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  subscriptions: many(subscriptions),
  payments: many(payments),
  usageLogs: many(usageLogs),
  transcripts: many(transcripts),
}));

export const transcriptsRelations = relations(transcripts, ({ one }) => ({
  user: one(users, {
    fields: [transcripts.userId],
    references: [users.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}));
