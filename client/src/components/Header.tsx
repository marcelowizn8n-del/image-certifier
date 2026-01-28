import { Link, useLocation } from "wouter";
import { History, Layers, Settings, Upload, CreditCard, Video, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { LanguageSelector } from "@/components/LanguageSelector";
import { ThemeToggle } from "@/components/ThemeToggle";
import logoPath from "@assets/logo.png";

export function Header() {
  const [location] = useLocation();
  const { t } = useLanguage();

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
        <Link href="/" className="flex items-center gap-2">
          <img src={logoPath} alt="Image Certifier" className="h-8 w-auto" data-testid="img-logo" />
        </Link>

        <nav className="flex items-center gap-1">
          {navItems.map(({ path, label, icon: Icon }) => (
            <Link key={path} href={path}>
              <Button
                variant={location === path ? "secondary" : "ghost"}
                size="sm"
                className="gap-2"
                data-testid={`nav-${path.replace("/", "") || "upload"}`}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Button>
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelector />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
