export type CertificationType = 'original' | 'ai-generated' | 'ai-modified';

interface WatermarkConfig {
  text: string;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
}

const WATERMARK_CONFIGS: Record<CertificationType, WatermarkConfig> = {
  'original': {
    text: 'ORIGINAL',
    backgroundColor: 'rgba(16, 185, 129, 0.9)',
    textColor: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.8)'
  },
  'ai-generated': {
    text: 'AI GENERATED',
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    textColor: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.8)'
  },
  'ai-modified': {
    text: 'AI MODIFIED',
    backgroundColor: 'rgba(245, 158, 11, 0.9)',
    textColor: '#ffffff',
    borderColor: 'rgba(255, 255, 255, 0.8)'
  }
};

export async function applyWatermark(
  imageDataUrl: string,
  certificationType: CertificationType
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;

      ctx.drawImage(img, 0, 0);

      const config = WATERMARK_CONFIGS[certificationType];
      
      const scale = Math.min(img.width, img.height) / 400;
      const fontSize = Math.max(12, Math.min(24, 16 * scale));
      const padding = fontSize * 0.6;
      const margin = fontSize * 0.8;
      const borderRadius = fontSize * 0.4;

      ctx.font = `bold ${fontSize}px "Inter", "Segoe UI", sans-serif`;
      const textMetrics = ctx.measureText(config.text);
      const textWidth = textMetrics.width;
      const textHeight = fontSize;

      const badgeWidth = textWidth + padding * 2;
      const badgeHeight = textHeight + padding * 1.2;
      const badgeX = canvas.width - badgeWidth - margin;
      const badgeY = canvas.height - badgeHeight - margin;

      ctx.beginPath();
      ctx.moveTo(badgeX + borderRadius, badgeY);
      ctx.lineTo(badgeX + badgeWidth - borderRadius, badgeY);
      ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + borderRadius);
      ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - borderRadius);
      ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - borderRadius, badgeY + badgeHeight);
      ctx.lineTo(badgeX + borderRadius, badgeY + badgeHeight);
      ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - borderRadius);
      ctx.lineTo(badgeX, badgeY + borderRadius);
      ctx.quadraticCurveTo(badgeX, badgeY, badgeX + borderRadius, badgeY);
      ctx.closePath();

      ctx.fillStyle = config.backgroundColor;
      ctx.fill();

      ctx.strokeStyle = config.borderColor;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = config.textColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(config.text, badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);

      const logoSize = fontSize * 0.9;
      const logoX = badgeX - logoSize - margin * 0.5;
      const logoY = badgeY + (badgeHeight - logoSize) / 2;

      ctx.beginPath();
      ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.95)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${logoSize * 0.5}px "Inter", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('IC', logoX + logoSize / 2, logoY + logoSize / 2);

      resolve(canvas.toDataURL('image/png'));
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
