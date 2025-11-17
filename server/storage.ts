import {
  users,
  predictions,
  categories,
  userStats,
  likes,
  comments,
  communityContent,
  type User,
  type UpsertUser,
  type Prediction,
  type InsertPrediction,
  type Category,
  type InsertCategory,
  type UserStats,
  type GoogleUser,
  type Like,
  type InsertLike,
  type Comment,
  type InsertComment,
  type CommunityContent,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, count } from "drizzle-orm";
import bcrypt from "bcrypt";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserDisplayName(userId: string, displayName: string): Promise<User>;
  
  // Prediction operations
  getPredictions(limit?: number, offset?: number): Promise<Prediction[]>;
  getUserPredictions(userId: string): Promise<Prediction[]>;
  createPrediction(prediction: InsertPrediction & { userId: string }): Promise<Prediction>;
  updatePrediction(id: string, updates: Partial<Prediction>): Promise<Prediction | undefined>;
  deletePrediction(id: string, userId: string): Promise<boolean>;
  
  // Category operations
  getCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Statistics operations
  getUserStats(userId: string): Promise<UserStats | undefined>;
  calculateUserStats(userId: string): Promise<UserStats>;
  
  // Accuracy trend data
  getUserAccuracyTrend(userId: string, period: '1m' | '6m' | '12m' | 'all'): Promise<{date: string, accuracy: number}[]>;
  
  // Leaderboard data
  getLeaderboard(): Promise<Array<{user: User, stats: UserStats}>>;
  
  // Likes operations
  toggleLike(userId: string, predictionId: string): Promise<{liked: boolean, count: number}>;
  getLikeCount(predictionId: string): Promise<number>;
  hasUserLiked(userId: string, predictionId: string): Promise<boolean>;
  
  // Comments operations
  addComment(userId: string, predictionId: string, content: string): Promise<Comment>;
  getComments(predictionId: string): Promise<Array<Comment & {userDisplayName: string}>>;
  getCommentCount(predictionId: string): Promise<number>;
  
  // Admin operations - only for admin users
  adminUpdatePrediction(id: string, updates: Partial<Prediction>): Promise<Prediction | undefined>;
  adminDeletePrediction(id: string): Promise<boolean>;
  adminGetAllUsers(): Promise<User[]>;
  adminUpdateUserDisplayName(userId: string, displayName: string): Promise<User>;
  adminDeleteComment(commentId: string): Promise<boolean>;

  // Community content operations
  getCommunityContent(): Promise<any>;
  saveCommunityContent(content: any): Promise<void>;
  
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      console.log('Checking if user exists with email:', email);
      const [user] = await db.select().from(users).where(eq(users.email, email));
      console.log('User lookup result:', user ? 'FOUND' : 'NOT_FOUND');
      return user;
    } catch (error: any) {
      console.error('Error in getUserByEmail:', {
        message: error.message,
        code: error.code
      });
      throw error;
    }
  }

  // Google OAuth user upsert method

  async upsertUser(userData: UpsertUser): Promise<User> {
    try {
      // First try to find existing user by ID
      const existingUser = await this.getUser(userData.id!);
      if (existingUser) {
        // Update existing user - preserve custom display name if it exists
        const [user] = await db
          .update(users)
          .set({
            email: userData.email,
            displayName: existingUser.displayName || userData.displayName,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.id, userData.id!))
          .returning();
        return user;
      }
      
      // Try to find by email if ID doesn't exist
      if (userData.email) {
        const userByEmail = await this.getUserByEmail(userData.email);
        if (userByEmail) {
          // Update existing user (DON'T change the ID - that breaks foreign keys)
          // Preserve custom display name if it exists, otherwise use Google display name
          const [user] = await db
            .update(users)
            .set({
              displayName: userByEmail.displayName || userData.displayName,
              firstName: userData.firstName,
              lastName: userData.lastName,
              profileImageUrl: userData.profileImageUrl,
              updatedAt: new Date(),
            })
            .where(eq(users.email, userData.email))
            .returning();
          return user;
        }
      }
      
      // Create new user if no conflicts
      const [user] = await db
        .insert(users)
        .values(userData)
        .returning();
      return user;
    } catch (error: any) {
      console.error('Error in upsertUser:', error);
      throw error;
    }
  }

  async updateUserDisplayName(userId: string, displayName: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        displayName,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    
    if (!user) {
      throw new Error('User not found');
    }
    
    return user;
  }

  // Prediction operations
  async getPredictions(limit = 50, offset = 0): Promise<Prediction[]> {
    const results = await db
      .select({
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
        userDisplayName: users.displayName,
      })
      .from(predictions)
      .leftJoin(users, eq(predictions.userId, users.id))
      .where(eq(predictions.isPublic, true))
      .orderBy(desc(predictions.createdAt))
      .limit(limit)
      .offset(offset);
    
    return results as any;
  }

  async getUserPredictions(userId: string): Promise<Prediction[]> {
    const results = await db
      .select({
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
        userDisplayName: users.displayName,
      })
      .from(predictions)
      .leftJoin(users, eq(predictions.userId, users.id))
      .where(eq(predictions.userId, userId))
      .orderBy(desc(predictions.createdAt));
    
    return results as any;
  }

  async createPrediction(predictionData: InsertPrediction & { userId: string }): Promise<Prediction> {
    const [prediction] = await db
      .insert(predictions)
      .values(predictionData)
      .returning();
    
    // Recalculate user stats
    await this.calculateUserStats(predictionData.userId);
    
    return prediction;
  }

  async updatePrediction(id: string, updates: Partial<Prediction>): Promise<Prediction | undefined> {
    const [prediction] = await db
      .update(predictions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(predictions.id, id))
      .returning();
    
    if (prediction && prediction.userId) {
      await this.calculateUserStats(prediction.userId);
    }
    
    return prediction;
  }

  async deletePrediction(id: string, userId: string): Promise<boolean> {
    try {
      // First, verify the prediction exists and belongs to the user
      const [prediction] = await db
        .select()
        .from(predictions)
        .where(and(
          eq(predictions.id, id),
          eq(predictions.userId, userId)
        ));
      
      if (!prediction) {
        return false;
      }
      
      // Use a transaction to ensure all deletions succeed together
      const result = await db.transaction(async (tx) => {
        // Delete all likes for this prediction first
        await tx
          .delete(likes)
          .where(eq(likes.predictionId, id));
        
        // Delete all comments for this prediction
        await tx
          .delete(comments)
          .where(eq(comments.predictionId, id));
        
        // Now delete the prediction itself
        const deletedPredictions = await tx
          .delete(predictions)
          .where(and(
            eq(predictions.id, id),
            eq(predictions.userId, userId)
          ))
          .returning();
        
        return deletedPredictions;
      });
      
      if (result && result.length > 0) {
        // Recalculate user stats after deletion
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
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.name);
  }

  async createCategory(categoryData: InsertCategory): Promise<Category> {
    const [category] = await db
      .insert(categories)
      .values(categoryData)
      .returning();
    return category;
  }

  // Statistics operations
  async getUserStats(userId: string): Promise<UserStats | undefined> {
    const [stats] = await db
      .select()
      .from(userStats)
      .where(eq(userStats.userId, userId));
    return stats;
  }

  async calculateUserStats(userId: string): Promise<UserStats> {
    // Get user's PUBLIC predictions with outcomes only
    const userPredictions = await db
      .select()
      .from(predictions)
      .where(and(
        eq(predictions.userId, userId),
        eq(predictions.isPublic, true)
      ));

    const total = userPredictions.length;
    const correct = userPredictions.filter(p => p.outcome === 'correct').length;
    const incorrect = userPredictions.filter(p => p.outcome === 'incorrect').length;
    const pending = userPredictions.filter(p => !p.outcome || p.outcome === 'pending').length;
    
    // Only calculate accuracy based on resolved predictions (correct + incorrect)
    const resolvedTotal = correct + incorrect;
    const accuracy = resolvedTotal > 0 ? (correct / resolvedTotal) * 100 : 0;

    // Calculate Brier Score for resolved predictions
    const resolvedPredictions = userPredictions.filter(p => p.outcome === 'correct' || p.outcome === 'incorrect');
    let brierScore = 0;
    if (resolvedPredictions.length > 0) {
      const brierSum = resolvedPredictions.reduce((sum, prediction) => {
        const forecastProbability = prediction.confidenceLevel / 100;
        const actualOutcome = prediction.outcome === 'correct' ? 1 : 0;
        const brierForPrediction = Math.pow(forecastProbability - actualOutcome, 2);
        return sum + brierForPrediction;
      }, 0);
      brierScore = brierSum / resolvedPredictions.length;
    }

    const [stats] = await db
      .insert(userStats)
      .values({
        userId,
        totalPredictions: total,
        correctPredictions: correct,
        incorrectPredictions: incorrect,
        pendingPredictions: pending,
        accuracy: accuracy.toFixed(2),
        brierScore: brierScore.toFixed(4),
        lastCalculated: new Date(),
      })
      .onConflictDoUpdate({
        target: userStats.userId,
        set: {
          totalPredictions: total,
          correctPredictions: correct,
          incorrectPredictions: incorrect,
          pendingPredictions: pending,
          accuracy: accuracy.toFixed(2),
          brierScore: brierScore.toFixed(4),
          lastCalculated: new Date(),
        },
      })
      .returning();

    return stats;
  }

  async getUserAccuracyTrend(userId: string, period: '1m' | '6m' | '12m' | 'all', includeBrierScore: boolean = false): Promise<{date: string, accuracy: number, confidence: number, brierScore?: number}[]> {
    let dateFilter = sql`true`;
    
    switch (period) {
      case '1m':
        dateFilter = sql`${predictions.createdAt} >= NOW() - INTERVAL '1 month'`;
        break;
      case '6m':
        dateFilter = sql`${predictions.createdAt} >= NOW() - INTERVAL '6 months'`;
        break;
      case '12m':
        dateFilter = sql`${predictions.createdAt} >= NOW() - INTERVAL '12 months'`;
        break;
    }

    // Get individual predictions with their actual creation dates
    const results = await db
      .select({
        date: sql<string>`${predictions.createdAt}::date::text`,
        outcome: predictions.outcome,
        confidenceLevel: predictions.confidenceLevel,
        createdAt: predictions.createdAt
      })
      .from(predictions)
      .where(and(
        eq(predictions.userId, userId),
        sql`${predictions.outcome} IN ('correct', 'incorrect')`, // Only resolved predictions
        dateFilter
      ))
      .orderBy(predictions.createdAt);

    // Group by date and calculate running averages
    const dateGroups = new Map<string, { predictions: any[], accuracy: number, confidence: number, brierScore?: number }>();
    let totalCorrect = 0;
    let totalPredictions = 0;
    let totalConfidence = 0;
    let totalBrierSum = 0;

    results.forEach((prediction, index) => {
      // Calculate running accuracy
      totalPredictions++;
      if (prediction.outcome === 'correct') {
        totalCorrect++;
      }
      totalConfidence += prediction.confidenceLevel;

      const accuracy = (totalCorrect / totalPredictions) * 100;
      const avgConfidence = totalConfidence / totalPredictions;

      // Calculate running Brier Score if requested
      let brierScore: number | undefined;
      if (includeBrierScore) {
        const forecastProbability = prediction.confidenceLevel / 100;
        const actualOutcome = prediction.outcome === 'correct' ? 1 : 0;
        const brierForPrediction = Math.pow(forecastProbability - actualOutcome, 2);
        totalBrierSum += brierForPrediction;
        brierScore = totalBrierSum / totalPredictions;
      }

      dateGroups.set(prediction.date, {
        predictions: [prediction],
        accuracy: accuracy,
        confidence: avgConfidence,
        brierScore: brierScore
      });
    });

    return Array.from(dateGroups.entries())
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, data]) => ({
        date,
        accuracy: data.accuracy,
        confidence: data.confidence,
        ...(includeBrierScore && data.brierScore !== undefined ? { brierScore: data.brierScore } : {})
      }));
  }

  async getLeaderboard(): Promise<Array<{user: User, stats: UserStats}>> {
    const results = await db
      .select({
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
        createdAt: users.createdAt,
      })
      .from(userStats)
      .innerJoin(users, eq(userStats.userId, users.id))
      .where(sql`${userStats.totalPredictions} > 0`)
      .orderBy(sql`${userStats.accuracy} DESC, ${userStats.totalPredictions} DESC`);
    
    return results.map(row => ({
      user: {
        id: row.userId,
        displayName: row.displayName,
        email: row.email,
        createdAt: row.createdAt,
      } as User,
      stats: {
        userId: row.userId,
        totalPredictions: row.totalPredictions,
        correctPredictions: row.correctPredictions,
        incorrectPredictions: row.incorrectPredictions,
        pendingPredictions: row.pendingPredictions,
        accuracy: row.accuracy,
        brierScore: row.brierScore,
        lastCalculated: row.lastCalculated,
      } as UserStats
    }));
  }

  // Likes operations
  async toggleLike(userId: string, predictionId: string): Promise<{liked: boolean, count: number}> {
    // Check if user already liked this prediction
    const [existingLike] = await db
      .select()
      .from(likes)
      .where(and(
        eq(likes.userId, userId),
        eq(likes.predictionId, predictionId)
      ));
    
    if (existingLike) {
      // Remove like
      await db
        .delete(likes)
        .where(and(
          eq(likes.userId, userId),
          eq(likes.predictionId, predictionId)
        ));
    } else {
      // Add like
      await db
        .insert(likes)
        .values({
          userId,
          predictionId,
        });
    }
    
    const likeCount = await this.getLikeCount(predictionId);
    return {
      liked: !existingLike,
      count: likeCount
    };
  }

  async getLikeCount(predictionId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(likes)
      .where(eq(likes.predictionId, predictionId));
    
    return result.count;
  }

  async hasUserLiked(userId: string, predictionId: string): Promise<boolean> {
    const [like] = await db
      .select()
      .from(likes)
      .where(and(
        eq(likes.userId, userId),
        eq(likes.predictionId, predictionId)
      ));
    
    return !!like;
  }

  // Comments operations
  async addComment(userId: string, predictionId: string, content: string): Promise<Comment> {
    const [comment] = await db
      .insert(comments)
      .values({
        userId,
        predictionId,
        content,
      })
      .returning();
    
    return comment;
  }

  async getComments(predictionId: string): Promise<Array<Comment & {userDisplayName: string}>> {
    const results = await db
      .select({
        id: comments.id,
        userId: comments.userId,
        predictionId: comments.predictionId,
        content: comments.content,
        createdAt: comments.createdAt,
        updatedAt: comments.updatedAt,
        userDisplayName: users.displayName,
      })
      .from(comments)
      .leftJoin(users, eq(comments.userId, users.id))
      .where(eq(comments.predictionId, predictionId))
      .orderBy(desc(comments.createdAt));
    
    return results as Array<Comment & {userDisplayName: string}>;
  }

  async getCommentCount(predictionId: string): Promise<number> {
    const [result] = await db
      .select({ count: count() })
      .from(comments)
      .where(eq(comments.predictionId, predictionId));
    
    return result.count;
  }

  // Admin operations - only for admin users
  async adminUpdatePrediction(id: string, updates: Partial<Prediction>): Promise<Prediction | undefined> {
    // Admin can update any prediction without userId restriction
    const [prediction] = await db
      .update(predictions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(predictions.id, id))
      .returning();
    
    if (prediction && prediction.userId) {
      await this.calculateUserStats(prediction.userId);
    }
    
    return prediction;
  }

  async adminDeletePrediction(id: string): Promise<boolean> {
    try {
      // Get prediction first to update user stats later
      const [prediction] = await db
        .select()
        .from(predictions)
        .where(eq(predictions.id, id));
      
      if (!prediction) {
        return false;
      }
      
      // Use a transaction to ensure all deletions succeed together
      const result = await db.transaction(async (tx) => {
        // Delete all likes for this prediction first
        await tx
          .delete(likes)
          .where(eq(likes.predictionId, id));
        
        // Delete all comments for this prediction
        await tx
          .delete(comments)
          .where(eq(comments.predictionId, id));
        
        // Now delete the prediction itself
        const deletedPredictions = await tx
          .delete(predictions)
          .where(eq(predictions.id, id))
          .returning();
        
        return deletedPredictions;
      });
      
      if (result && result.length > 0) {
        // Recalculate user stats after deletion
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

  async adminGetAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.displayName);
  }

  async adminUpdateUserDisplayName(userId: string, displayName: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ 
        displayName, 
        updatedAt: new Date() 
      })
      .where(eq(users.id, userId))
      .returning();
    
    return user;
  }

  async adminDeleteComment(commentId: string): Promise<boolean> {
    const deleted = await db.delete(comments).where(eq(comments.id, commentId)).returning();
    return deleted.length > 0;
  }

  // Community content methods
  async getCommunityContent(): Promise<any> {
    try {
      const [content] = await db
        .select()
        .from(communityContent)
        .limit(1);
      
      return content?.content || null;
    } catch (error) {
      console.error("Error getting community content:", error);
      return null;
    }
  }

  async saveCommunityContent(content: any): Promise<void> {
    try {
      const existingContent = await db
        .select()
        .from(communityContent)
        .limit(1);

      if (existingContent.length > 0) {
        // Update existing content
        await db
          .update(communityContent)
          .set({
            content: content,
            updatedAt: new Date()
          })
          .where(eq(communityContent.id, existingContent[0].id));
      } else {
        // Insert new content
        await db
          .insert(communityContent)
          .values({
            content: content,
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
    } catch (error) {
      console.error("Error saving community content:", error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();
