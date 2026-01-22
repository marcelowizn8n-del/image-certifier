import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Calendar,
  Image as ImageIcon
} from "lucide-react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Analysis } from "@shared/schema";

export default function Dashboard() {
  const { data: analyses, isLoading } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
  });

  const getResultIcon = (result: string) => {
    switch (result) {
      case "original":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "ai_generated":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "ai_modified":
        return <AlertCircle className="h-5 w-5 text-orange-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
  };

  const getResultBadge = (result: string) => {
    switch (result) {
      case "original":
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Original</Badge>;
      case "ai_generated":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20">AI Generated</Badge>;
      case "ai_modified":
        return <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20">AI Modified</Badge>;
      default:
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Uncertain</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      {/* Main Content */}
      <main className="flex-1 container py-8">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="border-border/50">
                <CardHeader>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-32 w-full rounded-lg" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : analyses && analyses.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analyses.map((analysis) => (
              <Card 
                key={analysis.id} 
                className="border-border/50 hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
                data-testid={`card-analysis-${analysis.id}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {getResultIcon(analysis.result)}
                      <CardTitle className="text-base truncate max-w-[180px]">
                        {analysis.filename}
                      </CardTitle>
                    </div>
                    {getResultBadge(analysis.result)}
                  </div>
                  <CardDescription className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(analysis.createdAt)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {analysis.imageData && (
                    <div className="relative rounded-lg overflow-hidden border border-border mb-3">
                      <img
                        src={analysis.imageData}
                        alt={analysis.filename}
                        className="w-full h-32 object-cover"
                      />
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-medium">{analysis.confidence}%</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="max-w-md mx-auto border-border/50 text-center py-12">
            <CardContent>
              <ImageIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2" data-testid="text-no-analyses">
                No analyses yet
              </h3>
              <p className="text-muted-foreground mb-4">
                Start by analyzing your first image to see it here.
              </p>
              <Link href="/">
                <Button data-testid="button-analyze-first">
                  Analyze First Image
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
