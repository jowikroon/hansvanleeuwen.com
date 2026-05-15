import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AnimatedRoutes from "./components/AnimatedRoutes";

const queryClient = new QueryClient();

const CHROMELESS_ROUTES = ["/marcel"];

function AppShell() {
  const { pathname } = useLocation();
  const hideChrome = CHROMELESS_ROUTES.includes(pathname);
  return (
    <AuthProvider>
      {!hideChrome && <Navbar />}
      <main className="min-h-screen">
        <AnimatedRoutes />
      </main>
      {!hideChrome && <Footer />}
    </AuthProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
