import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Support() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Suporte</h1>
          <p className="text-muted-foreground mt-1">
            Gerenciamento de tickets e atendimento ao cliente
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Central de Suporte</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Funcionalidade em desenvolvimento. Em breve você poderá gerenciar todos os tickets de suporte e atendimento aos clientes.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
