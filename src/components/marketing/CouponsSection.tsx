import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useTheme } from "@/contexts/ThemeContext";
import CouponForm from "@/components/coupons/CouponForm";

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  min_order_value: number | null;
  single_use: boolean;
  is_active: boolean;
  created_at: string;
}

const CouponsSection = () => {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor } = useTheme();

  const fetchCoupons = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar cupons");
      console.error(error);
    } else {
      setCoupons(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCoupons();
  }, [user]);

  const handleToggleStatus = async (couponId: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("coupons")
      .update({ is_active: !currentStatus })
      .eq("id", couponId);

    if (error) {
      toast.error("Erro ao atualizar status do cupom");
    } else {
      toast.success(`Cupom ${!currentStatus ? "ativado" : "desativado"}`);
      fetchCoupons();
    }
  };

  const handleDeleteCoupon = async (couponId: string) => {
    if (!confirm("Tem certeza que deseja excluir este cupom?")) return;

    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", couponId);

    if (error) {
      toast.error("Erro ao excluir cupom");
    } else {
      toast.success("Cupom excluído com sucesso");
      fetchCoupons();
    }
  };

  const handleCouponSaved = () => {
    setDialogOpen(false);
    setEditingCoupon(null);
    fetchCoupons();
  };

  const handleEditCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingCoupon(null);
    }
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}%`;
    }
    return `R$ ${coupon.discount_value.toFixed(2)}`;
  };

  const formatMinOrder = (value: number | null) => {
    if (value === null || value === 0) return "Sem mínimo";
    return `R$ ${value.toFixed(2)}`;
  };

  // Generate lighter version of button color for inactive state
  const getInactiveColor = (color: string) => {
    return `${color}40`; // 40 is hex for 25% opacity
  };

  return (
    <Card>
      {/* CSS for dialog close button - merchant color binding */}
      <style>{`
        [data-radix-dialog-content] > button[type="button"] {
          transition: all 0.2s ease;
        }
        [data-radix-dialog-content] > button[type="button"]:focus,
        [data-radix-dialog-content] > button[type="button"]:focus-visible {
          outline: 2px solid ${buttonBgColor} !important;
          outline-offset: 2px !important;
          box-shadow: none !important;
          ring: none !important;
        }
        [data-radix-dialog-content] > button[type="button"]:hover {
          color: ${buttonBgColor} !important;
          opacity: 1 !important;
        }
      `}</style>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Tag className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Cupons de Desconto</CardTitle>
              <CardDescription className="text-[#515151]">
                Crie e gerencie cupons de desconto para sua loja
              </CardDescription>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button
                style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Adicionar Cupom
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>
                  {editingCoupon ? "Editar Cupom" : "Novo Cupom de Desconto"}
                </DialogTitle>
              </DialogHeader>
              <CouponForm 
                onSuccess={handleCouponSaved} 
                editingCoupon={editingCoupon}
              />
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">
            Carregando cupons...
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            Nenhum cupom cadastrado. Clique em "Adicionar Cupom" para criar o primeiro.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Pedido Mínimo</TableHead>
                  <TableHead>Uso Único</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {coupons.map((coupon) => (
                  <TableRow key={coupon.id}>
                    <TableCell className="font-mono font-semibold">
                      {coupon.code}
                    </TableCell>
                    <TableCell>{formatDiscount(coupon)}</TableCell>
                    <TableCell>{formatMinOrder(coupon.min_order_value)}</TableCell>
                    <TableCell>{coupon.single_use ? "Sim" : "Não"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={coupon.is_active}
                          onCheckedChange={() => handleToggleStatus(coupon.id, coupon.is_active)}
                          style={{
                            backgroundColor: coupon.is_active ? buttonBgColor : getInactiveColor(buttonBgColor),
                          }}
                        />
                        <span 
                          className="text-sm font-medium"
                          style={{ color: coupon.is_active ? buttonBgColor : undefined }}
                        >
                          {coupon.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditCoupon(coupon)}
                          className="hover:bg-muted"
                        >
                          <Pencil className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteCoupon(coupon.id)}
                          className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CouponsSection;
