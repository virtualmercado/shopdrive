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
import StorePreviewEnhanced from "./pages/dashboard/StorePreviewEnhanced";
import Messages from "./pages/dashboard/Messages";
import OnlineStore from "./pages/OnlineStore";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

function App() {
  return (
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
            <Route path="/lojista/store" element={<ProtectedRoute><StorePreviewEnhanced /></ProtectedRoute>} />
            <Route path="/lojista/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            
            {/* Public Store Routes */}
            <Route path="/loja/:storeSlug" element={<OnlineStore />} />
            <Route path="/loja/:storeSlug/checkout" element={<Checkout />} />
            <Route path="/loja/:storeSlug/pedido-confirmado/:orderId" element={<OrderConfirmation />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
