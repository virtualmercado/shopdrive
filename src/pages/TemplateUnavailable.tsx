import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link2Off, Store, ArrowLeft } from 'lucide-react';

const TemplateUnavailable = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center py-12 px-6 text-center">
          <div className="p-4 rounded-full bg-muted mb-6">
            <Link2Off className="h-12 w-12 text-muted-foreground" />
          </div>
          
          <h1 className="text-2xl font-bold mb-3">Link indisponível</h1>
          
          <p className="text-muted-foreground mb-8">
            Este link de ativação não está mais disponível ou foi desativado.
            <br />
            <span className="text-sm">
              Entre em contato com a marca parceira para obter um novo link.
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <Button asChild variant="outline" className="flex-1">
              <Link to="/">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para a VirtualMercado
              </Link>
            </Button>
            
            <Button asChild className="flex-1 bg-primary hover:bg-primary/90">
              <Link to="/register">
                <Store className="h-4 w-4 mr-2" />
                Criar loja sem template
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TemplateUnavailable;
