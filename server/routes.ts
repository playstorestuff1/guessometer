import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { airtableService } from "./services/airtable";
import { setupGoogleAuth, isAuthenticated, isAdmin } from "./googleAuth";
import { insertPredictionSchema, insertCategorySchema, predictions } from "@shared/schema";
import { z } from "zod";
import { and, or, isNull, eq } from "drizzle-orm";
import { db } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Google OAuth authentication
  await setupGoogleAuth(app);
  
  // Auth endpoints
  app.get('/api/auth/user', isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User statistics
  app.get('/api/user/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const stats = await storage.getUserStats(userId);
      if (!stats) {
        // Calculate stats if they don't exist
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

  // User accuracy trend
  app.get('/api/user/accuracy-trend', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const period = req.query.period as '1m' | '6m' | '12m' | 'all' || 'all';
      const includeBrierScore = req.query.includeBrierScore === 'true';
      const trend = await storage.getUserAccuracyTrend(userId, period, includeBrierScore);
      res.json(trend);
    } catch (error) {
      console.error("Error fetching accuracy trend:", error);
      res.status(500).json({ message: "Failed to fetch accuracy trend" });
    }
  });

  // Update user display name
  app.put('/api/user/display-name', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { displayName } = req.body;

      // Validation
      if (!displayName || typeof displayName !== 'string') {
        return res.status(400).json({ message: "Display name is required" });
      }

      if (displayName.trim().length < 1 || displayName.trim().length > 50) {
        return res.status(400).json({ message: "Display name must be between 1 and 50 characters" });
      }

      // Update the user in the database
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

  // Leaderboard route
  app.get('/api/leaderboard', async (req, res) => {
    try {
      const leaderboard = await storage.getLeaderboard();
      res.json(leaderboard);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Likes routes
  app.post('/api/predictions/:id/like', isAuthenticated, async (req: any, res) => {
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

  app.get('/api/predictions/:id/likes', async (req, res) => {
    try {
      const predictionId = req.params.id;
      const count = await storage.getLikeCount(predictionId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching like count:", error);
      res.status(500).json({ message: "Failed to fetch like count" });
    }
  });

  app.get('/api/predictions/:id/user-liked', isAuthenticated, async (req: any, res) => {
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

  // Comments routes
  app.post('/api/predictions/:id/comments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const predictionId = req.params.id;
      const { content } = req.body;
      
      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      const comment = await storage.addComment(userId, predictionId, content.trim());
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({ message: "Failed to add comment" });
    }
  });


  app.get('/api/predictions/:id/comments', async (req, res) => {
    try {
      const predictionId = req.params.id;
      const comments = await storage.getComments(predictionId);
      res.json(comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ message: "Failed to fetch comments" });
    }
  });

  app.get('/api/predictions/:id/comments/count', async (req, res) => {
    try {
      const predictionId = req.params.id;
      const count = await storage.getCommentCount(predictionId);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching comment count:", error);
      res.status(500).json({ message: "Failed to fetch comment count" });
    }
  });

  // Predictions routes
  app.get('/api/predictions', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const predictions = await storage.getPredictions(limit, offset);
      res.json(predictions);
    } catch (error) {
      console.error("Error fetching predictions:", error);
      res.status(500).json({ message: "Failed to fetch predictions" });
    }
  });

  // Get user's own predictions (both public and private)
  app.get('/api/user/predictions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const predictions = await storage.getUserPredictions(userId);
      res.json(predictions);
    } catch (error) {
      console.error("Error fetching user predictions:", error);
      res.status(500).json({ message: "Failed to fetch user predictions" });
    }
  });

  app.get('/api/predictions/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const predictions = await storage.getUserPredictions(userId);
      res.json(predictions);
    } catch (error) {
      console.error("Error fetching user predictions:", error);
      res.status(500).json({ message: "Failed to fetch user predictions" });
    }
  });

  app.post('/api/predictions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const predictionData = {
        ...req.body,
        userId,
        predictionDate: new Date(),
        targetDate: new Date(req.body.targetDate)
      };

      const prediction = await storage.createPrediction(predictionData);
      
      // Sync to Airtable (will use appropriate table based on environment)
      try {
        const airtableRecord = await airtableService.createPrediction(prediction);
        console.log('Successfully synced prediction to Airtable:', airtableRecord.id);
        
        // Update local prediction with Airtable ID for future sync operations
        await storage.updatePrediction(prediction.id, { airtableId: airtableRecord.id });
      } catch (airtableError) {
        console.error('Failed to sync prediction to Airtable:', airtableError);
        // Don't fail the request if Airtable sync fails
      }
      
      res.status(201).json(prediction);
    } catch (error) {
      console.error("Error creating prediction:", error);
      res.status(500).json({ message: "Failed to create prediction" });
    }
  });

  // Update prediction outcome
  app.patch('/api/predictions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const predictionId = req.params.id;
      const userId = req.user.id;
      
      const prediction = await storage.updatePrediction(predictionId, req.body);
      if (!prediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }
      
      // Sync updates to Airtable if prediction has an airtableId
      if (prediction.airtableId) {
        try {
          await airtableService.updatePrediction(prediction.airtableId, req.body);
          console.log('Successfully synced prediction update to Airtable');
        } catch (airtableError) {
          console.error('Failed to sync prediction update to Airtable:', airtableError);
          // Don't fail the request if Airtable sync fails
        }
      }
      
      res.json(prediction);
    } catch (error) {
      console.error("Error updating prediction:", error);
      res.status(500).json({ message: "Failed to update prediction" });
    }
  });

  // Delete prediction
  app.delete('/api/predictions/:id', isAuthenticated, async (req: any, res) => {
    try {
      const predictionId = req.params.id;
      const userId = req.user.id;
      
      // Get prediction first to check for airtableId
      const prediction = await storage.getPredictions(1, 0);
      const targetPrediction = prediction.find(p => p.id === predictionId && p.userId === userId);
      
      const deleted = await storage.deletePrediction(predictionId, userId);
      if (!deleted) {
        return res.status(404).json({ message: "Prediction not found or not authorized" });
      }
      
      // Sync deletion to Airtable if prediction had an airtableId
      if (targetPrediction?.airtableId) {
        try {
          await airtableService.deletePrediction(targetPrediction.airtableId);
          console.log('Successfully synced prediction deletion to Airtable');
        } catch (airtableError) {
          console.error('Failed to sync prediction deletion to Airtable:', airtableError);
          // Don't fail the request if Airtable sync fails
        }
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting prediction:", error);
      res.status(500).json({ message: "Failed to delete prediction" });
    }
  });

  // Categories routes
  app.get('/api/categories', async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', async (req: any, res) => {
    try {
      // Return error since no user authentication
      res.status(401).json({ message: "Authentication required" });
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  // Sync routes (disabled since no auth)
  app.post('/api/sync/predictions', async (req, res) => {
    res.status(401).json({ message: "Authentication required" });
  });

  app.post('/api/sync/categories', async (req, res) => {
    res.status(401).json({ message: "Authentication required" });
  });

  // Test Airtable connection (disabled since no auth)
  app.get('/api/test-airtable', async (req, res) => {
    res.status(401).json({ message: "Authentication required" });
  });

  // Recalculate user stats (disabled since no auth)
  app.post('/api/user/recalculate-stats', async (req: any, res) => {
    res.status(401).json({ message: "Authentication required" });
  });

  // ====================
  // ADMIN ROUTES - Only for whoisworld9@gmail.com
  // ====================
  
  // Check if user is admin
  app.get('/api/admin/check', isAdmin, async (req, res) => {
    res.json({ isAdmin: true });
  });

  // Admin: Get all users
  app.get('/api/admin/users', isAdmin, async (req, res) => {
    try {
      const users = await storage.adminGetAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin: Update any user's display name
  app.patch('/api/admin/users/:userId/display-name', isAdmin, async (req, res) => {
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

  // Admin: Update any prediction (including dates, categories, etc.)
  app.patch('/api/admin/predictions/:id', isAdmin, async (req, res) => {
    try {
      const predictionId = req.params.id;
      const updates = req.body;
      
      // Parse target date if provided
      if (updates.targetDate) {
        updates.targetDate = new Date(updates.targetDate);
      }
      
      // Parse creation date if provided (Admin can modify creation date)
      if (updates.createdAt) {
        updates.createdAt = new Date(updates.createdAt);
      }
      
      const prediction = await storage.adminUpdatePrediction(predictionId, updates);
      if (!prediction) {
        return res.status(404).json({ message: "Prediction not found" });
      }
      
      // Sync updates to Airtable if prediction has an airtableId
      if (prediction.airtableId) {
        try {
          await airtableService.updatePrediction(prediction.airtableId, updates);
          console.log('Admin: Successfully synced prediction update to Airtable');
        } catch (airtableError) {
          console.error('Admin: Failed to sync prediction update to Airtable:', airtableError);
          // Don't fail the request if Airtable sync fails
        }
      }
      
      res.json(prediction);
    } catch (error) {
      console.error("Error updating prediction (admin):", error);
      res.status(500).json({ message: "Failed to update prediction" });
    }
  });

  // Community content endpoints
  app.get("/api/community-content", async (req, res) => {
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

  app.post("/api/community-content", isAdmin, async (req: any, res) => {
    try {
      const content = req.body;
      await storage.saveCommunityContent(content);
      
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving community content:", error);
      res.status(500).json({ message: "Failed to save content" });
    }
  });

  // Admin: Delete any prediction
  app.delete('/api/admin/predictions/:id', isAdmin, async (req, res) => {
    try {
      const predictionId = req.params.id;
      
      // Get prediction first to check for airtableId
      const predictions = await storage.getPredictions(1000, 0); // Get enough to find the prediction
      const targetPrediction = predictions.find(p => p.id === predictionId);
      
      const deleted = await storage.adminDeletePrediction(predictionId);
      if (!deleted) {
        return res.status(404).json({ message: "Prediction not found" });
      }
      
      // Sync deletion to Airtable if prediction had an airtableId
      if (targetPrediction?.airtableId) {
        try {
          await airtableService.deletePrediction(targetPrediction.airtableId);
          console.log('Admin: Successfully synced prediction deletion to Airtable');
        } catch (airtableError) {
          console.error('Admin: Failed to sync prediction deletion to Airtable:', airtableError);
          // Don't fail the request if Airtable sync fails
        }
      }
      
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting prediction (admin):", error);
      res.status(500).json({ message: "Failed to delete prediction" });
    }
  });

  // Admin: Delete any comment
  app.delete('/api/admin/comments/:id', isAdmin, async (req, res) => {
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

  const httpServer = createServer(app);
  return httpServer;
}
