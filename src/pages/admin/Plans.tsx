import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Plus, Edit, Trash2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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

const Plans = () => {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

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
      const formattedData = (data || []).map(plan => ({
        ...plan,
        features: Array.isArray(plan.features) ? plan.features : []
      }));
      setPlans(formattedData);
    } catch (error) {
      console.error('Error fetching plans:', error);
      toast({
        title: 'Erro ao carregar planos',
        description: 'Não foi possível carregar os planos.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSavePlan = async (planData: any) => {
    try {
      if (editingPlan) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(planData)
          .eq('id', editingPlan.id);

        if (error) throw error;

        toast({
          title: 'Plano atualizado',
          description: 'O plano foi atualizado com sucesso.',
        });
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert([planData]);

        if (error) throw error;

        toast({
          title: 'Plano criado',
          description: 'O novo plano foi criado com sucesso.',
        });
      }

      setIsDialogOpen(false);
      setEditingPlan(null);
      fetchPlans();
    } catch (error) {
      console.error('Error saving plan:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o plano.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (planId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: !isActive })
        .eq('id', planId);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `Plano ${!isActive ? 'ativado' : 'desativado'} com sucesso.`,
      });

      fetchPlans();
    } catch (error) {
      console.error('Error toggling plan status:', error);
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o status do plano.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Gerenciar Planos</h1>
            <p className="text-muted-foreground">Configure os planos de assinatura da plataforma</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingPlan(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
                <DialogDescription>
                  Configure os detalhes do plano de assinatura
                </DialogDescription>
              </DialogHeader>
              <PlanForm plan={editingPlan} onSave={handleSavePlan} />
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <Card key={plan.id} className="p-6 relative">
              <div className="absolute top-4 right-4 flex gap-2">
                <Switch
                  checked={plan.is_active}
                  onCheckedChange={() => handleToggleActive(plan.id, plan.is_active)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditingPlan(plan);
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>

              <div className="mb-4">
                <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                <p className="text-muted-foreground text-sm">{plan.description}</p>
              </div>

              <div className="mb-6">
                <div className="flex items-baseline">
                  <span className="text-4xl font-bold">R$ {plan.price.toFixed(2)}</span>
                  <span className="text-muted-foreground ml-2">
                    /{plan.interval === 'monthly' ? 'mês' : 'ano'}
                  </span>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  <span>
                    {plan.product_limit === -1 ? 'Produtos ilimitados' : `Até ${plan.product_limit} produtos`}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary" />
                  <span>
                    {plan.order_limit === -1 ? 'Pedidos ilimitados' : `Até ${plan.order_limit} pedidos/mês`}
                  </span>
                </div>
                {plan.features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                {plan.is_active ? 'Ativo' : 'Inativo'}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

const PlanForm = ({ plan, onSave }: { plan: Plan | null; onSave: (data: any) => void }) => {
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    price: plan?.price || 0,
    interval: plan?.interval || 'monthly',
    product_limit: plan?.product_limit || 0,
    order_limit: plan?.order_limit || 0,
    features: plan?.features?.join('\n') || '',
    is_active: plan?.is_active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      features: formData.features.split('\n').filter(f => f.trim()),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">Nome do Plano</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>

      <div>
        <Label htmlFor="description">Descrição</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="price">Preço (R$)</Label>
          <Input
            id="price"
            type="number"
            step="0.01"
            value={formData.price}
            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
            required
          />
        </div>

        <div>
          <Label htmlFor="interval">Intervalo</Label>
          <select
            id="interval"
            value={formData.interval}
            onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
            className="w-full h-10 px-3 border rounded-md"
          >
            <option value="monthly">Mensal</option>
            <option value="yearly">Anual</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="product_limit">Limite de Produtos (-1 = ilimitado)</Label>
          <Input
            id="product_limit"
            type="number"
            value={formData.product_limit}
            onChange={(e) => setFormData({ ...formData, product_limit: parseInt(e.target.value) })}
            required
          />
        </div>

        <div>
          <Label htmlFor="order_limit">Limite de Pedidos/Mês (-1 = ilimitado)</Label>
          <Input
            id="order_limit"
            type="number"
            value={formData.order_limit}
            onChange={(e) => setFormData({ ...formData, order_limit: parseInt(e.target.value) })}
            required
          />
        </div>
      </div>

      <div>
        <Label htmlFor="features">Funcionalidades (uma por linha)</Label>
        <Textarea
          id="features"
          value={formData.features}
          onChange={(e) => setFormData({ ...formData, features: e.target.value })}
          rows={5}
          placeholder="Suporte por email&#10;Personalização básica&#10;..."
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch
          id="is_active"
          checked={formData.is_active}
          onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
        />
        <Label htmlFor="is_active">Plano ativo</Label>
      </div>

      <DialogFooter>
        <Button type="submit">Salvar Plano</Button>
      </DialogFooter>
    </form>
  );
};

export default Plans;
