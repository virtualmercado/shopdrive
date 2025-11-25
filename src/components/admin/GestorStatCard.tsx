import { LucideIcon } from "lucide-react";

interface GestorStatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  subtitle?: string;
  loading?: boolean;
}

export const GestorStatCard = ({
  icon: Icon,
  title,
  value,
  subtitle,
  loading = false
}: GestorStatCardProps) => {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-3/4"></div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
          {subtitle && (
            <p className="text-sm text-gray-400">{subtitle}</p>
          )}
        </div>
        
        <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0">
          <Icon className="h-6 w-6 text-gray-600" />
        </div>
      </div>
    </div>
  );
};
