import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeImageSchema, analyzeUrlSchema } from "@shared/schema";

// Simulated AI detection function (in production, this would call Hugging Face API)
function analyzeImage(imageData: string, filename: string) {
  // Extract image info from base64
  const matches = imageData.match(/^data:image\/(\w+);base64,/);
  const format = matches ? matches[1].toUpperCase() : "UNKNOWN";
  
  // Simulated analysis scores
  const mlAiScore = Math.random() * 0.4; // Favor "original" results for demo
  const exifScore = Math.random() * 0.8 + 0.2;
  const noiseScore = Math.random() * 0.7 + 0.3;
  
  // Calculate combined confidence
  const aiConfidence = mlAiScore * 0.6 + (1 - exifScore) * 0.2 + (1 - noiseScore) * 0.2;
  const realnessScore = 1 - aiConfidence;
  
  // Determine result based on confidence
  let result: "original" | "ai_generated" | "ai_modified" | "uncertain";
  if (aiConfidence < 0.3) {
    result = "original";
  } else if (aiConfidence > 0.7) {
    result = "ai_generated";
  } else if (aiConfidence > 0.5) {
    result = "ai_modified";
  } else {
    result = "uncertain";
  }

  const confidence = Math.round(
    result === "original" || result === "uncertain" 
      ? realnessScore * 100 
      : aiConfidence * 100
  );

  // Simulated artifact detection
  const artifacts = {
    compression: Math.random() > 0.5,
    blur: Math.random() > 0.7,
    colorAdjustment: Math.random() > 0.6,
    noisePatterns: Math.random() > 0.5,
    inconsistentLighting: Math.random() > 0.8,
    edgeArtifacts: Math.random() > 0.7,
  };

  // Count significant artifacts
  const significantArtifacts = Object.values(artifacts).filter(Boolean).length;

  // Simulated metadata
  const metadata = {
    width: 1920,
    height: 1080,
    format,
    size: Math.round(imageData.length * 0.75), // Approximate decoded size
    hasExif: exifScore > 0.5,
    cameraMake: exifScore > 0.7 ? "Canon" : undefined,
    cameraModel: exifScore > 0.7 ? "EOS R5" : undefined,
  };

  const debugScores = {
    exif_score: exifScore,
    noise_score: noiseScore,
    ai_confidence: aiConfidence,
    realness_score: realnessScore,
    significant_artifacts: significantArtifacts,
    ml_ai_score: mlAiScore,
    ml_human_score: 1 - mlAiScore,
    ml_model: "umm-maybe/AI-image-detector",
  };

  return {
    result,
    confidence,
    artifacts,
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
      
      // Perform analysis
      const analysisResult = analyzeImage(imageData, filename);
      
      // Save to storage
      const analysis = await storage.createAnalysis({
        filename,
        result: analysisResult.result,
        confidence: analysisResult.confidence,
        artifacts: analysisResult.artifacts,
        metadata: analysisResult.metadata,
        debugScores: analysisResult.debugScores,
        imageData: imageData.length < 500000 ? imageData : undefined, // Only store small images
      });

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

      // Perform analysis
      const analysisResult = analyzeImage(imageData, filename);
      
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

      res.json(analysis);
    } catch (error) {
      console.error("Error analyzing URL:", error);
      res.status(500).json({ message: "Failed to analyze image from URL" });
    }
  });

  return httpServer;
}
