import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  analyzeImageSchema, analyzeUrlSchema, updateUserSchema, analyzeVideoSchema,
  type VideoAnalysisResult, FREE_ANALYSIS_LIMIT, type AnalysisResult
} from "@shared/schema";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { analysisFeedback } from "@shared/schema";
import { isVideoAnalysisConfigured } from "./videoAnalysisClient";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { analyzeImageAdvanced } from "./services/analysisService";
import { processVideoAnalysis } from "./services/videoService";
import { appleService } from "./services/appleService";

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



export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

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
        return res.status(400).json({ message: "Failed to fetch image from URL" });
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
