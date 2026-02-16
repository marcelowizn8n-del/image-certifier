import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Privacy() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-privacy-title">
              {t('privacy.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground text-sm">{t('privacy.lastUpdated')}</p>
            <p className="text-muted-foreground">{t('privacy.intro')}</p>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.collection')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{t('privacy.collectionText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.faceData')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{t('privacy.faceDataText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.usage')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{t('privacy.usageText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.thirdParty')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{t('privacy.thirdPartyText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.retention')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{t('privacy.retentionText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.userRights')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{t('privacy.userRightsText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.children')}</h2>
              <p className="text-muted-foreground">{t('privacy.childrenText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.security')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{t('privacy.securityText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.changes')}</h2>
              <p className="text-muted-foreground">{t('privacy.changesText')}</p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-2">{t('privacy.contact')}</h2>
              <p className="text-muted-foreground whitespace-pre-wrap">{t('privacy.contactText')}</p>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
