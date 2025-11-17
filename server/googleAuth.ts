import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth credentials not provided");
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || "guessometer-session-secret-dev",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function setupGoogleAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Google OAuth Strategy
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: "/api/auth/google/callback",
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Extract user info from Google profile
          const googleUser = {
            id: profile.id,
            email: profile.emails?.[0]?.value || "",
            displayName: profile.displayName || "",
            firstName: profile.name?.givenName || "",
            lastName: profile.name?.familyName || "",
            profileImageUrl: profile.photos?.[0]?.value || "",
          };

          // Upsert user in our database
          const user = await storage.upsertUser({
            id: googleUser.id,
            email: googleUser.email,
            displayName: googleUser.displayName,
            firstName: googleUser.firstName,
            lastName: googleUser.lastName,
            profileImageUrl: googleUser.profileImageUrl,
          });

          // TODO: Store Google tokens for logout revocation
          // For now, we'll store them in the user session for revocation during logout
          const userWithTokens = {
            ...user,
            accessToken,
            refreshToken
          };

          return done(null, userWithTokens);
        } catch (error) {
          return done(error, undefined);
        }
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        // User not found - this could happen if user was deleted
        // Return null (no error) to gracefully handle missing users
        return done(null, null);
      }
      done(null, user);
    } catch (error) {
      console.error("Error deserializing user:", error);
      // Return null instead of error to prevent session crashes
      done(null, null);
    }
  });

  // Google OAuth routes
  app.get(
    "/api/auth/google",
    passport.authenticate("google", { 
      scope: ["profile", "email"],
      prompt: "select_account" // Force Google account selection dialog
    })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { 
      failureRedirect: "/",
      successRedirect: "/dashboard"
    })
  );

  app.get("/api/auth/logout", async (req: any, res) => {
    console.log("Logout attempt for user:", req.user ? 'authenticated' : 'not authenticated');
    
    // Step 1: Revoke Google tokens if available
    try {
      if (req.user && req.user.accessToken) {
        console.log("Revoking Google access token...");
        // Revoke Google access token
        const revokeUrl = `https://oauth2.googleapis.com/revoke?token=${req.user.accessToken}`;
        await fetch(revokeUrl, { method: 'POST' });
        console.log("Google access token revoked successfully");
      }
    } catch (error) {
      console.error("Error revoking Google token:", error);
      // Continue with logout even if token revocation fails
    }
    
    // Step 2: Logout from Passport
    req.logout(function(err: any) {
      if (err) {
        console.error("Passport logout error:", err);
        return res.redirect("/");
      }
      
      console.log("User logged out from Passport, destroying session...");
      
      // Step 3: Destroy Express session
      req.session.destroy(function(err: any) {
        if (err) {
          console.error("Session destruction error:", err);
        }
        
        const isProduction = process.env.NODE_ENV === 'production';
        const cookieOptions = {
          path: "/",
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax' as const,
          domain: undefined // Let browser determine domain
        };
        
        // Step 4: Clear all authentication-related cookies comprehensively
        // Default express-session cookie name
        res.clearCookie("connect.sid", cookieOptions);
        
        // Clear any custom session cookies
        res.clearCookie("guessometer_session", cookieOptions);
        res.clearCookie("session", cookieOptions);
        res.clearCookie("sid", cookieOptions);
        
        // Clear any potential OAuth/auth cookies
        res.clearCookie("oauth_state", cookieOptions);
        res.clearCookie("oauth_verifier", cookieOptions);
        res.clearCookie("auth_token", cookieOptions);
        
        // Step 5: Set cache control headers to prevent back button issues
        res.set({
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        
        console.log(`Complete logout finished for ${isProduction ? 'production' : 'development'}`);
        console.log("Session destroyed, tokens revoked, and all cookies cleared");
        
        res.redirect("/");
      });
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Unauthorized" });
};

// Admin middleware - checks if the authenticated user is the admin
export const isAdmin: RequestHandler = (req: any, res, next) => {
  // First check if user is authenticated
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  // Check if the user's email matches the admin email
  const adminEmail = "whoisworld9@gmail.com";
  if (req.user.email !== adminEmail) {
    console.log(`Admin access denied for email: ${req.user.email}`);
    return res.status(403).json({ message: "Admin access required" });
  }

  console.log(`Admin access granted for email: ${req.user.email}`);
  next();
};