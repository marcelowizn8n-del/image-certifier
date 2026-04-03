import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { Check, Sparkles, Crown, Building2, Loader2, CreditCard, QrCode } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { useMemo } from "react";

interface Plan {
  id: string;
  mpPlanId: string;
  name: string;
  description: string | null;
  tier: "basic" | "premium" | "enterprise";
  amountBrl: number; // centavos
  active: boolean;
}

export default function Pricing() {
  const { t, language } = useLanguage();

  const { data: plansData, isLoading } = useQuery<{ data: Plan[] }>({
    queryKey: ["/api/mercadopago/plans"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest("POST", "/api/mercadopago/checkout", { planId });
      return await response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      if (error?.status === 401) {
        window.location.href = "/auth?next=/pricing";
        return;
      }
      toast.error(t("pricing.checkoutFailed"), {
        description: error?.message || t("pricing.checkoutFailed"),
      });
    },
  });

  const formatPrice = (amountCentavos: number) => {
    const locale =
      language === "pt"
        ? "pt-BR"
        : language === "en"
          ? "en-US"
          : language === "es"
            ? "es-ES"
            : language === "fr"
              ? "fr-FR"
              : language === "de"
                ? "de-DE"
                : "zh-CN";

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'BRL',
    }).format(amountCentavos / 100);
  };

  const getTierIcon = (tier: string) => {
    switch (tier) {
      case 'basic': return <Sparkles className="h-6 w-6" />;
      case 'premium': return <Crown className="h-6 w-6" />;
      case 'enterprise': return <Building2 className="h-6 w-6" />;
      default: return <Sparkles className="h-6 w-6" />;
    }
  };

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'basic': return 'text-blue-500';
      case 'premium': return 'text-amber-500';
      case 'enterprise': return 'text-purple-500';
      default: return 'text-primary';
    }
  };

  const getFeatures = (tier: string) => {
    switch (tier) {
      case 'basic':
        return [
          t("pricing.features.basic.1"),
          t("pricing.features.basic.2"),
          t("pricing.features.basic.3"),
          t("pricing.features.basic.4"),
        ];
      case 'premium':
        return [
          t("pricing.features.premium.1"),
          t("pricing.features.premium.2"),
          t("pricing.features.premium.3"),
          t("pricing.features.premium.4"),
          t("pricing.features.premium.5"),
        ];
      case 'enterprise':
        return [
          t("pricing.features.enterprise.1"),
          t("pricing.features.enterprise.2"),
          t("pricing.features.enterprise.3"),
          t("pricing.features.enterprise.4"),
          t("pricing.features.enterprise.5"),
          t("pricing.features.enterprise.6"),
        ];
      default:
        return [t("pricing.features.default")];
    }
  };

  const plans = plansData?.data || [];

  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => a.amountBrl - b.amountBrl);
  }, [plans]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t("pricing.title")}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("pricing.subtitle")}
          </p>
          <div className="flex items-center justify-center gap-4 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CreditCard className="h-4 w-4" /> Cartão
            </span>
            <span className="flex items-center gap-1">
              <QrCode className="h-4 w-4" /> Pix
            </span>
          </div>
        </div>

        {/* Free Plan */}
        <div className="max-w-5xl mx-auto mb-8">
          <Card className="border-dashed" data-testid="card-plan-free">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">{t("pricing.free.title")}</CardTitle>
              <CardDescription>{t("pricing.free.subtitle")}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-bold mb-4">
                {t("pricing.free.price")}
                <span className="text-sm font-normal text-muted-foreground">
                  {t("pricing.interval.monthSuffix")}
                </span>
              </div>
              <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                <li className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  {t("pricing.free.feature1")}
                </li>
                <li className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  {t("pricing.free.feature2")}
                </li>
                <li className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  {t("pricing.free.feature3")}
                </li>
              </ul>
              <Button variant="outline" className="w-full max-w-xs" disabled>
                {t("pricing.free.currentPlan")}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Paid Plans */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sortedPlans.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {t("pricing.comingSoon")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {sortedPlans.map((plan) => {
              const isPopular = plan.tier === 'premium';

              return (
                <Card
                  key={plan.id}
                  className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
                  data-testid={`card-plan-${plan.tier}`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      {t("pricing.mostPopular")}
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className={`mx-auto mb-2 ${getTierColor(plan.tier)}`}>
                      {getTierIcon(plan.tier)}
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    <div className="mb-6">
                      <span className="text-4xl font-bold">
                        {formatPrice(plan.amountBrl)}
                      </span>
                      <span className="text-muted-foreground">{t("pricing.interval.monthSuffix")}</span>
                    </div>
                    <ul className="text-sm space-y-3 text-left">
                      {getFeatures(plan.tier).map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={isPopular ? 'default' : 'outline'}
                      onClick={() => checkoutMutation.mutate(plan.id)}
                      disabled={checkoutMutation.isPending}
                      data-testid={`button-subscribe-${plan.tier}`}
                    >
                      {checkoutMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : null}
                      {t("pricing.subscribeNow")}
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>{t("pricing.footerGuarantee")}</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
