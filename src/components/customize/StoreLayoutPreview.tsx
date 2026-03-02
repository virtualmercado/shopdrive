import { StoreLayoutType } from "./StoreLayoutSelector";

interface WireframeBlock {
  id: string;
  name: string;
  heightClass: string;
  shade: "black" | "dark" | "medium" | "light" | "lighter";
}

interface StoreLayoutPreviewProps {
  layoutType: StoreLayoutType;
  primaryColor?: string;
}

// Fixed blocks (always first and last)
const topbar: WireframeBlock = { id: "topbar", name: "Topbar", heightClass: "h-[30px]", shade: "black" };
const header: WireframeBlock = { id: "header", name: "Header", heightClass: "h-[44px]", shade: "dark" };
const footer: WireframeBlock = { id: "footer", name: "Rodapé", heightClass: "h-[52px]", shade: "dark" };

// Dynamic middle modules
const modules: Record<string, WireframeBlock> = {
  banner: { id: "banner", name: "Banner Principal", heightClass: "h-[100px]", shade: "medium" },
  miniBanners: { id: "miniBanners", name: "Mini Banners", heightClass: "h-[60px]", shade: "medium" },
  destaques: { id: "destaques", name: "Carrossel de Destaques", heightClass: "h-[65px]", shade: "lighter" },
  promocoes: { id: "promocoes", name: "Carrossel de Promoções", heightClass: "h-[65px]", shade: "light" },
  todos: { id: "todos", name: "Todos os Produtos", heightClass: "h-[78px]", shade: "lighter" },
  video: { id: "video", name: "Vídeo YouTube", heightClass: "h-[90px]", shade: "dark" },
};

// Order of the dynamic middle section per layout
const layoutMiddleOrder: Record<StoreLayoutType, string[]> = {
  layout_01: ["banner", "miniBanners", "destaques", "promocoes", "todos", "video"],
  layout_02: ["banner", "promocoes", "destaques", "miniBanners", "todos", "video"],
  layout_03: ["banner", "video", "miniBanners", "destaques", "promocoes", "todos"],
};

const shadeColors: Record<WireframeBlock["shade"], string> = {
  black: "#1a1a1a",
  dark: "#374151",
  medium: "#6b7280",
  light: "#d1d5db",
  lighter: "#e5e7eb",
};

const textColors: Record<WireframeBlock["shade"], string> = {
  black: "#a3a3a3",
  dark: "#d1d5db",
  medium: "#e5e7eb",
  light: "#4b5563",
  lighter: "#4b5563",
};

const WireframeBlockItem = ({ block }: { block: WireframeBlock }) => (
  <div
    className={`${block.heightClass} w-full rounded-lg flex items-center justify-center border border-gray-200/50`}
    style={{
      backgroundColor: shadeColors[block.shade],
      boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
    }}
  >
    <span
      className="text-[11px] font-medium tracking-wide"
      style={{ color: textColors[block.shade] }}
    >
      {block.name}
    </span>
  </div>
);

export const StoreLayoutPreview = ({ layoutType }: StoreLayoutPreviewProps) => {
  const middleOrder = layoutMiddleOrder[layoutType];

  return (
    <div className="flex justify-center">
      {/* Mobile frame */}
      <div
        className="w-[340px] h-[600px] bg-white rounded-2xl border-2 border-gray-300 overflow-hidden flex flex-col"
        style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
      >
        {/* Topbar - always first */}
        <div className="flex-shrink-0 px-2 pt-2">
          <WireframeBlockItem block={topbar} />
        </div>

        {/* Header - always second */}
        <div className="flex-shrink-0 px-2 pt-1.5">
          <WireframeBlockItem block={header} />
        </div>

        {/* Scrollable middle */}
        <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-1.5 min-h-0">
          {middleOrder.map((key) => {
            const block = modules[key];
            if (!block) return null;
            return <WireframeBlockItem key={block.id} block={block} />;
          })}
        </div>

        {/* Footer - always last */}
        <div className="flex-shrink-0 px-2 pb-2">
          <WireframeBlockItem block={footer} />
        </div>
      </div>
    </div>
  );
};

export default StoreLayoutPreview;
