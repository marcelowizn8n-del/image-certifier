import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Analysis, User } from "@shared/schema";
import { 
  BarChart3, 
  Image, 
  Sparkles, 
  Wand2, 
  Users, 
  Crown, 
  Gift, 
  Trash2, 
  CreditCard, 
  DollarSign,
  TrendingUp,
  UserCheck,
  XCircle,
  RefreshCcw,
  Edit,
  Save,
  Lock,
  LogOut
} from "lucide-react";
import { apiRequest, queryClient as qc } from "@/lib/queryClient";
import { toast } from "sonner";

type SafeUser = Omit<User, 'password'>;

interface StripeCustomer {
  customer_id: string;
  email: string;
  name: string | null;
  created: string;
  subscription_id: string | null;
  subscription_status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  product_name: string | null;
  unit_amount: number | null;
  currency: string | null;
}

interface SubscriptionStats {
  totalCustomers: number;
  activeSubscriptions: number;
  canceledSubscriptions: number;
  monthlyRevenue: number;
}

interface ProductWithPrices {
  id: string;
  name: string;
  description: string;
  active: boolean;
  prices: {
    id: string;
    unit_amount: number;
    currency: string;
    active: boolean;
  }[];
}

export default function Admin() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [editingPrice, setEditingPrice] = useState<{ productId: string; productName: string; currentAmount: number } | null>(null);
  const [newPriceValue, setNewPriceValue] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminKey, setAdminKey] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('adminKey');
    if (savedKey) {
      setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = async () => {
    if (!adminKey.trim()) {
      toast.error("Digite a chave de admin");
      return;
    }
    
    setIsLoggingIn(true);
    localStorage.setItem('adminKey', adminKey);
    
    try {
      const res = await fetch('/api/admin/subscription-stats', {
        headers: { 'x-admin-key': adminKey }
      });
      
      if (res.ok) {
        setIsAuthenticated(true);
        queryClient.invalidateQueries();
        toast.success("Acesso autorizado");
      } else {
        localStorage.removeItem('adminKey');
        toast.error("Chave de admin inválida");
      }
    } catch {
      localStorage.removeItem('adminKey');
      toast.error("Erro ao verificar chave");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminKey');
    setIsAuthenticated(false);
    setAdminKey("");
    toast.success("Desconectado do painel admin");
  };
  
  const { data: analyses = [], isLoading: isLoadingAnalyses } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: customersData } = useQuery<{ data: StripeCustomer[] }>({
    queryKey: ["/api/admin/customers"],
    enabled: isAuthenticated,
  });

  const { data: subscriptionStats } = useQuery<SubscriptionStats>({
    queryKey: ["/api/admin/subscription-stats"],
    enabled: isAuthenticated,
  });

  const { data: productsData } = useQuery<{ data: ProductWithPrices[] }>({
    queryKey: ["/api/stripe/products-with-prices"],
  });

  const customers = customersData?.data || [];
  const products = productsData?.data || [];

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { isPremium?: boolean; isFreeAccount?: boolean } }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast.success("Usuário atualizado");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast.success("Usuário excluído");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ subscriptionId, immediately }: { subscriptionId: string; immediately: boolean }) => {
      const response = await apiRequest("POST", "/api/admin/cancel-subscription", { subscriptionId, immediately });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-stats"] });
      toast.success("Assinatura cancelada");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const reactivateSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: string) => {
      const response = await apiRequest("POST", "/api/admin/reactivate-subscription", { subscriptionId });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/customers"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscription-stats"] });
      toast.success("Assinatura reativada");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: async ({ productId, newAmount }: { productId: string; newAmount: number }) => {
      const response = await apiRequest("POST", "/api/admin/update-price", { productId, newAmount });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/products-with-prices"] });
      setEditingPrice(null);
      setNewPriceValue("");
      toast.success("Preço atualizado");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const stats = {
    total: analyses.length,
    original: analyses.filter(a => a.result === 'original').length,
    aiGenerated: analyses.filter(a => a.result === 'ai_generated').length,
    aiModified: analyses.filter(a => a.result === 'ai_modified').length,
  };

  const formatCurrency = (amount: number, currency: string = 'brl') => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('pt-BR');
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const colors: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500 border-green-500/20',
      canceled: 'bg-red-500/10 text-red-500 border-red-500/20',
      past_due: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      unpaid: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
      trialing: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
    };
    return (
      <Badge className={colors[status] || 'bg-gray-500/10 text-gray-500'}>
        {status}
      </Badge>
    );
  };

  const statCards = [
    { id: 'total', label: t('admin.totalAnalyses'), value: stats.total, icon: BarChart3, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'original', label: t('admin.originalImages'), value: stats.original, icon: Image, color: 'text-green-500', bg: 'bg-green-500/10' },
    { id: 'ai-generated', label: t('admin.aiGenerated'), value: stats.aiGenerated, icon: Sparkles, color: 'text-red-500', bg: 'bg-red-500/10' },
    { id: 'ai-modified', label: t('admin.aiModified'), value: stats.aiModified, icon: Wand2, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  ];

  const revenueCards = [
    { id: 'customers', label: 'Total Clientes', value: subscriptionStats?.totalCustomers || 0, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { id: 'active', label: 'Assinaturas Ativas', value: subscriptionStats?.activeSubscriptions || 0, icon: UserCheck, color: 'text-green-500', bg: 'bg-green-500/10' },
    { id: 'canceled', label: 'Canceladas', value: subscriptionStats?.canceledSubscriptions || 0, icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
    { id: 'revenue', label: 'Receita Mensal', value: formatCurrency(subscriptionStats?.monthlyRevenue || 0), icon: TrendingUp, color: 'text-emerald-500', bg: 'bg-emerald-500/10', isMonetary: true },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <Header />
        <main className="flex-1 container mx-auto px-4 py-8 flex items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Lock className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Acesso Administrativo</CardTitle>
              <CardDescription>
                Digite a chave de administrador para acessar o painel
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="password"
                placeholder="Chave de Admin"
                value={adminKey}
                onChange={(e) => setAdminKey(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                data-testid="input-admin-key"
              />
              <Button 
                className="w-full" 
                onClick={handleLogin}
                disabled={isLoggingIn}
                data-testid="button-admin-login"
              >
                {isLoggingIn ? "Verificando..." : "Acessar Painel"}
              </Button>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <h1 className="text-3xl font-bold" data-testid="text-admin-title">
              {t('admin.title')}
            </h1>
            <Button variant="ghost" size="sm" onClick={handleLogout} data-testid="button-admin-logout">
              <LogOut className="h-4 w-4 mr-1" />
              Sair
            </Button>
          </div>
          <p className="text-muted-foreground">{t('admin.stats')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statCards.map(({ id, label, value, icon: Icon, color, bg }) => (
            <Card key={id} data-testid={`card-stat-${id}`}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <div className={`p-2 rounded-full ${bg}`}>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${color}`}>
                  {isLoadingAnalyses ? "..." : value}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="subscriptions" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl mx-auto grid-cols-4">
            <TabsTrigger value="subscriptions" data-testid="tab-subscriptions">
              <CreditCard className="h-4 w-4 mr-2" />
              Assinaturas
            </TabsTrigger>
            <TabsTrigger value="pricing" data-testid="tab-pricing">
              <DollarSign className="h-4 w-4 mr-2" />
              Preços
            </TabsTrigger>
            <TabsTrigger value="analyses" data-testid="tab-analyses">
              <BarChart3 className="h-4 w-4 mr-2" />
              Análises
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              Usuários
            </TabsTrigger>
          </TabsList>

          <TabsContent value="subscriptions">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {revenueCards.map(({ id, label, value, icon: Icon, color, bg, isMonetary }) => (
                <Card key={id}>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                    <div className={`p-2 rounded-full ${bg}`}>
                      <Icon className={`h-4 w-4 ${color}`} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${color}`}>{value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Clientes e Assinaturas
                </CardTitle>
                <CardDescription>
                  Gerencie os clientes e suas assinaturas do Stripe
                </CardDescription>
              </CardHeader>
              <CardContent>
                {customers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum cliente encontrado
                  </div>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-auto">
                    {customers.map((customer, index) => (
                      <div
                        key={`${customer.customer_id}-${index}`}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                        data-testid={`row-customer-${customer.customer_id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-medium">
                              {(customer.email || '?').charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{customer.name || customer.email}</p>
                            <p className="text-sm text-muted-foreground">{customer.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          {customer.subscription_id && (
                            <>
                              <div className="text-right">
                                <p className="text-sm font-medium">{customer.product_name || 'Plano'}</p>
                                <p className="text-xs text-muted-foreground">
                                  {customer.unit_amount ? formatCurrency(customer.unit_amount, customer.currency || 'brl') : '-'}/mês
                                </p>
                              </div>
                              {getStatusBadge(customer.subscription_status)}
                              <div className="text-xs text-muted-foreground text-right">
                                <p>Início: {formatDate(customer.current_period_start)}</p>
                                <p>Fim: {formatDate(customer.current_period_end)}</p>
                              </div>
                              {customer.subscription_status === 'active' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => cancelSubscriptionMutation.mutate({ 
                                    subscriptionId: customer.subscription_id!, 
                                    immediately: false 
                                  })}
                                  data-testid={`button-cancel-${customer.subscription_id}`}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Cancelar
                                </Button>
                              )}
                              {customer.cancel_at_period_end && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-500 hover:bg-green-500/10"
                                  onClick={() => reactivateSubscriptionMutation.mutate(customer.subscription_id!)}
                                  data-testid={`button-reactivate-${customer.subscription_id}`}
                                >
                                  <RefreshCcw className="h-4 w-4 mr-1" />
                                  Reativar
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Planos e Preços
                </CardTitle>
                <CardDescription>
                  Edite os preços das assinaturas (novos preços serão aplicados para novas assinaturas)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado. Execute POST /api/stripe/seed-products para criar.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {products.map((product) => (
                      <Card key={product.id} className="border-primary/20">
                        <CardHeader>
                          <CardTitle className="text-lg">{product.name}</CardTitle>
                          <CardDescription>{product.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-4">
                            {product.prices.map((price) => (
                              <div key={price.id} className="flex items-center justify-between">
                                <span className="text-2xl font-bold text-primary">
                                  {formatCurrency(price.unit_amount, price.currency)}
                                  <span className="text-sm font-normal text-muted-foreground">/mês</span>
                                </span>
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button 
                                      variant="outline" 
                                      size="sm"
                                      onClick={() => {
                                        setEditingPrice({ 
                                          productId: product.id, 
                                          productName: product.name,
                                          currentAmount: price.unit_amount / 100 
                                        });
                                        setNewPriceValue((price.unit_amount / 100).toString());
                                      }}
                                      data-testid={`button-edit-price-${product.id}`}
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Editar
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Editar Preço - {product.name}</DialogTitle>
                                      <DialogDescription>
                                        Defina o novo valor mensal. Isso criará um novo preço no Stripe.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <div className="py-4">
                                      <label className="text-sm font-medium">Novo Valor (R$)</label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        placeholder="Ex: 29.90"
                                        value={newPriceValue}
                                        onChange={(e) => setNewPriceValue(e.target.value)}
                                        className="mt-2"
                                        data-testid="input-new-price"
                                      />
                                    </div>
                                    <DialogFooter>
                                      <Button
                                        onClick={() => {
                                          const amount = parseFloat(newPriceValue);
                                          if (!isNaN(amount) && amount > 0) {
                                            updatePriceMutation.mutate({ 
                                              productId: product.id, 
                                              newAmount: amount 
                                            });
                                          }
                                        }}
                                        disabled={updatePriceMutation.isPending}
                                        data-testid="button-save-price"
                                      >
                                        <Save className="h-4 w-4 mr-2" />
                                        {updatePriceMutation.isPending ? "Salvando..." : "Salvar"}
                                      </Button>
                                    </DialogFooter>
                                  </DialogContent>
                                </Dialog>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analyses">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.title')}</CardTitle>
                <CardDescription>{t('dashboard.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAnalyses ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
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
                              {new Date(analysis.createdAt).toLocaleDateString('pt-BR')}
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
                          <p className="text-xs text-muted-foreground">{analysis.confidence}%</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('admin.userManagement')}
                </CardTitle>
                <CardDescription>
                  Gerencie contas de usuários, conceda acesso premium ou gratuito
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {t('admin.noUsers')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 rounded-lg bg-muted/50"
                        data-testid={`row-user-${user.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-primary font-medium">
                              {user.username.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium">{user.username}</p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            {user.isPremium && (
                              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                                <Crown className="h-3 w-3 mr-1" />
                                Premium
                              </Badge>
                            )}
                            {user.isFreeAccount && (
                              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                                <Gift className="h-3 w-3 mr-1" />
                                Gratuito
                              </Badge>
                            )}
                            {user.role === 'admin' && (
                              <Badge className="bg-purple-500/10 text-purple-500 border-purple-500/20">
                                Admin
                              </Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{t('admin.analyses')}:</span>
                            <span className="font-medium">{user.analysisCount}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Gratuito</span>
                              <Switch
                                checked={user.isFreeAccount}
                                onCheckedChange={(checked) => 
                                  updateUserMutation.mutate({ id: user.id, updates: { isFreeAccount: checked } })
                                }
                                data-testid={`switch-free-${user.id}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Premium</span>
                              <Switch
                                checked={user.isPremium}
                                onCheckedChange={(checked) => 
                                  updateUserMutation.mutate({ id: user.id, updates: { isPremium: checked } })
                                }
                                data-testid={`switch-premium-${user.id}`}
                              />
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              data-testid={`button-delete-${user.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Footer />
    </div>
  );
}
