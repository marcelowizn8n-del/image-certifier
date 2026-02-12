import type { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import pgSession from "connect-pg-simple";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
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
          if (!user) return done(null, false, { message: "Invalid credentials" });

          const ok = await bcrypt.compare(password, user.password);
          if (!ok) return done(null, false, { message: "Invalid credentials" });

          return done(null, { id: user.id, email: user.email, isPremium: user.isPremium });
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user: any, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) return done(null, false);
      return done(null, { id: user.id, email: user.email, isPremium: user.isPremium });
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
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: info?.message || "Unauthorized" });

      req.logIn(user, (err2) => {
        if (err2) return next(err2);
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

    return res.status(201).json({ id: user.id, email: user.email, isPremium: user.isPremium });
  });
}
