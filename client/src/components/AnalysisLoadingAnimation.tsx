import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Scan, 
  Brain, 
  Shield, 
  CheckCircle2, 
  Fingerprint,
  Eye,
  Database
} from "lucide-react";

interface AnalysisLoadingAnimationProps {
  progress: number;
  isAnalyzing: boolean;
}

interface AnalysisStep {
  id: string;
  icon: React.ReactNode;
  label: string;
  minProgress: number;
  maxProgress: number;
}

const analysisSteps: AnalysisStep[] = [
  {
    id: "upload",
    icon: <Database className="h-5 w-5" />,
    label: "Uploading image...",
    minProgress: 0,
    maxProgress: 15,
  },
  {
    id: "preprocessing",
    icon: <Scan className="h-5 w-5" />,
    label: "Pre-processing image...",
    minProgress: 15,
    maxProgress: 30,
  },
  {
    id: "exif",
    icon: <Fingerprint className="h-5 w-5" />,
    label: "Analyzing EXIF metadata...",
    minProgress: 30,
    maxProgress: 45,
  },
  {
    id: "noise",
    icon: <Eye className="h-5 w-5" />,
    label: "Detecting noise patterns...",
    minProgress: 45,
    maxProgress: 60,
  },
  {
    id: "ml",
    icon: <Brain className="h-5 w-5" />,
    label: "Running ML detection...",
    minProgress: 60,
    maxProgress: 80,
  },
  {
    id: "verification",
    icon: <Shield className="h-5 w-5" />,
    label: "Verifying results...",
    minProgress: 80,
    maxProgress: 95,
  },
  {
    id: "complete",
    icon: <CheckCircle2 className="h-5 w-5" />,
    label: "Analysis complete!",
    minProgress: 95,
    maxProgress: 100,
  },
];

export function AnalysisLoadingAnimation({ progress, isAnalyzing }: AnalysisLoadingAnimationProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    const stepIndex = analysisSteps.findIndex(
      (step) => progress >= step.minProgress && progress < step.maxProgress
    );
    if (stepIndex !== -1) {
      setCurrentStepIndex(stepIndex);
    } else if (progress >= 95) {
      setCurrentStepIndex(analysisSteps.length - 1);
    }
  }, [progress]);

  if (!isAnalyzing) return null;

  const currentStep = analysisSteps[currentStepIndex];

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="bg-card border border-border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
        data-testid="analysis-loading-modal"
      >
        <div className="flex flex-col items-center">
          <div className="relative mb-6">
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-primary/20"
              style={{ width: 120, height: 120 }}
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            />
            
            <motion.div
              className="absolute inset-2 rounded-full border-2 border-primary/40"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
            
            <motion.div
              className="relative w-[120px] h-[120px] rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep.id}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  transition={{ duration: 0.2 }}
                  className="text-primary"
                >
                  {currentStep.icon}
                </motion.div>
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="w-full mb-4">
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-primary to-primary/80 rounded-full"
                style={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center mt-2" data-testid="text-progress">
              {Math.round(progress)}% complete
            </p>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2 text-foreground font-medium"
            >
              <motion.span
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="text-primary"
              >
                {currentStep.icon}
              </motion.span>
              <span data-testid="text-current-step">{currentStep.label}</span>
            </motion.div>
          </AnimatePresence>

          <div className="flex gap-2 mt-6">
            {analysisSteps.slice(0, -1).map((step, index) => (
              <motion.div
                key={step.id}
                className={`w-2 h-2 rounded-full transition-colors duration-300 ${
                  index <= currentStepIndex ? "bg-primary" : "bg-muted"
                }`}
                animate={index === currentStepIndex ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              />
            ))}
          </div>

          <motion.p
            className="text-xs text-muted-foreground text-center mt-6 max-w-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
          >
            Our AI analyzes multiple aspects of your image including metadata, noise patterns, and visual artifacts.
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
