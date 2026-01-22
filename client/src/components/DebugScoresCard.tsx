import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Info, Brain, Camera, Fingerprint, Layers, Eye, Grid3X3 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";

interface DebugScores {
  exif_score: number;
  noise_score: number;
  ai_confidence: number;
  realness_score: number;
  significant_artifacts: number;
  ml_ai_score?: number;
  ml_human_score?: number;
  ml_model?: string;
  ml_error?: string;
  face_smoothing_score?: number;
  edge_consistency_score?: number;
  texture_uniformity_score?: number;
  hybrid_indicator_score?: number;
}

interface DebugScoresCardProps {
  debugScores: DebugScores | null;
}

export function DebugScoresCard({ debugScores }: DebugScoresCardProps) {
  if (!debugScores) {
    return null;
  }

  const getScoreColor = (score: number, inverted: boolean = false) => {
    const effectiveScore = inverted ? 1 - score : score;
    if (effectiveScore >= 0.7) return "bg-green-500";
    if (effectiveScore >= 0.4) return "bg-yellow-500";
    return "bg-red-500";
  };

  const getScoreBadge = (score: number, inverted: boolean = false) => {
    const effectiveScore = inverted ? 1 - score : score;
    if (effectiveScore >= 0.7) return { text: "High", variant: "default" as const };
    if (effectiveScore >= 0.4) return { text: "Medium", variant: "secondary" as const };
    return { text: "Low", variant: "destructive" as const };
  };

  const primaryScores = [
    {
      label: "ML AI Detection",
      value: debugScores.ml_ai_score ?? 0,
      icon: <Brain className="h-4 w-4 text-purple-500" />,
      description: "Hugging Face AI-image-detector model prediction. Higher = more likely AI-generated.",
      color: "bg-purple-500",
      inverted: false,
      showIfAvailable: debugScores.ml_ai_score !== undefined,
    },
    {
      label: "EXIF Metadata",
      value: debugScores.exif_score,
      icon: <Camera className="h-4 w-4 text-blue-500" />,
      description: "Camera metadata richness. Higher = more camera metadata found (Make, Model, GPS, etc).",
      color: "bg-blue-500",
      inverted: false,
    },
    {
      label: "Noise Pattern",
      value: debugScores.noise_score,
      icon: <Fingerprint className="h-4 w-4 text-cyan-500" />,
      description: "Sensor noise pattern analysis. Higher = more natural camera-like noise.",
      color: "bg-cyan-500",
      inverted: false,
    },
  ];

  const hybridScores = [
    {
      label: "Face Smoothing",
      value: debugScores.face_smoothing_score ?? 0,
      icon: <Eye className="h-4 w-4 text-orange-500" />,
      description: "Detects unnatural skin smoothing in face regions. Higher = more AI smoothing detected.",
      color: "bg-orange-500",
      inverted: true,
      showIfAvailable: debugScores.face_smoothing_score !== undefined,
    },
    {
      label: "Edge Consistency",
      value: debugScores.edge_consistency_score ?? 0,
      icon: <Layers className="h-4 w-4 text-pink-500" />,
      description: "Analyzes edge processing consistency. Higher = more inconsistent (AI composite signs).",
      color: "bg-pink-500",
      inverted: true,
      showIfAvailable: debugScores.edge_consistency_score !== undefined,
    },
    {
      label: "Texture Uniformity",
      value: debugScores.texture_uniformity_score ?? 0,
      icon: <Grid3X3 className="h-4 w-4 text-indigo-500" />,
      description: "Detects unnatural texture uniformity. Higher = more AI-like uniform textures.",
      color: "bg-indigo-500",
      inverted: true,
      showIfAvailable: debugScores.texture_uniformity_score !== undefined,
    },
  ];

  const combinedScores = [
    {
      label: "AI Confidence",
      value: debugScores.ai_confidence,
      icon: <Brain className="h-4 w-4 text-red-500" />,
      description: "Combined AI detection confidence. Higher = more likely AI-generated.",
      color: "bg-red-500",
      inverted: true,
    },
    {
      label: "Realness Score",
      value: debugScores.realness_score,
      icon: <Camera className="h-4 w-4 text-green-500" />,
      description: "Combined authenticity score. Higher = more likely real/authentic.",
      color: "bg-green-500",
      inverted: false,
    },
  ];

  const renderScoreItem = (item: typeof primaryScores[0], index: number) => {
    if (item.showIfAvailable === false) return null;
    
    const badge = getScoreBadge(item.value, item.inverted);
    
    return (
      <div key={index} className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {item.icon}
            <span className="text-sm font-medium">{item.label}</span>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="text-xs">{item.description}</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">{(item.value * 100).toFixed(1)}%</span>
            <Badge variant={badge.variant} className="text-xs">
              {badge.text}
            </Badge>
          </div>
        </div>
        <Progress value={item.value * 100} className="h-2" />
      </div>
    );
  };

  return (
    <Card className="border-border/50" data-testid="card-debug-scores">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Analysis Details
        </CardTitle>
        <CardDescription>
          Detailed breakdown of detection scores and indicators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Primary Detection
          </h4>
          {primaryScores.map(renderScoreItem)}
        </div>

        {(debugScores.face_smoothing_score !== undefined || 
          debugScores.edge_consistency_score !== undefined ||
          debugScores.texture_uniformity_score !== undefined) && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Hybrid Detection (AI Modifications)
            </h4>
            {hybridScores.map(renderScoreItem)}
          </div>
        )}

        <div className="space-y-4">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Combined Analysis
          </h4>
          {combinedScores.map(renderScoreItem)}
        </div>
        
        <div className="pt-2 border-t border-border/50">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Significant Artifacts Detected</span>
            <Badge variant={debugScores.significant_artifacts >= 3 ? "destructive" : debugScores.significant_artifacts >= 2 ? "secondary" : "outline"}>
              {debugScores.significant_artifacts}
            </Badge>
          </div>
        </div>

        <div className="pt-2 text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <p className="leading-relaxed">
            <strong>How it works:</strong> The analysis combines a machine learning model (60%) with 
            heuristic analysis (40%). For hybrid images (real photos modified with AI), additional 
            indicators like face smoothing, edge consistency, and texture uniformity are analyzed 
            to detect AI modifications that may not be caught by the ML model alone.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
