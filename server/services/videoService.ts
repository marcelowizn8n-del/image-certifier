import { analyzeVideoWithGPT4V, isVideoAnalysisConfigured } from "../videoAnalysisClient";
import { analyzeVideoWithRealityDefender, isRealityDefenderConfigured } from "../realityDefenderClient";
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

    // Run GPT-4V and Reality Defender in parallel
    const [gptResult, rdResult] = await Promise.all([
        analyzeVideoWithGPT4V(videoBuffer, filename),
        isRealityDefenderConfigured()
            ? analyzeVideoWithRealityDefender(videoBuffer, filename).catch(err => {
                console.error("[Video] Reality Defender failed, continuing with GPT-4V only:", err.message);
                return null;
            })
            : Promise.resolve(null),
    ]);

    // Start with GPT-4V results
    let manipulationProbability = gptResult.manipulation_probability;
    let confidence = gptResult.confidence;
    let indicators = { ...gptResult.indicators };

    // Combine with Reality Defender if available
    if (rdResult) {
        console.log(`[Video] Reality Defender: manipulation=${rdResult.manipulation_probability.toFixed(2)}, deepfake=${rdResult.is_deepfake}, confidence=${rdResult.confidence.toFixed(2)}`);

        // Weighted combination: GPT-4V (0.4) + Reality Defender (0.6) - RD is specialized for video
        manipulationProbability = gptResult.manipulation_probability * 0.4 + rdResult.manipulation_probability * 0.6;
        confidence = Math.max(gptResult.confidence, rdResult.confidence);

        // Merge indicators (either source detecting = true)
        indicators = {
            facial_artifacts: (gptResult.indicators?.facial_artifacts || rdResult.indicators?.facial_artifacts) ?? false,
            temporal_inconsistencies: (gptResult.indicators?.temporal_inconsistencies || rdResult.indicators?.temporal_inconsistencies) ?? false,
            audio_video_mismatch: (gptResult.indicators?.audio_video_mismatch || rdResult.indicators?.audio_video_mismatch) ?? false,
            lip_sync_issues: (gptResult.indicators?.lip_sync_issues || rdResult.indicators?.lip_sync_issues) ?? false,
            blinking_anomalies: (gptResult.indicators?.blinking_anomalies || rdResult.indicators?.blinking_anomalies) ?? false,
            background_artifacts: (gptResult.indicators?.background_artifacts || rdResult.indicators?.background_artifacts) ?? false,
        };

        // If Reality Defender strongly detects deepfake but GPT-4V doesn't, trust RD
        if (rdResult.is_deepfake && rdResult.confidence > 0.7 && gptResult.manipulation_probability < 0.5) {
            manipulationProbability = Math.max(manipulationProbability, 0.75);
        }

        // If both agree it's a deepfake, very high confidence
        if (rdResult.is_deepfake && gptResult.manipulation_probability >= 0.6) {
            confidence = Math.min(1, confidence + 0.15);
        }
    }

    // Determine result based on manipulation probability
    const manipulationScore = Math.round(manipulationProbability * 100);
    let result: VideoAnalysisResultType;

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
        confidence: Math.round(confidence * 100),
        manipulationScore,
        indicators: {
            facialArtifacts: indicators.facial_artifacts || false,
            temporalInconsistencies: indicators.temporal_inconsistencies || false,
            audioVideoMismatch: indicators.audio_video_mismatch || false,
            lipSyncIssues: indicators.lip_sync_issues || false,
            blinkingAnomalies: indicators.blinking_anomalies || false,
            backgroundArtifacts: indicators.background_artifacts || false,
        },
    };
}
