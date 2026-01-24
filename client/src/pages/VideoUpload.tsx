import { useState, useCallback, useRef } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload as UploadIcon, 
  Video,
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Shield,
  Info,
  Eye,
  AlertTriangle,
  HelpCircle
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import type { VideoAnalysis } from "@shared/schema";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

interface VideoAnalysisStatus {
  configured: boolean;
  provider: string;
  freeQuota: string;
}

export default function VideoUpload() {
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VideoAnalysis | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: statusData } = useQuery<VideoAnalysisStatus>({
    queryKey: ["/api/video-analysis-status"],
  });

  const analyzeMutation = useMutation({
    mutationFn: async (data: { videoData: string; filename: string }) => {
      const response = await apiRequest("POST", "/api/analyze-video", data);
      return await response.json() as VideoAnalysis;
    },
    onSuccess: (data) => {
      setResult(data);
      setIsAnalyzing(false);
      setProgress(100);
      toast.success(t('video.analysisComplete'), {
        description: t('video.analysisSuccess'),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/video-analyses"] });
    },
    onError: (error: Error) => {
      setError(error.message);
      setIsAnalyzing(false);
      setProgress(0);
      toast.error(t('video.analysisFailed'), {
        description: error.message || t('video.analysisFailed'),
      });
    },
  });

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return t('video.invalidType');
    }
    if (file.size > MAX_FILE_SIZE) {
      return t('video.fileTooLarge');
    }
    return null;
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      toast.error(t('video.invalidFile'), {
        description: validationError,
      });
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);

    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
  }, [t]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleAnalyze = useCallback(() => {
    if (!file || !preview) return;

    setIsAnalyzing(true);
    setError(null);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    const reader = new FileReader();
    reader.onload = (e) => {
      const videoData = e.target?.result as string;
      analyzeMutation.mutate({ videoData, filename: file.name });
      clearInterval(progressInterval);
    };
    reader.readAsDataURL(file);
  }, [file, preview, analyzeMutation]);

  const handleReset = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setProgress(0);
  }, []);

  const getResultBadge = (analysisResult: VideoAnalysis["result"]) => {
    switch (analysisResult) {
      case "authentic":
        return (
          <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
            <CheckCircle2 className="w-4 h-4 mr-1" />
            {t('video.authentic')}
          </Badge>
        );
      case "deepfake":
        return (
          <Badge className="bg-red-500/20 text-red-500 border-red-500/30">
            <XCircle className="w-4 h-4 mr-1" />
            {t('video.deepfake')}
          </Badge>
        );
      case "manipulated":
        return (
          <Badge className="bg-orange-500/20 text-orange-500 border-orange-500/30">
            <AlertTriangle className="w-4 h-4 mr-1" />
            {t('video.manipulated')}
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30">
            <HelpCircle className="w-4 h-4 mr-1" />
            {t('video.uncertain')}
          </Badge>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-video-title">
            {t('video.title')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('video.description')}
          </p>
        </div>

        {!statusData?.configured && (
          <Alert className="mb-6 max-w-2xl mx-auto border-yellow-500/50 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-500">
              {t('video.notConfigured')}
            </AlertDescription>
          </Alert>
        )}

        {statusData?.configured && (
          <div className="flex items-center justify-center gap-2 mb-6">
            <Badge variant="outline" className="text-sm">
              <Shield className="w-3 h-3 mr-1" />
              {statusData.provider}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              {statusData.freeQuota}
            </Badge>
          </div>
        )}

        <div className="max-w-4xl mx-auto grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5 text-primary" />
                {t('video.uploadTitle')}
              </CardTitle>
              <CardDescription>
                {t('video.uploadDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!file && !result && (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                    isDragging
                      ? "border-primary bg-primary/5"
                      : "border-muted-foreground/25 hover:border-primary/50"
                  }`}
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="dropzone-video"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                      const selectedFile = e.target.files?.[0];
                      if (selectedFile) {
                        handleFileSelect(selectedFile);
                      }
                    }}
                    data-testid="input-video-file"
                  />
                  <UploadIcon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-lg font-medium mb-2">
                    {t('video.dropzone')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    MP4, WebM, MOV - {t('video.maxSize')}
                  </p>
                </div>
              )}

              {file && preview && !result && (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden bg-black/5">
                    <video
                      src={preview}
                      controls
                      className="w-full max-h-96 object-contain"
                      data-testid="video-preview"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Video className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(file.size / (1024 * 1024)).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={handleReset}
                        disabled={isAnalyzing}
                        data-testid="button-video-reset"
                      >
                        {t('video.cancel')}
                      </Button>
                      <Button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing || !statusData?.configured}
                        data-testid="button-video-analyze"
                      >
                        {isAnalyzing ? t('video.analyzing') : t('video.analyze')}
                      </Button>
                    </div>
                  </div>

                  {isAnalyzing && (
                    <div className="space-y-2">
                      <Progress value={progress} className="h-2" />
                      <p className="text-sm text-center text-muted-foreground">
                        {t('video.analyzingVideo')}...
                      </p>
                    </div>
                  )}
                </div>
              )}

              {result && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getResultBadge(result.result)}
                      <span className="text-2xl font-bold">
                        {result.confidence}% {t('video.confidence')}
                      </span>
                    </div>
                    <Button variant="outline" onClick={handleReset} data-testid="button-new-video">
                      {t('video.analyzeAnother')}
                    </Button>
                  </div>

                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Eye className="h-4 w-4" />
                        {t('video.detectionIndicators')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <IndicatorBadge 
                          label={t('video.facialArtifacts')} 
                          detected={result.indicators.facialArtifacts} 
                        />
                        <IndicatorBadge 
                          label={t('video.temporalInconsistencies')} 
                          detected={result.indicators.temporalInconsistencies} 
                        />
                        <IndicatorBadge 
                          label={t('video.audioVideoMismatch')} 
                          detected={result.indicators.audioVideoMismatch} 
                        />
                        <IndicatorBadge 
                          label={t('video.lipSyncIssues')} 
                          detected={result.indicators.lipSyncIssues} 
                        />
                        <IndicatorBadge 
                          label={t('video.blinkingAnomalies')} 
                          detected={result.indicators.blinkingAnomalies} 
                        />
                        <IndicatorBadge 
                          label={t('video.backgroundArtifacts')} 
                          detected={result.indicators.backgroundArtifacts} 
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        {t('video.metadata')}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">{t('video.format')}:</span>
                          <span className="ml-2 font-medium">{result.metadata.format.toUpperCase()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('video.size')}:</span>
                          <span className="ml-2 font-medium">
                            {(result.metadata.size / (1024 * 1024)).toFixed(2)} MB
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">{t('video.manipulationScore')}:</span>
                          <span className="ml-2 font-medium">{result.manipulationScore}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function IndicatorBadge({ label, detected }: { label: string; detected: boolean }) {
  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg ${
      detected ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
    }`}>
      {detected ? (
        <XCircle className="h-4 w-4" />
      ) : (
        <CheckCircle2 className="h-4 w-4" />
      )}
      <span className="text-sm">{label}</span>
    </div>
  );
}
