import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from "ws";

// Source database (the one with correct data)
const SOURCE_DB = 'postgresql://neondb_owner:npg_x46dCoBhsYIT@ep-spring-glade-afkldm4q.c-2.us-west-2.aws.neon.tech/neondb?sslmode=require';

// Target database (production)
const TARGET_DB = process.env.DATABASE_URL;

async function migrateData() {
  console.log('🚀 Starting data migration...');
  
  // Configure WebSocket for both connections
  neonConfig.webSocketConstructor = ws;
  
  const sourcePool = new Pool({ connectionString: SOURCE_DB });
  const targetPool = new Pool({ connectionString: TARGET_DB });
  
  try {
    // 1. Copy Users
    console.log('📋 Copying users...');
    const users = await sourcePool.query('SELECT * FROM users');
    
    for (const user of users.rows) {
      await targetPool.query(`
        INSERT INTO users (id, email, "firstName", "lastName", "displayName", "profileImageUrl", "createdAt", "updatedAt") 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          "firstName" = EXCLUDED."firstName",
          "lastName" = EXCLUDED."lastName", 
          "displayName" = EXCLUDED."displayName",
          "profileImageUrl" = EXCLUDED."profileImageUrl",
          "updatedAt" = EXCLUDED."updatedAt"
      `, [user.id, user.email, user.firstName, user.lastName, user.displayName, user.profileImageUrl, user.createdAt, user.updatedAt]);
    }
    console.log(`✅ Copied ${users.rows.length} users`);
    
    // 2. Copy Categories  
    console.log('📂 Copying categories...');
    const categories = await sourcePool.query('SELECT * FROM categories');
    
    for (const category of categories.rows) {
      await targetPool.query(`
        INSERT INTO categories (id, name, description, "createdAt") 
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description
      `, [category.id, category.name, category.description, category.createdAt]);
    }
    console.log(`✅ Copied ${categories.rows.length} categories`);
    
    // 3. Copy Predictions
    console.log('🔮 Copying predictions...');
    const predictions = await sourcePool.query('SELECT * FROM predictions');
    
    for (const prediction of predictions.rows) {
      await targetPool.query(`
        INSERT INTO predictions (id, "airtableId", "userId", "predictionText", description, "confidenceLevel", "targetDate", outcome, accuracy, "categoryId", tags, "imageUrl", "isPublic", "createdAt", "updatedAt") 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id) DO UPDATE SET
          "predictionText" = EXCLUDED."predictionText",
          description = EXCLUDED.description,
          "confidenceLevel" = EXCLUDED."confidenceLevel",
          "targetDate" = EXCLUDED."targetDate",
          outcome = EXCLUDED.outcome,
          accuracy = EXCLUDED.accuracy,
          "categoryId" = EXCLUDED."categoryId",
          tags = EXCLUDED.tags,
          "imageUrl" = EXCLUDED."imageUrl",
          "isPublic" = EXCLUDED."isPublic",
          "updatedAt" = EXCLUDED."updatedAt"
      `, [prediction.id, prediction.airtableId, prediction.userId, prediction.predictionText, prediction.description, prediction.confidenceLevel, prediction.targetDate, prediction.outcome, prediction.accuracy, prediction.categoryId, prediction.tags, prediction.imageUrl, prediction.isPublic, prediction.createdAt, prediction.updatedAt]);
    }
    console.log(`✅ Copied ${predictions.rows.length} predictions`);
    
    // 4. Copy other data (likes, comments, stats, etc.)
    console.log('📊 Copying additional data...');
    
    // User stats
    const userStats = await sourcePool.query('SELECT * FROM "userStats"');
    for (const stat of userStats.rows) {
      await targetPool.query(`
        INSERT INTO "userStats" (id, "userId", "totalPredictions", "correctPredictions", accuracy, "averageConfidence", "longestStreak", "currentStreak", "lastUpdated") 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (id) DO UPDATE SET
          "totalPredictions" = EXCLUDED."totalPredictions",
          "correctPredictions" = EXCLUDED."correctPredictions",
          accuracy = EXCLUDED.accuracy,
          "averageConfidence" = EXCLUDED."averageConfidence",
          "longestStreak" = EXCLUDED."longestStreak",
          "currentStreak" = EXCLUDED."currentStreak",
          "lastUpdated" = EXCLUDED."lastUpdated"
      `, [stat.id, stat.userId, stat.totalPredictions, stat.correctPredictions, stat.accuracy, stat.averageConfidence, stat.longestStreak, stat.currentStreak, stat.lastUpdated]);
    }
    console.log(`✅ Copied ${userStats.rows.length} user stats`);
    
    console.log('🎉 Data migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }
}

migrateData().catch(console.error);