const API_BASE_URL = 'https://www.imgcertifier.app';

export interface AnalysisResult {
  id: number;
  result: 'original' | 'ai_generated' | 'ai_modified' | 'uncertain';
  confidence: number;
  artifacts?: {
    textureAnomalies?: boolean;
    lightingInconsistencies?: boolean;
    anatomicalIssues?: boolean;
    patternRepetition?: boolean;
    colorArtifacts?: boolean;
    blurringAnomalies?: boolean;
    edgeArtifacts?: boolean;
  };
  metadata?: {
    width?: number;
    height?: number;
    format?: string;
    hasExif?: boolean;
    cameraMake?: string;
    cameraModel?: string;
  };
  debugScores?: {
    aiScore: number;
    originalScore: number;
    modifiedScore: number;
    exifBoost: number;
    artifactPenalty: number;
    finalConfidence: number;
  };
  createdAt?: string;
}

export const analyzeImage = async (imageBase64: string, filename?: string): Promise<AnalysisResult> => {
  const response = await fetch(`${API_BASE_URL}/api/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ 
      imageData: imageBase64, 
      filename: filename || 'image.jpg' 
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Analysis failed' }));
    throw new Error(error.message || 'Analysis failed');
  }

  return response.json();
};

export const analyzeImageUrl = async (url: string): Promise<AnalysisResult> => {
  const response = await fetch(`${API_BASE_URL}/api/analyze-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Analysis failed' }));
    throw new Error(error.message || 'Analysis failed');
  }

  return response.json();
};

export const getAnalysisHistory = async (): Promise<AnalysisResult[]> => {
  const response = await fetch(`${API_BASE_URL}/api/analyses`);
  if (!response.ok) {
    throw new Error('Failed to fetch history');
  }
  return response.json();
};

