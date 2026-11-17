import { useSearchParams } from "react-router-dom";
import ThermalReceipt80mm from "@/components/orders/ThermalReceipt80mm";
import { DEFAULT_ORDER_ITEM_SORT_MODE, isOrderItemSortMode } from "@/lib/orderItemSort";

const PrintThermalOrder = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const sort = searchParams.get("sort");

  if (!orderId) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        <p>Pedido não encontrado.</p>
      </div>
    );
  }

  return <ThermalReceipt80mm orderId={orderId} sortMode={isOrderItemSortMode(sort) ? sort : DEFAULT_ORDER_ITEM_SORT_MODE} />;
};

export default PrintThermalOrder;
