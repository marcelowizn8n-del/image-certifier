import { Link } from "wouter";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Shield,
  Upload,
  Brain,
  FileCheck,
  Camera,
  Eye,
  Fingerprint,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export default function Landing() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 md:py-24 text-center">
          <div className="max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              {t("landing.badge")}
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
              {t("landing.heroTitle")}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              {t("landing.heroSubtitle")}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/analyze">
                <Button size="lg" className="gap-2 text-base px-8">
                  <Upload className="h-5 w-5" />
                  {t("landing.ctaAnalyze")}
                </Button>
              </Link>
              <Link href="/auth">
                <Button size="lg" variant="outline" className="gap-2 text-base px-8">
                  {t("landing.ctaSignup")}
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground mt-4">
              {t("landing.freeAnalyses")}
            </p>
          </div>
        </section>

        {/* How It Works */}
        <section className="container mx-auto px-4 py-16 border-t border-border">
          <h2 className="text-3xl font-bold text-center mb-12">{t("landing.howItWorksTitle")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {[
              { icon: Upload, title: t("landing.step1Title"), desc: t("landing.step1Desc") },
              { icon: Brain, title: t("landing.step2Title"), desc: t("landing.step2Desc") },
              { icon: FileCheck, title: t("landing.step3Title"), desc: t("landing.step3Desc") },
            ].map(({ icon: Icon, title, desc }, i) => (
              <Card key={i} className="text-center border-border/50 bg-card/50">
                <CardContent className="pt-8 pb-6 px-6">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="text-sm font-medium text-primary mb-2">
                    {t("landing.step")} {i + 1}
                  </div>
                  <h3 className="text-xl font-semibold mb-3">{title}</h3>
                  <p className="text-muted-foreground text-sm">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Technology & Reliability */}
        <section className="container mx-auto px-4 py-16 border-t border-border">
          <h2 className="text-3xl font-bold text-center mb-4">{t("landing.reliabilityTitle")}</h2>
          <p className="text-center text-muted-foreground max-w-2xl mx-auto mb-12">
            {t("landing.reliabilitySubtitle")}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              { icon: Eye, title: t("landing.tech1Title"), desc: t("landing.tech1Desc") },
              { icon: Fingerprint, title: t("landing.tech2Title"), desc: t("landing.tech2Desc") },
              { icon: Camera, title: t("landing.tech3Title"), desc: t("landing.tech3Desc") },
              { icon: Sparkles, title: t("landing.tech4Title"), desc: t("landing.tech4Desc") },
              { icon: Shield, title: t("landing.tech5Title"), desc: t("landing.tech5Desc") },
              { icon: Brain, title: t("landing.tech6Title"), desc: t("landing.tech6Desc") },
            ].map(({ icon: Icon, title, desc }, i) => (
              <div key={i} className="flex gap-4 p-4">
                <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{title}</h3>
                  <p className="text-sm text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Free Tier CTA */}
        <section className="container mx-auto px-4 py-16 border-t border-border">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">{t("landing.ctaTitle")}</h2>
            <p className="text-muted-foreground mb-8">{t("landing.ctaSubtitle")}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8 max-w-lg mx-auto text-left">
              {[
                t("landing.benefit1"),
                t("landing.benefit2"),
                t("landing.benefit3"),
              ].map((benefit, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
            <Link href="/auth">
              <Button size="lg" className="gap-2 text-base px-8">
                {t("landing.ctaSignupFree")}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
