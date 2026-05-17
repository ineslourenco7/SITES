import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LocalStoreContext, useLocalStoreState } from "@/hooks/use-local-store";

import LandingPage from "@/pages/landing";
import BuilderPage from "@/pages/builder";
import SettingsPage from "@/pages/settings";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/builder" component={BuilderPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function LocalStoreProvider({ children }: { children: React.ReactNode }) {
  const store = useLocalStoreState();
  return (
    <LocalStoreContext.Provider value={store}>
      {children}
    </LocalStoreContext.Provider>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LocalStoreProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </LocalStoreProvider>
    </QueryClientProvider>
  );
}

export default App;
