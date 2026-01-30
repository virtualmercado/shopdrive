import ProductCarousel from "./ProductCarousel";
import MiniBannerSection from "./MiniBannerSection";
import { BrandSection } from "./BrandSection";
import HomeVideoSection from "./HomeVideoSection";

type StoreLayoutType = "layout_01" | "layout_02" | "layout_03";

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
    store_layout?: StoreLayoutType;
  };
  storeSlug: string | undefined;
  buttonBgColor: string;
  buttonTextColor: string;
  buttonBorderStyle: string;
  productImageFormat: string;
  productBorderStyle: string;
  productTextAlignment: string;
  productButtonDisplay: string;
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
};

// Define the order of modules for each layout
const layoutOrder: Record<StoreLayoutType, (keyof typeof ModuleComponents)[]> = {
  // Layout 01 - Clássico (padrão)
  layout_01: [
    "miniBanners",
    "destaques",
    "promocoes",
    "todos",
    "brands",
    "video",
  ],
  // Layout 02 - Conversão (foco em vendas)
  layout_02: [
    "promocoes",
    "destaques",
    "miniBanners",
    "todos",
    "brands",
    "video",
  ],
  // Layout 03 - Marca & Conteúdo (storytelling)
  layout_03: [
    "video",
    "miniBanners",
    "destaques",
    "promocoes",
    "todos",
    "brands",
  ],
};

export const StoreLayoutContent = (props: StoreLayoutContentProps) => {
  const currentLayout = props.storeData.store_layout || "layout_01";
  const moduleOrder = layoutOrder[currentLayout];

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
