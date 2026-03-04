import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Trash2, Plus, Save, ArrowLeft, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

interface Review {
  id?: string;
  customer_name: string;
  customer_city: string;
  comment: string;
  stars: number;
  product_id: string | null;
  is_verified: boolean;
  display_order: number;
}

interface Product {
  id: string;
  name: string;
  images: any;
}

const Reviews = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { buttonBgColor, buttonTextColor } = useTheme();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sectionTitle, setSectionTitle] = useState("Avaliações dos nossos clientes");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    
    const [reviewsRes, productsRes, profileRes] = await Promise.all([
      supabase
        .from("store_reviews")
        .select("*")
        .eq("store_owner_id", user.id)
        .order("display_order"),
      supabase
        .from("products")
        .select("id, name, images")
        .eq("user_id", user.id)
        .eq("is_active", true),
      supabase
        .from("profiles")
        .select("reviews_section_title")
        .eq("id", user.id)
        .single(),
    ]);

    if (reviewsRes.data) {
      setReviews(reviewsRes.data.map(r => ({
        ...r,
        product_id: r.product_id || null,
      })));
    }
    if (productsRes.data) {
      setProducts(productsRes.data);
    }
    if (profileRes.data && (profileRes.data as any).reviews_section_title) {
      setSectionTitle((profileRes.data as any).reviews_section_title);
    }
    setLoading(false);
  };

  const addReview = () => {
    if (reviews.length >= 4) {
      toast.error("Máximo de 4 depoimentos permitidos.");
      return;
    }
    setReviews([...reviews, {
      customer_name: "",
      customer_city: "",
      comment: "",
      stars: 5,
      product_id: null,
      is_verified: false,
      display_order: reviews.length,
    }]);
  };

  const updateReview = (index: number, field: keyof Review, value: any) => {
    const updated = [...reviews];
    (updated[index] as any)[field] = value;
    setReviews(updated);
  };

  const removeReview = async (index: number) => {
    const review = reviews[index];
    if (review.id) {
      await supabase.from("store_reviews").delete().eq("id", review.id);
    }
    const updated = reviews.filter((_, i) => i !== index);
    updated.forEach((r, i) => r.display_order = i);
    setReviews(updated);
    toast.success("Depoimento removido.");
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    try {
      // Save section title to profile
      await supabase
        .from("profiles")
        .update({ reviews_section_title: sectionTitle } as any)
        .eq("id", user.id);

      // Delete existing reviews and re-insert
      await supabase
        .from("store_reviews")
        .delete()
        .eq("store_owner_id", user.id);

      if (reviews.length > 0) {
        const toInsert = reviews.map((r, i) => ({
          store_owner_id: user.id,
          customer_name: r.customer_name,
          customer_city: r.customer_city,
          comment: r.comment,
          stars: r.stars,
          product_id: r.product_id || null,
          is_verified: r.is_verified,
          display_order: i,
        }));

        const { error } = await supabase.from("store_reviews").insert(toInsert);
        if (error) throw error;
      }

      toast.success("Avaliações salvas com sucesso!");
      fetchData();
    } catch (error) {
      console.error("Error saving reviews:", error);
      toast.error("Erro ao salvar avaliações.");
    } finally {
      setSaving(false);
    }
  };

  const getProductImage = (productId: string | null) => {
    if (!productId) return null;
    const product = products.find(p => p.id === productId);
    if (!product || !product.images) return null;
    const images = Array.isArray(product.images) ? product.images : [];
    return images[0] || null;
  };

  const getProductName = (productId: string | null) => {
    if (!productId) return null;
    const product = products.find(p => p.id === productId);
    return product?.name || null;
  };

  const filledCount = reviews.filter(r => r.customer_name && r.comment).length;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/lojista/marketing")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Avaliações dos clientes</h1>
            <p className="text-sm text-muted-foreground">
              Gerencie os depoimentos exibidos na sua loja
            </p>
          </div>
        </div>

        {/* Info banner */}
        {filledCount < 4 && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-800">
              Para que as avaliações apareçam na loja, é necessário cadastrar os 4 depoimentos.
              Atualmente você tem <strong>{filledCount} de 4</strong> depoimentos completos.
            </p>
          </div>
        )}

        {/* Section title */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Título da seção na loja</CardTitle>
          </CardHeader>
          <CardContent>
            <Input
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder="Avaliações dos nossos clientes"
            />
          </CardContent>
        </Card>

        {/* Reviews */}
        <div className="space-y-4">
          {reviews.map((review, index) => (
            <Card key={index}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Depoimento {index + 1}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => removeReview(index)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Nome do cliente</Label>
                    <Input
                      value={review.customer_name}
                      onChange={(e) => updateReview(index, "customer_name", e.target.value)}
                      placeholder="Ex: Maria Silva"
                    />
                  </div>
                  <div>
                    <Label>Cidade</Label>
                    <Input
                      value={review.customer_city}
                      onChange={(e) => updateReview(index, "customer_city", e.target.value)}
                      placeholder="Ex: São Paulo, SP"
                    />
                  </div>
                </div>

                <div>
                  <Label>Comentário</Label>
                  <Textarea
                    value={review.comment}
                    onChange={(e) => updateReview(index, "comment", e.target.value)}
                    placeholder="O que o cliente disse sobre o produto ou a loja?"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Stars */}
                  <div>
                    <Label>Avaliação (estrelas)</Label>
                    <div className="flex gap-1 mt-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => updateReview(index, "stars", s)}
                          className="focus:outline-none"
                        >
                          <Star
                            className={`h-6 w-6 ${s <= review.stars ? "text-yellow-400 fill-yellow-400" : "text-gray-300"}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Product */}
                  <div>
                    <Label>Produto vinculado</Label>
                    <Select
                      value={review.product_id || "none"}
                      onValueChange={(v) => updateReview(index, "product_id", v === "none" ? null : v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecionar produto" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {products.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Product preview */}
                {review.product_id && getProductImage(review.product_id) && (
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <img
                      src={getProductImage(review.product_id)!}
                      alt={getProductName(review.product_id) || ""}
                      className="w-12 h-12 object-cover rounded"
                    />
                    <span className="text-sm font-medium">{getProductName(review.product_id)}</span>
                  </div>
                )}

                {/* Verified */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={review.is_verified}
                    onCheckedChange={(v) => updateReview(index, "is_verified", !!v)}
                  />
                  <Label className="cursor-pointer">Selo "Cliente verificado"</Label>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Add + Save buttons */}
        <div className="flex flex-wrap gap-3">
          {reviews.length < 4 && (
            <Button variant="outline" onClick={addReview}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar depoimento
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={saving}
            style={{ backgroundColor: buttonBgColor, color: buttonTextColor }}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Salvando..." : "Salvar avaliações"}
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Reviews;
