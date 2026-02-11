import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";

function getNextUrl(): string {
  const url = new URL(window.location.href);
  return url.searchParams.get("next") || "/";
}

export default function Auth() {
  const [, setLocation] = useLocation();
  const nextUrl = useMemo(() => getNextUrl(), []);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    try {
      await apiRequest("POST", "/api/login", {
        email: loginEmail,
        password: loginPassword,
      });
      toast.success("Login realizado");
      setLocation(nextUrl);
    } catch (e: any) {
      toast.error("Falha no login", { description: e?.message || "Erro" });
    } finally {
      setLoading(false);
    }
  };

  const onRegister = async () => {
    setLoading(true);
    try {
      await apiRequest("POST", "/api/register", {
        username: registerUsername,
        email: registerEmail,
        password: registerPassword,
      });
      await apiRequest("POST", "/api/login", {
        email: registerEmail,
        password: registerPassword,
      });
      toast.success("Conta criada");
      setLocation(nextUrl);
    } catch (e: any) {
      toast.error("Falha ao criar conta", { description: e?.message || "Erro" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 container py-10">
        <Card className="max-w-md mx-auto border-border/50">
          <CardHeader>
            <CardTitle>Acessar</CardTitle>
            <CardDescription>Crie sua conta ou faça login para continuar.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="register">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <div className="space-y-3">
                  <Input
                    placeholder="Email"
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Senha"
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                  />
                  <Button className="w-full" onClick={onLogin} disabled={loading}>
                    Entrar
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="register">
                <div className="space-y-3">
                  <Input
                    placeholder="Usuário"
                    value={registerUsername}
                    onChange={(e) => setRegisterUsername(e.target.value)}
                  />
                  <Input
                    placeholder="Email"
                    type="email"
                    value={registerEmail}
                    onChange={(e) => setRegisterEmail(e.target.value)}
                  />
                  <Input
                    placeholder="Senha (mín. 8 caracteres)"
                    type="password"
                    value={registerPassword}
                    onChange={(e) => setRegisterPassword(e.target.value)}
                  />
                  <Button className="w-full" onClick={onRegister} disabled={loading}>
                    Criar conta
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
}
