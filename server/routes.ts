import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  analyzeImageSchema, analyzeUrlSchema, updateUserSchema, analyzeVideoSchema,
  type VideoAnalysisResult, FREE_ANALYSIS_LIMIT, type AnalysisResult,
  apiKeys, apiKeyUsageMonthly
} from "@shared/schema";
import { mercadoPagoService } from "./mercadoPagoService";
import { getMercadoPagoPublicKey } from "./mercadoPagoClient";
import { mpPlans, mpSubscriptions } from "@shared/schema";
import { db } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { analysisFeedback } from "@shared/schema";
import { isVideoAnalysisConfigured } from "./videoAnalysisClient";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { spawn } from "child_process";
import { promises as fsPromises } from "fs";
import path from "path";
import os from "os";
import { analyzeImageAdvanced } from "./services/analysisService";
import { processVideoAnalysis } from "./services/videoService";
import { appleService } from "./services/appleService";
import { googlePlayService } from "./services/googlePlayService";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.id) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  return next();
}

// YouTube URL patterns and thumbnail extraction
const YOUTUBE_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
  /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

const INSTAGRAM_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/,
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/reel\/([a-zA-Z0-9_-]+)/,
];

function extractYouTubeVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}

const FACEBOOK_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/.+\/photos?\//,
  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/photo/,
  /(?:https?:\/\/)?(?:www\.)?facebook\.com\/.+\/posts?\//,
  /(?:https?:\/\/)?(?:www\.)?fb\.watch\//,
];

const LINKEDIN_PATTERNS = [
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/posts?\//,
  /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/feed\//,
];

function isInstagramUrl(url: string): boolean {
  return INSTAGRAM_PATTERNS.some(pattern => pattern.test(url));
}

function isFacebookUrl(url: string): boolean {
  return FACEBOOK_PATTERNS.some(pattern => pattern.test(url));
}

function isLinkedInUrl(url: string): boolean {
  return LINKEDIN_PATTERNS.some(pattern => pattern.test(url));
}

function isSocialMediaUrl(url: string): boolean {
  return isInstagramUrl(url) || isFacebookUrl(url) || isLinkedInUrl(url);
}

function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
}

/**
 * Try to extract og:image from a social media URL page HTML.
 */
async function extractOgImage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ImageCertifier/1.0)',
      },
      redirect: 'follow',
    });
    if (!response.ok) return null;

    const html = await response.text();
    // Match og:image meta tag
    const ogMatch = html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]+)"/i)
      || html.match(/<meta\s+content="([^"]+)"\s+(?:property|name)="og:image"/i);

    if (ogMatch && ogMatch[1]) {
      return ogMatch[1].replace(/&amp;/g, '&');
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Try to get Instagram image via oEmbed API.
 */
async function extractInstagramImage(url: string): Promise<string | null> {
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl);
    if (!response.ok) return null;

    const data = await response.json() as any;
    return data.thumbnail_url || null;
  } catch {
    // oEmbed may fail for private posts; fall back to og:image
    return extractOgImage(url);
  }
}

/**
 * Download YouTube video using yt-dlp (max 30s, 720p, 50MB).
 * Returns the video buffer or null if download fails.
 */
async function downloadYouTubeVideo(videoId: string): Promise<Buffer | null> {
  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), 'yt-'));
  const outputPath = path.join(tempDir, 'video.mp4');

  try {
    return await new Promise<Buffer | null>((resolve) => {
      const ytdlp = spawn('yt-dlp', [
        `https://www.youtube.com/watch?v=${videoId}`,
        '-f', 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best',
        '--max-filesize', '50M',
        '--download-sections', '*0-30',
        '-o', outputPath,
        '--no-playlist',
        '--quiet',
      ]);

      const timeout = setTimeout(() => {
        ytdlp.kill();
        resolve(null);
      }, 60000); // 60s timeout

      ytdlp.on('close', async (code) => {
        clearTimeout(timeout);
        try {
          if (code === 0) {
            const buffer = await fsPromises.readFile(outputPath);
            resolve(buffer);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });

      ytdlp.on('error', () => {
        clearTimeout(timeout);
        resolve(null);
      });
    });
  } finally {
    // Cleanup
    try {
      const files = await fsPromises.readdir(tempDir);
      for (const f of files) {
        await fsPromises.unlink(path.join(tempDir, f)).catch(() => {});
      }
      await fsPromises.rmdir(tempDir).catch(() => {});
    } catch {}
  }
}

// Generate fingerprint from request for freemium tracking
function getFingerprint(req: Request): string {
  const cfIp = req.headers['cf-connecting-ip'];
  const realIp = req.headers['x-real-ip'];
  const forwardedFor = req.headers['x-forwarded-for'];

  const forwardedIp =
    typeof forwardedFor === 'string'
      ? forwardedFor.split(',')[0]?.trim()
      : Array.isArray(forwardedFor)
        ? forwardedFor[0]?.split(',')[0]?.trim()
        : undefined;

  const headerIp =
    (typeof cfIp === 'string' && cfIp.trim()) ||
    (typeof realIp === 'string' && realIp.trim()) ||
    forwardedIp;

  const ip = headerIp || req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const data = `${ip}-${userAgent}`;
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 32);
}

// Admin authentication middleware
const ADMIN_SECRET = process.env.ADMIN_SECRET;

if (!ADMIN_SECRET) {
  console.error('ADMIN_SECRET environment variable is not set. Admin endpoints will be unavailable.');
} else {
  console.log(
    `Admin auth configured (len=${ADMIN_SECRET.length}, sha256=${crypto
      .createHash("sha256")
      .update(ADMIN_SECRET)
      .digest("hex")
      .slice(0, 8)})`,
  );
}

const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Allow logged-in admin users
  const user = req.user as any;
  if (user?.role === "admin") {
    return next();
  }

  // Fallback to admin key header
  if (ADMIN_SECRET) {
    const adminKey = req.headers['x-admin-key'] as string;
    if (adminKey && adminKey === ADMIN_SECRET) {
      return next();
    }
  }

  return res.status(401).json({ message: "Unauthorized - Admin access required" });
};

const API_RATE_LIMIT_PER_MINUTE = 60;
const API_DEFAULT_MONTHLY_QUOTA = 5000;
const API_MONTHLY_QUOTA_BY_PLAN = {
  basic: 1000,
  premium: 10000,
} as const;
const apiRateLimitBuckets = new Map<string, { windowStartMs: number; count: number }>();

function getYearMonth(d: Date) {
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function hashApiKey(rawKey: string) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

async function authenticateApiKey(req: Request) {
  const xApiKeyHeader = req.headers["x-api-key"];
  const authHeader = req.headers["authorization"];

  let rawKey: string | null = null;
  if (typeof xApiKeyHeader === "string" && xApiKeyHeader.trim()) {
    rawKey = xApiKeyHeader.trim();
  } else if (typeof authHeader === "string" && authHeader.trim()) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token?.trim()) {
      rawKey = token.trim();
    }
  }

  if (!rawKey) return null;

  const keyHash = hashApiKey(rawKey);
  const [keyRow] = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1);
  if (!keyRow || !keyRow.isActive || keyRow.revokedAt) return null;
  return keyRow;
}

function enforceRateLimit(apiKeyId: string) {
  const now = Date.now();
  const bucket = apiRateLimitBuckets.get(apiKeyId);
  if (!bucket || now - bucket.windowStartMs >= 60_000) {
    apiRateLimitBuckets.set(apiKeyId, { windowStartMs: now, count: 1 });
    return { allowed: true as const };
  }
  if (bucket.count >= API_RATE_LIMIT_PER_MINUTE) {
    return { allowed: false as const, retryAfterSeconds: Math.ceil((60_000 - (now - bucket.windowStartMs)) / 1000) };
  }
  bucket.count += 1;
  return { allowed: true as const };
}

async function enforceMonthlyQuota(apiKeyId: string) {
  const yearMonth = getYearMonth(new Date());

  const [keyRow] = await db.select().from(apiKeys).where(eq(apiKeys.id, apiKeyId)).limit(1);
  if (!keyRow || !keyRow.isActive || keyRow.revokedAt) {
    return { allowed: false as const, error: "API_KEY_INACTIVE" };
  }

  const quota = keyRow.monthlyQuota ?? API_DEFAULT_MONTHLY_QUOTA;

  const [usageRow] = await db
    .select()
    .from(apiKeyUsageMonthly)
    .where(and(eq(apiKeyUsageMonthly.apiKeyId, apiKeyId), eq(apiKeyUsageMonthly.yearMonth, yearMonth)))
    .limit(1);

  const used = usageRow?.count ?? 0;
  if (used >= quota) {
    return { allowed: false as const, error: "API_QUOTA_EXCEEDED", used, quota };
  }

  return { allowed: true as const, yearMonth, used, quota };
}

async function incrementMonthlyUsage(apiKeyId: string, yearMonth: string) {
  const [existing] = await db
    .select()
    .from(apiKeyUsageMonthly)
    .where(and(eq(apiKeyUsageMonthly.apiKeyId, apiKeyId), eq(apiKeyUsageMonthly.yearMonth, yearMonth)))
    .limit(1);

  if (existing) {
    await db
      .update(apiKeyUsageMonthly)
      .set({ count: existing.count + 1, updatedAt: new Date() })
      .where(eq(apiKeyUsageMonthly.id, existing.id));
    return;
  }

  await db.insert(apiKeyUsageMonthly).values({
    apiKeyId,
    yearMonth,
    count: 1,
    updatedAt: new Date(),
  });
}

async function fetchImageFromUrl(url: string): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "ImageCertifier/1.0 (+https://imgcertifier.app)",
        accept: "image/*,*/*;q=0.8",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}



export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/admin/api-keys", adminAuthMiddleware, async (req, res) => {
    try {
      const { name, monthlyQuota, plan } = req.body ?? {};
      if (!name || typeof name !== "string") {
        return res.status(400).json({ message: "name is required" });
      }

      const planKey = typeof plan === "string" && plan.trim() ? plan.trim().toLowerCase() : null;
      if (planKey && planKey !== "enterprise" && !(planKey in API_MONTHLY_QUOTA_BY_PLAN)) {
        return res.status(400).json({ message: "Invalid plan", allowedPlans: [...Object.keys(API_MONTHLY_QUOTA_BY_PLAN), "enterprise"] });
      }

      const hasExplicitQuota = typeof monthlyQuota === "number" && Number.isFinite(monthlyQuota) && monthlyQuota > 0;
      if (planKey === "enterprise" && !hasExplicitQuota) {
        return res.status(400).json({
          message: "monthlyQuota is required for enterprise plan",
          example: { name: "Cliente Enterprise", plan: "enterprise", monthlyQuota: 50000 },
        });
      }

      const quota =
        hasExplicitQuota
          ? Math.floor(monthlyQuota)
          : planKey
            ? API_MONTHLY_QUOTA_BY_PLAN[planKey as keyof typeof API_MONTHLY_QUOTA_BY_PLAN]
            : API_DEFAULT_MONTHLY_QUOTA;

      const rawKey = crypto.randomBytes(24).toString("base64url");
      const keyHash = hashApiKey(rawKey);

      const [created] = await db
        .insert(apiKeys)
        .values({ name, keyHash, monthlyQuota: quota, isActive: true })
        .returning();

      return res.status(201).json({
        id: created.id,
        name: created.name,
        monthlyQuota: created.monthlyQuota,
        apiKey: rawKey,
      });
    } catch (error: any) {
      console.error("Error creating API key:", error);
      return res.status(500).json({ message: error?.message || "Failed to create API key" });
    }
  });

  app.post("/api/admin/api-keys/:id/revoke", adminAuthMiddleware, async (req, res) => {
    try {
      const id = String(req.params.id);
      const [updated] = await db
        .update(apiKeys)
        .set({ isActive: false, revokedAt: new Date() })
        .where(eq(apiKeys.id, id))
        .returning();

      if (!updated) {
        return res.status(404).json({ message: "API key not found" });
      }
      return res.json({ success: true });
    } catch (error: any) {
      console.error("Error revoking API key:", error);
      return res.status(500).json({ message: error?.message || "Failed to revoke API key" });
    }
  });

  app.get("/api/admin/api-keys", adminAuthMiddleware, async (req, res) => {
    try {
      const keys = await db.select({
        id: apiKeys.id,
        name: apiKeys.name,
        monthlyQuota: apiKeys.monthlyQuota,
        isActive: apiKeys.isActive,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
      }).from(apiKeys);

      const yearMonth = getYearMonth(new Date());
      const usage = await db.select().from(apiKeyUsageMonthly).where(eq(apiKeyUsageMonthly.yearMonth, yearMonth));

      const usageByKey = new Map<string, number>();
      for (const u of usage) usageByKey.set(u.apiKeyId, u.count);

      return res.json({
        yearMonth,
        data: keys.map((k) => ({ ...k, usedThisMonth: usageByKey.get(k.id) ?? 0 })),
      });
    } catch (error: any) {
      console.error("Error listing API keys:", error);
      return res.status(500).json({ message: error?.message || "Failed to list API keys" });
    }
  });

  app.post("/api/admin/reset-password", adminAuthMiddleware, async (req, res) => {
    try {
      const { email, password } = req.body ?? {};

      if (!email || !password) {
        return res.status(400).json({ message: "email and password are required" });
      }

      if (typeof password !== "string" || password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const user = await storage.getUserByEmail(String(email));
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const hash = await bcrypt.hash(String(password), 10);
      await storage.updateUser(user.id, { password: hash });

      return res.json({ success: true });
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.get("/api/admin/analysis-feedback", adminAuthMiddleware, async (req, res) => {
    try {
      const { analysisId } = (req.query ?? {}) as { analysisId?: string };
      if (analysisId) {
        const rows = await db.select().from(analysisFeedback).where(sql`${analysisFeedback.analysisId} = ${analysisId}`);
        return res.json({ data: rows });
      }
      const rows = await db.select().from(analysisFeedback).orderBy(sql`${analysisFeedback.updatedAt} DESC`);
      return res.json({ data: rows });
    } catch (error) {
      console.error("Error fetching analysis feedback:", error);
      return res.status(500).json({ message: "Failed to fetch analysis feedback" });
    }
  });

  app.post("/api/admin/analysis-feedback", adminAuthMiddleware, async (req, res) => {
    try {
      const { analysisId, correctLabel, notes } = req.body ?? {};
      if (!analysisId || !correctLabel) {
        return res.status(400).json({ message: "analysisId and correctLabel are required" });
      }

      const allowed = ["original", "ai_generated", "ai_modified", "uncertain"] as const;
      if (!allowed.includes(correctLabel)) {
        return res.status(400).json({ message: "Invalid correctLabel" });
      }

      const values = {
        analysisId: String(analysisId),
        correctLabel,
        notes: notes ? String(notes) : null,
        updatedAt: new Date(),
      };

      const [saved] = await db
        .insert(analysisFeedback)
        .values(values as any)
        .onConflictDoUpdate({
          target: analysisFeedback.analysisId,
          set: values as any,
        })
        .returning();

      return res.json({ success: true, feedback: saved });
    } catch (error) {
      console.error("Error saving analysis feedback:", error);
      return res.status(500).json({ message: "Failed to save analysis feedback" });
    }
  });

  // Get all analyses
  app.get("/api/analyses", async (req, res) => {
    try {
      const analyses = await storage.getAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching analyses:", error);
      res.status(500).json({ message: "Failed to fetch analyses" });
    }
  });

  // Get single analysis
  app.get("/api/analyses/:id", async (req, res) => {
    try {
      const analysis = await storage.getAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching analysis:", error);
      res.status(500).json({ message: "Failed to fetch analysis" });
    }
  });

  // Helper: check usage limit (user-based if logged in, fingerprint otherwise)
  async function checkUsageLimit(req: Request): Promise<{ allowed: boolean; remaining: number; limit: number; isUser: boolean }> {
    const user = req.user as any;
    if (user?.id) {
      const fullUser = await storage.getUser(user.id);
      if (fullUser?.role === "admin" || fullUser?.isPremium || fullUser?.isFreeAccount) {
        return { allowed: true, remaining: 999999, limit: 999999, isUser: true };
      }
      const status = await storage.canUserAnalyze(user.id);
      return { allowed: status.allowed, remaining: status.remaining, limit: status.total, isUser: true };
    }
    const fingerprint = getFingerprint(req);
    const status = await storage.canAnalyze(fingerprint);
    return { allowed: status.allowed, remaining: status.remaining, limit: FREE_ANALYSIS_LIMIT, isUser: false };
  }

  async function incrementUsage(req: Request): Promise<{ remaining: number; limit: number }> {
    const user = req.user as any;
    if (user?.id) {
      const fullUser = await storage.getUser(user.id);
      if (fullUser?.role === "admin" || fullUser?.isPremium || fullUser?.isFreeAccount) {
        return { remaining: 999999, limit: 999999 };
      }
      await storage.incrementUserUsage(user.id);
      const status = await storage.canUserAnalyze(user.id);
      return { remaining: status.remaining, limit: status.total };
    }
    const fingerprint = getFingerprint(req);
    await storage.incrementAnonymousUsage(fingerprint);
    const status = await storage.canAnalyze(fingerprint);
    return { remaining: status.remaining, limit: FREE_ANALYSIS_LIMIT };
  }

  // Check freemium usage status
  app.get("/api/usage", async (req, res) => {
    try {
      const status = await checkUsageLimit(req);
      res.json({
        allowed: status.allowed,
        remaining: status.remaining,
        limit: status.limit,
        used: status.limit - status.remaining,
      });
    } catch (error) {
      console.error("Error checking usage:", error);
      res.status(500).json({ message: "Failed to check usage" });
    }
  });

  // Analyze image from base64 data
  app.post("/api/analyze", async (req, res) => {
    try {
      // Check limit (user-based or anonymous)
      const usageCheck = await checkUsageLimit(req);

      if (!usageCheck.allowed) {
        return res.status(403).json({
          message: "Limite gratuito atingido",
          error: "FREE_LIMIT_EXCEEDED",
          remaining: 0,
          limit: usageCheck.limit,
          upgradeUrl: "/auth?next=/pricing"
        });
      }

      const parsed = analyzeImageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }

      const { imageData, filename } = parsed.data;

      // Perform advanced multi-layer analysis
      console.log("Starting image analysis for:", filename);
      const analysisResult = await analyzeImageAdvanced(imageData, filename);
      console.log("Analysis complete:", { result: analysisResult.result, confidence: analysisResult.confidence });

      // Increment usage count
      const usage = await incrementUsage(req);

      // Save to storage
      const analysis = await storage.createAnalysis({
        filename,
        result: analysisResult.result,
        confidence: analysisResult.confidence,
        artifacts: analysisResult.artifacts,
        metadata: analysisResult.metadata,
        debugScores: analysisResult.debugScores,
        imageData: imageData.length < 500000 ? imageData : undefined,
      });

      console.log("Returning analysis:", { id: analysis.id, result: analysis.result, confidence: analysis.confidence });
      res.json({
        ...analysis,
        usage,
      });
    } catch (error) {
      console.error("Error analyzing image:", error);
      res.status(500).json({ message: "Failed to analyze image" });
    }
  });

  app.post("/api/v1/analyze", async (req, res) => {
    try {
      const apiKey = await authenticateApiKey(req);
      if (!apiKey) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rate = enforceRateLimit(apiKey.id);
      if (!rate.allowed) {
        res.setHeader("Retry-After", String(rate.retryAfterSeconds));
        return res.status(429).json({ message: "Rate limit exceeded" });
      }

      const quota = await enforceMonthlyQuota(apiKey.id);
      if (!quota.allowed) {
        return res.status(403).json({ message: "Quota exceeded", error: quota.error, used: quota.used, quota: quota.quota });
      }

      const parsed = analyzeImageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }

      const { imageData, filename } = parsed.data;

      const analysisResult = await analyzeImageAdvanced(imageData, filename);

      await incrementMonthlyUsage(apiKey.id, quota.yearMonth);

      const analysis = await storage.createAnalysis({
        filename,
        result: analysisResult.result,
        confidence: analysisResult.confidence,
        artifacts: analysisResult.artifacts,
        metadata: analysisResult.metadata,
        debugScores: analysisResult.debugScores,
        imageData: imageData.length < 500000 ? imageData : undefined,
      });

      return res.json({
        ...analysis,
        apiUsage: {
          yearMonth: quota.yearMonth,
          used: (quota.used ?? 0) + 1,
          quota: quota.quota,
        },
      });
    } catch (error) {
      console.error("Error analyzing image (API v1):", error);
      return res.status(500).json({ message: "Failed to analyze image" });
    }
  });

  // Analyze image from URL
  app.post("/api/analyze-url", async (req, res) => {
    try {
      // Check limit (user-based or anonymous)
      const usageCheck = await checkUsageLimit(req);

      if (!usageCheck.allowed) {
        return res.status(403).json({
          message: "Limite gratuito atingido",
          error: "FREE_LIMIT_EXCEEDED",
          remaining: 0,
          limit: usageCheck.limit,
          upgradeUrl: "/auth?next=/pricing"
        });
      }

      const parsed = analyzeUrlSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid URL", errors: parsed.error.errors });
      }

      let { url } = parsed.data;
      console.log("Analyzing image from URL:", url);

      // Check for YouTube URLs - try to download actual video for analysis
      const youtubeVideoId = extractYouTubeVideoId(url);
      if (youtubeVideoId) {
        console.log("YouTube video detected, attempting video download:", youtubeVideoId);

        const videoBuffer = await downloadYouTubeVideo(youtubeVideoId);
        if (videoBuffer && videoBuffer.length > 0) {
          console.log(`YouTube video downloaded: ${(videoBuffer.length / 1024 / 1024).toFixed(1)}MB`);

          try {
            const videoResult = await processVideoAnalysis(videoBuffer, `youtube-${youtubeVideoId}.mp4`);

            const usage = await incrementUsage(req);

            const videoAnalysis = await storage.createVideoAnalysis({
              filename: `youtube-${youtubeVideoId}.mp4`,
              result: videoResult.result,
              confidence: videoResult.confidence,
              manipulationScore: videoResult.manipulationScore,
              indicators: videoResult.indicators,
              metadata: { duration: 30, width: 1280, height: 720, format: 'mp4', size: videoBuffer.length },
            });

            return res.json({
              ...videoAnalysis,
              youtubeVideoId,
              analysisType: 'video',
              usage,
            });
          } catch (videoErr) {
            console.error("Video analysis failed, falling back to thumbnail:", videoErr);
          }
        } else {
          console.log("yt-dlp not available or download failed, falling back to thumbnail");
        }

        // Fallback: analyze thumbnail
        url = getYouTubeThumbnailUrl(youtubeVideoId);
      }

      // Social media URL handling (Instagram, Facebook, LinkedIn)
      if (isSocialMediaUrl(url)) {
        console.log("Social media URL detected, extracting image:", url);
        let imageUrl: string | null = null;

        if (isInstagramUrl(url)) {
          imageUrl = await extractInstagramImage(url);
        }

        if (!imageUrl) {
          imageUrl = await extractOgImage(url);
        }

        if (imageUrl) {
          console.log("Extracted social media image URL:", imageUrl);
          url = imageUrl;
        } else {
          return res.status(400).json({
            message: "Não foi possível extrair a imagem desta URL. Tente:\n\n1. Abrir a imagem diretamente\n2. Salvar a imagem no dispositivo\n3. Fazer upload usando a opção 'Arquivo'",
            error: "SOCIAL_MEDIA_IMAGE_NOT_FOUND",
            suggestion: "save_image",
          });
        }
      }

      // Fetch image from URL
      const response = await fetch(url);
      if (!response.ok) {
        // If YouTube thumbnail fails, try hqdefault
        if (youtubeVideoId) {
          const fallbackUrl = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
          const fallbackResponse = await fetch(fallbackUrl);
          if (fallbackResponse.ok) {
            const contentType = fallbackResponse.headers.get("content-type");
            const arrayBuffer = await fallbackResponse.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            const imageData = `data:${contentType};base64,${base64}`;
            const filename = `youtube-thumbnail-${youtubeVideoId}.jpg`;

            console.log("Using YouTube hqdefault thumbnail");
            const analysisResult = await analyzeImageAdvanced(imageData, filename);

            const ytUsage = await incrementUsage(req);

            const analysis = await storage.createAnalysis({
              filename,
              result: analysisResult.result,
              confidence: analysisResult.confidence,
              artifacts: analysisResult.artifacts,
              metadata: analysisResult.metadata,
              debugScores: analysisResult.debugScores,
              imageData: imageData.length < 500000 ? imageData : undefined,
            });

            return res.json({
              ...analysis,
              youtubeVideoId,
              analysisType: 'thumbnail',
              usage: ytUsage
            });
          }
          return res.status(400).json({
            message: "Não foi possível obter a thumbnail do vídeo do YouTube. O vídeo pode não existir, ter sido removido, ou estar privado.",
            error: "YOUTUBE_THUMBNAIL_NOT_FOUND"
          });
        }
        return res.status(400).json({
          message: "Failed to fetch image from URL",
          error: "FETCH_NOT_OK",
          status: response.status,
        });
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.startsWith("image/")) {
        return res.status(400).json({ message: "URL does not point to an image. Please provide a direct image URL (ending in .jpg, .png, etc.)" });
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const imageData = `data:${contentType};base64,${base64}`;

      // Extract filename from URL
      const urlParts = url.split("/");
      const filename = urlParts[urlParts.length - 1] || "image-from-url";

      // Perform advanced multi-layer analysis
      console.log("Starting URL image analysis for:", filename);
      const analysisResult = await analyzeImageAdvanced(imageData, filename);
      console.log("URL analysis complete:", { result: analysisResult.result, confidence: analysisResult.confidence });

      // Increment usage count
      const urlUsage = await incrementUsage(req);

      // Save to storage
      const analysis = await storage.createAnalysis({
        filename,
        result: analysisResult.result,
        confidence: analysisResult.confidence,
        artifacts: analysisResult.artifacts,
        metadata: analysisResult.metadata,
        debugScores: analysisResult.debugScores,
        imageData: imageData.length < 500000 ? imageData : undefined,
      });

      console.log("URL analysis returning:", { id: analysis.id, result: analysis.result, confidence: analysis.confidence });
      res.json({
        ...analysis,
        usage: urlUsage,
      });
    } catch (error) {
      console.error("Error analyzing URL:", error);
      res.status(500).json({ message: "Failed to analyze image from URL" });
    }
  });

  app.post("/api/v1/analyze-url", async (req, res) => {
    try {
      const apiKey = await authenticateApiKey(req);
      if (!apiKey) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const rate = enforceRateLimit(apiKey.id);
      if (!rate.allowed) {
        res.setHeader("Retry-After", String(rate.retryAfterSeconds));
        return res.status(429).json({ message: "Rate limit exceeded" });
      }

      const quota = await enforceMonthlyQuota(apiKey.id);
      if (!quota.allowed) {
        return res.status(403).json({ message: "Quota exceeded", error: quota.error, used: quota.used, quota: quota.quota });
      }

      const parsed = analyzeUrlSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid URL", errors: parsed.error.errors });
      }

      let { url } = parsed.data;
      console.log("API v1 analyzing image from URL:", url);

      if (isInstagramUrl(url)) {
        return res.status(400).json({
          message:
            "Links do Instagram não são suportados diretamente. Para analisar uma imagem do Instagram:\n\n1. Abra a imagem no Instagram\n2. Toque nos três pontos (...)\n3. Selecione 'Salvar' ou faça uma captura de tela\n4. Use a opção 'Arquivo' para fazer upload da imagem salva",
          error: "INSTAGRAM_NOT_SUPPORTED",
          suggestion: "save_image",
        });
      }

      const youtubeVideoId = extractYouTubeVideoId(url);
      let isYouTubeThumbnail = false;
      if (youtubeVideoId) {
        url = getYouTubeThumbnailUrl(youtubeVideoId);
        isYouTubeThumbnail = true;
      }

      let response: globalThis.Response;
      try {
        response = await fetchImageFromUrl(url);
      } catch (err: any) {
        return res.status(502).json({
          message: "Failed to fetch image from URL",
          error: "FETCH_FAILED",
          details: err?.name === "AbortError" ? "Request timed out" : (err?.message || String(err)),
        });
      }
      if (!response.ok) {
        if (isYouTubeThumbnail && youtubeVideoId) {
          const fallbackUrl = `https://img.youtube.com/vi/${youtubeVideoId}/hqdefault.jpg`;
          let fallbackResponse: globalThis.Response;
          try {
            fallbackResponse = await fetchImageFromUrl(fallbackUrl);
          } catch (err: any) {
            return res.status(502).json({
              message: "Failed to fetch image from URL",
              error: "FETCH_FAILED",
              details: err?.name === "AbortError" ? "Request timed out" : (err?.message || String(err)),
            });
          }
          if (fallbackResponse.ok) {
            const contentType = fallbackResponse.headers.get("content-type");
            const arrayBuffer = await fallbackResponse.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString("base64");
            const imageData = `data:${contentType};base64,${base64}`;
            const filename = `youtube-thumbnail-${youtubeVideoId}.jpg`;

            const analysisResult = await analyzeImageAdvanced(imageData, filename);

            await incrementMonthlyUsage(apiKey.id, quota.yearMonth);

            const analysis = await storage.createAnalysis({
              filename,
              result: analysisResult.result,
              confidence: analysisResult.confidence,
              artifacts: analysisResult.artifacts,
              metadata: analysisResult.metadata,
              debugScores: analysisResult.debugScores,
              imageData: imageData.length < 500000 ? imageData : undefined,
            });

            return res.json({
              ...analysis,
              youtubeVideoId,
              apiUsage: {
                yearMonth: quota.yearMonth,
                used: (quota.used ?? 0) + 1,
                quota: quota.quota,
              },
            });
          }
        }

        if (isYouTubeThumbnail) {
          return res.status(400).json({
            message:
              "Não foi possível obter a thumbnail do vídeo do YouTube. O vídeo pode não existir, ter sido removido, ou estar privado.",
            error: "YOUTUBE_THUMBNAIL_NOT_FOUND",
          });
        }
        return res.status(400).json({ message: "Failed to fetch image from URL" });
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.startsWith("image/")) {
        return res.status(400).json({
          message:
            "URL does not point to an image. Please provide a direct image URL (ending in .jpg, .png, etc.)",
        });
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString("base64");
      const imageData = `data:${contentType};base64,${base64}`;

      const urlParts = url.split("/");
      const filename = urlParts[urlParts.length - 1] || "image-from-url";

      const analysisResult = await analyzeImageAdvanced(imageData, filename);

      await incrementMonthlyUsage(apiKey.id, quota.yearMonth);

      const analysis = await storage.createAnalysis({
        filename,
        result: analysisResult.result,
        confidence: analysisResult.confidence,
        artifacts: analysisResult.artifacts,
        metadata: analysisResult.metadata,
        debugScores: analysisResult.debugScores,
        imageData: imageData.length < 500000 ? imageData : undefined,
      });

      return res.json({
        ...analysis,
        apiUsage: {
          yearMonth: quota.yearMonth,
          used: (quota.used ?? 0) + 1,
          quota: quota.quota,
        },
      });
    } catch (error) {
      console.error("Error analyzing URL (API v1):", error);
      return res.status(500).json({ message: "Failed to analyze image from URL" });
    }
  });

  // User management endpoints for admin
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers();
      const safeUsers = users.map(({ password, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    try {
      const parsed = updateUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }

      const user = await storage.updateUser(req.params.id, parsed.data);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteUser(req.params.id);
      if (!deleted) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Video Analysis Routes
  app.get("/api/video-analyses", async (req, res) => {
    try {
      const videoAnalyses = await storage.getVideoAnalyses();
      res.json(videoAnalyses);
    } catch (error) {
      console.error("Error fetching video analyses:", error);
      res.status(500).json({ message: "Failed to fetch video analyses" });
    }
  });

  app.get("/api/video-analyses/:id", async (req, res) => {
    try {
      const analysis = await storage.getVideoAnalysis(req.params.id);
      if (!analysis) {
        return res.status(404).json({ message: "Video analysis not found" });
      }
      res.json(analysis);
    } catch (error) {
      console.error("Error fetching video analysis:", error);
      res.status(500).json({ message: "Failed to fetch video analysis" });
    }
  });

  app.post("/api/analyze-video", async (req, res) => {
    try {
      const parsed = analyzeVideoSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }

      const { videoData, filename } = parsed.data;

      if (!isVideoAnalysisConfigured()) {
        return res.status(503).json({
          message: "Video analysis is not configured. OpenAI API key not found."
        });
      }

      // Extract base64 data
      const base64Match = videoData.match(/^data:video\/\w+;base64,(.+)$/);
      if (!base64Match) {
        return res.status(400).json({ message: "Invalid video data format" });
      }

      const videoBuffer = Buffer.from(base64Match[1], 'base64');
      const videoSize = videoBuffer.length;

      // Limit video size to 50MB
      if (videoSize > 50 * 1024 * 1024) {
        return res.status(400).json({ message: "Video size exceeds 50MB limit" });
      }

      // Analyze video with service
      const detectionResult = await processVideoAnalysis(videoBuffer, filename);

      const analysis = await storage.createVideoAnalysis({
        filename,
        result: detectionResult.result,
        confidence: detectionResult.confidence,
        manipulationScore: detectionResult.manipulationScore,
        indicators: detectionResult.indicators,
        metadata: {
          duration: 0,
          width: 0,
          height: 0,
          format: filename.split('.').pop() || 'mp4',
          size: videoSize,
        },
        thumbnailData: null,
      });

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing video:", error);
      res.status(500).json({
        message: error instanceof Error ? error.message : "Failed to analyze video"
      });
    }
  });

  app.get("/api/video-analysis-status", (req, res) => {
    res.json({
      configured: isVideoAnalysisConfigured(),
      provider: "GPT-4 Vision",
      freeQuota: "Unlimited (uses OpenAI credits)"
    });
  });

  // Mercado Pago routes
  app.get("/api/mercadopago/public-key", async (_req, res) => {
    try {
      const publicKey = getMercadoPagoPublicKey();
      res.json({ publicKey });
    } catch (error) {
      console.error("Error getting Mercado Pago public key:", error);
      res.status(500).json({ message: "Failed to get Mercado Pago key" });
    }
  });

  app.get("/api/mercadopago/plans", async (_req, res) => {
    try {
      const plans = await db
        .select()
        .from(mpPlans)
        .where(eq(mpPlans.active, true))
        .orderBy(mpPlans.amountBrl);
      res.json({ data: plans });
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  // Seed plans (admin only - for initial setup)
  app.post("/api/mercadopago/seed-plans", adminAuthMiddleware, async (_req, res) => {
    try {
      const host = 'https://www.imgcertifier.app';
      const planDefs = [
        {
          name: 'Basic',
          description: '100 análises por mês com histórico completo',
          tier: 'basic' as const,
          price: 1990, // R$19.90 in centavos
        },
        {
          name: 'Premium',
          description: 'Análises ilimitadas com API access',
          tier: 'premium' as const,
          price: 4990, // R$49.90 in centavos
        },
        {
          name: 'Enterprise',
          description: 'Múltiplos usuários com suporte dedicado',
          tier: 'enterprise' as const,
          price: 19990, // R$199.90 in centavos
        },
      ];

      const results = [];

      for (const plan of planDefs) {
        const mpPlan = await mercadoPagoService.createPlan({
          name: `Image Certifier - ${plan.name}`,
          description: plan.description,
          amount: plan.price,
          backUrl: `${host}/pricing`,
        });

        // Save to local database
        await db.insert(mpPlans).values({
          mpPlanId: mpPlan.id!,
          name: plan.name,
          description: plan.description,
          tier: plan.tier,
          amountBrl: plan.price,
        });

        results.push({ mpPlanId: mpPlan.id, name: plan.name, tier: plan.tier });
      }

      res.json({ success: true, plans: results });
    } catch (error: any) {
      console.error("Error seeding plans:", error);
      res.status(500).json({ message: error.message || "Failed to seed plans" });
    }
  });

  app.post("/api/mercadopago/checkout", requireAuth, async (req, res) => {
    try {
      const { planId } = req.body;

      if (!planId) {
        return res.status(400).json({ message: "Plan ID is required" });
      }

      const userId = (req.user as any).id as string;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Look up the plan
      const plan = await db
        .select()
        .from(mpPlans)
        .where(eq(mpPlans.id, planId))
        .limit(1);

      if (!plan.length) {
        return res.status(404).json({ message: "Plan not found" });
      }

      const host = req.get('host') || 'www.imgcertifier.app';
      const backUrl = `https://${host}/pricing`;

      const subscription = await mercadoPagoService.createSubscriptionCheckout({
        planId: plan[0].mpPlanId,
        payerEmail: user.email,
        userId,
        backUrl,
      });

      res.json({ url: subscription.init_point });
    } catch (error: any) {
      console.error("Error creating checkout:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout" });
    }
  });

  app.post("/api/apple/verify-receipt", async (req, res) => {
    try {
      const { receiptData } = req.body;
      if (!receiptData) {
        return res.status(400).json({ message: "Receipt data is required" });
      }

      const result = await appleService.verifyReceipt(receiptData, req.user?.id);
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Error verifying Apple receipt:", error);
      res.status(500).json({ message: error.message || "Failed to verify receipt" });
    }
  });

  // Google Play Billing verification
  app.post("/api/google/verify-purchase", async (req, res) => {
    try {
      const { packageName, productId, purchaseToken, purchaseType } = req.body;
      if (!packageName || !productId || !purchaseToken) {
        return res.status(400).json({ message: "packageName, productId, and purchaseToken are required" });
      }

      let result;
      if (purchaseType === 'product') {
        result = await googlePlayService.verifyProduct(packageName, productId, purchaseToken, req.user?.id);
      } else {
        result = await googlePlayService.verifySubscription(packageName, productId, purchaseToken, req.user?.id);
      }
      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Error verifying Google Play purchase:", error);
      res.status(500).json({ message: error.message || "Failed to verify purchase" });
    }
  });

  // Admin: Get all subscribers
  app.get("/api/admin/customers", adminAuthMiddleware, async (_req, res) => {
    try {
      const result = await db.execute(
        sql`
          SELECT
            u.id as user_id,
            u.email,
            u.username,
            u.created_at,
            u.is_premium,
            s.id as subscription_id,
            s.mp_subscription_id,
            s.status as subscription_status,
            s.payer_email,
            s.created_at as sub_created_at,
            s.updated_at as sub_updated_at,
            p.name as plan_name,
            p.amount_brl,
            p.tier
          FROM users u
          LEFT JOIN mp_subscriptions s ON s.user_id = u.id
          LEFT JOIN mp_plans p ON p.mp_plan_id = s.mp_plan_id
          WHERE s.id IS NOT NULL
          ORDER BY s.created_at DESC
        `
      );
      res.json({ data: result.rows });
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Admin: Get subscription stats
  app.get("/api/admin/subscription-stats", adminAuthMiddleware, async (_req, res) => {
    try {
      const totalResult = await db.execute(
        sql`SELECT COUNT(DISTINCT user_id) as count FROM mp_subscriptions`
      );
      const activeResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM mp_subscriptions WHERE status = 'authorized'`
      );
      const canceledResult = await db.execute(
        sql`SELECT COUNT(*) as count FROM mp_subscriptions WHERE status = 'cancelled'`
      );
      const revenueResult = await db.execute(
        sql`
          SELECT COALESCE(SUM(p.amount_brl), 0) as mrr
          FROM mp_subscriptions s
          JOIN mp_plans p ON p.mp_plan_id = s.mp_plan_id
          WHERE s.status = 'authorized'
        `
      );

      res.json({
        totalCustomers: parseInt((totalResult.rows[0] as any)?.count || '0'),
        activeSubscriptions: parseInt((activeResult.rows[0] as any)?.count || '0'),
        canceledSubscriptions: parseInt((canceledResult.rows[0] as any)?.count || '0'),
        monthlyRevenue: parseInt((revenueResult.rows[0] as any)?.mrr || '0'),
      });
    } catch (error) {
      console.error("Error fetching subscription stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin: Cancel subscription
  app.post("/api/admin/cancel-subscription", adminAuthMiddleware, async (req, res) => {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ message: "Subscription ID is required" });
      }

      const result = await mercadoPagoService.cancelSubscription(subscriptionId);

      // Update local record
      await db
        .update(mpSubscriptions)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(mpSubscriptions.mpSubscriptionId, subscriptionId));

      res.json({ success: true, subscription: result });
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: error.message || "Failed to cancel subscription" });
    }
  });

  // Admin: Reactivate subscription
  app.post("/api/admin/reactivate-subscription", adminAuthMiddleware, async (req, res) => {
    try {
      const { subscriptionId } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ message: "Subscription ID is required" });
      }

      const result = await mercadoPagoService.reactivateSubscription(subscriptionId);

      // Update local record
      await db
        .update(mpSubscriptions)
        .set({ status: 'authorized', updatedAt: new Date() })
        .where(eq(mpSubscriptions.mpSubscriptionId, subscriptionId));

      res.json({ success: true, subscription: result });
    } catch (error: any) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ message: error.message || "Failed to reactivate subscription" });
    }
  });

  // Admin: Grant free access to user
  app.post("/api/admin/grant-access", adminAuthMiddleware, async (req, res) => {
    try {
      const { userId, accessType } = req.body;

      if (!userId || !accessType) {
        return res.status(400).json({ message: "User ID and access type are required" });
      }

      const updates: { isPremium?: boolean; isFreeAccount?: boolean } = {};
      if (accessType === 'premium') {
        updates.isPremium = true;
      } else if (accessType === 'free') {
        updates.isFreeAccount = true;
      }

      const user = await storage.updateUser(userId, updates);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { password, ...safeUser } = user;
      res.json({ success: true, user: safeUser });
    } catch (error: any) {
      console.error("Error granting access:", error);
      res.status(500).json({ message: error.message || "Failed to grant access" });
    }
  });

  // Proxy endpoint to fetch YouTube thumbnails (bypasses CORS)
  app.get("/api/youtube-thumbnail/:videoId", async (req: Request, res: Response) => {
    try {
      const videoId = req.params.videoId;
      if (typeof videoId !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
        return res.status(400).json({ message: "Invalid video ID" });
      }

      // Try maxresdefault first, fallback to hqdefault
      const urls = [
        `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      ];

      for (const url of urls) {
        const response = await fetch(url);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          res.set('Content-Type', 'image/jpeg');
          res.set('Cache-Control', 'public, max-age=86400');
          return res.send(Buffer.from(buffer));
        }
      }

      res.status(404).json({ message: "Thumbnail not found" });
    } catch (error: any) {
      console.error("Error fetching YouTube thumbnail:", error);
      res.status(500).json({ message: "Failed to fetch thumbnail" });
    }
  });

  return httpServer;
}
