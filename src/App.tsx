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
import AdminDashboard from "./pages/admin/AdminDashboard";
import Subscribers from "./pages/admin/Subscribers";
import Plans from "./pages/admin/Plans";
import Invoices from "./pages/admin/Invoices";
import Reports from "./pages/admin/Reports";
import Integrations from "./pages/admin/Integrations";
import Support from "./pages/admin/Support";
import Store from "./pages/Store";
import Cart from "./pages/Cart";
import Checkout from "./pages/Checkout";
import NotFound from "./pages/NotFound";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";

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
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/subscribers" element={<AdminRoute><Subscribers /></AdminRoute>} />
          <Route path="/admin/plans" element={<AdminRoute><Plans /></AdminRoute>} />
          <Route path="/admin/invoices" element={<AdminRoute><Invoices /></AdminRoute>} />
          <Route path="/admin/reports" element={<AdminRoute><Reports /></AdminRoute>} />
          <Route path="/admin/integrations" element={<AdminRoute><Integrations /></AdminRoute>} />
          <Route path="/admin/support" element={<AdminRoute><Support /></AdminRoute>} />
          
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
