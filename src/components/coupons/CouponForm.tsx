import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_value: number | null;
  single_use: boolean;
  is_active: boolean;
}

interface CouponFormProps {
  onSuccess: () => void;
  editingCoupon?: Coupon | null;
}

const CouponForm = ({ onSuccess, editingCoupon }: CouponFormProps) => {
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor } = useTheme();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    code: "",
    discount_type: "percentage" as "percentage" | "fixed",
    discount_value: "",
    min_order_value: "",
    single_use: false,
    is_active: true,
  });

  // Load editing coupon data when provided
  useEffect(() => {
    if (editingCoupon) {
      setFormData({
        code: editingCoupon.code,
        discount_type: editingCoupon.discount_type as "percentage" | "fixed",
        discount_value: editingCoupon.discount_value.toString(),
        min_order_value: editingCoupon.min_order_value?.toString() || "",
        single_use: editingCoupon.single_use,
        is_active: editingCoupon.is_active,
      });
    } else {
      // Reset form when not editing
      setFormData({
        code: "",
        discount_type: "percentage",
        discount_value: "",
        min_order_value: "",
        single_use: false,
        is_active: true,
      });
    }
  }, [editingCoupon]);

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow letters and numbers, convert to uppercase
    const value = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    setFormData({ ...formData, code: value });
  };

  const handleDiscountValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    if (formData.discount_type === "percentage") {
      // Only allow numbers 1-99
      const numValue = parseInt(value) || 0;
      if (numValue >= 0 && numValue <= 99) {
        setFormData({ ...formData, discount_value: value });
      }
    } else {
      // Allow decimal for fixed value
      if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
        setFormData({ ...formData, discount_value: value });
      }
    }
  };

  const handleMinOrderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (/^\d*\.?\d{0,2}$/.test(value) || value === "") {
      setFormData({ ...formData, min_order_value: value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast.error("Você precisa estar logado");
      return;
    }

    if (!formData.code.trim()) {
      toast.error("Digite o código do cupom");
      return;
    }

    if (formData.code.length < 3) {
      toast.error("O código deve ter pelo menos 3 caracteres");
      return;
    }

    const discountValue = parseFloat(formData.discount_value);
    if (isNaN(discountValue) || discountValue <= 0) {
      toast.error("Digite um valor de desconto válido");
      return;
    }

    if (formData.discount_type === "percentage" && discountValue > 99) {
      toast.error("Desconto percentual máximo é 99%");
      return;
    }

    setLoading(true);

    try {
      const couponData = {
        code: formData.code.trim().toUpperCase(),
        discount_type: formData.discount_type,
        discount_value: discountValue,
        min_order_value: formData.min_order_value ? parseFloat(formData.min_order_value) : null,
        single_use: formData.single_use,
        is_active: formData.is_active,
      };

      if (editingCoupon) {
        // Update existing coupon
        const { error } = await supabase
          .from("coupons")
          .update(couponData)
          .eq("id", editingCoupon.id);

        if (error) {
          if (error.code === "23505") {
            toast.error("Código de cupom já existe");
          } else {
            toast.error("Erro ao atualizar cupom");
            console.error(error);
          }
        } else {
          toast.success("Cupom atualizado com sucesso!");
          onSuccess();
        }
      } else {
        // Create new coupon
        const { error } = await supabase.from("coupons").insert({
          ...couponData,
          user_id: user.id,
        });

        if (error) {
          if (error.code === "23505") {
            toast.error("Código de cupom já existe");
          } else {
            toast.error("Erro ao criar cupom");
            console.error(error);
          }
        } else {
          toast.success("Cupom criado com sucesso!");
          onSuccess();
        }
      }
    } catch (err) {
      toast.error(editingCoupon ? "Erro ao atualizar cupom" : "Erro ao criar cupom");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Código do Cupom */}
      <div className="space-y-2">
        <Label htmlFor="code">Código do Cupom *</Label>
        <Input
          id="code"
          value={formData.code}
          onChange={handleCodeChange}
          placeholder="EX: PROMO10"
          maxLength={20}
          className="font-mono uppercase"
          disabled={!!editingCoupon} // Disable code editing for existing coupons
        />
        <p className="text-xs text-muted-foreground">
          {editingCoupon 
            ? "O código não pode ser alterado" 
            : "Apenas letras e números, sem espaços"}
        </p>
      </div>

      {/* Tipo de Desconto */}
      <div className="space-y-3">
        <Label>Tipo de Desconto *</Label>
        <RadioGroup
          value={formData.discount_type}
          onValueChange={(value) => 
            setFormData({ 
              ...formData, 
              discount_type: value as "percentage" | "fixed",
              discount_value: "" 
            })
          }
          className="flex gap-6"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="percentage" id="percentage" />
            <Label htmlFor="percentage" className="cursor-pointer">
              Percentual (%)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="fixed" id="fixed" />
            <Label htmlFor="fixed" className="cursor-pointer">
              Valor Fixo (R$)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Valor do Desconto */}
      <div className="space-y-2">
        <Label htmlFor="discount_value">
          Valor do Desconto *
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {formData.discount_type === "percentage" ? "%" : "R$"}
          </span>
          <Input
            id="discount_value"
            value={formData.discount_value}
            onChange={handleDiscountValueChange}
            placeholder={formData.discount_type === "percentage" ? "10" : "15.00"}
            className="pl-10"
          />
        </div>
        {formData.discount_type === "percentage" && (
          <p className="text-xs text-muted-foreground">
            Valor entre 1 e 99
          </p>
        )}
      </div>

      {/* Valor Mínimo do Pedido */}
      <div className="space-y-2">
        <Label htmlFor="min_order_value">
          Valor Mínimo do Pedido (opcional)
        </Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            R$
          </span>
          <Input
            id="min_order_value"
            value={formData.min_order_value}
            onChange={handleMinOrderChange}
            placeholder="50.00"
            className="pl-10"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Deixe vazio para aplicar a qualquer pedido
        </p>
      </div>

      {/* Uso Único */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div className="space-y-0.5">
          <Label htmlFor="single_use" className="cursor-pointer">
            Uso único por cliente
          </Label>
          <p className="text-xs text-muted-foreground">
            Cada cliente só poderá usar este cupom uma vez
          </p>
        </div>
        <Switch
          id="single_use"
          checked={formData.single_use}
          onCheckedChange={(checked) =>
            setFormData({ ...formData, single_use: checked })
          }
        />
      </div>

      {/* Status (only show when editing) */}
      {editingCoupon && (
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label htmlFor="is_active" className="cursor-pointer">
              Cupom ativo
            </Label>
            <p className="text-xs text-muted-foreground">
              Desative para impedir o uso deste cupom
            </p>
          </div>
          <Switch
            id="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) =>
              setFormData({ ...formData, is_active: checked })
            }
          />
        </div>
      )}

      {/* Botão Salvar */}
      <Button
        type="submit"
        className="w-full"
        disabled={loading}
        style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
      >
        {loading 
          ? (editingCoupon ? "Atualizando..." : "Salvando...") 
          : (editingCoupon ? "Atualizar Cupom" : "Salvar Cupom")}
      </Button>
    </form>
  );
};

export default CouponForm;
