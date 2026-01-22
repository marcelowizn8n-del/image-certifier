import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie, Settings, X } from "lucide-react";

export function CookieConsent() {
  const [showConsent, setShowConsent] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent");
    if (!consent) {
      const timer = setTimeout(() => {
        setShowConsent(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent", "accepted");
    setShowConsent(false);
  };

  const handleReject = () => {
    localStorage.setItem("cookie-consent", "rejected");
    setShowConsent(false);
  };

  return (
    <AnimatePresence>
      {showConsent && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-50 p-4"
        >
          <Card className="max-w-4xl mx-auto border-border/50 bg-card/95 backdrop-blur-lg shadow-2xl">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Cookie className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1" data-testid="text-cookie-title">
                      Cookie Consent
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      We use cookies to enhance your experience, analyze site traffic, and for marketing purposes. 
                      By clicking "Accept All", you consent to our use of cookies.{" "}
                      <Link href="/privacy" className="text-primary hover:underline">
                        Privacy Policy
                      </Link>
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 flex-shrink-0 w-full md:w-auto">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleReject}
                    className="flex-1 md:flex-initial"
                    data-testid="button-reject-cookies"
                  >
                    Reject All
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleAccept}
                    className="flex-1 md:flex-initial"
                    data-testid="button-accept-cookies"
                  >
                    Accept All
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
