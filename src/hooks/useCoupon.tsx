import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CouponValidation {
  isValid: boolean;
  discount: number;
  discountType: string;
  errorMessage?: string;
  couponId?: string;
  singleUse?: boolean;
}

export const useCoupon = (storeOwnerId: string | null) => {
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidation | null>(null);
  const [loading, setLoading] = useState(false);

  const validateCoupon = async (code: string, orderSubtotal: number, customerEmail: string): Promise<CouponValidation> => {
    if (!storeOwnerId) {
      return { isValid: false, discount: 0, discountType: "fixed", errorMessage: "Loja não encontrada" };
    }

    if (!code.trim()) {
      return { isValid: false, discount: 0, discountType: "fixed", errorMessage: "Digite o código do cupom" };
    }

    setLoading(true);

    try {
      // Find the coupon
      const { data: coupon, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("user_id", storeOwnerId)
        .ilike("code", code.trim())
        .eq("is_active", true)
        .maybeSingle();

      if (error) {
        console.error("Error fetching coupon:", error);
        return { isValid: false, discount: 0, discountType: "fixed", errorMessage: "Erro ao validar cupom" };
      }

      if (!coupon) {
        return { isValid: false, discount: 0, discountType: "fixed", errorMessage: "Cupom inválido ou expirado" };
      }

      // Check minimum order value
      if (coupon.min_order_value && orderSubtotal < coupon.min_order_value) {
        return { 
          isValid: false, 
          discount: 0, 
          discountType: "fixed", 
          errorMessage: `Pedido mínimo de R$ ${coupon.min_order_value.toFixed(2)} para usar este cupom` 
        };
      }

      // Check single use
      if (coupon.single_use && customerEmail) {
        const { data: usage } = await supabase
          .from("coupon_usage")
          .select("id")
          .eq("coupon_id", coupon.id)
          .eq("customer_email", customerEmail.toLowerCase())
          .maybeSingle();

        if (usage) {
          return { isValid: false, discount: 0, discountType: "fixed", errorMessage: "Você já usou este cupom" };
        }
      }

      // Calculate discount
      let discountAmount = 0;
      if (coupon.discount_type === "percentage") {
        discountAmount = (orderSubtotal * coupon.discount_value) / 100;
      } else {
        discountAmount = Math.min(coupon.discount_value, orderSubtotal);
      }

      return {
        isValid: true,
        discount: discountAmount,
        discountType: coupon.discount_type,
        couponId: coupon.id,
        singleUse: coupon.single_use,
      };
    } catch (err) {
      console.error("Error validating coupon:", err);
      return { isValid: false, discount: 0, discountType: "fixed", errorMessage: "Erro ao validar cupom" };
    } finally {
      setLoading(false);
    }
  };

  const applyCoupon = async (code: string, orderSubtotal: number, customerEmail: string) => {
    const result = await validateCoupon(code, orderSubtotal, customerEmail);
    
    if (result.isValid) {
      setAppliedCoupon(result);
    } else {
      setAppliedCoupon(null);
    }
    
    return result;
  };

  const removeCoupon = () => {
    setCouponCode("");
    setAppliedCoupon(null);
  };

  const recordCouponUsage = async (couponId: string, customerEmail: string, orderId: string) => {
    try {
      await supabase.from("coupon_usage").insert({
        coupon_id: couponId,
        customer_email: customerEmail.toLowerCase(),
        order_id: orderId,
      });
    } catch (err) {
      console.error("Error recording coupon usage:", err);
    }
  };

  const calculateDiscount = (subtotal: number) => {
    if (!appliedCoupon || !appliedCoupon.isValid) return 0;
    
    if (appliedCoupon.discountType === "percentage") {
      return (subtotal * appliedCoupon.discount) / 100;
    }
    return Math.min(appliedCoupon.discount, subtotal);
  };

  return {
    couponCode,
    setCouponCode,
    appliedCoupon,
    loading,
    applyCoupon,
    removeCoupon,
    recordCouponUsage,
    calculateDiscount,
  };
};
