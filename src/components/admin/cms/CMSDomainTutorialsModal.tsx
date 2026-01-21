import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Globe, Plus, Trash2, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

interface CMSDomainTutorialsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TutorialStep {
  title: string;
  content: string;
}

interface Tutorial {
  id: string;
  provider_name: string;
  provider_slug: string;
  display_order: number;
  is_active: boolean;
  tutorial_content: {
    steps: TutorialStep[];
  };
}

export const CMSDomainTutorialsModal = ({ isOpen, onClose }: CMSDomainTutorialsModalProps) => {
  const queryClient = useQueryClient();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

  const { data: fetchedTutorials, isLoading } = useQuery({
    queryKey: ['admin-domain-tutorials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('domain_provider_tutorials')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data.map(item => ({
        ...item,
        tutorial_content: (item.tutorial_content as unknown as Tutorial['tutorial_content']) || { steps: [] },
      })) as Tutorial[];
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (fetchedTutorials) {
      setTutorials(fetchedTutorials);
    }
  }, [fetchedTutorials]);

  const updateMutation = useMutation({
    mutationFn: async (tutorial: Tutorial) => {
      const { error } = await supabase
        .from('domain_provider_tutorials')
        .update({
          provider_name: tutorial.provider_name,
          provider_slug: tutorial.provider_slug,
          display_order: tutorial.display_order,
          is_active: tutorial.is_active,
          tutorial_content: JSON.parse(JSON.stringify(tutorial.tutorial_content)),
        })
        .eq('id', tutorial.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domain-tutorials'] });
      queryClient.invalidateQueries({ queryKey: ['domain-tutorials'] });
      toast.success('Tutorial atualizado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao atualizar tutorial');
    },
  });

  const createMutation = useMutation({
    mutationFn: async (tutorial: Omit<Tutorial, 'id'>) => {
      const { error } = await supabase
        .from('domain_provider_tutorials')
        .insert([{
          provider_name: tutorial.provider_name,
          provider_slug: tutorial.provider_slug,
          display_order: tutorial.display_order,
          is_active: tutorial.is_active,
          tutorial_content: JSON.parse(JSON.stringify(tutorial.tutorial_content)),
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domain-tutorials'] });
      queryClient.invalidateQueries({ queryKey: ['domain-tutorials'] });
      toast.success('Tutorial criado com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao criar tutorial');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('domain_provider_tutorials')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-domain-tutorials'] });
      queryClient.invalidateQueries({ queryKey: ['domain-tutorials'] });
      toast.success('Tutorial excluído com sucesso!');
      setSelectedTutorial(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erro ao excluir tutorial');
    },
  });

  const handleSave = () => {
    if (selectedTutorial) {
      updateMutation.mutate(selectedTutorial);
    }
  };

  const handleAddStep = () => {
    if (!selectedTutorial) return;
    setSelectedTutorial({
      ...selectedTutorial,
      tutorial_content: {
        steps: [
          ...selectedTutorial.tutorial_content.steps,
          { title: 'Novo passo', content: 'Descrição do passo' },
        ],
      },
    });
  };

  const handleRemoveStep = (index: number) => {
    if (!selectedTutorial) return;
    setSelectedTutorial({
      ...selectedTutorial,
      tutorial_content: {
        steps: selectedTutorial.tutorial_content.steps.filter((_, i) => i !== index),
      },
    });
  };

  const handleUpdateStep = (index: number, field: 'title' | 'content', value: string) => {
    if (!selectedTutorial) return;
    const newSteps = [...selectedTutorial.tutorial_content.steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSelectedTutorial({
      ...selectedTutorial,
      tutorial_content: { steps: newSteps },
    });
  };

  const handleAddTutorial = () => {
    const newTutorial: Omit<Tutorial, 'id'> = {
      provider_name: 'Novo Provedor',
      provider_slug: 'novo-provedor-' + Date.now(),
      display_order: tutorials.length + 1,
      is_active: true,
      tutorial_content: {
        steps: [
          { title: 'Passo 1', content: 'Descrição do primeiro passo' },
        ],
      },
    };
    createMutation.mutate(newTutorial);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <DialogTitle>Tutoriais de Domínio Próprio</DialogTitle>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4 h-[500px]">
            {/* Tutorial List */}
            <div className="border rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-sm">Provedores</h4>
                <Button variant="ghost" size="sm" onClick={handleAddTutorial}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <ScrollArea className="h-[400px]">
                <div className="space-y-1">
                  {tutorials.map((tutorial) => (
                    <button
                      key={tutorial.id}
                      onClick={() => setSelectedTutorial(tutorial)}
                      className={`w-full text-left p-2 rounded-lg text-sm flex items-center justify-between ${
                        selectedTutorial?.id === tutorial.id
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        {tutorial.provider_name}
                      </span>
                      <Badge variant={tutorial.is_active ? 'default' : 'secondary'} className="text-xs">
                        {tutorial.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </div>

            {/* Tutorial Editor */}
            <div className="col-span-2 border rounded-lg p-4">
              {selectedTutorial ? (
                <ScrollArea className="h-[440px] pr-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome do Provedor</Label>
                        <Input
                          value={selectedTutorial.provider_name}
                          onChange={(e) =>
                            setSelectedTutorial({
                              ...selectedTutorial,
                              provider_name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <Input
                          value={selectedTutorial.provider_slug}
                          onChange={(e) =>
                            setSelectedTutorial({
                              ...selectedTutorial,
                              provider_slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                            })
                          }
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <Label>Tutorial Ativo</Label>
                      <Switch
                        checked={selectedTutorial.is_active}
                        onCheckedChange={(checked) =>
                          setSelectedTutorial({
                            ...selectedTutorial,
                            is_active: checked,
                          })
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Passos do Tutorial</Label>
                        <Button variant="outline" size="sm" onClick={handleAddStep}>
                          <Plus className="h-4 w-4 mr-1" />
                          Adicionar Passo
                        </Button>
                      </div>

                      <Accordion type="single" collapsible className="w-full">
                        {selectedTutorial.tutorial_content.steps.map((step, index) => (
                          <AccordionItem key={index} value={`step-${index}`}>
                            <AccordionTrigger className="text-sm">
                              Passo {index + 1}: {step.title}
                            </AccordionTrigger>
                            <AccordionContent className="space-y-3">
                              <div className="space-y-2">
                                <Label>Título</Label>
                                <Input
                                  value={step.title}
                                  onChange={(e) => handleUpdateStep(index, 'title', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Conteúdo</Label>
                                <Textarea
                                  value={step.content}
                                  onChange={(e) => handleUpdateStep(index, 'content', e.target.value)}
                                  rows={4}
                                />
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={() => handleRemoveStep(index)}
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                Remover Passo
                              </Button>
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                        className="flex-1"
                      >
                        {updateMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Salvar Alterações
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          if (confirm('Tem certeza que deseja excluir este tutorial?')) {
                            deleteMutation.mutate(selectedTutorial.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  Selecione um provedor para editar
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
