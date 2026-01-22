import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Terms() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-terms-title">
              {t('terms.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">{t('terms.intro')}</p>
            
            <section>
              <h2 className="text-lg font-semibold mb-2">{t('terms.service')}</h2>
              <p className="text-muted-foreground">{t('terms.serviceText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('terms.accuracy')}</h2>
              <p className="text-muted-foreground">{t('terms.accuracyText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('terms.liability')}</h2>
              <p className="text-muted-foreground">{t('terms.liabilityText')}</p>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
