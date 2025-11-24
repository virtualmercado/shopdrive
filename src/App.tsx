import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/dashboard/Dashboard";
import Products from "./pages/dashboard/Products";
import Orders from "./pages/dashboard/Orders";
import Customize from "./pages/dashboard/Customize";
import Settings from "./pages/dashboard/Settings";
import StorePreview from "./pages/dashboard/StorePreview";
import Store from "./pages/Store";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import Gestor from "./pages/admin/Gestor";
import Assinantes from "./pages/admin/Assinantes";
import Faturas from "./pages/admin/Faturas";
import Relatorios from "./pages/admin/Relatorios";
import Integracoes from "./pages/admin/Integracoes";
import Suporte from "./pages/admin/Suporte";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/lojista" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/lojista/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/lojista/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/lojista/customize" element={<ProtectedRoute><Customize /></ProtectedRoute>} />
          <Route path="/lojista/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/lojista/store" element={<ProtectedRoute><StorePreview /></ProtectedRoute>} />
          
          {/* Admin Routes */}
          <Route path="/gestor" element={<AdminRoute><Gestor /></AdminRoute>} />
          <Route path="/gestor/assinantes" element={<AdminRoute><Assinantes /></AdminRoute>} />
          <Route path="/gestor/faturas" element={<AdminRoute><Faturas /></AdminRoute>} />
          <Route path="/gestor/relatorios" element={<AdminRoute><Relatorios /></AdminRoute>} />
          <Route path="/gestor/integracoes" element={<AdminRoute><Integracoes /></AdminRoute>} />
          <Route path="/gestor/suporte" element={<AdminRoute><Suporte /></AdminRoute>} />
          
          {/* Public Store Routes */}
          <Route path="/store/:storeSlug" element={<Store />} />
          <Route path="/store/:storeSlug/cart" element={<Cart />} />
          <Route path="/store/:storeSlug/checkout" element={<Checkout />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
