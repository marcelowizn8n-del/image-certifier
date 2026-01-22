import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Analysis } from "@shared/schema";
import { BarChart3, Image, Sparkles, Wand2 } from "lucide-react";

export default function Admin() {
  const { t } = useLanguage();
  
  const { data: analyses = [], isLoading } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
  });

  const stats = {
    total: analyses.length,
    original: analyses.filter(a => a.result === 'original').length,
    aiGenerated: analyses.filter(a => a.result === 'ai_generated').length,
    aiModified: analyses.filter(a => a.result === 'ai_modified').length,
  };

  const statCards = [
    { 
      id: 'total',
      label: t('admin.totalAnalyses'), 
      value: stats.total, 
      icon: BarChart3, 
      color: 'text-blue-500',
      bg: 'bg-blue-500/10'
    },
    { 
      id: 'original',
      label: t('admin.originalImages'), 
      value: stats.original, 
      icon: Image, 
      color: 'text-green-500',
      bg: 'bg-green-500/10'
    },
    { 
      id: 'ai-generated',
      label: t('admin.aiGenerated'), 
      value: stats.aiGenerated, 
      icon: Sparkles, 
      color: 'text-red-500',
      bg: 'bg-red-500/10'
    },
    { 
      id: 'ai-modified',
      label: t('admin.aiModified'), 
      value: stats.aiModified, 
      icon: Wand2, 
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10'
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-admin-title">
            {t('admin.title')}
          </h1>
          <p className="text-muted-foreground">{t('admin.stats')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ id, label, value, icon: Icon, color, bg }) => (
            <Card key={id} data-testid={`card-stat-${id}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
                <div className={`p-2 rounded-full ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${color}`}>
                  {isLoading ? "..." : value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('dashboard.title')}</CardTitle>
            <CardDescription>{t('dashboard.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : analyses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {t('dashboard.noAnalyses')}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-auto">
                {analyses.slice(0, 20).map((analysis) => (
                  <div
                    key={analysis.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                    data-testid={`row-analysis-${analysis.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Image className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{analysis.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(analysis.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-medium ${
                        analysis.result === 'original' ? 'text-green-500' :
                        analysis.result === 'ai_generated' ? 'text-red-500' :
                        'text-yellow-500'
                      }`}>
                        {t(`result.${analysis.result}`)}
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {analysis.confidence}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
