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
import StoreCategoryPage from "./pages/StoreCategoryPage";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import CustomerAuth from "./pages/CustomerAuth";
import CustomerAccount from "./pages/CustomerAccount";
import NotFound from "./pages/NotFound";
import { MerchantRoute } from "./components/MerchantRoute";

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
            <Route path="/lojista" element={<MerchantRoute><Dashboard /></MerchantRoute>} />
            <Route path="/lojista/products" element={<MerchantRoute><Products /></MerchantRoute>} />
            <Route path="/lojista/orders" element={<MerchantRoute><Orders /></MerchantRoute>} />
            <Route path="/lojista/customize" element={<MerchantRoute><Customize /></MerchantRoute>} />
            <Route path="/lojista/settings" element={<MerchantRoute><Settings /></MerchantRoute>} />
            <Route path="/lojista/store" element={<MerchantRoute><StorePreviewEnhanced /></MerchantRoute>} />
            <Route path="/lojista/messages" element={<MerchantRoute><Messages /></MerchantRoute>} />
            
            {/* Public Store Routes */}
            <Route path="/loja/:storeSlug" element={<OnlineStore />} />
            <Route path="/loja/:storeSlug/produtos" element={<StoreCategoryPage />} />
            <Route path="/loja/:storeSlug/categoria/:categoryId" element={<StoreCategoryPage />} />
            <Route path="/loja/:storeSlug/produto/:productId" element={<ProductDetail />} />
            <Route path="/loja/:storeSlug/checkout" element={<Checkout />} />
            <Route path="/loja/:storeSlug/pedido-confirmado/:orderId" element={<OrderConfirmation />} />
            
            {/* Customer Account Routes */}
            <Route path="/loja/:storeSlug/auth" element={<CustomerAuth />} />
            <Route path="/loja/:storeSlug/conta" element={<CustomerAccount />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
