import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="border-t border-border/40 py-4 mt-auto">
      <div className="container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              By{" "}
              <a 
                href="mailto:marcelo@dttools.app" 
                className="font-medium text-muted-foreground hover:text-foreground transition-colors"
                data-testid="link-author"
              >
                MARCELO FERREIRA DE ARAUJO
              </a>
            </span>
          </div>

          <div className="text-xs text-muted-foreground">
            Contact:{" "}
            <a 
              href="mailto:contato@imgcertifier.app" 
              className="hover:text-foreground transition-colors"
              data-testid="link-contact-email"
            >
              contato@imgcertifier.app
            </a>
          </div>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors" data-testid="link-privacy">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors" data-testid="link-terms">
              Terms
            </Link>
            <Link href="/about" className="hover:text-foreground transition-colors" data-testid="link-about">
              About
            </Link>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border/40 text-center text-[10px] text-muted-foreground/70">
          © {new Date().getFullYear()} Image Certifier. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
