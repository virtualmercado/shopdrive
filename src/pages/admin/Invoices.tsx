import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Invoices() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Faturas e Pagamentos</h1>
          <p className="text-muted-foreground mt-1">
            Gerenciamento de faturas e controle de pagamentos
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Faturas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Funcionalidade em desenvolvimento. Em breve você poderá gerenciar todas as faturas e pagamentos da plataforma.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
