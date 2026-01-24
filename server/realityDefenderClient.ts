const REALITY_DEFENDER_API_KEY = process.env.REALITY_DEFENDER_API_KEY;
const REALITY_DEFENDER_BASE_URL = 'https://api.prd.realitydefender.xyz';

interface PresignedUrlResponse {
  presignedUrl: string;
  fileKey: string;
}

interface DetectionResult {
  manipulation_probability: number;
  is_deepfake: boolean;
  confidence: number;
  indicators: {
    facial_artifacts?: boolean;
    temporal_inconsistencies?: boolean;
    audio_video_mismatch?: boolean;
    lip_sync_issues?: boolean;
    blinking_anomalies?: boolean;
    background_artifacts?: boolean;
  };
  analysis_metadata?: {
    models_used?: string[];
    processing_time_ms?: number;
  };
}

function getContentType(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop();
  switch (extension) {
    case 'mp4':
      return 'video/mp4';
    case 'webm':
      return 'video/webm';
    case 'mov':
      return 'video/quicktime';
    default:
      return 'video/mp4';
  }
}

export async function analyzeVideoWithRealityDefender(
  videoBuffer: Buffer,
  filename: string
): Promise<DetectionResult> {
  if (!REALITY_DEFENDER_API_KEY) {
    throw new Error('REALITY_DEFENDER_API_KEY is not configured');
  }

  // Step 1: Get presigned URL for upload
  const presignedResponse = await fetch(`${REALITY_DEFENDER_BASE_URL}/api/files/aws-presigned`, {
    method: 'POST',
    headers: {
      'X-API-KEY': REALITY_DEFENDER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileName: filename }),
  });

  if (!presignedResponse.ok) {
    const error = await presignedResponse.text();
    throw new Error(`Failed to get presigned URL: ${error}`);
  }

  const presignedData = await presignedResponse.json() as PresignedUrlResponse;

  // Step 2: Upload video to presigned URL with correct Content-Type
  const contentType = getContentType(filename);
  const uploadResponse = await fetch(presignedData.presignedUrl, {
    method: 'PUT',
    body: videoBuffer,
    headers: {
      'Content-Type': contentType,
    },
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload video to presigned URL');
  }

  // Step 3: Request analysis (poll for results)
  const analysisResponse = await fetch(`${REALITY_DEFENDER_BASE_URL}/api/detect`, {
    method: 'POST',
    headers: {
      'X-API-KEY': REALITY_DEFENDER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fileKey: presignedData.fileKey }),
  });

  if (!analysisResponse.ok) {
    const error = await analysisResponse.text();
    throw new Error(`Analysis request failed: ${error}`);
  }

  const result = await analysisResponse.json() as DetectionResult;
  return result;
}

export function isRealityDefenderConfigured(): boolean {
  return !!REALITY_DEFENDER_API_KEY;
}
