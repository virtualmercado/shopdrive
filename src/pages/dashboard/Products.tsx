import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Plus, Search, Edit, Trash2, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Products = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  // Mock products data
  const products = [
    { id: 1, name: "Produto Exemplo 1", price: 99.90, stock: 50, image: "https://placehold.co/100x100" },
    { id: 2, name: "Produto Exemplo 2", price: 149.90, stock: 30, image: "https://placehold.co/100x100" },
    { id: 3, name: "Produto Exemplo 3", price: 199.90, stock: 20, image: "https://placehold.co/100x100" },
  ];

  const handleDelete = (id: number) => {
    toast({
      title: "Produto excluído",
      description: "O produto foi removido com sucesso",
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar produtos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button className="bg-secondary hover:bg-secondary/90 gap-2">
            <Plus className="h-4 w-4" />
            Novo Produto
          </Button>
        </div>

        {/* Products Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <div className="aspect-square bg-muted">
                <img 
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-1">{product.name}</h3>
                <p className="text-2xl font-bold text-primary mb-2">
                  R$ {product.price.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Estoque: {product.stock} unidades
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 gap-2">
                    <Edit className="h-4 w-4" />
                    Editar
                  </Button>
                  <Button 
                    variant="outline" 
                    className="gap-2 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    onClick={() => handleDelete(product.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Empty State */}
        {products.length === 0 && (
          <Card className="p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum produto cadastrado</h3>
            <p className="text-muted-foreground mb-4">
              Comece adicionando seus primeiros produtos
            </p>
            <Button className="bg-secondary hover:bg-secondary/90">
              Adicionar Produto
            </Button>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Products;