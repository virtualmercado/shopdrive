import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Truck, BarChart3, Share2, CheckCircle2, XCircle } from 'lucide-react';

export default function Integrations() {
  const integrations = [
    {
      category: 'Gateways de Pagamento',
      icon: CreditCard,
      items: [
        { name: 'Mercado Pago', status: 'disconnected', color: 'bg-blue-500' },
        { name: 'PagBank', status: 'disconnected', color: 'bg-green-500' },
      ],
    },
    {
      category: 'Logística',
      icon: Truck,
      items: [
        { name: 'Correios', status: 'disconnected', color: 'bg-yellow-500' },
        { name: 'Melhor Envio', status: 'disconnected', color: 'bg-purple-500' },
      ],
    },
    {
      category: 'Analytics',
      icon: BarChart3,
      items: [
        { name: 'Google Analytics', status: 'disconnected', color: 'bg-orange-500' },
        { name: 'Google Tag Manager', status: 'disconnected', color: 'bg-indigo-500' },
      ],
    },
    {
      category: 'Marketing',
      icon: Share2,
      items: [
        { name: 'Meta Pixel', status: 'disconnected', color: 'bg-blue-600' },
        { name: 'TikTok Ads', status: 'disconnected', color: 'bg-black' },
      ],
    },
  ];

  return (
    <AdminLayout>
      <div className="p-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Integrações</h1>
          <p className="text-muted-foreground mt-2">Gerencie conexões com serviços externos</p>
        </div>

        {/* Integrations by Category */}
        {integrations.map((category, idx) => {
          const CategoryIcon = category.icon;
          return (
            <div key={idx} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <CategoryIcon className="text-primary" size={20} />
                </div>
                <h2 className="text-xl font-semibold">{category.category}</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.items.map((item, itemIdx) => (
                  <Card key={itemIdx} className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 ${item.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                          {item.name.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold">{item.name}</h3>
                          <Badge
                            variant={item.status === 'connected' ? 'default' : 'secondary'}
                            className="mt-1"
                          >
                            {item.status === 'connected' ? (
                              <>
                                <CheckCircle2 size={12} className="mr-1" />
                                Conectado
                              </>
                            ) : (
                              <>
                                <XCircle size={12} className="mr-1" />
                                Desconectado
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <p className="text-sm text-muted-foreground">
                        Última sincronização: Nunca
                      </p>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" className="flex-1">
                        Configurar
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1">
                        Logs
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </AdminLayout>
  );
}
