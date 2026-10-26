import { Route, Routes } from "react-router-dom";
import OnlineStore from "@/pages/OnlineStore";
import StoreCategoryPage from "@/pages/StoreCategoryPage";
import StorePromotionsPage from "@/pages/StorePromotionsPage";
import StoreBrandPage from "@/pages/StoreBrandPage";
import ProductDetail from "@/pages/ProductDetail";
import Checkout from "@/pages/Checkout";
import OrderConfirmation from "@/pages/OrderConfirmation";
import CustomerAuth from "@/pages/CustomerAuth";
import CustomerAccount from "@/pages/CustomerAccount";
import StoreSearchResults from "@/pages/StoreSearchResults";
import AboutUsPage from "@/pages/AboutUsPage";
import ReturnPolicyPage from "@/pages/ReturnPolicyPage";
import { PublicStoreErrorBoundary } from "@/components/store/PublicStoreErrorBoundary";
import { usePublicStoreIdentity } from "@/contexts/PublicStoreRuntime";

export default function CustomDomainRoutes() {
  const { storeId, storeSlug } = usePublicStoreIdentity();
  return <PublicStoreErrorBoundary storeSlug={storeSlug}>
    <Routes key={storeId}>
      <Route path="/" element={<OnlineStore />} />
      <Route path="/produtos" element={<StoreCategoryPage />} />
      <Route path="/categoria/:categoryId" element={<StoreCategoryPage />} />
      <Route path="/promocoes" element={<StorePromotionsPage />} />
      <Route path="/marca/:brandId" element={<StoreBrandPage />} />
      <Route path="/produto/:productId" element={<ProductDetail />} />
      <Route path="/checkout" element={<Checkout />} />
      <Route path="/pedido-confirmado/:orderId" element={<OrderConfirmation />} />
      <Route path="/auth" element={<CustomerAuth />} />
      <Route path="/conta" element={<CustomerAccount />} />
      <Route path="/buscar" element={<StoreSearchResults />} />
      <Route path="/sobre-nos" element={<AboutUsPage />} />
      <Route path="/trocas-e-devolucoes" element={<ReturnPolicyPage />} />
      <Route path="*" element={<main className="min-h-screen flex items-center justify-center bg-background text-foreground px-6"><h1 className="text-xl text-center">Página não encontrada.</h1></main>} />
    </Routes>
  </PublicStoreErrorBoundary>;
}