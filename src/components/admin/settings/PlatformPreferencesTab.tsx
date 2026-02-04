import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Settings2, Construction } from "lucide-react";

const PlatformPreferencesTab = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-[#6a1b9a]" />
          <div>
            <CardTitle>Preferências da Plataforma</CardTitle>
            <CardDescription>
              Configurações avançadas da plataforma (em desenvolvimento)
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <Construction className="h-16 w-16 mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">Em Desenvolvimento</h3>
          <p className="max-w-md">
            Esta seção está em desenvolvimento e será disponibilizada em breve
            com configurações avançadas de personalização da plataforma.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PlatformPreferencesTab;
