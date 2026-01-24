import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { 
  Upload, 
  Image, 
  Video, 
  Layers, 
  Shield, 
  Download, 
  Camera, 
  Link, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  HelpCircle,
  Smartphone,
  Globe
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Manual() {
  const { t } = useLanguage();

  const sections = [
    {
      id: "getting-started",
      icon: HelpCircle,
      title: t('manual.gettingStarted.title'),
      content: t('manual.gettingStarted.content'),
    },
    {
      id: "image-analysis",
      icon: Image,
      title: t('manual.imageAnalysis.title'),
      content: t('manual.imageAnalysis.content'),
    },
    {
      id: "video-analysis",
      icon: Video,
      title: t('manual.videoAnalysis.title'),
      content: t('manual.videoAnalysis.content'),
    },
    {
      id: "upload-methods",
      icon: Upload,
      title: t('manual.uploadMethods.title'),
      content: t('manual.uploadMethods.content'),
    },
    {
      id: "results",
      icon: Shield,
      title: t('manual.results.title'),
      content: t('manual.results.content'),
    },
    {
      id: "batch-processing",
      icon: Layers,
      title: t('manual.batchProcessing.title'),
      content: t('manual.batchProcessing.content'),
    },
    {
      id: "certification",
      icon: Download,
      title: t('manual.certification.title'),
      content: t('manual.certification.content'),
    },
    {
      id: "mobile",
      icon: Smartphone,
      title: t('manual.mobile.title'),
      content: t('manual.mobile.content'),
    },
    {
      id: "faq",
      icon: HelpCircle,
      title: t('manual.faq.title'),
      content: t('manual.faq.content'),
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2" data-testid="text-manual-title">
              {t('manual.title')}
            </h1>
            <p className="text-muted-foreground" data-testid="text-manual-subtitle">
              {t('manual.subtitle')}
            </p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                {t('manual.welcome.title')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground whitespace-pre-line">
                {t('manual.welcome.content')}
              </p>
            </CardContent>
          </Card>

          <Accordion type="single" collapsible className="space-y-4">
            {sections.map((section) => (
              <AccordionItem key={section.id} value={section.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline" data-testid={`accordion-${section.id}`}>
                  <div className="flex items-center gap-3">
                    <section.icon className="w-5 h-5 text-primary" />
                    <span className="font-semibold">{section.title}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2 pb-4 text-muted-foreground whitespace-pre-line">
                    {section.content}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                {t('manual.resultTypes.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-green-600 dark:text-green-400">
                    {t('manual.resultTypes.original')}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('manual.resultTypes.originalDesc')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-red-500/10 rounded-lg">
                <XCircle className="w-6 h-6 text-red-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-600 dark:text-red-400">
                    {t('manual.resultTypes.aiGenerated')}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('manual.resultTypes.aiGeneratedDesc')}
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-orange-500/10 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-orange-600 dark:text-orange-400">
                    {t('manual.resultTypes.aiModified')}
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    {t('manual.resultTypes.aiModifiedDesc')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
      <Footer />
    </div>
  );
}
