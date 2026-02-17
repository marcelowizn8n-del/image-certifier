import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  analyzeImageSchema, analyzeUrlSchema, updateUserSchema, analyzeVideoSchema,
  type VideoAnalysisResult, FREE_ANALYSIS_LIMIT, type AnalysisResult,
  apiKeys, apiKeyUsageMonthly
} from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { and, eq, sql } from "drizzle-orm";
import { analysisFeedback } from "@shared/schema";
import { isVideoAnalysisConfigured } from "./videoAnalysisClient";
import crypto from "crypto";
import bcrypt from "bcryptjs";
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

function isInstagramUrl(url: string): boolean {
  return INSTAGRAM_PATTERNS.some(pattern => pattern.test(url));
}

function getYouTubeThumbnailUrl(videoId: string): string {
  // Try maxresdefault first, fallback options available
  return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
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
  if (!ADMIN_SECRET) {
    return res.status(500).json({ message: "Admin authentication not configured" });
  }

  const adminKey = req.headers['x-admin-key'] as string;
  if (adminKey && adminKey === ADMIN_SECRET) {
    return next();
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

  // Check freemium usage status
  app.get("/api/usage", async (req, res) => {
    try {
      const fingerprint = getFingerprint(req);
      const status = await storage.canAnalyze(fingerprint);
      res.json({
        ...status,
        limit: FREE_ANALYSIS_LIMIT,
        used: FREE_ANALYSIS_LIMIT - status.remaining,
      });
    } catch (error) {
      console.error("Error checking usage:", error);
      res.status(500).json({ message: "Failed to check usage" });
    }
  });

  // Analyze image from base64 data
  app.post("/api/analyze", async (req, res) => {
    try {
      // Check freemium limit
      const fingerprint = getFingerprint(req);
      const canAnalyze = await storage.canAnalyze(fingerprint);

      if (!canAnalyze.allowed) {
        return res.status(403).json({
          message: "Limite gratuito atingido",
          error: "FREE_LIMIT_EXCEEDED",
          remaining: 0,
          limit: FREE_ANALYSIS_LIMIT,
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
      await storage.incrementAnonymousUsage(fingerprint);
      const updatedStatus = await storage.canAnalyze(fingerprint);

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
        usage: {
          remaining: updatedStatus.remaining,
          limit: FREE_ANALYSIS_LIMIT,
        }
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
      // Check freemium limit
      const fingerprint = getFingerprint(req);
      const canAnalyzeResult = await storage.canAnalyze(fingerprint);

      if (!canAnalyzeResult.allowed) {
        return res.status(403).json({
          message: "Limite gratuito atingido",
          error: "FREE_LIMIT_EXCEEDED",
          remaining: 0,
          limit: FREE_ANALYSIS_LIMIT,
          upgradeUrl: "/auth?next=/pricing"
        });
      }

      const parsed = analyzeUrlSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid URL", errors: parsed.error.errors });
      }

      let { url } = parsed.data;
      console.log("Analyzing image from URL:", url);

      // Check for Instagram URLs - provide helpful message
      if (isInstagramUrl(url)) {
        return res.status(400).json({
          message: "Links do Instagram não são suportados diretamente. Para analisar uma imagem do Instagram:\n\n1. Abra a imagem no Instagram\n2. Toque nos três pontos (...)\n3. Selecione 'Salvar' ou faça uma captura de tela\n4. Use a opção 'Arquivo' para fazer upload da imagem salva",
          error: "INSTAGRAM_NOT_SUPPORTED",
          suggestion: "save_image"
        });
      }

      // Check for YouTube URLs - extract thumbnail automatically
      const youtubeVideoId = extractYouTubeVideoId(url);
      let isYouTubeThumbnail = false;
      if (youtubeVideoId) {
        console.log("YouTube video detected, extracting thumbnail for video:", youtubeVideoId);
        url = getYouTubeThumbnailUrl(youtubeVideoId);
        isYouTubeThumbnail = true;
      }

      // Fetch image from URL
      const response = await fetch(url);
      if (!response.ok) {
        // If YouTube maxresdefault fails, try hqdefault
        if (isYouTubeThumbnail && youtubeVideoId) {
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

            await storage.incrementAnonymousUsage(fingerprint);
            const updatedStatus = await storage.canAnalyze(fingerprint);

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
              usage: { remaining: updatedStatus.remaining, limit: FREE_ANALYSIS_LIMIT }
            });
          }
        }
        if (isYouTubeThumbnail) {
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
      await storage.incrementAnonymousUsage(fingerprint);
      const updatedStatus = await storage.canAnalyze(fingerprint);

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
        usage: {
          remaining: updatedStatus.remaining,
          limit: FREE_ANALYSIS_LIMIT,
        }
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

  // Stripe routes
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Error getting Stripe publishable key:", error);
      res.status(500).json({ message: "Failed to get Stripe key" });
    }
  });

  app.get("/api/stripe/products", async (req, res) => {
    try {
      const result = await db.execute(
        sql`SELECT * FROM stripe.products WHERE active = true`
      );
      res.json({ data: result.rows });
    } catch (error) {
      console.error("Error fetching products:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  app.get("/api/stripe/products-with-prices", async (req, res) => {
    try {
      const result = await db.execute(
        sql`
          SELECT 
            p.id as product_id,
            p.name as product_name,
            p.description as product_description,
            p.active as product_active,
            p.metadata as product_metadata,
            pr.id as price_id,
            pr.unit_amount,
            pr.currency,
            pr.recurring,
            pr.active as price_active
          FROM stripe.products p
          LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
          WHERE p.active = true
          ORDER BY pr.unit_amount ASC
        `
      );

      if (!result.rows || result.rows.length === 0) {
        try {
          const { getUncachableStripeClient } = await import("./stripeClient");
          const stripe = await getUncachableStripeClient();

          const stripeProducts = await stripe.products.list({
            active: true,
            limit: 100,
          });

          const productsWithPrices = await Promise.all(
            stripeProducts.data.map(async (p) => {
              const prices = await stripe.prices.list({
                active: true,
                product: p.id,
                limit: 100,
              });

              return {
                id: p.id,
                name: p.name,
                description: p.description || "",
                active: p.active,
                metadata: (p.metadata || {}) as any,
                prices: prices.data.map((pr) => ({
                  id: pr.id,
                  unit_amount: pr.unit_amount || 0,
                  currency: pr.currency,
                  recurring: pr.recurring
                    ? { interval: pr.recurring.interval }
                    : null,
                  active: pr.active,
                })),
              };
            })
          );

          return res.json({ data: productsWithPrices });
        } catch (fallbackError) {
          console.error("Error fetching products/prices from Stripe API:", fallbackError);
        }
      }

      // Group prices by product
      const productsMap = new Map();
      for (const row of result.rows as any[]) {
        if (!productsMap.has(row.product_id)) {
          productsMap.set(row.product_id, {
            id: row.product_id,
            name: row.product_name,
            description: row.product_description,
            active: row.product_active,
            metadata: row.product_metadata,
            prices: []
          });
        }
        if (row.price_id) {
          productsMap.get(row.product_id).prices.push({
            id: row.price_id,
            unit_amount: row.unit_amount,
            currency: row.currency,
            recurring: row.recurring,
            active: row.price_active,
          });
        }
      }

      res.json({ data: Array.from(productsMap.values()) });
    } catch (error) {
      console.error("Error fetching products with prices:", error);
      res.status(500).json({ message: "Failed to fetch products" });
    }
  });

  // Seed products (admin only - for initial setup)
  app.post("/api/stripe/seed-products", async (req, res) => {
    try {
      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      const products = [
        {
          name: 'Basic',
          description: '100 análises por mês com histórico completo',
          metadata: { tier: 'basic', analysisLimit: '100' },
          price: 1990, // R$19.90 in centavos
        },
        {
          name: 'Premium',
          description: 'Análises ilimitadas com API access',
          metadata: { tier: 'premium', analysisLimit: 'unlimited' },
          price: 4990, // R$49.90 in centavos
        },
        {
          name: 'Enterprise',
          description: 'Múltiplos usuários com suporte dedicado',
          metadata: { tier: 'enterprise', analysisLimit: 'unlimited' },
          price: 19990, // R$199.90 in centavos
        }
      ];

      const results = [];

      for (const prod of products) {
        // Create product
        const product = await stripe.products.create({
          name: prod.name,
          description: prod.description,
          metadata: prod.metadata,
        });

        // Create price
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: prod.price,
          currency: 'brl',
          recurring: { interval: 'month' },
        });

        results.push({ product: product.id, price: price.id, name: prod.name });
      }

      res.json({ success: true, products: results });
    } catch (error: any) {
      console.error("Error seeding products:", error);
      res.status(500).json({ message: error.message || "Failed to seed products" });
    }
  });

  app.post("/api/stripe/checkout", requireAuth, async (req, res) => {
    try {
      const { priceId, email } = req.body;

      if (!priceId) {
        return res.status(400).json({ message: "Price ID is required" });
      }

      const userId = (req.user as any).id as string;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Reuse Stripe customer when available, else create one tied to this user.
      const customer = user.stripeCustomerId
        ? { id: user.stripeCustomerId }
        : await stripeService.createCustomer(email || user.email, userId);

      if (!user.stripeCustomerId) {
        await storage.updateUser(userId, { stripeCustomerId: customer.id });
      }

      // Create checkout session
      const host = req.get('host') || 'imgcertifier.app';
      const baseUrl = `https://${host}`;
      const session = await stripeService.createCheckoutSession(
        customer.id,
        priceId,
        `${baseUrl}/checkout/success`,
        `${baseUrl}/pricing`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: error.message || "Failed to create checkout session" });
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

  // Admin: Get all Stripe customers with subscriptions
  app.get("/api/admin/customers", adminAuthMiddleware, async (req, res) => {
    try {
      const result = await db.execute(
        sql`
          SELECT 
            c.id as customer_id,
            c.email,
            c.name,
            c.created,
            c.metadata,
            s.id as subscription_id,
            s.status as subscription_status,
            s.current_period_start,
            s.current_period_end,
            s.cancel_at_period_end,
            p.name as product_name,
            pr.unit_amount,
            pr.currency
          FROM stripe.customers c
          LEFT JOIN stripe.subscriptions s ON s.customer = c.id
          LEFT JOIN stripe.prices pr ON s.items @> jsonb_build_array(jsonb_build_object('price', pr.id))
          LEFT JOIN stripe.products p ON pr.product = p.id
          ORDER BY c.created DESC
        `
      );
      res.json({ data: result.rows });
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ message: "Failed to fetch customers" });
    }
  });

  // Admin: Get subscription stats
  app.get("/api/admin/subscription-stats", adminAuthMiddleware, async (req, res) => {
    try {
      const customersResult = await db.execute(sql`SELECT COUNT(*) as count FROM stripe.customers`);
      const activeSubsResult = await db.execute(sql`SELECT COUNT(*) as count FROM stripe.subscriptions WHERE status = 'active'`);
      const canceledSubsResult = await db.execute(sql`SELECT COUNT(*) as count FROM stripe.subscriptions WHERE status = 'canceled'`);
      const revenueResult = await db.execute(sql`
        SELECT COALESCE(SUM(pr.unit_amount), 0) as mrr
        FROM stripe.subscriptions s
        JOIN stripe.prices pr ON s.items @> jsonb_build_array(jsonb_build_object('price', pr.id))
        WHERE s.status = 'active'
      `);

      res.json({
        totalCustomers: parseInt((customersResult.rows[0] as any)?.count || '0'),
        activeSubscriptions: parseInt((activeSubsResult.rows[0] as any)?.count || '0'),
        canceledSubscriptions: parseInt((canceledSubsResult.rows[0] as any)?.count || '0'),
        monthlyRevenue: parseInt((revenueResult.rows[0] as any)?.mrr || '0'),
      });
    } catch (error) {
      console.error("Error fetching subscription stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin: Update product price (creates new price in Stripe)
  app.post("/api/admin/update-price", adminAuthMiddleware, async (req, res) => {
    try {
      const { productId, newAmount, currency = 'brl' } = req.body;

      if (!productId || !newAmount) {
        return res.status(400).json({ message: "Product ID and new amount are required" });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      // Deactivate old price
      const oldPrices = await stripe.prices.list({ product: productId, active: true });
      for (const oldPrice of oldPrices.data) {
        await stripe.prices.update(oldPrice.id, { active: false });
      }

      // Create new price
      const newPrice = await stripe.prices.create({
        product: productId,
        unit_amount: Math.round(newAmount * 100), // Convert to centavos
        currency,
        recurring: { interval: 'month' },
      });

      res.json({ success: true, price: newPrice });
    } catch (error: any) {
      console.error("Error updating price:", error);
      res.status(500).json({ message: error.message || "Failed to update price" });
    }
  });

  // Admin: Cancel subscription
  app.post("/api/admin/cancel-subscription", adminAuthMiddleware, async (req, res) => {
    try {
      const { subscriptionId, immediately = false } = req.body;

      if (!subscriptionId) {
        return res.status(400).json({ message: "Subscription ID is required" });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      let subscription;
      if (immediately) {
        subscription = await stripe.subscriptions.cancel(subscriptionId);
      } else {
        subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
      }

      res.json({ success: true, subscription });
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

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });

      res.json({ success: true, subscription });
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
