import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Layers,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

interface BatchFile {
  id: string;
  file: File;
  preview: string;
  status: "pending" | "analyzing" | "complete" | "error";
  result?: "original" | "ai_generated" | "ai_modified" | "uncertain";
  confidence?: number;
  error?: string;
}

export default function BatchUpload() {
  const [files, setFiles] = useState<BatchFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const { t } = useLanguage();

  const fileToDataUrl = (file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error(t('batch.readFileError')));
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== "string") {
          reject(new Error(t('batch.readFileError')));
          return;
        }
        resolve(result);
      };
      reader.readAsDataURL(file);
    });
  };

  const startBatchAnalysis = async () => {
    if (files.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProgress(0);

    const total = files.length;
    let completed = 0;

    try {
      for (const current of files) {
        setFiles((prev) =>
          prev.map((f) => (f.id === current.id ? { ...f, status: "analyzing", error: undefined } : f))
        );

        try {
          const imageData = await fileToDataUrl(current.file);
          const response = await apiRequest("POST", "/api/analyze", {
            imageData,
            filename: current.file.name,
          });
          const data = (await response.json()) as any;

          setFiles((prev) =>
            prev.map((f) =>
              f.id === current.id
                ? {
                    ...f,
                    status: "complete",
                    result: data?.result,
                    confidence: data?.confidence,
                  }
                : f
            )
          );
        } catch (err: any) {
          const message = err?.error === "FREE_LIMIT_EXCEEDED"
            ? t('batch.freeLimitMessage')
            : err?.message || t('batch.analyzeFailed');

          setFiles((prev) =>
            prev.map((f) => (f.id === current.id ? { ...f, status: "error", error: message } : f))
          );

          if (err?.error === "FREE_LIMIT_EXCEEDED") {
            toast.error(t('batch.limitReachedTitle'), {
              description: t('batch.limitReachedDesc'),
              action: {
                label: t('batch.viewPlans'),
                onClick: () => (window.location.href = "/auth?next=/pricing"),
              },
            });
            break;
          }
        } finally {
          completed += 1;
          setProgress((completed / total) * 100);
        }
      }

      toast.success(t('batch.doneTitle'), {
        description: t('batch.doneDesc'),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: BatchFile[] = selectedFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const getResultIcon = (result?: string) => {
    switch (result) {
      case "original":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "ai_generated":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "ai_modified":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getResultBadge = (result?: string) => {
    switch (result) {
      case "original":
        return <Badge className="bg-green-500/10 text-green-500 text-xs">{t('result.original')}</Badge>;
      case "ai_generated":
        return <Badge className="bg-red-500/10 text-red-500 text-xs">{t('result.ai_generated')}</Badge>;
      case "ai_modified":
        return <Badge className="bg-orange-500/10 text-orange-500 text-xs">{t('result.ai_modified')}</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-500 text-xs">{t('result.uncertain')}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Main Content */}
      <main className="flex-1 container py-8">
        <Card className="max-w-4xl mx-auto border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              {t('batch.title')}
            </CardTitle>
            <CardDescription>
              {t('batch.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload Area */}
            <div className="border-2 border-dashed rounded-xl p-8 text-center border-border hover:border-primary/50 transition-colors">
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFilesSelect}
                className="hidden"
                id="batch-upload"
                data-testid="input-batch-files"
              />
              <label htmlFor="batch-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-foreground font-medium mb-2">
                  {t('batch.clickToSelect')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t('batch.orDragDrop')}
                </p>
              </label>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {files.length === 1 ? t('batch.filesSelected_one') : t('batch.filesSelected_many')}
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFiles([])}
                    data-testid="button-clear-all"
                  >
                    {t('batch.clearAll')}
                  </Button>
                </div>

                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('batch.processing')}</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  {files.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50"
                      data-testid={`batch-file-${item.id}`}
                    >
                      <img
                        src={item.preview}
                        alt={item.file.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        {item.status === "complete" && item.result && (
                          <div className="flex items-center gap-2 mt-1">
                            {getResultIcon(item.result)}
                            {getResultBadge(item.result)}
                          </div>
                        )}
                        {item.status === "analyzing" && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {t('batch.analyzing')}
                          </Badge>
                        )}
                        {item.status === "error" && (
                          <Badge variant="destructive" className="text-xs mt-1">
                            {t('batch.error')}
                          </Badge>
                        )}
                      </div>
                      {item.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeFile(item.id)}
                          data-testid={`button-remove-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  size="lg"
                  disabled={files.length === 0 || isProcessing}
                  onClick={startBatchAnalysis}
                  data-testid="button-start-batch"
                >
                  {isProcessing
                    ? t('batch.processing')
                    : files.length === 1
                      ? t('batch.analyzeCount_one')
                      : t('batch.analyzeCount_many')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
