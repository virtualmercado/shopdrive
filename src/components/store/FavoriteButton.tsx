import { useEffect, useState, MouseEvent } from "react";
import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCustomerAuth } from "@/hooks/useCustomerAuth";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  productId: string;
  storeOwnerId?: string;
  storeSlug?: string;
  className?: string;
  size?: number;
}

/**
 * Botão de favorito reutilizável.
 * Usa a mesma tabela `customer_favorites` do ProductDetail.
 */
const FavoriteButton = ({
  productId,
  storeOwnerId,
  storeSlug,
  className,
  size = 18,
}: FavoriteButtonProps) => {
  const { user } = useCustomerAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user || !productId) {
        setIsFavorite(false);
        return;
      }
      const { data } = await supabase
        .from("customer_favorites")
        .select("id")
        .eq("customer_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();
      if (!cancelled) setIsFavorite(!!data);
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [user, productId]);

  const handleClick = async (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!user) {
      toast({
        title: "Faça login",
        description: "Você precisa estar logado para salvar favoritos.",
        variant: "destructive",
      });
      if (storeSlug) navigate(`/${storeSlug}/conta`);
      return;
    }

    if (loading) return;
    setLoading(true);

    if (isFavorite) {
      const { error } = await supabase
        .from("customer_favorites")
        .delete()
        .eq("customer_id", user.id)
        .eq("product_id", productId);
      if (!error) {
        setIsFavorite(false);
        toast({ title: "Removido dos favoritos" });
      }
    } else {
      if (!storeOwnerId) {
        setLoading(false);
        return;
      }
      const { error } = await supabase
        .from("customer_favorites")
        .insert({
          customer_id: user.id,
          product_id: productId,
          store_owner_id: storeOwnerId,
        });
      if (!error) {
        setIsFavorite(true);
        toast({ title: "Adicionado aos favoritos" });
      }
    }

    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
      aria-pressed={isFavorite}
      disabled={loading}
      className={cn(
        "absolute top-3 right-3 z-10 flex items-center justify-center",
        "h-9 w-9 rounded-full bg-white/85 backdrop-blur-sm shadow-sm",
        "hover:bg-white hover:scale-110 active:scale-95 transition-all",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        className,
      )}
    >
      <Heart
        size={size}
        className={cn(
          "transition-all",
          isFavorite ? "fill-red-500 text-red-500" : "text-gray-500",
        )}
      />
    </button>
  );
};

export default FavoriteButton;
