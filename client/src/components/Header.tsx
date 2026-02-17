import { Link, useLocation } from "wouter";
import { History, Layers, Settings, Upload, CreditCard, Video, BookOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoLightPath from "@assets/logo-light.png";
import logoDarkPath from "@assets/logo-dark.png";

export function Header() {
  const [location] = useLocation();
  const { t } = useLanguage();
  const { theme } = useTheme();
  const logoPath = theme === "dark" ? logoDarkPath : logoLightPath;

  const navItems = [
    { path: "/", label: t('nav.upload'), icon: Upload },
    { path: "/video", label: t('nav.video'), icon: Video },
    { path: "/dashboard", label: t('nav.dashboard'), icon: History },
    { path: "/batch", label: t('nav.batch'), icon: Layers },
    { path: "/pricing", label: t('nav.pricing'), icon: CreditCard },
    { path: "/manual", label: t('nav.manual'), icon: BookOpen },
    { path: "/admin", label: t('nav.admin'), icon: Settings },
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
                data-testid={`nav-${path.replace("/", "") || "upload"}`}
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

                <div className="pt-2">
                  <ThemeToggle />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
