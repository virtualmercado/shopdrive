import { useSearchParams } from "react-router-dom";
import ThermalReceipt80mm from "@/components/orders/ThermalReceipt80mm";

const PrintThermalOrder = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return (
      <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
        <p>Pedido não encontrado.</p>
      </div>
    );
  }

  return <ThermalReceipt80mm orderId={orderId} />;
};

export default PrintThermalOrder;
