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

// Neutral gray palette for layout thumbnails
const NEUTRAL = {
  dark: '#9E9E9E',
  medium: '#BDBDBD',
  light: '#E0E0E0',
  lightest: '#F5F5F5',
};

// Mini preview thumbnails for each layout using neutral grays — high-res SVG viewBox for retina sharpness
const LayoutThumb = ({ id }: { id: CatalogLayoutType }) => {
  switch (id) {
    case 'layout_01':
      return (
        <svg viewBox="0 0 210 297" className="w-full h-full" shapeRendering="geometricPrecision">
          <rect width="210" height="297" fill="white" />
          <rect x="0" y="0" width="42" height="297" fill={NEUTRAL.dark} />
          <rect x="49" y="0" width="21" height="297" fill={NEUTRAL.dark} />
          <rect x="77" y="0" width="10" height="297" fill={NEUTRAL.dark} />
          <rect x="63" y="78" width="98" height="141" fill="white" stroke="#ddd" strokeWidth="1" />
          <text x="112" y="134" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">CATÁLOGO</text>
          <text x="112" y="152" textAnchor="middle" fontSize="11" fill="#333">de</text>
          <text x="112" y="170" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">PRODUTOS</text>
          <text x="112" y="191" textAnchor="middle" fontSize="10" fill="#666">{new Date().getFullYear()}</text>
        </svg>
      );
    case 'layout_02':
      return (
        <svg viewBox="0 0 210 297" className="w-full h-full" shapeRendering="geometricPrecision">
          <rect width="210" height="297" fill="white" />
          <rect x="0" y="0" width="14" height="297" fill={NEUTRAL.dark} />
          <rect x="21" y="0" width="7" height="297" fill={NEUTRAL.medium} />
          <rect x="182" y="0" width="14" height="297" fill={NEUTRAL.dark} />
          <rect x="199" y="0" width="11" height="297" fill={NEUTRAL.medium} />
          <rect x="52" y="99" width="106" height="106" rx="3" fill="white" stroke="#eee" strokeWidth="1" />
          <text x="105" y="141" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">CATÁLOGO</text>
          <text x="105" y="159" textAnchor="middle" fontSize="11" fill="#333">de</text>
          <text x="105" y="177" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">PRODUTOS</text>
        </svg>
      );
    case 'layout_03':
      return (
        <svg viewBox="0 0 210 297" className="w-full h-full" shapeRendering="geometricPrecision">
          <rect width="210" height="297" fill="white" />
          <polygon points="0,0 210,0 210,106" fill={NEUTRAL.lightest} />
          <polygon points="0,297 0,176 140,297" fill={NEUTRAL.dark} />
          <polygon points="210,297 210,212 105,297" fill={NEUTRAL.medium} />
          <rect x="52" y="95" width="106" height="106" rx="3" fill="white" stroke="#eee" strokeWidth="1" />
          <text x="105" y="137" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">CATÁLOGO</text>
          <text x="105" y="155" textAnchor="middle" fontSize="11" fill="#333">de</text>
          <text x="105" y="173" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">PRODUTOS</text>
        </svg>
      );
    case 'layout_04':
      return (
        <svg viewBox="0 0 210 297" className="w-full h-full" shapeRendering="geometricPrecision">
          <rect width="210" height="297" fill="white" />
          <polygon points="0,148 210,106 210,297 0,297" fill={NEUTRAL.dark} />
          <rect x="52" y="95" width="106" height="106" rx="3" fill="white" stroke="#eee" strokeWidth="1" />
          <text x="105" y="137" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">CATÁLOGO</text>
          <text x="105" y="155" textAnchor="middle" fontSize="11" fill="#333">de</text>
          <text x="105" y="173" textAnchor="middle" fontSize="14" fontWeight="bold" fill="#333">PRODUTOS</text>
        </svg>
      );
  }
};

const SELECTION_COLOR = '#6A1B9A';

export const CatalogLayoutSelector = ({ selected, onChange }: CatalogLayoutSelectorProps) => {
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
                borderColor: isSelected ? SELECTION_COLOR : '#e5e7eb',
                backgroundColor: isSelected ? SELECTION_COLOR + '08' : 'white',
                boxShadow: isSelected ? `0 0 0 1px ${SELECTION_COLOR}` : 'none',
              }}
            >
              <div className="w-full aspect-[210/297] rounded overflow-hidden border border-gray-100">
                <LayoutThumb id={layout.id} />
              </div>
              <span
                className="text-xs font-medium"
                style={{ color: isSelected ? SELECTION_COLOR : '#666' }}
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
