import { Link, useLocation } from "wouter";
import { History, Layers, Settings, Upload, CreditCard, Video, BookOpen, Menu, Code, Home, LogIn, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import logoLightPath from "@assets/logo-light.png";
import logoDarkPath from "@assets/logo-dark.png";

interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: string;
  isPremium: boolean;
}

export function Header() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const logoPath = theme === "dark" ? logoDarkPath : logoLightPath;

  const { data: user } = useQuery<AuthUser | null>({
    queryKey: ["/api/me"],
    queryFn: async () => {
      try {
        const res = await fetch("/api/me", { credentials: "include" });
        if (!res.ok) return null;
        return await res.json();
      } catch {
        return null;
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  const handleLogout = async () => {
    try {
      await apiRequest("POST", "/api/logout");
      queryClient.setQueryData(["/api/me"], null);
      queryClient.invalidateQueries({ queryKey: ["/api/me"] });
    } catch {}
  };

  const navItems = [
    { path: "/", label: t("nav.home"), icon: Home },
    { path: "/analyze", label: t("nav.upload"), icon: Upload },
    { path: "/video", label: t("nav.video"), icon: Video },
    { path: "/dashboard", label: t("nav.dashboard"), icon: History },
    { path: "/batch", label: t("nav.batch"), icon: Layers },
    { path: "/pricing", label: t("nav.pricing"), icon: CreditCard },
    { path: "/api", label: t("nav.api"), icon: Code },
    { path: "/manual", label: t("nav.manual"), icon: BookOpen },
    { path: "/admin", label: t("nav.admin"), icon: Settings },
  ];

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <img
            src={logoPath}
            alt="Image Certifier"
            className="h-10 w-auto max-w-[220px] sm:max-w-[280px] object-contain"
            data-testid="img-logo"
          />
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link key={path} href={path}>
              <Button
                variant={location === path ? "secondary" : "ghost"}
                size="sm"
                className="gap-2"
                data-testid={`nav-${path.replace("/", "") || "home"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden lg:inline">{label}</span>
              </Button>
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground truncate max-w-[120px]">
                {user.username || user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Link href="/auth">
              <Button variant="default" size="sm" className="gap-2">
                <LogIn className="h-4 w-4" />
                {t("nav.login")}
              </Button>
            </Link>
          )}
        </div>

        <div className="flex md:hidden items-center gap-2">
          <LanguageSelector />
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("nav.menu") || "Menu"}>
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-4">
              <div className="flex flex-col gap-2 mt-6">
                {user && (
                  <div className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg bg-muted/50">
                    <User className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium truncate">{user.username || user.email}</span>
                  </div>
                )}

                {navItems.map(({ path, label, icon: Icon }) => (
                  <SheetClose key={path} asChild>
                    <Link href={path}>
                      <Button
                        variant={location === path ? "secondary" : "ghost"}
                        className="w-full justify-start gap-3"
                      >
                        <Icon className="h-4 w-4" />
                        <span>{label}</span>
                      </Button>
                    </Link>
                  </SheetClose>
                ))}

                <div className="pt-2 flex flex-col gap-2">
                  <ThemeToggle />
                  {user ? (
                    <SheetClose asChild>
                      <Button variant="outline" className="w-full gap-2" onClick={handleLogout}>
                        <LogOut className="h-4 w-4" />
                        {t("nav.logout")}
                      </Button>
                    </SheetClose>
                  ) : (
                    <SheetClose asChild>
                      <Link href="/auth">
                        <Button variant="default" className="w-full gap-2">
                          <LogIn className="h-4 w-4" />
                          {t("nav.login")}
                        </Button>
                      </Link>
                    </SheetClose>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
