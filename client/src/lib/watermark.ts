import originalSealImage from '@/assets/seals/original-seal.png';
import aiGeneratedSealImage from '@/assets/seals/aigenerated-seal.png';
import aiModifiedSealImage from '@/assets/seals/aimodified-seal.png';

export type CertificationType = 'original' | 'ai-generated' | 'ai-modified';

const SEAL_IMAGES: Record<CertificationType, string> = {
  'original': originalSealImage,
  'ai-generated': aiGeneratedSealImage,
  'ai-modified': aiModifiedSealImage
};

export async function applyWatermark(
  imageDataUrl: string,
  certificationType: CertificationType
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const sealImg = new Image();
      sealImg.crossOrigin = 'anonymous';
      
      sealImg.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        canvas.width = img.width;
        canvas.height = img.height;

        ctx.drawImage(img, 0, 0);

        const sealSize = Math.min(img.width, img.height) * 0.25;
        const margin = sealSize * 0.1;
        const sealX = canvas.width - sealSize - margin;
        const sealY = canvas.height - sealSize - margin;

        ctx.drawImage(sealImg, sealX, sealY, sealSize, sealSize);

        resolve(canvas.toDataURL('image/png'));
      };

      sealImg.onerror = () => {
        reject(new Error('Failed to load seal image'));
      };

      sealImg.src = SEAL_IMAGES[certificationType];
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageDataUrl;
  });
}

export function downloadImage(dataUrl: string, filename: string = 'certified-image.png'): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
