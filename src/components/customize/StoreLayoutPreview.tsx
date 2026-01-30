import { StoreLayoutType } from "./StoreLayoutSelector";

interface ModuleBlock {
  id: string;
  name: string;
  height: "sm" | "md" | "lg" | "xl";
  width: "full" | "half";
  icon?: string;
}

interface StoreLayoutPreviewProps {
  layoutType: StoreLayoutType;
  primaryColor: string;
}

// Define the order of modules for each layout
const layoutModules: Record<StoreLayoutType, ModuleBlock[]> = {
  layout_01: [
    { id: "header", name: "Header", height: "sm", width: "full" },
    { id: "banner", name: "Banner Principal", height: "lg", width: "full" },
    { id: "mini-banners", name: "Mini Banners", height: "md", width: "full" },
    { id: "destaques", name: "Carrossel de Destaques", height: "md", width: "full" },
    { id: "promocoes", name: "Carrossel de Promoções", height: "md", width: "full" },
    { id: "todos", name: "Todos os Produtos", height: "md", width: "full" },
    { id: "video", name: "Vídeo YouTube", height: "lg", width: "full" },
    { id: "footer", name: "Rodapé", height: "sm", width: "full" },
  ],
  layout_02: [
    { id: "header", name: "Header", height: "sm", width: "full" },
    { id: "banner", name: "Banner Principal", height: "lg", width: "full" },
    { id: "promocoes", name: "Carrossel de Promoções", height: "md", width: "full" },
    { id: "destaques", name: "Carrossel de Destaques", height: "md", width: "full" },
    { id: "mini-banners", name: "Mini Banners", height: "md", width: "full" },
    { id: "todos", name: "Todos os Produtos", height: "md", width: "full" },
    { id: "video", name: "Vídeo YouTube", height: "lg", width: "full" },
    { id: "footer", name: "Rodapé", height: "sm", width: "full" },
  ],
  layout_03: [
    { id: "header", name: "Header", height: "sm", width: "full" },
    { id: "banner", name: "Banner Principal", height: "lg", width: "full" },
    { id: "video", name: "Vídeo YouTube", height: "lg", width: "full" },
    { id: "mini-banners", name: "Mini Banners", height: "md", width: "full" },
    { id: "destaques", name: "Carrossel de Destaques", height: "md", width: "full" },
    { id: "promocoes", name: "Carrossel de Promoções", height: "md", width: "full" },
    { id: "todos", name: "Todos os Produtos", height: "md", width: "full" },
    { id: "footer", name: "Rodapé", height: "sm", width: "full" },
  ],
};

const heightClasses: Record<string, string> = {
  sm: "h-6",
  md: "h-10",
  lg: "h-14",
  xl: "h-20",
};

const getModuleStyle = (moduleId: string, primaryColor: string): React.CSSProperties => {
  switch (moduleId) {
    case "header":
      return { backgroundColor: primaryColor, opacity: 0.9 };
    case "banner":
      return { background: `linear-gradient(135deg, ${primaryColor}cc, ${primaryColor}88)` };
    case "footer":
      return { backgroundColor: "#1f2937" };
    case "video":
      return { backgroundColor: "#374151", border: "2px dashed #6b7280" };
    case "mini-banners":
      return { backgroundColor: "#e5e7eb" };
    case "destaques":
      return { backgroundColor: `${primaryColor}30` };
    case "promocoes":
      return { backgroundColor: "#fef3c7" };
    case "todos":
      return { backgroundColor: "#f3f4f6" };
    default:
      return { backgroundColor: "#f9fafb" };
  }
};

const getModuleIcon = (moduleId: string): string => {
  switch (moduleId) {
    case "header":
      return "☰";
    case "banner":
      return "🖼️";
    case "footer":
      return "📍";
    case "video":
      return "▶️";
    case "mini-banners":
      return "◻◻";
    case "destaques":
      return "⭐";
    case "promocoes":
      return "🏷️";
    case "todos":
      return "📦";
    default:
      return "□";
  }
};

export const StoreLayoutPreview = ({ layoutType, primaryColor }: StoreLayoutPreviewProps) => {
  const modules = layoutModules[layoutType];

  return (
    <div className="w-full bg-white rounded-lg shadow-sm overflow-hidden border">
      {/* Browser mockup header */}
      <div className="bg-gray-100 px-3 py-2 flex items-center gap-2 border-b">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 bg-white rounded px-2 py-0.5 text-[10px] text-gray-400 text-center">
          minhaloja.virtualmercado.com
        </div>
      </div>

      {/* Layout modules */}
      <div className="p-2 space-y-1.5 max-h-[360px] overflow-y-auto">
        {modules.map((module, index) => (
          <div
            key={`${module.id}-${index}`}
            className={`${heightClasses[module.height]} ${
              module.width === "full" ? "w-full" : "w-1/2"
            } rounded flex items-center justify-center gap-1.5 transition-all`}
            style={getModuleStyle(module.id, primaryColor)}
          >
            <span className="text-xs opacity-80">{getModuleIcon(module.id)}</span>
            <span 
              className={`text-[10px] font-medium truncate px-1 ${
                module.id === "footer" || module.id === "video" 
                  ? "text-white" 
                  : module.id === "header" 
                    ? "text-white" 
                    : "text-gray-700"
              }`}
            >
              {module.name}
            </span>
          </div>
        ))}
      </div>

      {/* Layout name badge */}
      <div className="bg-gray-50 px-3 py-2 border-t text-center">
        <span 
          className="text-xs font-medium px-2 py-0.5 rounded"
          style={{ 
            backgroundColor: `${primaryColor}20`,
            color: primaryColor 
          }}
        >
          {layoutType === "layout_01" && "Layout Clássico"}
          {layoutType === "layout_02" && "Layout Conversão"}
          {layoutType === "layout_03" && "Layout Marca & Conteúdo"}
        </span>
      </div>
    </div>
  );
};

export default StoreLayoutPreview;
