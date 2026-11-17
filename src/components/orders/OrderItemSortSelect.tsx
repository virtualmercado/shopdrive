import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ORDER_ITEM_SORT_LABEL,
  ORDER_ITEM_SORT_OPTIONS,
  isOrderItemSortMode,
  type OrderItemSortMode,
} from "@/lib/orderItemSort";

interface OrderItemSortSelectProps {
  value: OrderItemSortMode;
  onChange: (mode: OrderItemSortMode) => void;
  id?: string;
}

/** "Ordenar itens por" — only rendered for orders that carry item positions. */
export const OrderItemSortSelect = ({ value, onChange, id = "order-item-sort" }: OrderItemSortSelectProps) => (
  <div className="flex items-center gap-2">
    <Label htmlFor={id} className="text-xs text-muted-foreground whitespace-nowrap">
      {ORDER_ITEM_SORT_LABEL}
    </Label>
    <Select value={value} onValueChange={(v) => isOrderItemSortMode(v) && onChange(v)}>
      <SelectTrigger id={id} aria-label={ORDER_ITEM_SORT_LABEL} className="h-8 w-32 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ORDER_ITEM_SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);
