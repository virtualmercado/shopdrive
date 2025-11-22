import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { HelpCircle, Search, Clock, CheckCircle2 } from 'lucide-react';

export default function Support() {
  return (
    <AdminLayout>
      <div className="p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">Suporte</h1>
          <p className="text-muted-foreground mt-2">Gerencie tickets e atendimento aos clientes</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded">
                <HelpCircle className="text-blue-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Abertos</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded">
                <Clock className="text-orange-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Em Andamento</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded">
                <Clock className="text-yellow-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aguardando</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded">
                <CheckCircle2 className="text-green-600" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Resolvidos (30d)</p>
                <p className="text-2xl font-bold">0</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded">
                <Clock className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold">0h</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters and Actions */}
        <Card className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
              <Input
                placeholder="Buscar tickets..."
                className="pl-10"
              />
            </div>
            <Button>
              <HelpCircle size={16} className="mr-2" />
              Novo Ticket
            </Button>
          </div>

          {/* Empty State */}
          <div className="text-center py-12 text-muted-foreground">
            <HelpCircle size={48} className="mx-auto mb-4 opacity-20" />
            <p>Nenhum ticket encontrado</p>
            <p className="text-sm mt-2">Os tickets de suporte aparecerão aqui quando forem criados</p>
          </div>
        </Card>
      </div>
    </AdminLayout>
  );
}
