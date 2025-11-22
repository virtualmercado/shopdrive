import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Edit, Check, X } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  interval: string;
  product_limit: number;
  order_limit: number;
  features: any;
  is_active: boolean;
}

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    interval: 'monthly',
    product_limit: 0,
    order_limit: 0,
    features: '',
    is_active: true,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching plans:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (planId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: isActive })
        .eq('id', planId);

      if (error) throw error;

      toast({
        title: isActive ? 'Plano ativado' : 'Plano desativado',
        description: `Plano ${isActive ? 'ativado' : 'desativado'} com sucesso.`,
      });

      fetchPlans();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error toggling plan:', error);
      }
    }
  };

  const handleSave = async () => {
    try {
      const planData = {
        name: formData.name,
        description: formData.description,
        price: formData.price,
        interval: formData.interval,
        product_limit: formData.product_limit === -1 ? -1 : formData.product_limit,
        order_limit: formData.order_limit === -1 ? -1 : formData.order_limit,
        features: formData.features.split('\n').filter(f => f.trim()),
        is_active: formData.is_active,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;

        toast({
          title: 'Plano atualizado',
          description: 'Plano atualizado com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert(planData);

        if (error) throw error;

        toast({
          title: 'Plano criado',
          description: 'Novo plano criado com sucesso.',
        });
      }

      setModalOpen(false);
      setEditingPlan(null);
      setFormData({
        name: '',
        description: '',
        price: 0,
        interval: 'monthly',
        product_limit: 0,
        order_limit: 0,
        features: '',
        is_active: true,
      });
      fetchPlans();
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error saving plan:', error);
      }
    }
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description || '',
      price: plan.price,
      interval: plan.interval,
      product_limit: plan.product_limit,
      order_limit: plan.order_limit,
      features: Array.isArray(plan.features) ? plan.features.join('\n') : '',
      is_active: plan.is_active,
    });
    setModalOpen(true);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Gerenciar Planos</h1>
            <p className="text-muted-foreground">Configure os planos de assinatura da plataforma</p>
          </div>
          <Button onClick={() => setModalOpen(true)}>Novo Plano</Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <p>Carregando...</p>
          ) : (
            plans.map((plan) => (
              <Card key={plan.id} className="p-6 relative">
                <div className="absolute top-4 right-4 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openEditModal(plan)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Switch
                    checked={plan.is_active}
                    onCheckedChange={(checked) => handleToggleActive(plan.id, checked)}
                  />
                </div>

                <div className="space-y-4 mt-8">
                  <div>
                    <h3 className="text-2xl font-bold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">{plan.description}</p>
                  </div>

                  <div>
                    <p className="text-3xl font-bold">
                      R$ {plan.price.toFixed(2)}
                      <span className="text-sm text-muted-foreground font-normal">
                        /{plan.interval === 'monthly' ? 'mês' : 'ano'}
                      </span>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm">
                        {plan.product_limit === -1 ? 'Produtos Ilimitados' : `${plan.product_limit} produtos`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-green-600" />
                      <span className="text-sm">
                        {plan.order_limit === -1 ? 'Pedidos Ilimitados' : `${plan.order_limit} pedidos/mês`}
                      </span>
                    </div>
                    {Array.isArray(plan.features) &&
                      plan.features.map((feature: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-600" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                  </div>

                  <Badge variant={plan.is_active ? 'default' : 'outline'}>
                    {plan.is_active ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Plano</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Preço</Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="interval">Intervalo</Label>
                <Select value={formData.interval} onValueChange={(value) => setFormData({ ...formData, interval: value })}>
                  <SelectTrigger id="interval">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="annual">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="product_limit">Limite de Produtos</Label>
                <Input
                  id="product_limit"
                  type="number"
                  value={formData.product_limit}
                  onChange={(e) => setFormData({ ...formData, product_limit: parseInt(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="order_limit">Limite de Pedidos</Label>
                <Input
                  id="order_limit"
                  type="number"
                  value={formData.order_limit}
                  onChange={(e) => setFormData({ ...formData, order_limit: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="features">Features (uma por linha)</Label>
              <Textarea
                id="features"
                value={formData.features}
                onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                rows={5}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="is_active">Plano Ativo</Label>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setModalOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>Salvar Plano</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
