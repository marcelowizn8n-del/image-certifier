import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, 
  Layers,
  Upload,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Trash2
} from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoImage from "@/assets/logo.png";
import { Footer } from "@/components/Footer";

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
        return <Badge className="bg-green-500/10 text-green-500 text-xs">Original</Badge>;
      case "ai_generated":
        return <Badge className="bg-red-500/10 text-red-500 text-xs">AI Generated</Badge>;
      case "ai_modified":
        return <Badge className="bg-orange-500/10 text-orange-500 text-xs">AI Modified</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-500 text-xs">Uncertain</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border/40 sticky top-0 z-40 bg-background/95 backdrop-blur-sm">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <img 
              src={logoImage} 
              alt="Image Certifier Logo" 
              className="h-10 w-10"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground" data-testid="text-page-title">
                Batch Analysis
              </h1>
              <p className="text-xs text-muted-foreground hidden sm:block">
                Analyze multiple images at once
              </p>
            </div>
          </div>
          
          <ThemeToggle />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container py-8">
        <Card className="max-w-4xl mx-auto border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Batch Upload
            </CardTitle>
            <CardDescription>
              Select multiple images to analyze them all at once
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
                  Click to select images
                </p>
                <p className="text-sm text-muted-foreground">
                  or drag and drop multiple files
                </p>
              </label>
            </div>

            {/* File List */}
            {files.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    {files.length} {files.length === 1 ? "file" : "files"} selected
                  </h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFiles([])}
                    data-testid="button-clear-all"
                  >
                    Clear All
                  </Button>
                </div>

                {isProcessing && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Processing...</span>
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
                            Analyzing...
                          </Badge>
                        )}
                        {item.status === "error" && (
                          <Badge variant="destructive" className="text-xs mt-1">
                            Error
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
                  data-testid="button-start-batch"
                >
                  {isProcessing ? "Processing..." : `Analyze ${files.length} Images`}
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
