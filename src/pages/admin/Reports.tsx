import { AdminLayout } from '@/components/layout/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function Reports() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground mt-1">
            Análises e relatórios detalhados da plataforma
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Relatórios Gerenciais</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Funcionalidade em desenvolvimento. Em breve você terá acesso a relatórios completos de vendas, usuários e performance.
            </p>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
