import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import NotFound from "@/pages/not-found";
import Upload from "@/pages/Upload";
import VideoUpload from "@/pages/VideoUpload";
import Dashboard from "@/pages/Dashboard";
import BatchUpload from "@/pages/BatchUpload";
import Admin from "@/pages/Admin";
import Privacy from "@/pages/Privacy";
import Terms from "@/pages/Terms";
import About from "@/pages/About";
import Pricing from "@/pages/Pricing";
import Manual from "@/pages/Manual";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Upload} />
      <Route path="/video" component={VideoUpload} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/batch" component={BatchUpload} />
      <Route path="/admin" component={Admin} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/manual" component={Manual} />
      <Route path="/checkout/success" component={Upload} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/about" component={About} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" switchable>
      <LanguageProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </QueryClientProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
