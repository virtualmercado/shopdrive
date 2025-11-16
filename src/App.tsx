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
import AdminDashboard from "./pages/admin/AdminDashboard";
import Subscribers from "./pages/admin/Subscribers";
import Plans from "./pages/admin/Plans";
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
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/dashboard/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
          <Route path="/dashboard/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/dashboard/customize" element={<ProtectedRoute><Customize /></ProtectedRoute>} />
          <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/subscribers" element={<AdminRoute><Subscribers /></AdminRoute>} />
          <Route path="/admin/plans" element={<AdminRoute><Plans /></AdminRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
