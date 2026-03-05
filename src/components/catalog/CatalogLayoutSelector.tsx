export type CatalogLayoutType = 'layout_01' | 'layout_02' | 'layout_03' | 'layout_04';

interface CatalogLayoutSelectorProps {
  selected: CatalogLayoutType;
  onChange: (layout: CatalogLayoutType) => void;
  primaryColor: string;
}

const layouts: { id: CatalogLayoutType; label: string; description: string }[] = [
  { id: 'layout_01', label: 'Layout 01', description: 'Barras verticais clássico' },
  { id: 'layout_02', label: 'Layout 02', description: 'Barras minimalistas' },
  { id: 'layout_03', label: 'Layout 03', description: 'Geometria moderna' },
  { id: 'layout_04', label: 'Layout 04', description: 'Diagonal premium' },
];

// Mini preview thumbnails for each layout
const LayoutThumb = ({ id, color }: { id: CatalogLayoutType; color: string }) => {
  const lighter = color + '99';
  const lightest = color + '44';

  switch (id) {
    case 'layout_01':
      return (
        <svg viewBox="0 0 60 84" className="w-full h-full">
          <rect width="60" height="84" fill="white" />
          <rect x="0" y="0" width="12" height="84" fill={color} />
          <rect x="14" y="0" width="6" height="84" fill={color} />
          <rect x="22" y="0" width="3" height="84" fill={color} />
          <rect x="18" y="22" width="28" height="40" fill="white" stroke="#ddd" strokeWidth="0.5" />
          <text x="32" y="38" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#333">CATÁLOGO</text>
          <text x="32" y="43" textAnchor="middle" fontSize="3" fill="#333">de</text>
          <text x="32" y="48" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#333">PRODUTOS</text>
          <text x="32" y="54" textAnchor="middle" fontSize="3" fill="#666">{new Date().getFullYear()}</text>
        </svg>
      );
    case 'layout_02':
      return (
        <svg viewBox="0 0 60 84" className="w-full h-full">
          <rect width="60" height="84" fill="white" />
          <rect x="0" y="0" width="4" height="84" fill={color} />
          <rect x="6" y="0" width="2" height="84" fill={lighter} />
          <rect x="52" y="0" width="4" height="84" fill={color} />
          <rect x="57" y="0" width="3" height="84" fill={lighter} />
          <rect x="15" y="28" width="30" height="30" rx="1" fill="white" stroke="#eee" strokeWidth="0.5" />
          <text x="30" y="40" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#333">CATÁLOGO</text>
          <text x="30" y="45" textAnchor="middle" fontSize="3" fill="#333">de</text>
          <text x="30" y="50" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#333">PRODUTOS</text>
        </svg>
      );
    case 'layout_03':
      return (
        <svg viewBox="0 0 60 84" className="w-full h-full">
          <rect width="60" height="84" fill="white" />
          <polygon points="0,0 60,0 60,30" fill={lightest} />
          <polygon points="0,84 0,50 40,84" fill={color} />
          <polygon points="60,84 60,60 30,84" fill={lighter} />
          <rect x="15" y="27" width="30" height="30" rx="1" fill="white" stroke="#eee" strokeWidth="0.5" />
          <text x="30" y="39" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#333">CATÁLOGO</text>
          <text x="30" y="44" textAnchor="middle" fontSize="3" fill="#333">de</text>
          <text x="30" y="49" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#333">PRODUTOS</text>
        </svg>
      );
    case 'layout_04':
      return (
        <svg viewBox="0 0 60 84" className="w-full h-full">
          <rect width="60" height="84" fill="white" />
          <polygon points="0,42 60,30 60,84 0,84" fill={color} />
          <rect x="15" y="27" width="30" height="30" rx="1" fill="white" stroke="#eee" strokeWidth="0.5" />
          <text x="30" y="39" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#333">CATÁLOGO</text>
          <text x="30" y="44" textAnchor="middle" fontSize="3" fill="#333">de</text>
          <text x="30" y="49" textAnchor="middle" fontSize="4" fontWeight="bold" fill="#333">PRODUTOS</text>
        </svg>
      );
  }
};

export const CatalogLayoutSelector = ({ selected, onChange, primaryColor }: CatalogLayoutSelectorProps) => {
  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">Escolher Layout do Catálogo</label>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {layouts.map((layout) => {
          const isSelected = selected === layout.id;
          return (
            <button
              key={layout.id}
              type="button"
              onClick={() => onChange(layout.id)}
              className="flex flex-col items-center gap-2 p-2 rounded-lg border-2 transition-all duration-200"
              style={{
                borderColor: isSelected ? primaryColor : '#e5e7eb',
                backgroundColor: isSelected ? primaryColor + '08' : 'white',
                boxShadow: isSelected ? `0 0 0 1px ${primaryColor}` : 'none',
              }}
            >
              <div className="w-full aspect-[210/297] rounded overflow-hidden border border-gray-100">
                <LayoutThumb id={layout.id} color={primaryColor} />
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: isSelected ? primaryColor : '#666' }}
              >
                {layout.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CatalogLayoutSelector;
