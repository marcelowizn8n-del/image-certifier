import sharp from "sharp";
import ExifParser from "exif-parser";
import OpenAI from "openai";
import { type AnalysisResult } from "@shared/schema";
import { analyzeWithSightEngine, isSightEngineConfigured } from "./sightengineService";

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

export interface ExifData {
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

export interface ImageStats {
    width: number;
    height: number;
    format: string;
    channels: number;
    hasAlpha: boolean;
    isProgressive?: boolean;
    size: number;
}

export interface NoiseAnalysis {
    noiseLevel: number;
    noiseConsistency: number;
    channelVariance: { r: number; g: number; b: number };
}

export interface ArtifactAnalysis {
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
export async function extractExifData(buffer: Buffer): Promise<ExifData> {
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
        return { hasExif: false };
    }
}

// Get image statistics using sharp
export async function getImageStats(buffer: Buffer): Promise<ImageStats> {
    const metadata = await sharp(buffer).metadata();
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
export async function analyzeNoise(buffer: Buffer): Promise<NoiseAnalysis> {
    try {
        const stats = await sharp(buffer).stats();
        const channels = stats.channels;
        const avgStdDev = channels.reduce((sum, ch) => sum + ch.stdev, 0) / channels.length;

        const noiseLevel = avgStdDev / 255;
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
        return { noiseLevel: 0.5, noiseConsistency: 0.5, channelVariance: { r: 0, g: 0, b: 0 } };
    }
}

// Analyze image for AI-typical artifacts
export async function analyzeArtifacts(buffer: Buffer, stats: ImageStats): Promise<ArtifactAnalysis> {
    try {
        const sharpStats = await sharp(buffer).stats();
        const channels = sharpStats.channels;
        const avgEntropy = channels.reduce((sum, ch) => sum + ch.stdev, 0) / channels.length;
        const unnaturalSmoothing = avgEntropy < 20;

        const colorRanges = channels.map(ch => ch.max - ch.min);
        const avgColorRange = colorRanges.reduce((a, b) => a + b, 0) / colorRanges.length;
        const hasCompression = stats.format === "jpeg" && buffer.length < (stats.width * stats.height * 0.5);

        const suspiciousRatio = stats.width === stats.height;
        const standardAiSize = [512, 768, 1024, 1536, 2048].includes(stats.width) &&
            [512, 768, 1024, 1536, 2048].includes(stats.height);

        return {
            compression: hasCompression,
            blur: avgEntropy < 25,
            colorAdjustment: avgColorRange > 240,
            noisePatterns: avgEntropy < 15 || avgEntropy > 90,
            inconsistentLighting: false,
            edgeArtifacts: false,
            unnaturalSmoothing,
            repetitivePatterns: standardAiSize && suspiciousRatio,
        };
    } catch (error) {
        return {
            compression: false, blur: false, colorAdjustment: false, noisePatterns: false,
            inconsistentLighting: false, edgeArtifacts: false, unnaturalSmoothing: false, repetitivePatterns: false,
        };
    }
}

/**
 * Error Level Analysis (ELA)
 * Resaves the image at a known quality and compares it to the original.
 * Areas with high error levels indicate potential manipulation.
 */
export async function analyzeELA(buffer: Buffer): Promise<number> {
    try {
        const meta = await sharp(buffer).metadata();

        // ELA is fundamentally a JPEG recompression technique. For PNG/WebP/HEIC,
        // converting to JPEG and diffing against the original will often produce
        // large differences that look like "manipulation" even for authentic photos.
        // To avoid systematic false positives, only run ELA on JPEG inputs.
        const format = String(meta.format || "").toLowerCase();
        if (format !== "jpeg" && format !== "jpg") {
            return 0;
        }

        // Resave at 90% quality
        const resavedBuffer = await sharp(buffer)
            .jpeg({ quality: 90 })
            .toBuffer();

        const original = sharp(buffer);
        const resaved = sharp(resavedBuffer);

        const originalMeta = await original.metadata();
        const resavedMeta = await resaved.metadata();

        if (originalMeta.width !== resavedMeta.width || originalMeta.height !== resavedMeta.height) {
            return 0.5; // Error in comparison
        }

        // Get difference stats
        const diff = await original
            .composite([{ input: resavedBuffer, blend: 'difference' }])
            .toBuffer();

        const stats = await sharp(diff).stats();
        const avgDiff = stats.channels.reduce((sum, ch) => sum + ch.mean, 0) / stats.channels.length;

        // ELA score: higher difference (compared to normal noise) = higher suspicion
        // Usually, original images have low, uniform difference.
        // Manipulated images have bright spots in modified areas.
        return Math.min(1, avgDiff / 10);
    } catch (error) {
        console.error("ELA Analysis failed:", error);
        return 0;
    }
}

// Technical scoring functions
export function calculateExifScore(exif: ExifData): number {
    if (exif.software) {
        const softwareLower = exif.software.toLowerCase();
        if (AI_GENERATOR_PATTERNS.some(pattern => softwareLower.includes(pattern))) return 0;
    }
    let score = 0;
    let maxPoints = 0;
    maxPoints += 15; if (exif.hasExif) score += 15;
    maxPoints += 20;
    if (exif.cameraMake) {
        score += 10;
        if (KNOWN_CAMERA_BRANDS.some(brand => exif.cameraMake!.toLowerCase().includes(brand))) score += 10;
    }
    maxPoints += 10; if (exif.cameraModel) score += 10;
    maxPoints += 15; if (exif.dateTime) score += 15;
    maxPoints += 20; if (exif.gpsLatitude && exif.gpsLongitude) score += 20;
    maxPoints += 20;
    if (exif.iso) score += 5;
    if (exif.aperture) score += 5;
    if (exif.shutterSpeed) score += 5;
    if (exif.focalLength) score += 5;
    return score / maxPoints;
}

export function calculateNoiseScore(noise: NoiseAnalysis): number {
    let score = 0;
    if (noise.noiseLevel >= 0.1 && noise.noiseLevel <= 0.4) score += 0.5;
    else if (noise.noiseLevel < 0.05) score += 0.1;
    else if (noise.noiseLevel > 0.5) score += 0.2;
    else score += 0.3;
    score += noise.noiseConsistency * 0.5;
    return Math.max(0, Math.min(1, score));
}

export function calculateArtifactScore(artifacts: ArtifactAnalysis): number {
    let suspiciousCount = 0;
    if (artifacts.unnaturalSmoothing) suspiciousCount += 2;
    if (artifacts.repetitivePatterns) suspiciousCount += 2;
    if (artifacts.noisePatterns) suspiciousCount += 1;
    if (artifacts.blur && !artifacts.compression) suspiciousCount += 1;
    if (artifacts.colorAdjustment) suspiciousCount += 0.5;
    return Math.max(0, 1 - (suspiciousCount / 7));
}

// AI Analysis using GPT-4o
export async function analyzeWithAI(imageData: string): Promise<{
    result: "original" | "ai_generated" | "ai_modified";
    confidence: number;
    reasoning: string;
    artifacts: string[];
}> {
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: `You are a careful AI image forensics expert. Your job is to detect AI generation or AI-assisted edits, but you must avoid false positives. Do NOT assume an image is edited by default.

 HAIR & FACIAL MODIFICATIONS (very common AI edits - look carefully):
- Hair changes: added bangs/fringe, color changes, hairstyle modifications
- Hair texture that looks too smooth, uniform, or "painted"
- Hair edges that don't blend naturally with the forehead/face
- Facial feature changes: nose, lips, eyes, skin smoothing
- Age modifications (wrinkle removal, rejuvenation)
- Makeup additions or modifications

DIFFUSION & GENERATION ARTIFACTS:
- Check for "hallucinatory" details in complex textures (leaves, grass, hair)
- Look for mismatched earrings, glasses frames that don't join, or fingers that blend
- Look for localized areas with DIFFERENT noise grain than the rest of the image

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

CRITICAL RULE: Only classify as "ai_modified" when you have clear, specific evidence of editing (e.g. localized mismatched noise/grain, inconsistent lighting/shadows, pasted objects, inpainting seams, or very unnatural textures confined to specific regions). If you are unsure, prefer "original" with lower confidence.

CONFIDENCE GUIDELINES:
- 90-100: Multiple strong, specific artifacts that strongly indicate AI generation or AI edits.
- 70-89: Some evidence, but not conclusive.
- 50-69: Weak evidence / uncertain.
- Below 50 is not allowed; if uncertain, return "original" with confidence 50-69.

You MUST respond with valid JSON:
{"classification":"original"|"ai_generated"|"ai_modified","confidence":0-100,"reasoning":"explanation","artifacts":["list"]}`
            },
            {
                role: "user",
                content: [
                    { type: "text", text: "Analyze this image for signs of AI generation or AI-assisted edits. Pay special attention to: 1) HAIR (unnatural texture/edges), 2) FACE (localized smoothing/feature edits), 3) OBJECTS/TEXT (pasted elements). Only classify as ai_modified when you can name clear, specific visual evidence. If evidence is weak/uncertain, prefer original with lower confidence. Return JSON only." },
                    { type: "image_url", image_url: { url: imageData, detail: "high" } }
                ]
            }
        ],
        max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const classification = ["original", "ai_generated", "ai_modified"].includes(parsed.classification) ? parsed.classification : "original";
    const confidence = Math.min(100, Math.max(0, Number(parsed.confidence) || 60));

    return {
        result: classification as "original" | "ai_generated" | "ai_modified",
        confidence,
        reasoning: String(parsed.reasoning || ""),
        artifacts: Array.isArray(parsed.artifacts) ? parsed.artifacts : [],
    };
}

/**
 * Resizes image data (base64) if it's too large for OpenAI's 20MB limit.
 */
async function ensureOpenAILimit(imageData: string): Promise<string> {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    // OpenAI constant limit is 20MB for image data. 
    // We target ~15MB to be safe with some overhead.
    if (buffer.length < 15 * 1024 * 1024) {
        return imageData;
    }

    console.log(`Image size (${(buffer.length / 1024 / 1024).toFixed(2)}MB) exceeds safe limit for OpenAI. Resizing...`);

    // Resize down by 50% scale or more until it's smaller
    const metadata = await sharp(buffer).metadata();
    const targetWidth = Math.round((metadata.width || 2048) * 0.7);

    const resizedBuffer = await sharp(buffer)
        .resize({ width: targetWidth })
        .jpeg({ quality: 85 })
        .toBuffer();

    const mimeType = imageData.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';
    const resizedBase64 = `data:${mimeType};base64,${resizedBuffer.toString("base64")}`;

    console.log(`Image resized to ${(resizedBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    return resizedBase64;
}

export async function analyzeImageAdvanced(imageData: string, filename: string) {
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");
    const stats = await getImageStats(buffer);

    const [exif, noise, artifacts, elaScore, sightEngine] = await Promise.all([
        extractExifData(buffer),
        analyzeNoise(buffer),
        analyzeArtifacts(buffer, stats),
        analyzeELA(buffer),
        analyzeWithSightEngine(buffer),
    ]);

    const exifScore = calculateExifScore(exif);
    const noiseScore = calculateNoiseScore(noise);
    const artifactScore = calculateArtifactScore(artifacts);

    const isJpeg = stats.format.toUpperCase() === "JPEG" || stats.format.toUpperCase() === "JPG";
    const effectiveElaScore = isJpeg ? elaScore : 0;

    // Technical authenticity score used to reduce false positives from LLM classification.
    // Higher means more likely an authentic/original photo.
    const technicalScore =
        exifScore * 0.35 +
        noiseScore * 0.2 +
        artifactScore * 0.25 +
        (1 - effectiveElaScore) * 0.2;

    let aiAnalysis;
    try {
        const safeImageData = await ensureOpenAILimit(imageData);
        aiAnalysis = await analyzeWithAI(safeImageData);
    } catch (error) {
        console.error("AI analysis failed, using technical fallback:", error);
        // ELA adds precision to technical analysis
        aiAnalysis = {
            result: technicalScore > 0.6 ? "original" : technicalScore < 0.4 ? "ai_generated" : "ai_modified",
            confidence: Math.round(Math.abs(technicalScore - 0.5) * 200),
            reasoning: "Technical analysis fallback including ELA",
            artifacts: [],
        };
    }

    let finalResult = aiAnalysis.result;
    let finalConfidence = aiAnalysis.confidence;

    // Cross-verify AI result with ELA (JPEG only)
    if (isJpeg && effectiveElaScore > 0.6 && finalResult === "original") {
        // High ELA difference but AI said original - highly likely modified
        finalResult = "ai_modified";
        finalConfidence = Math.round(effectiveElaScore * 100);
    }

    if (exifScore >= 0.5 && exif.cameraMake) {
        if (aiAnalysis.result === "original") {
            finalConfidence = Math.min(99, finalConfidence + 10);
        } else if (aiAnalysis.result === "ai_modified" && aiAnalysis.confidence < 70) {
            finalResult = "original";
            finalConfidence = Math.round(exifScore * 100);
        }
    }

    // Reduce false positives on PNG/no-EXIF uploads (common when photos are exported by apps)
    // by allowing technical signals to override an LLM "ai_modified" call.
    const technicalSuggestsOriginal =
        technicalScore >= 0.67 &&
        artifactScore >= 0.75 &&
        effectiveElaScore < 0.55;

    const sightEngineSuggestsOriginalForPngOverride =
        !!sightEngine && !sightEngine.isGenerated && sightEngine.confidence >= 90;

    if (
        finalResult === "ai_modified" &&
        finalConfidence >= 85 &&
        !exif.hasExif &&
        stats.format.toUpperCase() === "PNG" &&
        (technicalSuggestsOriginal || sightEngineSuggestsOriginalForPngOverride)
    ) {
        finalResult = "original";
        finalConfidence = Math.max(60, Math.min(99, Math.round(technicalScore * 100)));
    }

    if (!exif.hasExif && aiAnalysis.result === "ai_generated") {
        finalConfidence = Math.min(99, finalConfidence + 5);
    }

    // SightEngine Verification
    if (sightEngine && sightEngine.isGenerated) {
        if (finalResult === "original") {
            // Strong contradiction: SightEngine says generated, but others say original
            // Trust SightEngine/GPT if confidence is high, or degrade confidence
            if (sightEngine.confidence > 80) {
                finalResult = "ai_generated";
                finalConfidence = Math.round(sightEngine.confidence);
            } else {
                finalConfidence = Math.max(0, finalConfidence - 30);
            }
        } else {
            // Confirmation: both suspect AI
            finalConfidence = Math.min(99, finalConfidence + 15);
        }
    } else if (sightEngine && !sightEngine.isGenerated && sightEngine.confidence > 90) {
        // SightEngine is very sure it's original
        if (finalResult !== "original") {
            finalConfidence = Math.max(0, finalConfidence - 20);
        } else {
            finalConfidence = Math.min(99, finalConfidence + 10);
        }
    }

    // Conservative, high-precision policy:
    // only return a definitive label when evidence is strong and corroborated.
    // otherwise return "uncertain" to avoid false positives.
    const suspiciousArtifactCount = [
        artifacts.compression,
        artifacts.blur,
        artifacts.colorAdjustment,
        artifacts.noisePatterns,
        artifacts.inconsistentLighting,
        artifacts.edgeArtifacts,
        artifacts.unnaturalSmoothing,
        artifacts.repetitivePatterns,
    ].filter(Boolean).length;

    const sightEngineSuggestsGenerated = !!sightEngine && sightEngine.isGenerated && sightEngine.confidence >= 90;
    const sightEngineSuggestsOriginal = !!sightEngine && !sightEngine.isGenerated && sightEngine.confidence >= 90;

    let conservativeResult: AnalysisResult = "uncertain";
    let conservativeConfidence = Math.min(69, Math.max(50, finalConfidence));

    if (sightEngineSuggestsGenerated) {
        conservativeResult = "ai_generated";
        conservativeConfidence = Math.max(conservativeConfidence, Math.round(sightEngine!.confidence));
    } else if (finalResult === "ai_generated") {
        if (finalConfidence >= 90) {
            conservativeResult = "ai_generated";
            conservativeConfidence = finalConfidence;
        }
    } else if (finalResult === "ai_modified") {
        const hasStrongModificationEvidence =
            (isJpeg && effectiveElaScore >= 0.75) ||
            suspiciousArtifactCount >= 2 ||
            (suspiciousArtifactCount >= 1 && technicalScore <= 0.55);

        if (hasStrongModificationEvidence && finalConfidence >= 90) {
            conservativeResult = "ai_modified";
            conservativeConfidence = finalConfidence;
        }
    } else if (finalResult === "original") {
        const hasStrongOriginalEvidence =
            technicalScore >= 0.72 &&
            noiseScore >= 0.7 &&
            artifactScore >= 0.75 &&
            (exif.hasExif || sightEngineSuggestsOriginal);

        if (hasStrongOriginalEvidence && finalConfidence >= 70) {
            conservativeResult = "original";
            conservativeConfidence = finalConfidence;
        }
    }

    finalResult = conservativeResult;
    finalConfidence = conservativeConfidence;

    return {
        result: finalResult as AnalysisResult,
        confidence: finalConfidence,
        artifacts: {
            compression: artifacts.compression,
            blur: artifacts.blur,
            colorAdjustment: artifacts.colorAdjustment,
            noisePatterns: artifacts.noisePatterns,
            inconsistentLighting: artifacts.inconsistentLighting,
            edgeArtifacts: artifacts.edgeArtifacts,
        },
        metadata: {
            width: stats.width,
            height: stats.height,
            format: stats.format.toUpperCase(),
            size: stats.size,
            hasExif: exif.hasExif,
            cameraMake: exif.cameraMake,
            cameraModel: exif.cameraModel,
        },
        debugScores: {
            exif_score: exifScore,
            noise_score: noiseScore,
            artifact_score: artifactScore,
            ela_score: elaScore,
            technical_score: technicalScore,
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
        },
    };
}
