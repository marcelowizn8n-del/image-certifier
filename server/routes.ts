import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeImageSchema, analyzeUrlSchema, updateUserSchema, analyzeVideoSchema, type VideoAnalysisResult, FREE_ANALYSIS_LIMIT } from "@shared/schema";
import sharp from "sharp";
import ExifParser from "exif-parser";
import OpenAI from "openai";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { analyzeVideoWithGPT4V, isVideoAnalysisConfigured } from "./videoAnalysisClient";
import crypto from "crypto";

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
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || '';
  const acceptLang = req.headers['accept-language'] || '';
  const data = `${ip}-${userAgent}-${acceptLang}`;
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

// Initialize OpenAI client for AI-powered analysis
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Known camera manufacturers
const KNOWN_CAMERA_BRANDS = [
  "apple", "iphone", "canon", "nikon", "sony", "fuji", "fujifilm",
  "olympus", "panasonic", "leica", "samsung", "google", "pixel",
  "huawei", "xiaomi", "oppo", "oneplus", "lg", "motorola"
];

// AI generator signatures (common patterns in AI-generated images)
const AI_GENERATOR_PATTERNS = [
  "stable diffusion", "midjourney", "dall-e", "dalle", "openai",
  "ai generated", "artificial intelligence", "neural network"
];

interface ExifData {
  hasExif: boolean;
  cameraMake?: string;
  cameraModel?: string;
  software?: string;
  dateTime?: string;
  gpsLatitude?: number;
  gpsLongitude?: number;
  iso?: number;
  aperture?: number;
  shutterSpeed?: number;
  focalLength?: number;
  flash?: boolean;
  orientation?: number;
}

interface ImageStats {
  width: number;
  height: number;
  format: string;
  channels: number;
  hasAlpha: boolean;
  isProgressive?: boolean;
  size: number;
}

interface NoiseAnalysis {
  noiseLevel: number;
  noiseConsistency: number;
  channelVariance: { r: number; g: number; b: number };
}

interface ArtifactAnalysis {
  compression: boolean;
  blur: boolean;
  colorAdjustment: boolean;
  noisePatterns: boolean;
  inconsistentLighting: boolean;
  edgeArtifacts: boolean;
  unnaturalSmoothing: boolean;
  repetitivePatterns: boolean;
}

// Extract EXIF metadata from image buffer
async function extractExifData(buffer: Buffer): Promise<ExifData> {
  try {
    const parser = ExifParser.create(buffer);
    const result = parser.parse();
    
    const tags = result.tags || {};
    
    return {
      hasExif: Object.keys(tags).length > 0,
      cameraMake: tags.Make,
      cameraModel: tags.Model,
      software: tags.Software,
      dateTime: tags.DateTimeOriginal ? new Date(tags.DateTimeOriginal * 1000).toISOString() : undefined,
      gpsLatitude: tags.GPSLatitude,
      gpsLongitude: tags.GPSLongitude,
      iso: tags.ISO,
      aperture: tags.FNumber,
      shutterSpeed: tags.ExposureTime,
      focalLength: tags.FocalLength,
      flash: tags.Flash ? true : false,
      orientation: tags.Orientation,
    };
  } catch (error) {
    // If EXIF parsing fails, return empty data
    return { hasExif: false };
  }
}

// Get image statistics using sharp
async function getImageStats(buffer: Buffer): Promise<ImageStats> {
  const metadata = await sharp(buffer).metadata();
  const stats = await sharp(buffer).stats();
  
  return {
    width: metadata.width || 0,
    height: metadata.height || 0,
    format: metadata.format || "unknown",
    channels: metadata.channels || 3,
    hasAlpha: metadata.hasAlpha || false,
    isProgressive: metadata.isProgressive,
    size: buffer.length,
  };
}

// Analyze noise patterns in the image
async function analyzeNoise(buffer: Buffer): Promise<NoiseAnalysis> {
  try {
    const stats = await sharp(buffer).stats();
    
    // Calculate noise level based on standard deviation of channels
    const channels = stats.channels;
    const avgStdDev = channels.reduce((sum, ch) => sum + ch.stdev, 0) / channels.length;
    
    // Natural photos typically have stddev between 30-80
    // AI images often have either too uniform (low) or artificially noisy patterns
    const noiseLevel = avgStdDev / 255;
    
    // Check consistency across channels - natural noise should be somewhat consistent
    const stdDevs = channels.map(ch => ch.stdev);
    const maxDiff = Math.max(...stdDevs) - Math.min(...stdDevs);
    const noiseConsistency = 1 - (maxDiff / 100);
    
    return {
      noiseLevel,
      noiseConsistency: Math.max(0, Math.min(1, noiseConsistency)),
      channelVariance: {
        r: channels[0]?.stdev || 0,
        g: channels[1]?.stdev || 0,
        b: channels[2]?.stdev || 0,
      }
    };
  } catch (error) {
    return {
      noiseLevel: 0.5,
      noiseConsistency: 0.5,
      channelVariance: { r: 0, g: 0, b: 0 }
    };
  }
}

// Analyze image for AI-typical artifacts
async function analyzeArtifacts(buffer: Buffer, stats: ImageStats): Promise<ArtifactAnalysis> {
  try {
    // Get entropy and edge information
    const sharpStats = await sharp(buffer).stats();
    const channels = sharpStats.channels;
    
    // Calculate overall entropy (randomness) - AI images often have less natural entropy
    const avgEntropy = channels.reduce((sum, ch) => sum + ch.stdev, 0) / channels.length;
    
    // Very low entropy might indicate artificial smoothing
    const unnaturalSmoothing = avgEntropy < 20;
    
    // Very uniform color distributions can indicate AI generation
    const colorRanges = channels.map(ch => ch.max - ch.min);
    const avgColorRange = colorRanges.reduce((a, b) => a + b, 0) / colorRanges.length;
    
    // Check for compression artifacts (JPEG artifacts)
    const hasCompression = stats.format === "jpeg" && buffer.length < (stats.width * stats.height * 0.5);
    
    // Check for suspicious patterns
    const suspiciousRatio = stats.width === stats.height; // Perfect squares are common in AI
    const standardAiSize = [512, 768, 1024, 1536, 2048].includes(stats.width) && 
                          [512, 768, 1024, 1536, 2048].includes(stats.height);
    
    return {
      compression: hasCompression,
      blur: avgEntropy < 25,
      colorAdjustment: avgColorRange > 240, // Near-full range might indicate enhancement
      noisePatterns: avgEntropy < 15 || avgEntropy > 90,
      inconsistentLighting: false, // Would need more sophisticated analysis
      edgeArtifacts: false, // Would need edge detection
      unnaturalSmoothing,
      repetitivePatterns: standardAiSize && suspiciousRatio,
    };
  } catch (error) {
    return {
      compression: false,
      blur: false,
      colorAdjustment: false,
      noisePatterns: false,
      inconsistentLighting: false,
      edgeArtifacts: false,
      unnaturalSmoothing: false,
      repetitivePatterns: false,
    };
  }
}

// Calculate EXIF score (0-1, higher = more likely real)
function calculateExifScore(exif: ExifData): number {
  // Check for AI generator signatures first
  if (exif.software) {
    const softwareLower = exif.software.toLowerCase();
    if (AI_GENERATOR_PATTERNS.some(pattern => softwareLower.includes(pattern))) {
      return 0; // AI generator signature means not real
    }
  }
  
  let score = 0;
  let maxPoints = 0;
  
  // Has any EXIF data at all
  maxPoints += 15;
  if (exif.hasExif) score += 15;
  
  // Has camera make
  maxPoints += 20;
  if (exif.cameraMake) {
    score += 10;
    // Known camera brand bonus
    if (KNOWN_CAMERA_BRANDS.some(brand => 
      exif.cameraMake!.toLowerCase().includes(brand)
    )) {
      score += 10;
    }
  }
  
  // Has camera model
  maxPoints += 10;
  if (exif.cameraModel) score += 10;
  
  // Has date/time
  maxPoints += 15;
  if (exif.dateTime) score += 15;
  
  // Has GPS data (strong indicator of real photo)
  maxPoints += 20;
  if (exif.gpsLatitude && exif.gpsLongitude) score += 20;
  
  // Has exposure settings (ISO, aperture, shutter) - indicates real camera
  maxPoints += 20;
  if (exif.iso) score += 5;
  if (exif.aperture) score += 5;
  if (exif.shutterSpeed) score += 5;
  if (exif.focalLength) score += 5;
  
  return score / maxPoints; // Normalized 0-1
}

// Calculate noise score (0-1, higher = more natural/real)
function calculateNoiseScore(noise: NoiseAnalysis): number {
  // Natural photos have moderate noise levels (0.1-0.4 typically)
  // AI images often have either too clean (< 0.05) or artificial noise
  
  let score = 0;
  
  // Optimal noise level is around 0.15-0.35
  if (noise.noiseLevel >= 0.1 && noise.noiseLevel <= 0.4) {
    score += 0.5;
  } else if (noise.noiseLevel < 0.05) {
    score += 0.1; // Too clean, likely AI
  } else if (noise.noiseLevel > 0.5) {
    score += 0.2; // Too noisy, might be artificial
  } else {
    score += 0.3;
  }
  
  // Noise consistency across channels
  score += noise.noiseConsistency * 0.5;
  
  return Math.max(0, Math.min(1, score));
}

// Calculate artifact score (0-1, higher = fewer suspicious artifacts = more likely real)
function calculateArtifactScore(artifacts: ArtifactAnalysis): number {
  let suspiciousCount = 0;
  
  if (artifacts.unnaturalSmoothing) suspiciousCount += 2;
  if (artifacts.repetitivePatterns) suspiciousCount += 2;
  if (artifacts.noisePatterns) suspiciousCount += 1;
  if (artifacts.blur && !artifacts.compression) suspiciousCount += 1;
  if (artifacts.colorAdjustment) suspiciousCount += 0.5;
  
  // More suspicious artifacts = lower score
  return Math.max(0, 1 - (suspiciousCount / 7));
}

// AI-powered image analysis using GPT-4o vision
async function analyzeWithAI(imageData: string): Promise<{
  result: "original" | "ai_generated" | "ai_modified";
  confidence: number;
  reasoning: string;
  artifacts: string[];
}> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a highly skeptical AI image forensics expert. Your job is to detect ANY AI modifications, even subtle ones. Assume images MAY be edited until proven otherwise.

HAIR & FACIAL MODIFICATIONS (very common AI edits - look carefully):
- Hair changes: added bangs/fringe, color changes, hairstyle modifications
- Hair texture that looks too smooth, uniform, or "painted"
- Hair edges that don't blend naturally with the forehead/face
- Facial feature changes: nose, lips, eyes, skin smoothing
- Age modifications (wrinkle removal, rejuvenation)
- Makeup additions or modifications

OTHER AI MODIFICATIONS to detect:
- Objects that look "pasted" (different noise/grain patterns)
- Text, numbers, or logos artificially added
- Background replacements or extensions
- Object additions/removals (inpainting)
- Lighting/shadow inconsistencies between elements

For FULLY AI-GENERATED images:
- Unnatural skin textures throughout
- Malformed details (hands, fingers, text, teeth)
- Repetitive patterns or impossible perspectives
- Unusual color gradients/noise patterns

For TRULY ORIGINAL photos (be strict):
- COMPLETELY consistent noise/grain across entire image including hair
- No localized smoothing or texture differences
- Natural hair with individual strands visible
- Uniform lighting and shadows throughout

CRITICAL RULE: If you see ANY hair modifications (bangs, fringe, color, style changes), different textures in different parts of the image, or facial edits, you MUST classify as "ai_modified". When in doubt, classify as "ai_modified" rather than "original".

You MUST respond with valid JSON:
{"classification":"original"|"ai_generated"|"ai_modified","confidence":0-100,"reasoning":"explanation","artifacts":["list"]}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image with extreme scrutiny. Pay special attention to: 1) HAIR - look for bangs/fringe that might be added, unnatural hair texture or edges; 2) FACE - any smoothing, feature changes, or edits; 3) OBJECTS - text, numbers, or items that look pasted. If ANYTHING looks modified or has different texture than surrounding areas, classify as ai_modified. Only classify as original if you're 100% certain nothing was edited. Return JSON only."
            },
            {
              type: "image_url",
              image_url: {
                url: imageData,
                detail: "high"
              }
            }
          ]
        }
      ],
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    
    // Validate and clamp values
    const validClassifications = ["original", "ai_generated", "ai_modified"];
    const classification = validClassifications.includes(parsed.classification) 
      ? parsed.classification 
      : "original";
    const confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 75));
    
    return {
      result: classification as "original" | "ai_generated" | "ai_modified",
      confidence,
      reasoning: String(parsed.reasoning || ""),
      artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
    };
  } catch (error) {
    console.error("AI analysis error:", error);
    throw error;
  }
}

// Main analysis function using multi-layer approach + AI
async function analyzeImageAdvanced(imageData: string, filename: string) {
  // Extract buffer from base64
  const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
  const buffer = Buffer.from(base64Data, "base64");
  
  // Get image stats first (needed for artifact analysis)
  const stats = await getImageStats(buffer);
  
  // Run technical analyses in parallel
  const [exif, noise, artifacts] = await Promise.all([
    extractExifData(buffer),
    analyzeNoise(buffer),
    analyzeArtifacts(buffer, stats),
  ]);
  
  // Calculate technical scores
  const exifScore = calculateExifScore(exif);
  const noiseScore = calculateNoiseScore(noise);
  const artifactScore = calculateArtifactScore(artifacts);
  
  // Run AI analysis for high accuracy
  let aiAnalysis: { result: "original" | "ai_generated" | "ai_modified"; confidence: number; reasoning: string; artifacts: string[] };
  try {
    aiAnalysis = await analyzeWithAI(imageData);
  } catch (error) {
    // Fallback to technical analysis if AI fails
    console.error("AI analysis failed, using technical fallback:", error);
    const technicalScore = exifScore * 0.4 + noiseScore * 0.25 + artifactScore * 0.35;
    aiAnalysis = {
      result: technicalScore > 0.6 ? "original" : technicalScore < 0.4 ? "ai_generated" : "ai_modified",
      confidence: Math.round(Math.abs(technicalScore - 0.5) * 200),
      reasoning: "Technical analysis fallback",
      artifacts: [],
    };
  }
  
  // Combine AI result with EXIF boost for real photos
  let finalResult = aiAnalysis.result;
  let finalConfidence = aiAnalysis.confidence;
  
  // If EXIF shows real camera data, boost confidence in "original" classification
  if (exifScore >= 0.5 && exif.cameraMake) {
    if (aiAnalysis.result === "original") {
      finalConfidence = Math.min(99, finalConfidence + 10);
    } else if (aiAnalysis.result === "ai_modified" && aiAnalysis.confidence < 70) {
      // If AI is uncertain about modification but EXIF is strong, lean toward original
      finalResult = "original";
      finalConfidence = Math.round(exifScore * 100);
    }
  }
  
  // If no EXIF and AI says AI-generated, boost that confidence
  if (!exif.hasExif && aiAnalysis.result === "ai_generated") {
    finalConfidence = Math.min(99, finalConfidence + 5);
  }

  // Format artifacts for response
  const artifactResponse = {
    compression: artifacts.compression,
    blur: artifacts.blur,
    colorAdjustment: artifacts.colorAdjustment,
    noisePatterns: artifacts.noisePatterns,
    inconsistentLighting: artifacts.inconsistentLighting,
    edgeArtifacts: artifacts.edgeArtifacts,
  };

  // Format metadata for response
  const metadata = {
    width: stats.width,
    height: stats.height,
    format: stats.format.toUpperCase(),
    size: stats.size,
    hasExif: exif.hasExif,
    cameraMake: exif.cameraMake,
    cameraModel: exif.cameraModel,
  };

  const debugScores = {
    exif_score: exifScore,
    noise_score: noiseScore,
    artifact_score: artifactScore,
    ai_confidence: aiAnalysis.confidence / 100,
    realness_score: finalResult === "original" ? finalConfidence / 100 : 1 - (finalConfidence / 100),
    significant_artifacts: Object.values(artifacts).filter(Boolean).length,
    ml_ai_score: aiAnalysis.confidence / 100,
    ml_human_score: finalResult === "original" ? finalConfidence / 100 : 1 - (finalConfidence / 100),
    ml_model: "gpt-4o-vision",
    noise_level: noise.noiseLevel,
    noise_consistency: noise.noiseConsistency,
    ai_reasoning: aiAnalysis.reasoning,
    ai_detected_artifacts: aiAnalysis.artifacts,
  };

  return {
    result: finalResult,
    confidence: finalConfidence,
    artifacts: artifactResponse,
    metadata,
    debugScores,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
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
          upgradeUrl: "/pricing"
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
          upgradeUrl: "/pricing"
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

      // Analyze video with GPT-4 Vision
      const detectionResult = await analyzeVideoWithGPT4V(videoBuffer, filename);

      // Determine result based on manipulation probability
      let result: VideoAnalysisResult;
      const manipulationScore = Math.round(detectionResult.manipulation_probability * 100);

      if (manipulationScore >= 70) {
        result = "deepfake";
      } else if (manipulationScore >= 40) {
        result = "manipulated";
      } else if (manipulationScore <= 20) {
        result = "authentic";
      } else {
        result = "uncertain";
      }

      const analysis = await storage.createVideoAnalysis({
        filename,
        result,
        confidence: Math.round(detectionResult.confidence * 100),
        manipulationScore,
        indicators: {
          facialArtifacts: detectionResult.indicators?.facial_artifacts || false,
          temporalInconsistencies: detectionResult.indicators?.temporal_inconsistencies || false,
          audioVideoMismatch: detectionResult.indicators?.audio_video_mismatch || false,
          lipSyncIssues: detectionResult.indicators?.lip_sync_issues || false,
          blinkingAnomalies: detectionResult.indicators?.blinking_anomalies || false,
          backgroundArtifacts: detectionResult.indicators?.background_artifacts || false,
        },
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

  app.post("/api/stripe/checkout", async (req, res) => {
    try {
      const { priceId, email } = req.body;
      
      if (!priceId) {
        return res.status(400).json({ message: "Price ID is required" });
      }

      // Create customer
      const customer = await stripeService.createCustomer(
        email || 'customer@example.com',
        'anonymous'
      );

      // Create checkout session
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || req.get('host')}`;
      const session = await stripeService.createCheckoutSession(
        customer.id,
        priceId,
        `${baseUrl}/checkout/success`,
        `${baseUrl}/pricing`
      );

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout session" });
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

  return httpServer;
}
