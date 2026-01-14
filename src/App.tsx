import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import CookieConsentBanner from "@/components/CookieConsentBanner";
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
import Financeiro from "./pages/dashboard/Financeiro";
import Support from "./pages/dashboard/Support";
import Coupons from "./pages/dashboard/Coupons";
import Shipping from "./pages/dashboard/Shipping";
import PaymentMethods from "./pages/dashboard/PaymentMethods";
import Customers from "./pages/dashboard/Customers";
import CustomerDetail from "./pages/dashboard/CustomerDetail";
import CatalogPDF from "./pages/dashboard/CatalogPDF";
import OnlineStore from "./pages/OnlineStore";
import StoreCategoryPage from "./pages/StoreCategoryPage";
import ReturnPolicyPage from "./pages/ReturnPolicyPage";
import AboutUsPage from "./pages/AboutUsPage";
import LandingAboutUs from "./pages/LandingAboutUs";
import TermsOfUsePage from "./pages/TermsOfUsePage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import CookiePolicyPage from "./pages/CookiePolicyPage";
import HelpCenterPage from "./pages/HelpCenterPage";
import ContactPage from "./pages/ContactPage";
import ProductDetail from "./pages/ProductDetail";
import Checkout from "./pages/Checkout";
import OrderConfirmation from "./pages/OrderConfirmation";
import CustomerAuth from "./pages/CustomerAuth";
import CustomerAccount from "./pages/CustomerAccount";
import NotFound from "./pages/NotFound";
import ComingSoon from "./pages/ComingSoon";
import { MerchantRoute } from "./components/MerchantRoute";
import { AdminRoute } from "./components/AdminRoute";

// Admin Panel Pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminCommandCenter from "./pages/admin/AdminCommandCenter";
import AdminAI from "./pages/admin/AdminAI";
import AdminSubscribers from "./pages/admin/AdminSubscribers";
import AdminInvoices from "./pages/admin/AdminInvoices";
import AdminAutomations from "./pages/admin/AdminAutomations";
import AdminIntegrations from "./pages/admin/AdminIntegrations";
import AdminReports from "./pages/admin/AdminReports";
import AdminSupport from "./pages/admin/AdminSupport";
import AdminSecurity from "./pages/admin/AdminSecurity";
import AdminCMS from "./pages/admin/AdminCMS";
import AdminMediaLibrary from "./pages/admin/AdminMediaLibrary";
import AdminLandingSupport from "./pages/admin/AdminLandingSupport";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <CookieConsentBanner />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Admin Master Panel Routes */}
            <Route path="/gestor/login" element={<AdminLogin />} />
            <Route path="/gestor" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/gestor/comando-ia" element={<AdminRoute><AdminCommandCenter /></AdminRoute>} />
            <Route path="/gestor/inteligencia-artificial" element={<AdminRoute><AdminAI /></AdminRoute>} />
            <Route path="/gestor/assinantes" element={<AdminRoute><AdminSubscribers /></AdminRoute>} />
            <Route path="/gestor/faturas" element={<AdminRoute><AdminInvoices /></AdminRoute>} />
            <Route path="/gestor/automacoes" element={<AdminRoute><AdminAutomations /></AdminRoute>} />
            <Route path="/gestor/integracoes" element={<AdminRoute><AdminIntegrations /></AdminRoute>} />
            <Route path="/gestor/cms" element={<AdminRoute><AdminCMS /></AdminRoute>} />
            <Route path="/gestor/biblioteca-midia" element={<AdminRoute><AdminMediaLibrary /></AdminRoute>} />
            <Route path="/gestor/relatorios" element={<AdminRoute><AdminReports /></AdminRoute>} />
            <Route path="/gestor/suporte" element={<AdminRoute><AdminSupport /></AdminRoute>} />
            <Route path="/gestor/suporte-landing" element={<AdminRoute><AdminLandingSupport /></AdminRoute>} />
            <Route path="/gestor/seguranca" element={<AdminRoute><AdminSecurity /></AdminRoute>} />
            
            {/* Merchant Routes */}
            <Route path="/lojista" element={<MerchantRoute><Dashboard /></MerchantRoute>} />
            <Route path="/lojista/products" element={<MerchantRoute><Products /></MerchantRoute>} />
            <Route path="/lojista/coupons" element={<MerchantRoute><Coupons /></MerchantRoute>} />
            <Route path="/lojista/orders" element={<MerchantRoute><Orders /></MerchantRoute>} />
            <Route path="/lojista/customers" element={<MerchantRoute><Customers /></MerchantRoute>} />
            <Route path="/lojista/customers/:customerId" element={<MerchantRoute><CustomerDetail /></MerchantRoute>} />
            <Route path="/lojista/shipping" element={<MerchantRoute><Shipping /></MerchantRoute>} />
            <Route path="/lojista/payment-methods" element={<MerchantRoute><PaymentMethods /></MerchantRoute>} />
            <Route path="/lojista/catalog-pdf" element={<MerchantRoute><CatalogPDF /></MerchantRoute>} />
            <Route path="/lojista/customize" element={<MerchantRoute><Customize /></MerchantRoute>} />
            <Route path="/lojista/settings" element={<MerchantRoute><Settings /></MerchantRoute>} />
            <Route path="/lojista/store" element={<MerchantRoute><StorePreviewEnhanced /></MerchantRoute>} />
            <Route path="/lojista/messages" element={<MerchantRoute><Messages /></MerchantRoute>} />
            <Route path="/lojista/financeiro" element={<MerchantRoute><Financeiro /></MerchantRoute>} />
            <Route path="/lojista/support" element={<MerchantRoute><Support /></MerchantRoute>} />
            
            {/* Public Store Routes */}
            <Route path="/loja/:storeSlug" element={<OnlineStore />} />
            <Route path="/loja/:storeSlug/produtos" element={<StoreCategoryPage />} />
            <Route path="/loja/:storeSlug/categoria/:categoryId" element={<StoreCategoryPage />} />
            <Route path="/loja/:storeSlug/produto/:productId" element={<ProductDetail />} />
            <Route path="/loja/:storeSlug/checkout" element={<Checkout />} />
            <Route path="/loja/:storeSlug/pedido-confirmado/:orderId" element={<OrderConfirmation />} />
            <Route path="/loja/:storeSlug/trocas-e-devolucoes" element={<ReturnPolicyPage />} />
            <Route path="/loja/:storeSlug/sobre-nos" element={<AboutUsPage />} />
            
            {/* Customer Account Routes */}
            <Route path="/loja/:storeSlug/auth" element={<CustomerAuth />} />
            <Route path="/loja/:storeSlug/conta" element={<CustomerAccount />} />
            
            {/* Landing Page Internal Routes (Coming Soon) */}
            <Route path="/sobre-nos" element={<LandingAboutUs />} />
            <Route path="/blog" element={<ComingSoon />} />
            <Route path="/programa-de-afiliados" element={<ComingSoon />} />
            <Route path="/central-de-ajuda" element={<HelpCenterPage />} />
            <Route path="/fale-conosco" element={<ContactPage />} />
            <Route path="/termos-de-uso" element={<TermsOfUsePage />} />
            <Route path="/politica-de-privacidade" element={<PrivacyPolicyPage />} />
            <Route path="/politica-de-cookies" element={<CookiePolicyPage />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
