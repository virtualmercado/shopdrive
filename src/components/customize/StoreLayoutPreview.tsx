import { StoreLayoutType } from "./StoreLayoutSelector";

interface StoreLayoutPreviewProps {
  layoutType: StoreLayoutType;
}

// Module IDs for the dynamic middle section
type ModuleId = "banner" | "miniBanners" | "destaques" | "promocoes" | "todos" | "video";

const layoutMiddleOrder: Record<StoreLayoutType, ModuleId[]> = {
  layout_01: ["banner", "miniBanners", "destaques", "promocoes", "todos", "video"],
  layout_02: ["banner", "promocoes", "destaques", "miniBanners", "todos", "video"],
  layout_03: ["banner", "video", "miniBanners", "destaques", "promocoes", "todos"],
};

/* ── Tiny reusable wireframe pieces ── */

const ProductCard = () => (
  <div className="flex flex-col gap-1">
    <div className="w-[60px] h-[52px] bg-[#b0b0b0] rounded" />
    <div className="w-[34px] h-[7px] bg-[#888] rounded-sm" />
    <div className="w-[24px] h-[7px] bg-[#999] rounded-sm" />
  </div>
);

const CarouselSection = ({ label }: { label: string }) => (
  <div className="bg-[#f0f0f0] rounded-lg px-3 py-3 space-y-2">
    <p className="text-[11px] font-semibold text-[#555] text-center">{label}</p>
    <div className="flex justify-center gap-3">
      <ProductCard />
      <ProductCard />
      <ProductCard />
    </div>
  </div>
);

/* ── Module renderers ── */

const moduleRenderers: Record<ModuleId, () => React.ReactNode> = {
  banner: () => (
    <div className="bg-[#9a9a9a] rounded-lg h-[90px] flex items-center justify-center">
      <span className="text-[12px] font-semibold text-white/90">Banner Principal</span>
    </div>
  ),
  promocoes: () => <CarouselSection label="Carrossel de Promoções" />,
  destaques: () => <CarouselSection label="Carrossel de Destaques" />,
  miniBanners: () => (
    <div className="flex gap-2">
      <div className="flex-1 bg-[#8a8a8a] rounded-lg h-[48px] flex items-center justify-center">
        <span className="text-[10px] font-medium text-white/90">Mini Banners</span>
      </div>
      <div className="flex-1 bg-[#8a8a8a] rounded-lg h-[48px] flex items-center justify-center">
        <span className="text-[10px] font-medium text-white/90">Mini Banners</span>
      </div>
    </div>
  ),
  todos: () => <CarouselSection label="Todos os Produtos" />,
  video: () => (
    <div className="bg-[#a0a0a0] rounded-lg h-[80px] flex items-center justify-center">
      <span className="text-[12px] font-semibold text-white/90">Vídeo YouTube</span>
    </div>
  ),
};

export const StoreLayoutPreview = ({ layoutType }: StoreLayoutPreviewProps) => {
  const middleOrder = layoutMiddleOrder[layoutType];

  return (
    <div className="flex justify-center">
      {/* Mobile frame */}
      <div
        className="w-[340px] h-[620px] bg-[#f7f7f7] rounded-2xl border-2 border-gray-300 overflow-hidden flex flex-col"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
      >
        {/* Topbar */}
        <div className="bg-[#222] h-[28px] flex items-center justify-center flex-shrink-0">
          <span className="text-[10px] font-medium text-gray-300">Top Bar</span>
        </div>

        {/* Header */}
        <div className="mx-2 mt-2 bg-[#555] h-[38px] rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-semibold text-gray-200">Header</span>
        </div>

        {/* Scrollable middle */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2 min-h-0">
          {middleOrder.map((key) => (
            <div key={key}>{moduleRenderers[key]()}</div>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-[#333] h-[42px] flex items-center justify-center flex-shrink-0">
          <span className="text-[11px] font-semibold text-gray-300">Rodapé</span>
        </div>
      </div>
    </div>
  );
};

export default StoreLayoutPreview;
