import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import NotFound from "@/pages/not-found";
import Upload from "@/pages/Upload";
import Dashboard from "@/pages/Dashboard";
import BatchUpload from "@/pages/BatchUpload";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Upload} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/batch" component={BatchUpload} />
      <Route path="/privacy" component={() => <StaticPage title="Privacy Policy" />} />
      <Route path="/terms" component={() => <StaticPage title="Terms of Service" />} />
      <Route path="/about" component={() => <StaticPage title="About" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function StaticPage({ title }: { title: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">{title}</h1>
        <p className="text-muted-foreground">Coming soon...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider defaultTheme="dark" switchable>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
