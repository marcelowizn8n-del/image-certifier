import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Analysis, User } from "@shared/schema";
import { BarChart3, Image, Sparkles, Wand2, Users, Crown, Gift, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

type SafeUser = Omit<User, 'password'>;

export default function Admin() {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  
  const { data: analyses = [], isLoading: isLoadingAnalyses } = useQuery<Analysis[]>({
    queryKey: ["/api/analyses"],
  });

  const { data: users = [], isLoading: isLoadingUsers } = useQuery<SafeUser[]>({
    queryKey: ["/api/users"],
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { isPremium?: boolean; isFreeAccount?: boolean } }) => {
      const response = await apiRequest("PATCH", `/api/users/${id}`, updates);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast.success("User updated");
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
      toast.success("User deleted");
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
              <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {label}
                </CardTitle>
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

        <Tabs defaultValue="analyses" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="analyses" data-testid="tab-analyses">
              <BarChart3 className="h-4 w-4 mr-2" />
              {t('dashboard.title')}
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              {t('admin.userManagement')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analyses">
            <Card>
              <CardHeader>
                <CardTitle>{t('dashboard.title')}</CardTitle>
                <CardDescription>{t('dashboard.subtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingAnalyses ? (
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
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('admin.userManagement')}
                </CardTitle>
                <CardDescription>
                  Manage user accounts, grant premium or free access
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
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
                                Free
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
                              <span className="text-xs text-muted-foreground">{t('admin.freeAccount')}</span>
                              <Switch
                                checked={user.isFreeAccount}
                                onCheckedChange={(checked) => 
                                  updateUserMutation.mutate({ id: user.id, updates: { isFreeAccount: checked } })
                                }
                                data-testid={`switch-free-${user.id}`}
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">{t('admin.premium')}</span>
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
