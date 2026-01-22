import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeImageSchema, analyzeUrlSchema } from "@shared/schema";
import sharp from "sharp";
import ExifParser from "exif-parser";
import OpenAI from "openai";

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
          content: `You are an expert image forensics analyst. Analyze images for AI generation signs:
- Unnatural skin textures/smoothness
- Inconsistent lighting/shadows
- Malformed details (hands, fingers, text)
- Repetitive patterns or artifacts
- Unnatural backgrounds/perspective
- Unusual color gradients/noise

For real photos look for:
- Natural noise/grain patterns
- Consistent lighting/perspective
- Natural imperfections
- Camera artifacts (lens distortion, blur)

You MUST respond with valid JSON:
{"classification":"original"|"ai_generated"|"ai_modified","confidence":0-100,"reasoning":"explanation","artifacts":["list"]}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this image. Determine if it's an original photograph, AI-generated, or AI-modified. Return JSON only."
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

  // Analyze image from base64 data
  app.post("/api/analyze", async (req, res) => {
    try {
      const parsed = analyzeImageSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }

      const { imageData, filename } = parsed.data;
      
      // Perform advanced multi-layer analysis
      console.log("Starting image analysis for:", filename);
      const analysisResult = await analyzeImageAdvanced(imageData, filename);
      console.log("Analysis complete:", { result: analysisResult.result, confidence: analysisResult.confidence });
      
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
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing image:", error);
      res.status(500).json({ message: "Failed to analyze image" });
    }
  });

  // Analyze image from URL
  app.post("/api/analyze-url", async (req, res) => {
    try {
      const parsed = analyzeUrlSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid URL", errors: parsed.error.errors });
      }

      const { url } = parsed.data;
      console.log("Analyzing image from URL:", url);
      
      // Fetch image from URL
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(400).json({ message: "Failed to fetch image from URL" });
      }

      const contentType = response.headers.get("content-type");
      if (!contentType?.startsWith("image/")) {
        return res.status(400).json({ message: "URL does not point to an image" });
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
      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing URL:", error);
      res.status(500).json({ message: "Failed to analyze image from URL" });
    }
  });

  return httpServer;
}
