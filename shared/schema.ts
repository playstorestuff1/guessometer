import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table
export const users = pgTable("users", {
  id: varchar("id").primaryKey(), // Google OAuth provides this
  email: varchar("email").unique(),
  displayName: varchar("display_name"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  provider: varchar("provider").default("google"), // 'google' for our OAuth implementation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Predictions table - mirrors Airtable structure
export const predictions = pgTable("predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  airtableId: varchar("airtable_id").unique(),
  userId: varchar("user_id").references(() => users.id),
  predictionText: text("prediction_text").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  confidenceLevel: integer("confidence_level").notNull(),
  targetDate: timestamp("target_date").notNull(),
  predictionDate: timestamp("prediction_date").defaultNow(),
  outcome: varchar("outcome").default('pending'), // 'correct', 'incorrect', 'pending'
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Categories table - mirrors Airtable structure
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  airtableId: varchar("airtable_id").unique(),
  name: varchar("name").notNull(),
  color: varchar("color"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User statistics (calculated from predictions)
export const userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).unique(),
  totalPredictions: integer("total_predictions").default(0),
  correctPredictions: integer("correct_predictions").default(0),
  incorrectPredictions: integer("incorrect_predictions").default(0),
  pendingPredictions: integer("pending_predictions").default(0),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }).default("0"),
  brierScore: decimal("brier_score", { precision: 5, scale: 4 }).default("0"),
  lastCalculated: timestamp("last_calculated").defaultNow(),
});

// Likes table for prediction thumbs up
export const likes = pgTable("likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  predictionId: varchar("prediction_id").references(() => predictions.id).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  // Ensure one like per user per prediction
  index("unique_user_prediction_like").on(table.userId, table.predictionId),
]);

// Comments table for prediction comments
export const comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  predictionId: varchar("prediction_id").references(() => predictions.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  displayName: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  provider: true,
});

// Google OAuth user data schema
export const googleUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional(),
});

export const selectUserSchema = createInsertSchema(users);
export const selectPredictionSchema = createInsertSchema(predictions);
export const selectCategorySchema = createInsertSchema(categories);

export const insertPredictionSchema = createInsertSchema(predictions).pick({
  predictionText: true,
  description: true,
  category: true,
  confidenceLevel: true,
  targetDate: true,
  isPublic: true,
  outcome: true,
}).extend({
  targetDate: z.string().transform((val) => new Date(val)),
  outcome: z.string().optional(),
});

export const insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  color: true,
});

export const insertLikeSchema = createInsertSchema(likes).pick({
  predictionId: true,
});

export const insertCommentSchema = createInsertSchema(comments).pick({
  predictionId: true,
  content: true,
});

// Community content storage
export const communityContent = pgTable("community_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertPrediction = z.infer<typeof insertPredictionSchema>;
export type Prediction = typeof predictions.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categories.$inferSelect;
export type UserStats = typeof userStats.$inferSelect;
export type GoogleUser = z.infer<typeof googleUserSchema>;
export type InsertLike = z.infer<typeof insertLikeSchema>;
export type Like = typeof likes.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;
export type CommunityContent = typeof communityContent.$inferSelect;
