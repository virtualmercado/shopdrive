import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Integrations() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Integrações</h1>
          <p className="text-muted-foreground mt-1">
            Gerenciamento de integrações e APIs externas
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Integrações Disponíveis</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Funcionalidade em desenvolvimento. Em breve você poderá configurar integrações com gateways de pagamento, APIs de envio e outras ferramentas.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
