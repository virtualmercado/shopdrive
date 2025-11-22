import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface StatCardProps {
  icon: LucideIcon;
  title: string;
  value: string | number;
  trend?: 'up' | 'down';
  trendValue?: string;
  color?: string;
  loading?: boolean;
}

export const StatCard = ({
  icon: Icon,
  title,
  value,
  trend,
  trendValue,
  color = "primary",
  loading = false
}: StatCardProps) => {
  if (loading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/2 mb-4"></div>
        <div className="h-8 bg-muted rounded w-3/4"></div>
      </Card>
    );
  }

  const colorClasses = {
    primary: "text-primary bg-primary/10",
    success: "text-green-600 bg-green-50",
    warning: "text-orange-600 bg-orange-50",
    danger: "text-red-600 bg-red-50",
    info: "text-blue-600 bg-blue-50"
  };

  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <h3 className="text-3xl font-bold text-foreground">{value}</h3>
          
          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}>
              {trend === 'up' ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        
        <div className={`p-3 rounded-lg ${colorClasses[color as keyof typeof colorClasses] || colorClasses.primary}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </Card>
  );
};