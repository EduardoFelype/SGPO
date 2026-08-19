import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Dashboard from "./pages/Dashboard";
import Financial from "./pages/Financial";
import Reports from "./pages/Reports";
import ServiceOrderDetail from "./pages/ServiceOrderDetail";
import ServiceOrderForm from "./pages/ServiceOrderForm";
import ServiceOrders from "./pages/ServiceOrders";
import Settings from "./pages/Settings";
import Stock from "./pages/Stock";
import Vehicles from "./pages/Vehicles";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Dashboard} />
      <Route path={"/dashboard"} component={Dashboard} />
      <Route path={"/clientes"} component={Customers} />
      <Route path={"/clientes/:id"} component={CustomerDetail} />
      <Route path={"/veiculos"} component={Vehicles} />
      <Route path={"/os"} component={ServiceOrders} />
      <Route path={"/os/nova"} component={ServiceOrderForm} />
      <Route path={"/os/:id"} component={ServiceOrderDetail} />
      <Route path={"/os/:id/editar"} component={ServiceOrderForm} />
      <Route path={"/estoque"} component={Stock} />
      <Route path={"/financeiro"} component={Financial} />
      <Route path={"/relatorios"} component={Reports} />
      <Route path={"/config"} component={Settings} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
