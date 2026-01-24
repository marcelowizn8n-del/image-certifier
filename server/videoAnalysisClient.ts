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

async function extractFrames(videoBuffer: Buffer, numFrames: number = 5): Promise<string[]> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'video-frames-'));
  const videoPath = path.join(tempDir, 'input.mp4');
  
  await fs.writeFile(videoPath, videoBuffer);
  
  const framePattern = path.join(tempDir, 'frame-%03d.jpg');
  
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-i', videoPath,
      '-vf', `select='eq(n,0)+eq(n,floor(n_frames/${numFrames}))+eq(n,floor(2*n_frames/${numFrames}))+eq(n,floor(3*n_frames/${numFrames}))+eq(n,floor(4*n_frames/${numFrames}))',setpts=N/FRAME_RATE/TB`,
      '-vsync', 'vfr',
      '-frames:v', numFrames.toString(),
      '-q:v', '2',
      framePattern,
      '-y'
    ]);
    
    let stderr = '';
    ffmpeg.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    ffmpeg.on('close', async (code) => {
      if (code !== 0) {
        const simpleExtract = spawn('ffmpeg', [
          '-i', videoPath,
          '-vf', `fps=1/${Math.max(1, Math.floor(10 / numFrames))}`,
          '-frames:v', numFrames.toString(),
          '-q:v', '2',
          framePattern,
          '-y'
        ]);
        
        simpleExtract.on('close', async (code2) => {
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
        return;
      }
      
      try {
        const files = await fs.readdir(tempDir);
        const frameFiles = files
          .filter(f => f.startsWith('frame-') && f.endsWith('.jpg'))
          .sort()
          .map(f => path.join(tempDir, f));
        
        resolve(frameFiles);
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function analyzeFrameWithGPT4V(frameBase64: string): Promise<{
  isManipulated: boolean;
  confidence: number;
  indicators: {
    facial_artifacts: boolean;
    blinking_anomalies: boolean;
    background_artifacts: boolean;
    lip_sync_issues: boolean;
  };
  explanation: string;
}> {
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

  return JSON.parse(content);
}

export async function analyzeVideoWithGPT4V(
  videoBuffer: Buffer,
  filename: string
): Promise<VideoAnalysisResult> {
  let framePaths: string[] = [];
  
  try {
    framePaths = await extractFrames(videoBuffer, 5);
    
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

    const manipulatedCount = frameAnalyses.filter(a => a.isManipulated).length;
    const totalFrames = frameAnalyses.length;
    const manipulationProbability = manipulatedCount / totalFrames;
    
    const avgConfidence = frameAnalyses.reduce((sum, a) => sum + a.confidence, 0) / totalFrames;
    
    const indicators = {
      facial_artifacts: frameAnalyses.some(a => a.indicators.facial_artifacts),
      temporal_inconsistencies: manipulatedCount > 1 && manipulatedCount < totalFrames,
      audio_video_mismatch: false,
      lip_sync_issues: frameAnalyses.some(a => a.indicators.lip_sync_issues),
      blinking_anomalies: frameAnalyses.some(a => a.indicators.blinking_anomalies),
      background_artifacts: frameAnalyses.some(a => a.indicators.background_artifacts),
    };

    for (const framePath of framePaths) {
      try {
        await fs.unlink(framePath);
      } catch (e) {}
    }
    
    const tempDir = path.dirname(framePaths[0]);
    try {
      const inputVideo = path.join(tempDir, 'input.mp4');
      await fs.unlink(inputVideo);
      await fs.rmdir(tempDir);
    } catch (e) {}

    return {
      manipulation_probability: manipulationProbability,
      is_deepfake: manipulationProbability >= 0.6,
      confidence: avgConfidence,
      indicators,
    };
  } catch (error) {
    for (const framePath of framePaths) {
      try {
        await fs.unlink(framePath);
      } catch (e) {}
    }
    throw error;
  }
}

export function isVideoAnalysisConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}
