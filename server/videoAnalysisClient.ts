import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

interface VideoAnalysisResult {
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
}

interface FrameAnalysis {
  isManipulated: boolean;
  confidence: number;
  indicators: {
    facial_artifacts: boolean;
    blinking_anomalies: boolean;
    background_artifacts: boolean;
    lip_sync_issues: boolean;
  };
  explanation: string;
}

async function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      videoPath
    ]);
    
    let output = '';
    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ffprobe.on('close', () => {
      const duration = parseFloat(output.trim());
      resolve(isNaN(duration) ? 10 : duration);
    });
    
    ffprobe.on('error', () => {
      resolve(10);
    });
  });
}

async function extractFrames(videoBuffer: Buffer, numFrames: number = 5): Promise<string[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-frames-'));
  const videoPath = path.join(tempDir, 'input.mp4');
  
  await fs.writeFile(videoPath, videoBuffer);
  
  const duration = await getVideoDuration(videoPath);
  const fps = Math.max(0.5, numFrames / duration);
  
  const framePattern = path.join(tempDir, 'frame-%03d.jpg');
  
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vf', `fps=${fps}`,
      '-frames:v', numFrames.toString(),
      '-q:v', '2',
      framePattern,
      '-y'
    ]);
    
    ffmpeg.on('close', async (code) => {
      try {
        const files = await fs.readdir(tempDir);
        const frameFiles = files
          .filter(f => f.startsWith('frame-') && f.endsWith('.jpg'))
          .sort()
          .map(f => path.join(tempDir, f));
        
        if (frameFiles.length === 0) {
          reject(new Error('Failed to extract frames from video'));
          return;
        }
        
        resolve(frameFiles);
      } catch (err) {
        reject(err);
      }
    });
    
    ffmpeg.on('error', (err) => {
      reject(err);
    });
  });
}

async function analyzeFrameWithGPT4V(frameBase64: string): Promise<FrameAnalysis> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are an expert in detecting AI-generated and manipulated video frames, specifically deepfakes. Analyze the provided video frame for signs of manipulation.

Look for these indicators:
1. Facial artifacts: Unnatural skin texture, blurry face edges, inconsistent lighting on face
2. Eye/blinking anomalies: Unnatural eye reflections, irregular iris patterns
3. Background artifacts: Warping, blending issues, inconsistent depth
4. Lip/mouth issues: Unnatural mouth movements frozen in frame

Respond ONLY with valid JSON in this exact format:
{
  "isManipulated": boolean,
  "confidence": number between 0 and 1,
  "indicators": {
    "facial_artifacts": boolean,
    "blinking_anomalies": boolean,
    "background_artifacts": boolean,
    "lip_sync_issues": boolean
  },
  "explanation": "brief explanation"
}`
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analyze this video frame for signs of deepfake or AI manipulation. Is this frame from an authentic video or has it been manipulated?"
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${frameBase64}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from GPT-4 Vision');
    }

    const parsed = JSON.parse(content);
    
    return {
      isManipulated: Boolean(parsed.isManipulated),
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0.5,
      indicators: {
        facial_artifacts: Boolean(parsed.indicators?.facial_artifacts),
        blinking_anomalies: Boolean(parsed.indicators?.blinking_anomalies),
        background_artifacts: Boolean(parsed.indicators?.background_artifacts),
        lip_sync_issues: Boolean(parsed.indicators?.lip_sync_issues),
      },
      explanation: String(parsed.explanation || 'Analysis complete'),
    };
  } catch (error) {
    console.error('Error analyzing frame:', error);
    return {
      isManipulated: false,
      confidence: 0.3,
      indicators: {
        facial_artifacts: false,
        blinking_anomalies: false,
        background_artifacts: false,
        lip_sync_issues: false,
      },
      explanation: 'Could not analyze this frame',
    };
  }
}

async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      try {
        await fs.unlink(path.join(tempDir, file));
      } catch (e) {}
    }
    await fs.rmdir(tempDir);
  } catch (e) {}
}

export async function analyzeVideoWithGPT4V(
  videoBuffer: Buffer,
  filename: string
): Promise<VideoAnalysisResult> {
  let tempDir: string | null = null;
  
  try {
    const framePaths = await extractFrames(videoBuffer, 5);
    tempDir = path.dirname(framePaths[0]);
    
    if (framePaths.length === 0) {
      throw new Error('No frames could be extracted from video');
    }

    const frameAnalyses = await Promise.all(
      framePaths.map(async (framePath) => {
        const frameBuffer = await fs.readFile(framePath);
        const frameBase64 = frameBuffer.toString('base64');
        return analyzeFrameWithGPT4V(frameBase64);
      })
    );

    const validAnalyses = frameAnalyses.filter(a => a.confidence > 0.2);
    
    if (validAnalyses.length === 0) {
      return {
        manipulation_probability: 0,
        is_deepfake: false,
        confidence: 0.3,
        indicators: {},
      };
    }

    const totalWeight = validAnalyses.reduce((sum, a) => sum + a.confidence, 0);
    const weightedManipulation = validAnalyses.reduce(
      (sum, a) => sum + (a.isManipulated ? a.confidence : 0),
      0
    );
    const manipulationProbability = weightedManipulation / totalWeight;
    
    const avgConfidence = validAnalyses.reduce((sum, a) => sum + a.confidence, 0) / validAnalyses.length;
    
    const manipulatedCount = validAnalyses.filter(a => a.isManipulated).length;
    const totalFrames = validAnalyses.length;
    
    const indicators = {
      facial_artifacts: validAnalyses.filter(a => a.indicators.facial_artifacts).length > totalFrames * 0.3,
      temporal_inconsistencies: manipulatedCount >= 2 && manipulatedCount < totalFrames,
      audio_video_mismatch: false,
      lip_sync_issues: validAnalyses.filter(a => a.indicators.lip_sync_issues).length > totalFrames * 0.3,
      blinking_anomalies: validAnalyses.filter(a => a.indicators.blinking_anomalies).length > totalFrames * 0.3,
      background_artifacts: validAnalyses.filter(a => a.indicators.background_artifacts).length > totalFrames * 0.3,
    };

    return {
      manipulation_probability: manipulationProbability,
      is_deepfake: manipulationProbability >= 0.6,
      confidence: avgConfidence,
      indicators,
    };
  } finally {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  }
}

export function isVideoAnalysisConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}
