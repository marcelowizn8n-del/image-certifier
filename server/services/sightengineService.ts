const API_USER = process.env.SIGHTENGINE_API_USER;
const API_SECRET = process.env.SIGHTENGINE_API_SECRET;

export interface SightEngineResult {
    status: string;
    request: {
        id: string;
        timestamp: number;
        operations: number;
    };
    type: {
        genai: {
            is_generated: number;
            confidence: number;
        };
    };
}

/**
 * Analyzes an image using SightEngine to detect AI generation.
 */
export async function analyzeWithSightEngine(buffer: Buffer): Promise<{
    isGenerated: boolean;
    confidence: number;
    raw: any;
}> {
    if (!API_USER || !API_SECRET) {
        console.warn('SightEngine credentials missing, skipping analysis.');
        return { isGenerated: false, confidence: 0, raw: null };
    }

    try {
        // Node.js 18+ has native fetch and FormData
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(buffer)], { type: 'image/jpeg' });
        formData.append('media', blob, 'image.jpg');
        formData.append('models', 'genai');
        formData.append('api_user', API_USER);
        formData.append('api_secret', API_SECRET);

        const response = await fetch('https://api.sightengine.com/1.0/check.json', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`SightEngine API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json() as any;

        if (data.status !== 'success') {
            throw new Error(`SightEngine API failure: ${data.error?.message || 'Unknown error'}`);
        }

        const genai = data.type?.genai;
        return {
            isGenerated: genai ? genai.is_generated > 0.5 : false,
            confidence: genai ? genai.confidence * 100 : 0,
            raw: data,
        };
    } catch (error) {
        console.error('SightEngine analysis failed:', error);
        return { isGenerated: false, confidence: 0, raw: null };
    }
}

export function isSightEngineConfigured(): boolean {
    return !!(API_USER && API_SECRET);
}
