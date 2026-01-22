import { Link } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";
import mfaLogoPath from "@assets/mfa-logo.png";

export function Footer() {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border/40 py-4 mt-auto bg-card/30">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <img 
              src={mfaLogoPath} 
              alt="MFA" 
              className="h-8 w-8 rounded-full" 
              data-testid="img-mfa-logo"
            />
            <span className="text-sm font-medium">{t('footer.developer')}</span>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{t('footer.contact')}:</span>
            <a 
              href="mailto:contato@imgcertifier.app" 
              className="text-primary hover:underline"
              data-testid="link-contact-email"
            >
              contato@imgcertifier.app
            </a>
          </div>

          <nav className="flex items-center gap-4 text-sm">
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-privacy">
              {t('footer.privacy')}
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-terms">
              {t('footer.terms')}
            </Link>
            <Link href="/about" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="link-about">
              {t('footer.about')}
            </Link>
          </nav>
        </div>

        <div className="pt-3 border-t border-border/40 text-center text-xs text-muted-foreground/70">
          &copy; {currentYear} Image Certifier. {t('footer.rights')}
        </div>
      </div>
    </footer>
  );
}
