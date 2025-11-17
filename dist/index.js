var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  categories: () => categories,
  comments: () => comments,
  communityContent: () => communityContent,
  googleUserSchema: () => googleUserSchema,
  insertCategorySchema: () => insertCategorySchema,
  insertCommentSchema: () => insertCommentSchema,
  insertLikeSchema: () => insertLikeSchema,
  insertPredictionSchema: () => insertPredictionSchema,
  insertUserSchema: () => insertUserSchema,
  likes: () => likes,
  predictions: () => predictions,
  selectCategorySchema: () => selectCategorySchema,
  selectPredictionSchema: () => selectPredictionSchema,
  selectUserSchema: () => selectUserSchema,
  sessions: () => sessions,
  userStats: () => userStats,
  users: () => users
});
import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  boolean,
  decimal
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey(),
  // Google OAuth provides this
  email: varchar("email").unique(),
  displayName: varchar("display_name"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  provider: varchar("provider").default("google"),
  // 'google' for our OAuth implementation
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var predictions = pgTable("predictions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  airtableId: varchar("airtable_id").unique(),
  userId: varchar("user_id").references(() => users.id),
  predictionText: text("prediction_text").notNull(),
  description: text("description"),
  category: varchar("category").notNull(),
  confidenceLevel: integer("confidence_level").notNull(),
  targetDate: timestamp("target_date").notNull(),
  predictionDate: timestamp("prediction_date").defaultNow(),
  outcome: varchar("outcome").default("pending"),
  // 'correct', 'incorrect', 'pending'
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  airtableId: varchar("airtable_id").unique(),
  name: varchar("name").notNull(),
  color: varchar("color"),
  createdAt: timestamp("created_at").defaultNow()
});
var userStats = pgTable("user_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).unique(),
  totalPredictions: integer("total_predictions").default(0),
  correctPredictions: integer("correct_predictions").default(0),
  incorrectPredictions: integer("incorrect_predictions").default(0),
  pendingPredictions: integer("pending_predictions").default(0),
  accuracy: decimal("accuracy", { precision: 5, scale: 2 }).default("0"),
  brierScore: decimal("brier_score", { precision: 5, scale: 4 }).default("0"),
  lastCalculated: timestamp("last_calculated").defaultNow()
});
var likes = pgTable("likes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  predictionId: varchar("prediction_id").references(() => predictions.id).notNull(),
  createdAt: timestamp("created_at").defaultNow()
}, (table) => [
  // Ensure one like per user per prediction
  index("unique_user_prediction_like").on(table.userId, table.predictionId)
]);
var comments = pgTable("comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  predictionId: varchar("prediction_id").references(() => predictions.id).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var insertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  displayName: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  provider: true
});
var googleUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  profileImageUrl: z.string().optional()
});
var selectUserSchema = createInsertSchema(users);
var selectPredictionSchema = createInsertSchema(predictions);
var selectCategorySchema = createInsertSchema(categories);
var insertPredictionSchema = createInsertSchema(predictions).pick({
  predictionText: true,
  description: true,
  category: true,
  confidenceLevel: true,
  targetDate: true,
  isPublic: true,
  outcome: true
}).extend({
  targetDate: z.string().transform((val) => new Date(val)),
  outcome: z.string().optional()
});
var insertCategorySchema = createInsertSchema(categories).pick({
  name: true,
  color: true
});
var insertLikeSchema = createInsertSchema(likes).pick({
  predictionId: true
});
var insertCommentSchema = createInsertSchema(comments).pick({
  predictionId: true,
  content: true
});
var communityContent = pgTable("community_content", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { eq, desc, and, sql as sql2, count } from "drizzle-orm";
var DatabaseStorage = class {
  // User operations
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    try {
      console.log("Checking if user exists with email:", email);
      const [user] = await db.select().from(users).where(eq(users.email, email));
      console.log("User lookup result:", user ? "FOUND" : "NOT_FOUND");
      return user;
    } catch (error) {
      console.error("Error in getUserByEmail:", {
        message: error.message,
        code: error.code
      });
      throw error;
    }
  }
  // Google OAuth user upsert method
  async upsertUser(userData) {
    try {
      const existingUser = await this.getUser(userData.id);
      if (existingUser) {
        const [user2] = await db.update(users).set({
          email: userData.email,
          displayName: existingUser.displayName || userData.displayName,
          firstName: userData.firstName,
          lastName: userData.lastName,
          profileImageUrl: userData.profileImageUrl,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(users.id, userData.id)).returning();
        return user2;
      }
      if (userData.email) {
        const userByEmail = await this.getUserByEmail(userData.email);
        if (userByEmail) {
          const [user2] = await db.update(users).set({
            displayName: userByEmail.displayName || userData.displayName,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: /* @__PURE__ */ new Date()
          }).where(eq(users.email, userData.email)).returning();
          return user2;
        }
      }
      const [user] = await db.insert(users).values(userData).returning();
      return user;
    } catch (error) {
      console.error("Error in upsertUser:", error);
      throw error;
    }
  }
  async updateUserDisplayName(userId, displayName) {
    const [user] = await db.update(users).set({
      displayName,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, userId)).returning();
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }
  // Prediction operations
  async getPredictions(limit = 50, offset = 0) {
    const results = await db.select({
      id: predictions.id,
      airtableId: predictions.airtableId,
      userId: predictions.userId,
      predictionText: predictions.predictionText,
      description: predictions.description,
      category: predictions.category,
      confidenceLevel: predictions.confidenceLevel,
      targetDate: predictions.targetDate,
      predictionDate: predictions.predictionDate,
      outcome: predictions.outcome,
      isPublic: predictions.isPublic,
      createdAt: predictions.createdAt,
      updatedAt: predictions.updatedAt,
      userDisplayName: users.displayName
    }).from(predictions).leftJoin(users, eq(predictions.userId, users.id)).where(eq(predictions.isPublic, true)).orderBy(desc(predictions.createdAt)).limit(limit).offset(offset);
    return results;
  }
  async getUserPredictions(userId) {
    const results = await db.select({
      id: predictions.id,
      airtableId: predictions.airtableId,
      userId: predictions.userId,
      predictionText: predictions.predictionText,
      description: predictions.description,
      category: predictions.category,
      confidenceLevel: predictions.confidenceLevel,
      targetDate: predictions.targetDate,
      predictionDate: predictions.predictionDate,
      outcome: predictions.outcome,
      isPublic: predictions.isPublic,
      createdAt: predictions.createdAt,
      updatedAt: predictions.updatedAt,
      userDisplayName: users.displayName
    }).from(predictions).leftJoin(users, eq(predictions.userId, users.id)).where(eq(predictions.userId, userId)).orderBy(desc(predictions.createdAt));
    return results;
  }
  async createPrediction(predictionData) {
    const [prediction] = await db.insert(predictions).values(predictionData).returning();
    await this.calculateUserStats(predictionData.userId);
    return prediction;
  }
  async updatePrediction(id, updates) {
    const [prediction] = await db.update(predictions).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(predictions.id, id)).returning();
    if (prediction && prediction.userId) {
      await this.calculateUserStats(prediction.userId);
    }
    return prediction;
  }
  async deletePrediction(id, userId) {
    try {
      const [prediction] = await db.select().from(predictions).where(and(
        eq(predictions.id, id),
        eq(predictions.userId, userId)
      ));
      if (!prediction) {
        return false;
      }
      const result = await db.transaction(async (tx) => {
        await tx.delete(likes).where(eq(likes.predictionId, id));
        await tx.delete(comments).where(eq(comments.predictionId, id));
        const deletedPredictions = await tx.delete(predictions).where(and(
          eq(predictions.id, id),
          eq(predictions.userId, userId)
        )).returning();
        return deletedPredictions;
      });
      if (result && result.length > 0) {
        await this.calculateUserStats(userId);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error in deletePrediction:", error);
      return false;
    }
  }
  // Category operations
  async getCategories() {
    return await db.select().from(categories).orderBy(categories.name);
  }
  async createCategory(categoryData) {
    const [category] = await db.insert(categories).values(categoryData).returning();
    return category;
  }
  // Statistics operations
  async getUserStats(userId) {
    const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));
    return stats;
  }
  async calculateUserStats(userId) {
    const userPredictions = await db.select().from(predictions).where(and(
      eq(predictions.userId, userId),
      eq(predictions.isPublic, true)
    ));
    const total = userPredictions.length;
    const correct = userPredictions.filter((p) => p.outcome === "correct").length;
    const incorrect = userPredictions.filter((p) => p.outcome === "incorrect").length;
    const pending = userPredictions.filter((p) => !p.outcome || p.outcome === "pending").length;
    const resolvedTotal = correct + incorrect;
    const accuracy = resolvedTotal > 0 ? correct / resolvedTotal * 100 : 0;
    const resolvedPredictions = userPredictions.filter((p) => p.outcome === "correct" || p.outcome === "incorrect");
    let brierScore = 0;
    if (resolvedPredictions.length > 0) {
      const brierSum = resolvedPredictions.reduce((sum, prediction) => {
        const forecastProbability = prediction.confidenceLevel / 100;
        const actualOutcome = prediction.outcome === "correct" ? 1 : 0;
        const brierForPrediction = Math.pow(forecastProbability - actualOutcome, 2);
        return sum + brierForPrediction;
      }, 0);
      brierScore = brierSum / resolvedPredictions.length;
    }
    const [stats] = await db.insert(userStats).values({
      userId,
      totalPredictions: total,
      correctPredictions: correct,
      incorrectPredictions: incorrect,
      pendingPredictions: pending,
      accuracy: accuracy.toFixed(2),
      brierScore: brierScore.toFixed(4),
      lastCalculated: /* @__PURE__ */ new Date()
    }).onConflictDoUpdate({
      target: userStats.userId,
      set: {
        totalPredictions: total,
        correctPredictions: correct,
        incorrectPredictions: incorrect,
        pendingPredictions: pending,
        accuracy: accuracy.toFixed(2),
        brierScore: brierScore.toFixed(4),
        lastCalculated: /* @__PURE__ */ new Date()
      }
    }).returning();
    return stats;
  }
  async getUserAccuracyTrend(userId, period, includeBrierScore = false) {
    let dateFilter = sql2`true`;
    switch (period) {
      case "1m":
        dateFilter = sql2`${predictions.createdAt} >= NOW() - INTERVAL '1 month'`;
        break;
      case "6m":
        dateFilter = sql2`${predictions.createdAt} >= NOW() - INTERVAL '6 months'`;
        break;
      case "12m":
        dateFilter = sql2`${predictions.createdAt} >= NOW() - INTERVAL '12 months'`;
        break;
    }
    const results = await db.select({
      date: sql2`${predictions.createdAt}::date::text`,
      outcome: predictions.outcome,
      confidenceLevel: predictions.confidenceLevel,
      createdAt: predictions.createdAt
    }).from(predictions).where(and(
      eq(predictions.userId, userId),
      sql2`${predictions.outcome} IN ('correct', 'incorrect')`,
      // Only resolved predictions
      dateFilter
    )).orderBy(predictions.createdAt);
    const dateGroups = /* @__PURE__ */ new Map();
    let totalCorrect = 0;
    let totalPredictions = 0;
    let totalConfidence = 0;
    let totalBrierSum = 0;
    results.forEach((prediction, index2) => {
      totalPredictions++;
      if (prediction.outcome === "correct") {
        totalCorrect++;
      }
      totalConfidence += prediction.confidenceLevel;
      const accuracy = totalCorrect / totalPredictions * 100;
      const avgConfidence = totalConfidence / totalPredictions;
      let brierScore;
      if (includeBrierScore) {
        const forecastProbability = prediction.confidenceLevel / 100;
        const actualOutcome = prediction.outcome === "correct" ? 1 : 0;
        const brierForPrediction = Math.pow(forecastProbability - actualOutcome, 2);
        totalBrierSum += brierForPrediction;
        brierScore = totalBrierSum / totalPredictions;
      }
      dateGroups.set(prediction.date, {
        predictions: [prediction],
        accuracy,
        confidence: avgConfidence,
        brierScore
      });
    });
    return Array.from(dateGroups.entries()).sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime()).map(([date, data]) => ({
      date,
      accuracy: data.accuracy,
      confidence: data.confidence,
      ...includeBrierScore && data.brierScore !== void 0 ? { brierScore: data.brierScore } : {}
    }));
  }
  async getLeaderboard() {
    const results = await db.select({
      userId: userStats.userId,
      totalPredictions: userStats.totalPredictions,
      correctPredictions: userStats.correctPredictions,
      incorrectPredictions: userStats.incorrectPredictions,
      pendingPredictions: userStats.pendingPredictions,
      accuracy: userStats.accuracy,
      brierScore: userStats.brierScore,
      lastCalculated: userStats.lastCalculated,
      displayName: users.displayName,
      email: users.email,
      createdAt: users.createdAt
    }).from(userStats).innerJoin(users, eq(userStats.userId, users.id)).where(sql2`${userStats.totalPredictions} > 0`).orderBy(sql2`${userStats.accuracy} DESC, ${userStats.totalPredictions} DESC`);
    return results.map((row) => ({
      user: {
        id: row.userId,
        displayName: row.displayName,
        email: row.email,
        createdAt: row.createdAt
      },
      stats: {
        userId: row.userId,
        totalPredictions: row.totalPredictions,
        correctPredictions: row.correctPredictions,
        incorrectPredictions: row.incorrectPredictions,
        pendingPredictions: row.pendingPredictions,
        accuracy: row.accuracy,
        brierScore: row.brierScore,
        lastCalculated: row.lastCalculated
      }
    }));
  }
  // Likes operations
  async toggleLike(userId, predictionId) {
    const [existingLike] = await db.select().from(likes).where(and(
      eq(likes.userId, userId),
      eq(likes.predictionId, predictionId)
    ));
    if (existingLike) {
      await db.delete(likes).where(and(
        eq(likes.userId, userId),
        eq(likes.predictionId, predictionId)
      ));
    } else {
      await db.insert(likes).values({
        userId,
        predictionId
      });
    }
    const likeCount = await this.getLikeCount(predictionId);
    return {
      liked: !existingLike,
      count: likeCount
    };
  }
  async getLikeCount(predictionId) {
    const [result] = await db.select({ count: count() }).from(likes).where(eq(likes.predictionId, predictionId));
    return result.count;
  }
  async hasUserLiked(userId, predictionId) {
    const [like] = await db.select().from(likes).where(and(
      eq(likes.userId, userId),
      eq(likes.predictionId, predictionId)
    ));
    return !!like;
  }
  // Comments operations
  async addComment(userId, predictionId, content) {
    const [comment] = await db.insert(comments).values({
      userId,
      predictionId,
      content
    }).returning();
    return comment;
  }
  async getComments(predictionId) {
    const results = await db.select({
      id: comments.id,
      userId: comments.userId,
      predictionId: comments.predictionId,
      content: comments.content,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      userDisplayName: users.displayName
    }).from(comments).leftJoin(users, eq(comments.userId, users.id)).where(eq(comments.predictionId, predictionId)).orderBy(desc(comments.createdAt));
    return results;
  }
  async getCommentCount(predictionId) {
    const [result] = await db.select({ count: count() }).from(comments).where(eq(comments.predictionId, predictionId));
    return result.count;
  }
  // Admin operations - only for admin users
  async adminUpdatePrediction(id, updates) {
    const [prediction] = await db.update(predictions).set({ ...updates, updatedAt: /* @__PURE__ */ new Date() }).where(eq(predictions.id, id)).returning();
    if (prediction && prediction.userId) {
      await this.calculateUserStats(prediction.userId);
    }
    return prediction;
  }
  async adminDeletePrediction(id) {
    try {
      const [prediction] = await db.select().from(predictions).where(eq(predictions.id, id));
      if (!prediction) {
        return false;
      }
      const result = await db.transaction(async (tx) => {
        await tx.delete(likes).where(eq(likes.predictionId, id));
        await tx.delete(comments).where(eq(comments.predictionId, id));
        const deletedPredictions = await tx.delete(predictions).where(eq(predictions.id, id)).returning();
        return deletedPredictions;
      });
      if (result && result.length > 0) {
        if (prediction.userId) {
          await this.calculateUserStats(prediction.userId);
        }
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error in adminDeletePrediction:", error);
      return false;
    }
  }
  async adminGetAllUsers() {
    return await db.select().from(users).orderBy(users.displayName);
  }
  async adminUpdateUserDisplayName(userId, displayName) {
    const [user] = await db.update(users).set({
      displayName,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(users.id, userId)).returning();
    return user;
  }
  async adminDeleteComment(commentId) {
    const deleted = await db.delete(comments).where(eq(comments.id, commentId)).returning();
    return deleted.length > 0;
  }
  // Community content methods
  async getCommunityContent() {
    try {
      const [content] = await db.select().from(communityContent).limit(1);
      return content?.content || null;
    } catch (error) {
      console.error("Error getting community content:", error);
      return null;
    }
  }
  async saveCommunityContent(content) {
    try {
      const existingContent = await db.select().from(communityContent).limit(1);
      if (existingContent.length > 0) {
        await db.update(communityContent).set({
          content,
          updatedAt: /* @__PURE__ */ new Date()
        }).where(eq(communityContent.id, existingContent[0].id));
      } else {
        await db.insert(communityContent).values({
          content,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date()
        });
      }
    } catch (error) {
      console.error("Error saving community content:", error);
      throw error;
    }
  }
};
var storage = new DatabaseStorage();

// server/services/airtable.ts
var AirtableService = class {
  baseId = process.env.AIRTABLE_BASE_ID || "appyBygBNgMiHtfkm";
  apiKey = process.env.AIRTABLE_TOKEN || "patIWPRWZ9wmBIuia";
  baseUrl = `https://api.airtable.com/v0/${this.baseId}`;
  // Determine table name based on environment
  getTableName() {
    const isProduction = process.env.NODE_ENV === "production" || process.env.REPLIT_DOMAINS?.includes("guessometer.com") || process.env.DEPLOYMENT_DOMAIN?.includes("guessometer.com");
    return isProduction ? "Production" : "Predictions";
  }
  constructor() {
    console.log("Airtable service initialized with:");
    console.log("Base ID:", this.baseId ? "Set" : "Not set");
    console.log("API Key:", this.apiKey ? "Set (" + this.apiKey.substring(0, 8) + "...)" : "Not set");
    console.log("Table Name:", this.getTableName());
  }
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    console.log("Making Airtable request to:", url);
    console.log("Using token:", this.apiKey ? this.apiKey.substring(0, 12) + "..." : "None");
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers
      }
    });
    console.log("Airtable response status:", response.status, response.statusText);
    if (!response.ok) {
      const errorText = await response.text();
      console.log("Airtable error response:", errorText);
      throw new Error(`Airtable API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    return response.json();
  }
  // Predictions operations
  async getPredictions() {
    const tableName = this.getTableName();
    const response = await this.makeRequest(`/${tableName}`);
    return response.records;
  }
  // Get only public predictions for community view
  async getPublicPredictions() {
    const tableName = this.getTableName();
    const filterFormula = "Privacy = 'Public'";
    const encodedFilter = encodeURIComponent(filterFormula);
    const response = await this.makeRequest(`/${tableName}?filterByFormula=${encodedFilter}`);
    return response.records;
  }
  async createPrediction(predictionData) {
    const fields = {
      "Prediction Text": predictionData.predictionText,
      "Confidence %": predictionData.confidenceLevel,
      "Category": predictionData.category,
      "Privacy": predictionData.isPublic ? "Public" : "Private",
      "Prediction Date": predictionData.predictionDate ? new Date(predictionData.predictionDate).toISOString().split("T")[0] : (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      "Outcome Known?": "No",
      // Text field indicating if outcome is known
      "Predicted Outcome": "Yes"
      // Default prediction - user can manually set this to 'No' if they predict 'No'
    };
    console.log("Creating Airtable prediction with fields:", fields);
    const tableName = this.getTableName();
    const response = await this.makeRequest(`/${tableName}`, {
      method: "POST",
      body: JSON.stringify({ fields })
    });
    return response;
  }
  async updatePrediction(id, predictionData) {
    const fields = {};
    if (predictionData.outcome !== void 0) {
      if (predictionData.outcome === "correct") {
        fields["Actual Outcome"] = "Yes";
        fields["Outcome Known?"] = "Yes";
      } else if (predictionData.outcome === "incorrect") {
        fields["Actual Outcome"] = "No";
        fields["Outcome Known?"] = "Yes";
      } else {
        fields["Outcome Known?"] = "No";
      }
    }
    if (predictionData.confidenceLevel !== void 0) {
      fields["Confidence %"] = predictionData.confidenceLevel;
    }
    console.log("Updating Airtable prediction with fields:", fields);
    const tableName = this.getTableName();
    const response = await this.makeRequest(`/${tableName}/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ fields })
    });
    return response;
  }
  async deletePrediction(id) {
    try {
      console.log("Deleting Airtable prediction with ID:", id);
      const tableName = this.getTableName();
      await this.makeRequest(`/${tableName}/${id}`, {
        method: "DELETE"
      });
      console.log("Successfully deleted prediction from Airtable");
      return true;
    } catch (error) {
      console.error("Error deleting prediction from Airtable:", error);
      return false;
    }
  }
  // Helper method to map Airtable outcome to our format
  mapAirtableOutcome(predictedOutcome, outcomeKnown) {
    if (outcomeKnown !== "Yes") return "pending";
    if (predictedOutcome === "Yes") return "correct";
    if (predictedOutcome === "No") return "incorrect";
    return "pending";
  }
  // Categories operations - using existing prediction categories
  async getCategories() {
    try {
      const predictions2 = await this.getPredictions();
      const categories2 = /* @__PURE__ */ new Set();
      predictions2.forEach((record) => {
        const category = record.fields["Category"];
        if (category && typeof category === "string") {
          categories2.add(category);
        }
      });
      return Array.from(categories2);
    } catch (error) {
      console.error("Error getting categories from Airtable:", error);
      return ["Finance", "Technology", "Personal", "Sports", "Politics", "Weather"];
    }
  }
  // Users operations (for sync)
  async getUsers() {
    const response = await this.makeRequest("/Users");
    return response.records;
  }
  async createUser(fields) {
    const response = await this.makeRequest("/Users", {
      method: "POST",
      body: JSON.stringify({ fields })
    });
    return response;
  }
  // Sync operations
  async syncPredictionsToLocal(storage2) {
    try {
      const airtablePredictions = await this.getPredictions();
      for (const record of airtablePredictions) {
        const fields = record.fields;
        const predictionData = {
          airtableId: record.id,
          userId: fields["User"] ? Array.isArray(fields["User"]) ? fields["User"][0] : fields["User"] : "unknown",
          predictionText: fields["Prediction Text"] || "",
          description: fields["Prediction Text"] || "",
          // Use same field as description for now
          category: fields["Category"] || "general",
          confidenceLevel: fields["Confidence %"] || 50,
          targetDate: new Date(fields["Remind Date"] || Date.now()),
          outcome: this.mapAirtableOutcome(fields["Predicted Outcome"], fields["Outcome Known?"]),
          isPublic: fields["Privacy"] !== "Private",
          predictionDate: new Date(fields["Prediction Date"] || record.createdTime)
        };
        await storage2.createPrediction(predictionData);
      }
    } catch (error) {
      console.error("Error syncing predictions from Airtable:", error);
    }
  }
  async syncCategoriesToLocal(storage2) {
    try {
      const categories2 = await this.getCategories();
      for (const categoryName of categories2) {
        const categoryData = {
          name: categoryName,
          color: "#666666"
        };
        await storage2.createCategory(categoryData);
      }
    } catch (error) {
      console.error("Error syncing categories from Airtable:", error);
    }
  }
};
var airtableService = new AirtableService();

// server/googleAuth.ts
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import connectPg from "connect-pg-simple";
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth credentials not provided");
}
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions"
  });
  return session({
    secret: process.env.SESSION_SECRET || "guessometer-session-secret-dev",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl
    }
  });
}
async function setupGoogleAuth(app2) {
  app2.set("trust proxy", 1);
  app2.use(getSession());
  app2.use(passport.initialize());
  app2.use(passport.session());
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: "/api/auth/google/callback"
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const googleUser = {
            id: profile.id,
            email: profile.emails?.[0]?.value || "",
            displayName: profile.displayName || "",
            firstName: profile.name?.givenName || "",
            lastName: profile.name?.familyName || "",
            profileImageUrl: profile.photos?.[0]?.value || ""
          };
          const user = await storage.upsertUser({
            id: googleUser.id,
            email: googleUser.email,
            displayName: googleUser.displayName,
            firstName: googleUser.firstName,
            lastName: googleUser.lastName,
            profileImageUrl: googleUser.profileImageUrl
          });
          const userWithTokens = {
            ...user,
            accessToken,
            refreshToken
          };
          return done(null, userWithTokens);
        } catch (error) {
          return done(error, void 0);
        }
      }
    )
  );
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, null);
      }
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      done(null, null);
    }
  });
  app2.get(
    "/api/auth/google",
    passport.authenticate("google", {
      scope: ["profile", "email"],
      prompt: "select_account"
      // Force Google account selection dialog
    })
  );
  app2.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/",
      successRedirect: "/dashboard"
    })
  );
  app2.get("/api/auth/logout", async (req, res) => {
    console.log("Logout attempt for user:", req.user ? "authenticated" : "not authenticated");
    try {
      if (req.user && req.user.accessToken) {
        console.log("Revoking Google access token...");
        const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${req.user.accessToken}`;
        await fetch(revokeUrl, { method: "POST" });
        console.log("Google access token revoked successfully");
      }
    } catch (error) {
      console.error("Error revoking Google token:", error);
    }
    req.logout(function(err) {
      if (err) {
        console.error("Passport logout error:", err);
        return res.redirect("/");
      }
      console.log("User logged out from Passport, destroying session...");
      req.session.destroy(function(err2) {
        if (err2) {
          console.error("Session destruction error:", err2);
        }
        const isProduction = process.env.NODE_ENV === "production";
        const cookieOptions = {
          path: "/",
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          domain: void 0
          // Let browser determine domain
        };
        res.clearCookie("connect.sid", cookieOptions);
        res.clearCookie("guessometer_session", cookieOptions);
        res.clearCookie("session", cookieOptions);
        res.clearCookie("sid", cookieOptions);
        res.clearCookie("oauth_state", cookieOptions);
        res.clearCookie("oauth_verifier", cookieOptions);
        res.clearCookie("auth_token", cookieOptions);
        res.set({
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        });
        console.log(`Complete logout finished for ${isProduction ? "production" : "development"}`);
        console.log("Session destroyed, tokens revoked, and all cookies cleared");
        res.redirect("/");
      });
    });
  });
}
var isAuthenticated = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};
var isAdmin = (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const adminEmail = "whoisworld9@gmail.com";
  if (req.user.email !== adminEmail) {
    console.log(`Admin access denied for email: ${req.user.email}`);
    return res.status(403).json({ message: "Admin access required" });
  }
  console.log(`Admin access granted for email: ${req.user.email}`);
  next();
};

// server/routes.ts
async function registerRoutes(app2) {
  await setupGoogleAuth(app2);
  app2.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  app2.get("/api/user/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserStats(userId);
      if (!stats) {
        const calculatedStats = await storage.calculateUserStats(userId);
        res.json(calculatedStats);
      } else {
        res.json(stats);
      }
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ message: "Failed to fetch user stats" });
    }
  });
  app2.get("/api/user/accuracy-trend", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const period = req.query.period || "all";
      const includeBrierScore = req.query.includeBrierScore === "true";
      const trend = await storage.getUserAccuracyTrend(userId, period, includeBrierScore);
      res.json(trend);
    } catch (error) {
      console.error("Error fetching accuracy trend:", error);
      res.status(500).json({ message: "Failed to fetch accuracy trend" });
    }
  });
  app2.put("/api/user/display-name", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const { displayName } = req.body;
      if (!displayName || typeof displayName !== "string") {
        return res.status(400).json({ message: "Display name is required" });
      }
      if (displayName.trim().length < 1 || displayName.trim().length > 50) {
        return res.status(400).json({ message: "Display name must be between 1 and 50 characters" });
      }
      const updatedUser = await storage.updateUserDisplayName(userId, displayName.trim());
      res.json({
        success: true,
        user: updatedUser
      });
    } catch (error) {
      console.error("Error updating display name:", error);
      res.status(500).json({ message: "Failed to update display name" });
    }
  });
  app2.get("/api/leaderboard", async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });
  app2.post("/api/predictions/:id/like", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const predictionId = req.params.id;
      const result = await storage.toggleLike(userId, predictionId);
      res.json(result);
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ message: "Failed to toggle like" });
    }
  });
  app2.get("/api/predictions/:id/likes", async (req, res) => {
    try {
      const predictionId = req.params.id;
      const count2 = await storage.getLikeCount(predictionId);
      res.json({ count: count2 });
    } catch (error) {
      console.error("Error fetching like count:", error);
      res.status(500).json({ message: "Failed to fetch like count" });
    }
  });
  app2.get("/api/predictions/:id/user-liked", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const predictionId = req.params.id;
      const liked = await storage.hasUserLiked(userId, predictionId);
      res.json({ liked });
    } catch (error) {
      console.error("Error checking user like:", error);
      res.status(500).json({ message: "Failed to check user like" });
    }
  });
  app2.post("/api/predictions/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const predictionId = req.params.id;
      const { content } = req.body;
      if (!content || typeof content !== "string" || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }
      const comment = await storage.addComment(userId, predictionId, content.trim());
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });
  app2.get("/api/predictions/:id/comments", async (req, res) => {
    try {
      const predictionId = req.params.id;
      const comments2 = await storage.getComments(predictionId);
      res.json(comments2);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });
  app2.get("/api/predictions/:id/comments/count", async (req, res) => {
    try {
      const predictionId = req.params.id;
      const count2 = await storage.getCommentCount(predictionId);
      res.json({ count: count2 });
    } catch (error) {
      console.error("Error fetching comment count:", error);
      res.status(500).json({ message: "Failed to fetch comment count" });
    }
  });
  app2.get("/api/predictions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const predictions2 = await storage.getPredictions(limit, offset);
      res.json(predictions2);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ message: "Failed to fetch predictions" });
    }
  });
  app2.get("/api/user/predictions", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const predictions2 = await storage.getUserPredictions(userId);
      res.json(predictions2);
    } catch (error) {
      console.error("Error fetching user predictions:", error);
      res.status(500).json({ message: "Failed to fetch user predictions" });
    }
  });
  app2.get("/api/predictions/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const predictions2 = await storage.getUserPredictions(userId);
      res.json(predictions2);
    } catch (error) {
      console.error("Error fetching user predictions:", error);
      res.status(500).json({ message: "Failed to fetch user predictions" });
    }
  });
  app2.post("/api/predictions", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.id;
      const predictionData = {
        ...req.body,
        userId,
        predictionDate: /* @__PURE__ */ new Date(),
        targetDate: new Date(req.body.targetDate)
      };
      const prediction = await storage.createPrediction(predictionData);
      try {
        const airtableRecord = await airtableService.createPrediction(prediction);
        console.log("Successfully synced prediction to Airtable:", airtableRecord.id);
        await storage.updatePrediction(prediction.id, { airtableId: airtableRecord.id });
      } catch (airtableError) {
        console.error("Failed to sync prediction to Airtable:", airtableError);
      }
      res.status(201).json(prediction);
    } catch (error) {
      console.error("Error creating prediction:", error);
      res.status(500).json({ message: "Failed to create prediction" });
    }
  });
  app2.patch("/api/predictions/:id", isAuthenticated, async (req, res) => {
    try {
      const predictionId = req.params.id;
      const userId = req.user.id;
      const prediction = await storage.updatePrediction(predictionId, req.body);
      if (!prediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }
      if (prediction.airtableId) {
        try {
          await airtableService.updatePrediction(prediction.airtableId, req.body);
          console.log("Successfully synced prediction update to Airtable");
        } catch (airtableError) {
          console.error("Failed to sync prediction update to Airtable:", airtableError);
        }
      }
      res.json(prediction);
    } catch (error) {
      console.error("Error updating prediction:", error);
      res.status(500).json({ message: "Failed to update prediction" });
    }
  });
  app2.delete("/api/predictions/:id", isAuthenticated, async (req, res) => {
    try {
      const predictionId = req.params.id;
      const userId = req.user.id;
      const prediction = await storage.getPredictions(1, 0);
      const targetPrediction = prediction.find((p) => p.id === predictionId && p.userId === userId);
      const deleted = await storage.deletePrediction(predictionId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Prediction not found or not authorized" });
      }
      if (targetPrediction?.airtableId) {
        try {
          await airtableService.deletePrediction(targetPrediction.airtableId);
          console.log("Successfully synced prediction deletion to Airtable");
        } catch (airtableError) {
          console.error("Failed to sync prediction deletion to Airtable:", airtableError);
        }
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting prediction:", error);
      res.status(500).json({ message: "Failed to delete prediction" });
    }
  });
  app2.get("/api/categories", async (req, res) => {
    try {
      const categories2 = await storage.getCategories();
      res.json(categories2);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });
  app2.post("/api/categories", async (req, res) => {
    try {
      res.status(401).json({ message: "Authentication required" });
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });
  app2.post("/api/sync/predictions", async (req, res) => {
    res.status(401).json({ message: "Authentication required" });
  });
  app2.post("/api/sync/categories", async (req, res) => {
    res.status(401).json({ message: "Authentication required" });
  });
  app2.get("/api/test-airtable", async (req, res) => {
    res.status(401).json({ message: "Authentication required" });
  });
  app2.post("/api/user/recalculate-stats", async (req, res) => {
    res.status(401).json({ message: "Authentication required" });
  });
  app2.get("/api/admin/check", isAdmin, async (req, res) => {
    res.json({ isAdmin: true });
  });
  app2.get("/api/admin/users", isAdmin, async (req, res) => {
    try {
      const users2 = await storage.adminGetAllUsers();
      res.json(users2);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  app2.patch("/api/admin/users/:userId/display-name", isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const { displayName } = req.body;
      if (!displayName || displayName.trim().length === 0) {
        return res.status(400).json({ message: "Display name is required" });
      }
      const user = await storage.adminUpdateUserDisplayName(userId, displayName.trim());
      res.json(user);
    } catch (error) {
      console.error("Error updating user display name:", error);
      res.status(500).json({ message: "Failed to update display name" });
    }
  });
  app2.patch("/api/admin/predictions/:id", isAdmin, async (req, res) => {
    try {
      const predictionId = req.params.id;
      const updates = req.body;
      if (updates.targetDate) {
        updates.targetDate = new Date(updates.targetDate);
      }
      if (updates.createdAt) {
        updates.createdAt = new Date(updates.createdAt);
      }
      const prediction = await storage.adminUpdatePrediction(predictionId, updates);
      if (!prediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }
      if (prediction.airtableId) {
        try {
          await airtableService.updatePrediction(prediction.airtableId, updates);
          console.log("Admin: Successfully synced prediction update to Airtable");
        } catch (airtableError) {
          console.error("Admin: Failed to sync prediction update to Airtable:", airtableError);
        }
      }
      res.json(prediction);
    } catch (error) {
      console.error("Error updating prediction (admin):", error);
      res.status(500).json({ message: "Failed to update prediction" });
    }
  });
  app2.get("/api/community-content", async (req, res) => {
    try {
      const content = await storage.getCommunityContent();
      if (content) {
        res.json(content);
      } else {
        res.status(404).json({ message: "No content found" });
      }
    } catch (error) {
      console.error("Error loading community content:", error);
      res.status(500).json({ message: "Failed to load content" });
    }
  });
  app2.post("/api/community-content", isAdmin, async (req, res) => {
    try {
      const content = req.body;
      await storage.saveCommunityContent(content);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving community content:", error);
      res.status(500).json({ message: "Failed to save content" });
    }
  });
  app2.delete("/api/admin/predictions/:id", isAdmin, async (req, res) => {
    try {
      const predictionId = req.params.id;
      const predictions2 = await storage.getPredictions(1e3, 0);
      const targetPrediction = predictions2.find((p) => p.id === predictionId);
      const deleted = await storage.adminDeletePrediction(predictionId);
      if (!deleted) {
        return res.status(404).json({ message: "Prediction not found" });
      }
      if (targetPrediction?.airtableId) {
        try {
          await airtableService.deletePrediction(targetPrediction.airtableId);
          console.log("Admin: Successfully synced prediction deletion to Airtable");
        } catch (airtableError) {
          console.error("Admin: Failed to sync prediction deletion to Airtable:", airtableError);
        }
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting prediction (admin):", error);
      res.status(500).json({ message: "Failed to delete prediction" });
    }
  });
  app2.delete("/api/admin/comments/:id", isAdmin, async (req, res) => {
    try {
      const commentId = req.params.id;
      const deleted = await storage.adminDeleteComment(commentId);
      if (!deleted) {
        return res.status(404).json({ message: "Comment not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting comment (admin):", error);
      res.status(500).json({ message: "Failed to delete comment" });
    }
  });
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json({ limit: "10mb" }));
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
