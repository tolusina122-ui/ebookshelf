import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Checkout from "@/pages/checkout";
import AdminLogin from "@/pages/admin/login";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminBooks from "@/pages/admin/books";
import AdminTransactions from "@/pages/admin/transactions";
import AdminWallet from "@/pages/admin/wallet";
import { Navbar } from "@/components/navbar";
import { AdminLayout } from "@/components/admin-layout";

function Router() {
  return (
    <Switch>
      {/* Public Routes */}
      <Route path="/">
        {() => (
          <>
            <Navbar />
            <Home />
          </>
        )}
      </Route>
      <Route path="/checkout">
        {() => (
          <>
            <Navbar />
            <Checkout />
          </>
        )}
      </Route>

      {/* Admin Routes */}
      <Route path="/admin/login" component={AdminLogin} />
      <Route path="/admin/dashboard">
        {() => (
          <AdminLayout>
            <AdminDashboard />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/books">
        {() => (
          <AdminLayout>
            <AdminBooks />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/transactions">
        {() => (
          <AdminLayout>
            <AdminTransactions />
          </AdminLayout>
        )}
      </Route>
      <Route path="/admin/wallet">
        {() => (
          <AdminLayout>
            <AdminWallet />
          </AdminLayout>
        )}
      </Route>

      {/* 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
