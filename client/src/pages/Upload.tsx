import { useState, useCallback, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Upload as UploadIcon, 
  FileImage, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Link2, 
  Camera,
  Sparkles
} from "lucide-react";
import { DebugScoresCard } from "@/components/DebugScoresCard";
import { AnalysisLoadingAnimation } from "@/components/AnalysisLoadingAnimation";
import { Testimonials } from "@/components/Testimonials";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CookieConsent } from "@/components/CookieConsent";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import type { Analysis } from "@shared/schema";

const MAX_FILE_SIZE = 16 * 1024 * 1024; // 16MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function Upload() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [activeTab, setActiveTab] = useState("file");
  
  const [imageUrl, setImageUrl] = useState("");
  const [isLoadingUrl, setIsLoadingUrl] = useState(false);
  
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const analyzeMutation = useMutation({
    mutationFn: async (data: { imageData: string; filename: string }) => {
      const response = await apiRequest("POST", "/api/analyze", data);
      return response as Analysis;
    },
    onSuccess: (data) => {
      setResult(data);
      setIsAnalyzing(false);
      setProgress(100);
      toast.success("Analysis Complete", {
        description: "Your image has been analyzed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/analyses"] });
    },
    onError: (error: Error) => {
      setError(error.message);
      setIsAnalyzing(false);
      setProgress(0);
      toast.error("Analysis Failed", {
        description: error.message || "Failed to analyze image",
      });
    },
  });

  const analyzeUrlMutation = useMutation({
    mutationFn: async (url: string) => {
      const response = await apiRequest("POST", "/api/analyze-url", { url });
      return response as Analysis;
    },
    onSuccess: (data) => {
      setResult(data);
      setIsAnalyzing(false);
      setProgress(100);
      toast.success("Analysis Complete", {
        description: "Your image has been analyzed successfully.",
      });
    },
    onError: (error: Error) => {
      setError(error.message);
      setIsAnalyzing(false);
      setProgress(0);
      toast.error("Analysis Failed", {
        description: error.message || "Failed to analyze image from URL",
      });
    },
  });

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(", ")}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
    }
    return null;
  };

  const handleFileSelect = useCallback((selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      toast.error("Invalid File", {
        description: validationError,
      });
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleAnalyze = async () => {
    if (!file || !preview) return;

    setIsAnalyzing(true);
    setProgress(0);
    setError(null);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      await analyzeMutation.mutateAsync({
        imageData: preview,
        filename: file.name,
      });
    } finally {
      clearInterval(progressInterval);
    }
  };

  const handleAnalyzeUrl = async () => {
    if (!imageUrl.trim()) return;

    setIsAnalyzing(true);
    setProgress(0);
    setError(null);

    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + Math.random() * 15;
      });
    }, 500);

    try {
      await analyzeUrlMutation.mutateAsync(imageUrl);
    } finally {
      clearInterval(progressInterval);
    }
  };

  const startCamera = async () => {
    try {
      setCameraError(null);
      setNeedsUserGesture(false);
      setCameraLoading(true);
      
      // Request camera with multiple fallback options for mobile compatibility
      const constraints = {
        video: { 
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        // Set muted to allow autoplay on mobile
        videoRef.current.muted = true;
        videoRef.current.srcObject = stream;
        
        // Try to play immediately
        try {
          await videoRef.current.play();
          setCameraLoading(false);
        } catch (playError) {
          console.log("Autoplay blocked, waiting for user gesture");
          setCameraLoading(false);
          setNeedsUserGesture(true);
        }
      }
      setIsCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      setCameraLoading(false);
      setCameraError("Unable to access camera. Please check permissions.");
    }
  };

  const playVideo = async () => {
    if (videoRef.current) {
      try {
        await videoRef.current.play();
        setNeedsUserGesture(false);
      } catch (e) {
        console.error("Manual play failed:", e);
        setCameraError("Could not start video. Please try again.");
      }
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setPreview(dataUrl);
      
      canvas.toBlob((blob) => {
        if (blob) {
          const capturedFile = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
          setFile(capturedFile);
        }
      }, "image/jpeg", 0.9);
      
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const getResultIcon = () => {
    if (!result) return null;
    switch (result.result) {
      case "original":
        return <CheckCircle2 className="h-8 w-8 text-green-500" />;
      case "ai_generated":
        return <XCircle className="h-8 w-8 text-red-500" />;
      case "ai_modified":
        return <AlertCircle className="h-8 w-8 text-orange-500" />;
      default:
        return <AlertCircle className="h-8 w-8 text-yellow-500" />;
    }
  };

  const getResultText = () => {
    if (!result) return "";
    switch (result.result) {
      case "original":
        return "Original Image";
      case "ai_generated":
        return "AI Generated";
      case "ai_modified":
        return "AI Modified";
      default:
        return "Uncertain";
    }
  };

  const getResultColor = () => {
    if (!result) return "";
    switch (result.result) {
      case "original":
        return "text-green-500";
      case "ai_generated":
        return "text-red-500";
      case "ai_modified":
        return "text-orange-500";
      default:
        return "text-yellow-500";
    }
  };

  const resetAnalysis = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setProgress(0);
    setImageUrl("");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AnalysisLoadingAnimation progress={progress} isAnalyzing={isAnalyzing} />
      
      <Header />

      {/* Main Content */}
      <main className="flex-1">
        <div className="container py-8">
          {/* Hero Section */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
              <Sparkles className="h-4 w-4" />
              <span>94.2% Detection Accuracy</span>
            </div>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Upload an image to detect if it's AI-generated or real, and analyze any manipulations.
            </p>
          </div>

          {/* Upload Card */}
          <Card className="max-w-2xl mx-auto border-border/50 bg-card/50 backdrop-blur-sm mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UploadIcon className="h-5 w-5 text-primary" />
                Upload Image
              </CardTitle>
              <CardDescription>
                Supported formats: JPEG, PNG, WebP (max 16MB)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-3 mb-6">
                  <TabsTrigger value="file" className="gap-2" data-testid="tab-file">
                    <FileImage className="h-4 w-4" />
                    File
                  </TabsTrigger>
                  <TabsTrigger value="url" className="gap-2" data-testid="tab-url">
                    <Link2 className="h-4 w-4" />
                    URL
                  </TabsTrigger>
                  <TabsTrigger value="camera" className="gap-2" data-testid="tab-camera">
                    <Camera className="h-4 w-4" />
                    Camera
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="file">
                  {!preview ? (
                    <div
                      className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
                        isDragging
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50 hover:bg-muted/30"
                      }`}
                      onDrop={handleDrop}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onClick={() => fileInputRef.current?.click()}
                      data-testid="dropzone-file"
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ALLOWED_TYPES.join(",")}
                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                        className="hidden"
                        data-testid="input-file"
                      />
                      <FileImage className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-foreground font-medium mb-2">
                        Drag and drop your image here
                      </p>
                      <p className="text-sm text-muted-foreground">
                        or click to browse
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative rounded-xl overflow-hidden border border-border">
                        <img
                          src={preview}
                          alt="Preview"
                          className="w-full max-h-80 object-contain bg-muted/20"
                          data-testid="img-preview"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {file?.name}
                        </p>
                        <Button variant="ghost" size="sm" onClick={resetAnalysis} data-testid="button-reset">
                          Change Image
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="url">
                  <div className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        className="flex-1"
                        data-testid="input-url"
                      />
                    </div>
                    {imageUrl && (
                      <div className="rounded-xl overflow-hidden border border-border">
                        <img
                          src={imageUrl}
                          alt="URL Preview"
                          className="w-full max-h-80 object-contain bg-muted/20"
                          onError={() => setError("Failed to load image from URL")}
                          data-testid="img-url-preview"
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="camera">
                  <div className="space-y-4">
                    {cameraError && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{cameraError}</AlertDescription>
                      </Alert>
                    )}
                    
                    {!isCameraActive && !preview ? (
                      <div className="text-center py-8">
                        <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <Button onClick={startCamera} disabled={cameraLoading} data-testid="button-start-camera">
                          {cameraLoading ? "Starting..." : "Start Camera"}
                        </Button>
                      </div>
                    ) : isCameraActive ? (
                      <div className="space-y-4">
                        <div className="rounded-xl overflow-hidden border border-border relative">
                          <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full"
                            data-testid="video-camera"
                          />
                          {needsUserGesture && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <Button onClick={playVideo} size="lg" data-testid="button-tap-to-start">
                                Tap to Start Camera
                              </Button>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-center gap-2">
                          <Button onClick={capturePhoto} disabled={needsUserGesture} data-testid="button-capture">
                            Capture Photo
                          </Button>
                          <Button variant="outline" onClick={stopCamera} data-testid="button-stop-camera">
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : preview ? (
                      <div className="space-y-4">
                        <div className="rounded-xl overflow-hidden border border-border">
                          <img
                            src={preview}
                            alt="Captured"
                            className="w-full max-h-80 object-contain bg-muted/20"
                          />
                        </div>
                        <div className="flex justify-center">
                          <Button variant="ghost" onClick={resetAnalysis}>
                            Retake Photo
                          </Button>
                        </div>
                      </div>
                    ) : null}
                    <canvas ref={canvasRef} className="hidden" />
                  </div>
                </TabsContent>
              </Tabs>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                className="w-full mt-6"
                size="lg"
                disabled={(!file && !imageUrl) || isAnalyzing}
                onClick={activeTab === "url" ? handleAnalyzeUrl : handleAnalyze}
                data-testid="button-analyze"
              >
                {isAnalyzing ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Analyzing...
                  </>
                ) : (
                  <>
                    <UploadIcon className="h-4 w-4 mr-2" />
                    Analyze Image
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Results */}
          {result && (
            <div className="max-w-2xl mx-auto space-y-6 mb-8">
              <Card className="border-border/50" data-testid="card-result">
                <CardHeader>
                  <div className="flex items-center gap-4">
                    {getResultIcon()}
                    <div>
                      <CardTitle className={getResultColor()}>
                        {getResultText()}
                      </CardTitle>
                      <CardDescription>
                        Confidence: {result.confidence}%
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Confidence Level</p>
                      <Progress value={result.confidence} className="h-3" />
                    </div>
                    
                    {result.artifacts && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Detected Artifacts</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(result.artifacts).map(([key, value]) => (
                            value && (
                              <Badge key={key} variant="secondary">
                                {key.replace(/([A-Z])/g, " $1").trim()}
                              </Badge>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {result.metadata && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">Image Metadata</p>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Dimensions:</span>
                            <span>{result.metadata.width} x {result.metadata.height}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Format:</span>
                            <span>{result.metadata.format}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Has EXIF:</span>
                            <span>{result.metadata.hasExif ? "Yes" : "No"}</span>
                          </div>
                          {result.metadata.cameraMake && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Camera:</span>
                              <span>{result.metadata.cameraMake} {result.metadata.cameraModel}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <DebugScoresCard debugScores={result.debugScores || null} />

              <div className="flex justify-center">
                <Button variant="outline" onClick={resetAnalysis} data-testid="button-analyze-another">
                  Analyze Another Image
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Testimonials */}
        {!result && <Testimonials />}
      </main>

      <Footer />
      <CookieConsent />
    </div>
  );
}
