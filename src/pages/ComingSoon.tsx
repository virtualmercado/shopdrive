import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Construction, ArrowLeft, Home } from "lucide-react";
import LandingLayout from "@/components/layout/LandingLayout";

const ComingSoon = () => {
  return (
    <LandingLayout>
      <div className="flex-1 flex items-center justify-center px-4 py-16 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="text-center max-w-md">
          <div className="mb-8 flex justify-center">
            <div className="p-6 bg-primary/10 rounded-full">
              <Construction className="h-16 w-16 text-primary" />
            </div>
          </div>
          
          <h1 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            Página em Construção
          </h1>
          
          <p className="text-lg text-muted-foreground mb-8">
            Estamos trabalhando nesta página para oferecer a melhor experiência. 
            Volte em breve!
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild variant="outline" className="gap-2">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Link>
            </Button>
            <Button asChild className="gap-2">
              <Link to="/">
                <Home className="h-4 w-4" />
                Página Inicial
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </LandingLayout>
  );
};

export default ComingSoon;
