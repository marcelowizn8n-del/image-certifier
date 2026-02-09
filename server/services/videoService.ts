import { analyzeVideoWithGPT4V, isVideoAnalysisConfigured } from "../videoAnalysisClient";
import { type VideoAnalysisResult as VideoAnalysisResultType } from "@shared/schema";

export interface VideoDetectionResult {
    result: VideoAnalysisResultType;
    confidence: number;
    manipulationScore: number;
    indicators: {
        facialArtifacts: boolean;
        temporalInconsistencies: boolean;
        audioVideoMismatch: boolean;
        lipSyncIssues: boolean;
        blinkingAnomalies: boolean;
        backgroundArtifacts: boolean;
    };
}

export async function processVideoAnalysis(videoBuffer: Buffer, filename: string): Promise<VideoDetectionResult> {
    if (!isVideoAnalysisConfigured()) {
        throw new Error("Video analysis is not configured. OpenAI API key not found.");
    }

    // Analyze video with GPT-4 Vision
    const detectionResult = await analyzeVideoWithGPT4V(videoBuffer, filename);

    // Determine result based on manipulation probability
    let result: VideoAnalysisResultType;
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

    return {
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
    };
}
