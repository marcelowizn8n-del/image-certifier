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
  const { t } = useLanguage();

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
      toast.error("Checkout failed", { description: error?.message || "Checkout failed" });
    },
  });

  const formatPrice = (amount: number, currency: string) => {
    return new Intl.NumberFormat('pt-BR', {
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
          '100 análises por mês',
          'Histórico completo',
          'Suporte por email',
          'Detecção de IA básica',
        ];
      case 'premium':
        return [
          'Análises ilimitadas',
          'Batch processing',
          'API access',
          'Detecção avançada',
          'Suporte prioritário',
        ];
      case 'enterprise':
        return [
          'Tudo do Premium',
          'Múltiplos usuários',
          'Dashboard customizado',
          'SLA garantido',
          'Suporte 24/7',
          'Treinamento dedicado',
        ];
      default:
        return ['Recursos básicos'];
    }
  };

  const products = productsData?.data || [];

  // Sort products by price
  const sortedProducts = [...products].sort((a, b) => {
    const priceA = a.prices[0]?.unit_amount || 0;
    const priceB = b.prices[0]?.unit_amount || 0;
    return priceA - priceB;
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Escolha seu Plano</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Proteja-se contra fake news e imagens manipuladas com nossa tecnologia de detecção de IA
          </p>
        </div>

        {/* Free Plan */}
        <div className="max-w-5xl mx-auto mb-8">
          <Card className="border-dashed" data-testid="card-plan-free">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Plano Gratuito</CardTitle>
              <CardDescription>Experimente nossa tecnologia</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-3xl font-bold mb-4">R$ 0<span className="text-sm font-normal text-muted-foreground">/mês</span></div>
              <ul className="text-sm text-muted-foreground space-y-2 mb-4">
                <li className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  10 análises gratuitas
                </li>
                <li className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Detecção com IA avançada
                </li>
                <li className="flex items-center justify-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  Sem necessidade de cadastro
                </li>
              </ul>
              <Button variant="outline" className="w-full max-w-xs" disabled>
                Plano Atual
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
              Planos de assinatura serão disponibilizados em breve.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {sortedProducts.map((product) => {
              const tier = product.metadata?.tier;
              const price = product.prices[0];
              const isPopular = tier === 'premium';

              return (
                <Card 
                  key={product.id} 
                  className={`relative ${isPopular ? 'border-primary shadow-lg scale-105' : ''}`}
                  data-testid={`card-plan-${tier}`}
                >
                  {isPopular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                      Mais Popular
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
                        <span className="text-muted-foreground">/mês</span>
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
                      Assinar Agora
                    </Button>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        <div className="text-center mt-12 text-sm text-muted-foreground">
          <p>Todos os planos incluem garantia de 7 dias. Cancele quando quiser.</p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
