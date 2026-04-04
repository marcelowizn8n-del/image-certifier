import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import bcrypt from "bcryptjs";
import { storage } from "./storage";
import { pool } from "./db";

function requireSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is not set");
  }
  return secret;
}

function ensureSessionTable() {
  (async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS "session" (
          "sid" varchar NOT NULL COLLATE "default",
          "sess" json NOT NULL,
          "expire" timestamp(6) NOT NULL,
          CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
        );
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");`);
    } catch (err) {
      console.error("Failed to ensure session table exists:", err);
    }
  })();
}

export function setupAuth(app: Express) {
  const PgSession = pgSession(session);

  ensureSessionTable();

  app.use(
    session({
      store: new PgSession({
        pool,
        createTableIfMissing: true,
      }),
      secret: requireSessionSecret(),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 * 30,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email", passwordField: "password" },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !user.password) return done(null, false, { message: "Invalid credentials" });

          const ok = await bcrypt.compare(password, user.password);
          if (!ok) return done(null, false, { message: "Invalid credentials" });

          return done(null, { id: user.id, email: user.email, username: user.username, role: user.role, isPremium: user.isPremium });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  // Google OAuth Strategy (only if credentials are configured)
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    const callbackURL = process.env.GOOGLE_CALLBACK_URL || "/api/auth/google/callback";
    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const googleId = profile.id;
            const email = profile.emails?.[0]?.value;
            const displayName = profile.displayName || email?.split("@")[0] || "user";

            if (!email) {
              return done(null, false, { message: "No email from Google" });
            }

            // Check if user already exists by googleId
            let user = await storage.getUserByGoogleId(googleId);
            if (user) {
              return done(null, { id: user.id, email: user.email, username: user.username, role: user.role, isPremium: user.isPremium });
            }

            // Check if user exists by email (link Google account)
            user = await storage.getUserByEmail(email);
            if (user) {
              const { db: dbConn } = await import("./db");
              const { users: usersTable } = await import("@shared/schema");
              const { eq: eqOp } = await import("drizzle-orm");
              await dbConn.update(usersTable).set({ googleId }).where(eqOp(usersTable.id, user.id));
              return done(null, { id: user.id, email: user.email, username: user.username, role: user.role, isPremium: user.isPremium });
            }

            // Create new user - ensure unique username
            let username = displayName;
            const existingUsername = await storage.getUserByEmail(email); // already checked
            // Check if username is taken and make unique
            const allUsers = await storage.getUsers();
            const usernames = new Set(allUsers.map(u => u.username));
            if (usernames.has(username)) {
              let i = 1;
              while (usernames.has(`${username}${i}`)) i++;
              username = `${username}${i}`;
            }

            const newUser = await storage.createUser({
              username,
              email,
              password: null,
              googleId,
            });

            return done(null, { id: newUser.id, email: newUser.email, username: newUser.username, role: newUser.role, isPremium: newUser.isPremium });
          } catch (err) {
            return done(err);
          }
        },
      ),
    );

    // Google OAuth routes
    app.get(
      "/api/auth/google",
      (req, res, next) => {
        // Store the redirect URL in session
        const next_url = (req.query.next as string) || "/analyze";
        (req.session as any).authRedirect = next_url;
        next();
      },
      passport.authenticate("google", { scope: ["profile", "email"] }),
    );

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/auth?error=google" }),
      (req: Request, res: Response) => {
        const redirectUrl = (req.session as any).authRedirect || "/analyze";
        delete (req.session as any).authRedirect;
        res.redirect(redirectUrl);
      },
    );

    console.log("Google OAuth configured");
  } else {
    console.log("Google OAuth not configured (missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET)");
  }

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      return done(null, { id: user.id, email: user.email, username: user.username, role: user.role, isPremium: user.isPremium });
    } catch (err) {
      return done(err);
    }
  });

  app.get("/api/me", (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });
    return res.json(req.user);
  });

  app.post("/api/logout", (req: Request, res: Response, next: NextFunction) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ success: true });
    });
  });

  app.post("/api/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Unauthorized" });

      req.logIn(user, async (err2) => {
        if (err2) return next(err2);

        // Transfer anonymous usage to user account
        try {
          const fingerprint = [
            req.ip || req.socket.remoteAddress || "unknown",
            req.headers["user-agent"] || "unknown",
          ].join("|");
          const crypto = await import("crypto");
          const fp = crypto.createHash("sha256").update(fingerprint).digest("hex");
          await storage.transferAnonymousUsage(fp, user.id);
        } catch (e) {
          console.error("Failed to transfer anonymous usage:", e);
        }

        return res.json(user);
      });
    })(req, res, next);
  });

  app.post("/api/register", async (req: Request, res: Response) => {
    const { username, email, password } = req.body ?? {};

    if (!username || !email || !password) {
      return res.status(400).json({ message: "username, email and password are required" });
    }

    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const existing = await storage.getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await storage.createUser({ username, email, password: hash });

    // Auto-login after register
    const sessionUser = { id: user.id, email: user.email, username: user.username, role: user.role, isPremium: user.isPremium };
    req.logIn(sessionUser, async (err) => {
      if (err) {
        return res.status(201).json(sessionUser);
      }

      // Transfer anonymous usage
      try {
        const fingerprint = [
          req.ip || req.socket.remoteAddress || "unknown",
          req.headers["user-agent"] || "unknown",
        ].join("|");
        const crypto = await import("crypto");
        const fp = crypto.createHash("sha256").update(fingerprint).digest("hex");
        await storage.transferAnonymousUsage(fp, user.id);
      } catch (e) {
        console.error("Failed to transfer anonymous usage:", e);
      }

      return res.status(201).json(sessionUser);
    });
  });
}
