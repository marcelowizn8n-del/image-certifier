import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import mfaLogoPath from "@assets/mfa-logo.png";

export default function About() {
  const { t } = useLanguage();

  const features = [
    t('about.feature1'),
    t('about.feature2'),
    t('about.feature3'),
    t('about.feature4'),
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl" data-testid="text-about-title">
              {t('about.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">{t('about.description')}</p>
            
            <section>
              <h2 className="text-lg font-semibold mb-3">{t('about.features')}</h2>
              <ul className="space-y-2">
                {features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </section>

            <section className="pt-4 border-t">
              <h2 className="text-lg font-semibold mb-3">{t('about.developer')}</h2>
              <div className="flex items-center gap-4">
                <img 
                  src={mfaLogoPath} 
                  alt="MFA" 
                  className="h-16 w-16 rounded-full"
                  data-testid="img-developer-logo"
                />
                <div>
                  <p className="font-semibold">MARCELO FERREIRA DE ARAUJO</p>
                  <a 
                    href="mailto:contato@imgcertifier.app" 
                    className="text-sm text-primary hover:underline"
                  >
                    contato@imgcertifier.app
                  </a>
                </div>
              </div>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
