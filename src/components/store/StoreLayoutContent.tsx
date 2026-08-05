import ProductCarousel from "./ProductCarousel";
import MiniBannerSection from "./MiniBannerSection";
import { BrandSection } from "./BrandSection";
import HomeVideoSection from "./HomeVideoSection";
import StoreReviewsSection from "./StoreReviewsSection";
import { normalizeStoreLayout, type StoreLayoutType } from "@/lib/storeLayout";


interface StoreLayoutContentProps {
  storeData: {
    id: string;
    primary_color: string;
    banner_rect_1_url: string;
    banner_rect_2_url: string;
    minibanner_1_img2_url?: string | null;
    minibanner_2_img2_url?: string | null;
    home_video_enabled?: boolean;
    home_video_id?: string | null;
    home_video_title?: string | null;
    home_video_description?: string | null;
    store_layout?: string | null;
  };
  storeSlug: string | undefined;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonBorderStyle: string;
  productImageFormat: string;
  productBorderStyle: string;
  productTextAlignment: string;
  productButtonDisplay: string;
  priceColor?: string;
  titleColor?: string;
  selectedCategory: string | null;
}

// Define module components for each type
const ModuleComponents = {
  destaques: (props: any) => (
    <ProductCarousel
      title="Destaques"
      subtitle="Confira os produtos em destaque"
      storeOwnerId={props.storeData.id}
      storeSlug={props.storeSlug}
      featured={true}
      primaryColor={props.storeData.primary_color}
      buttonBgColor={props.buttonBgColor}
      buttonTextColor={props.buttonTextColor}
      buttonBorderStyle={props.buttonBorderStyle}
      productImageFormat={props.productImageFormat}
      productBorderStyle={props.productBorderStyle}
      productTextAlignment={props.productTextAlignment}
      productButtonDisplay={props.productButtonDisplay}
      priceColor={props.priceColor}
      titleColor={props.titleColor}
      selectedCategory={props.selectedCategory}
    />
  ),
  novidades: (props: any) => (
    <ProductCarousel
      title="Novidades"
      subtitle="Confira os últimos lançamentos"
      storeOwnerId={props.storeData.id}
      storeSlug={props.storeSlug}
      newest
      primaryColor={props.storeData.primary_color}
      buttonBgColor={props.buttonBgColor}
      buttonTextColor={props.buttonTextColor}
      buttonBorderStyle={props.buttonBorderStyle}
      productImageFormat={props.productImageFormat}
      productBorderStyle={props.productBorderStyle}
      productTextAlignment={props.productTextAlignment}
      productButtonDisplay={props.productButtonDisplay}
      priceColor={props.priceColor}
      titleColor={props.titleColor}
      selectedCategory={props.selectedCategory}
    />
  ),
  promocoes: (props: any) => (
    <ProductCarousel
      title="Promoções"
      subtitle="Aproveite os melhores preços"
      storeOwnerId={props.storeData.id}
      storeSlug={props.storeSlug}
      promotional={true}
      primaryColor={props.storeData.primary_color}
      buttonBgColor={props.buttonBgColor}
      buttonTextColor={props.buttonTextColor}
      buttonBorderStyle={props.buttonBorderStyle}
      productImageFormat={props.productImageFormat}
      productBorderStyle={props.productBorderStyle}
      productTextAlignment={props.productTextAlignment}
      productButtonDisplay={props.productButtonDisplay}
      priceColor={props.priceColor}
      titleColor={props.titleColor}
      selectedCategory={props.selectedCategory}
    />
  ),
  todos: (props: any) => (
    <section id="todos-produtos">
      <ProductCarousel
        title="Todos os Produtos"
        subtitle="Navegue por todo o catálogo"
        storeOwnerId={props.storeData.id}
        storeSlug={props.storeSlug}
        primaryColor={props.storeData.primary_color}
        buttonBgColor={props.buttonBgColor}
        buttonTextColor={props.buttonTextColor}
        buttonBorderStyle={props.buttonBorderStyle}
        productImageFormat={props.productImageFormat}
        productBorderStyle={props.productBorderStyle}
        productTextAlignment={props.productTextAlignment}
        productButtonDisplay={props.productButtonDisplay}
      priceColor={props.priceColor}
      titleColor={props.titleColor}
      selectedCategory={props.selectedCategory}
      />
    </section>
  ),
  miniBanners: (props: any) => (
    <MiniBannerSection
      miniBanner1={{
        img1Url: props.storeData.banner_rect_1_url || null,
        img2Url: props.storeData.minibanner_1_img2_url || null,
      }}
      miniBanner2={{
        img1Url: props.storeData.banner_rect_2_url || null,
        img2Url: props.storeData.minibanner_2_img2_url || null,
      }}
    />
  ),
  video: (props: any) => (
    props.storeData.home_video_enabled && props.storeData.home_video_id ? (
      <HomeVideoSection
        videoId={props.storeData.home_video_id}
        title={props.storeData.home_video_title}
        description={props.storeData.home_video_description}
        primaryColor={props.storeData.primary_color}
      />
    ) : null
  ),
  brands: (props: any) => (
    <BrandSection
      storeOwnerId={props.storeData.id}
      storeSlug={props.storeSlug || ""}
      primaryColor={props.storeData.primary_color}
      buttonBgColor={props.buttonBgColor}
      buttonTextColor={props.buttonTextColor}
    />
  ),
  reviews: (props: any) => (
    <StoreReviewsSection
      storeOwnerId={props.storeData.id}
      storeSlug={props.storeSlug || ""}
      primaryColor={props.storeData.primary_color}
    />
  ),
};

// Define the order of modules for each layout
// Note: "benefitBanners" is rendered separately in OnlineStore.tsx (above <main>), not here.
const layoutOrder: Record<StoreLayoutType, (keyof typeof ModuleComponents)[]> = {
  layout_01: [
    "miniBanners",
    "destaques",
    "promocoes",
    "todos",
    "brands",
    "video",
    "reviews",
  ],
  layout_02: [
    "promocoes",
    "destaques",
    "miniBanners",
    "todos",
    "brands",
    "video",
    "reviews",
  ],
  layout_03: [
    "video",
    "miniBanners",
    "destaques",
    "promocoes",
    "todos",
    "brands",
    "reviews",
  ],
};

export const StoreLayoutContent = (props: StoreLayoutContentProps) => {
  // Normalize legacy/unknown values ("modelo-1"...) to canonical layout keys.
  const currentLayout = normalizeStoreLayout(props.storeData.store_layout);
  // Double protection: never call .map() on undefined.
  const moduleOrder = layoutOrder[currentLayout] ?? layoutOrder.layout_01;


  return (
    <>
      {moduleOrder.map((moduleKey, index) => {
        const ModuleComponent = ModuleComponents[moduleKey];
        return (
          <div key={`${moduleKey}-${index}`}>
            {ModuleComponent(props)}
          </div>
        );
      })}
    </>
  );
};

export default StoreLayoutContent;
