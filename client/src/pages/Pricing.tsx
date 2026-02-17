import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { Check, Sparkles, Crown, Building2, Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";
import { useMemo, useState } from "react";

interface Price {
  id: string;
  unit_amount: number;
  currency: string;
  recurring: { interval: string } | null;
  active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  active: boolean;
  metadata: { tier?: string; analysisLimit?: string };
  prices: Price[];
}

export default function Pricing() {
  const { t, language } = useLanguage();
  const [billingInterval, setBillingInterval] = useState<"month" | "year">("month");

  const { data: productsData, isLoading } = useQuery<{ data: Product[] }>({
    queryKey: ["/api/stripe/products-with-prices"],
  });

  const checkoutMutation = useMutation({
    mutationFn: async (priceId: string) => {
      const response = await apiRequest("POST", "/api/stripe/checkout", { priceId });
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

  const formatPrice = (amount: number, currency: string) => {
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
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const getTierIcon = (tier?: string) => {
    switch (tier) {
      case 'basic': return <Sparkles className="h-6 w-6" />;
      case 'premium': return <Crown className="h-6 w-6" />;
      case 'enterprise': return <Building2 className="h-6 w-6" />;
      default: return <Sparkles className="h-6 w-6" />;
    }
  };

  const getTierColor = (tier?: string) => {
    switch (tier) {
      case 'basic': return 'text-blue-500';
      case 'premium': return 'text-amber-500';
      case 'enterprise': return 'text-purple-500';
      default: return 'text-primary';
    }
  };

  const getFeatures = (tier?: string) => {
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

  const products = productsData?.data || [];

  const getPriceByInterval = (product: Product, interval: "month" | "year") => {
    return product.prices.find((p) => p.recurring?.interval === interval) ?? null;
  };

  const intervalLabel =
    billingInterval === "year" ? t("pricing.interval.yearSuffix") : t("pricing.interval.monthSuffix");

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => {
      const priceA = getPriceByInterval(a, billingInterval)?.unit_amount ?? 0;
      const priceB = getPriceByInterval(b, billingInterval)?.unit_amount ?? 0;
      return priceA - priceB;
    });
  }, [products, billingInterval]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">{t("pricing.title")}</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-md border bg-background p-1">
            <Button
              type="button"
              variant={billingInterval === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBillingInterval("month")}
            >
              {t("pricing.interval.month")}
            </Button>
            <Button
              type="button"
              variant={billingInterval === "year" ? "default" : "ghost"}
              size="sm"
              onClick={() => setBillingInterval("year")}
            >
              {t("pricing.interval.year")}
            </Button>
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
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {t("pricing.comingSoon")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {sortedProducts.map((product) => {
              const tier = product.metadata?.tier;
              const price = getPriceByInterval(product, billingInterval);
              const isPopular = tier === 'premium';

              return (
                <Card 
                  key={product.id} 
                  className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
                  data-testid={`card-plan-${tier}`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      {t("pricing.mostPopular")}
                    </Badge>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className={`mx-auto mb-2 ${getTierColor(tier)}`}>
                      {getTierIcon(tier)}
                    </div>
                    <CardTitle className="text-xl">{product.name}</CardTitle>
                    <CardDescription>{product.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="text-center">
                    {price && (
                      <div className="mb-6">
                        <span className="text-4xl font-bold">
                          {formatPrice(price.unit_amount, price.currency)}
                        </span>
                        <span className="text-muted-foreground">{intervalLabel}</span>
                      </div>
                    )}
                    <ul className="text-sm space-y-3 text-left">
                      {getFeatures(tier).map((feature, index) => (
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
                      onClick={() => price && checkoutMutation.mutate(price.id)}
                      disabled={!price || checkoutMutation.isPending}
                      data-testid={`button-subscribe-${tier}`}
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
