const HIVE_API_KEY = process.env.HIVE_API_KEY;

export interface HiveResult {
  isGenerated: boolean;
  confidence: number;
  raw: any;
}

/**
 * Analyzes an image using Hive Moderation API to detect AI-generated content.
 * Returns gracefully if API key is not configured.
 */
export async function analyzeWithHive(buffer: Buffer): Promise<HiveResult> {
  if (!HIVE_API_KEY) {
    return { isGenerated: false, confidence: 0, raw: null };
  }

  try {
    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' });
    formData.append('media', blob, 'image.jpg');

    const response = await fetch('https://api.thehive.ai/api/v2/task/sync', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${HIVE_API_KEY}`,
        'Accept': 'application/json',
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Hive API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json() as any;

    // Hive returns status array with output classes
    const output = data?.status?.[0]?.response?.output;
    if (!output || !Array.isArray(output)) {
      console.warn('[Hive] Unexpected response structure:', JSON.stringify(data).slice(0, 200));
      return { isGenerated: false, confidence: 0, raw: data };
    }

    // Find AI-generated class score
    const classes = output[0]?.classes || [];
    const aiGeneratedClass = classes.find(
      (c: any) => c.class === 'ai_generated'
    );
    const notAiClass = classes.find(
      (c: any) => c.class === 'not_ai_generated'
    );

    const aiScore = aiGeneratedClass?.score ?? 0;
    const notAiScore = notAiClass?.score ?? 0;

    const isGenerated = aiScore > 0.5;
    const confidence = Math.round(Math.max(aiScore, notAiScore) * 100);

    console.log(`[Hive] AI score: ${aiScore.toFixed(3)}, Not-AI score: ${notAiScore.toFixed(3)}, isGenerated: ${isGenerated}`);

    return { isGenerated, confidence, raw: data };
  } catch (error) {
    console.error('[Hive] Analysis failed:', error);
    return { isGenerated: false, confidence: 0, raw: null };
  }
}

export function isHiveConfigured(): boolean {
  return !!HIVE_API_KEY;
}
