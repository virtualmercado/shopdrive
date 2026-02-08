import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Headset, CreditCard, Shield, Handshake, Mail, Loader2 } from "lucide-react";
import LandingLayout from "@/components/layout/LandingLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { supabase } from "@/integrations/supabase/client";
import { useCMSContent } from "@/hooks/useCMSContent";

// Schemas for each form type
const supportSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("E-mail inválido").max(255),
  store_url: z.string().max(255).optional(),
  problem_type: z.string().min(1, "Selecione o tipo de problema"),
  message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(1000),
});

const financialSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("E-mail inválido").max(255),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ inválido").max(18),
  message: z.string().min(10, "Descrição deve ter pelo menos 10 caracteres").max(1000),
});

const commercialSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  company: z.string().min(2, "Empresa deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("E-mail inválido").max(255),
  message: z.string().min(10, "Mensagem deve ter pelo menos 10 caracteres").max(1000),
});

type SupportFormData = z.infer<typeof supportSchema>;
type FinancialFormData = z.infer<typeof financialSchema>;
type CommercialFormData = z.infer<typeof commercialSchema>;

type FormType = "support" | "financial" | "commercial" | null;

const ContactPage = () => {
  const [openForm, setOpenForm] = useState<FormType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: cmsData } = useCMSContent();

  // Helper function to get content with fallback
  const getContentValue = (field: string, fallback: string): string => {
    if (!cmsData || !cmsData["contact_page"]) return fallback;
    return cmsData["contact_page"][field] || fallback;
  };

  // Get CMS content
  const content = {
    title: getContentValue("title", "Fale com a ShopDrive"),
    subtitle: getContentValue("subtitle", "Escolha o tipo de atendimento para que possamos ajudar mais rápido"),
    supportTitle: getContentValue("support_title", "Suporte ao Lojista"),
    supportText: getContentValue("support_text", "Problemas com sua loja, produtos, pedidos, pagamentos ou sistema"),
    financialTitle: getContentValue("financial_title", "Financeiro e Cobranças"),
    financialText: getContentValue("financial_text", "Problemas com sua assinatura, cartão ou cobranças"),
    privacyTitle: getContentValue("privacy_title", "Privacidade e Dados (LGPD)"),
    privacyText: getContentValue("privacy_text", "Solicitações sobre dados pessoais, exclusão ou privacidade"),
    dpoEmail: getContentValue("dpo_email", "dpo@shopdrive.com.br"),
    commercialTitle: getContentValue("commercial_title", "Comercial e Parcerias"),
    commercialText: getContentValue("commercial_text", "Parcerias, revenda, integrações ou negócios"),
  };

  // Support Form
  const supportForm = useForm<SupportFormData>({
    resolver: zodResolver(supportSchema),
    defaultValues: {
      name: "",
      email: "",
      store_url: "",
      problem_type: "",
      message: "",
    },
  });

  // Financial Form
  const financialForm = useForm<FinancialFormData>({
    resolver: zodResolver(financialSchema),
    defaultValues: {
      name: "",
      email: "",
      cpf_cnpj: "",
      message: "",
    },
  });

  // Commercial Form
  const commercialForm = useForm<CommercialFormData>({
    resolver: zodResolver(commercialSchema),
    defaultValues: {
      name: "",
      company: "",
      email: "",
      message: "",
    },
  });

  const getCategoryFromType = (type: FormType): string => {
    switch (type) {
      case "support": return "suporte_lojista";
      case "financial": return "financeiro_cobrancas";
      case "commercial": return "comercial_parcerias";
      default: return "suporte_lojista";
    }
  };

  const submitForm = async (type: FormType, data: Record<string, unknown>) => {
    if (!type) return;
    
    setIsSubmitting(true);
    try {
      // Insert into tickets_landing_page (new table with protocol generation)
      const { data: ticketData, error } = await supabase.from("tickets_landing_page" as any).insert({
        categoria: getCategoryFromType(type),
        nome: data.name as string,
        email: data.email as string,
        loja_url_ou_nome: (data.store_url as string) || null,
        tipo_problema: (data.problem_type as string) || null,
        cpf_cnpj: (data.cpf_cnpj as string) || null,
        empresa: (data.company as string) || null,
        mensagem: data.message as string,
      } as any).select('protocolo').single();

      if (error) throw error;

      const protocolo = (ticketData as any)?.protocolo || 'Gerado';
      toast.success(
        <div className="space-y-1">
          <p className="font-medium">Mensagem enviada com sucesso!</p>
          <p className="text-sm">Seu protocolo: <span className="font-mono font-bold">{protocolo}</span></p>
          <p className="text-xs text-muted-foreground">Guarde este número para acompanhamento.</p>
        </div>,
        { duration: 10000 }
      );
      setOpenForm(null);
      
      // Reset forms
      supportForm.reset();
      financialForm.reset();
      commercialForm.reset();
    } catch (error) {
      console.error("Error submitting form:", error);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const problemTypes = [
    { value: "loja", label: "Loja" },
    { value: "produtos", label: "Produtos" },
    { value: "pagamentos", label: "Pagamentos" },
    { value: "pedidos", label: "Pedidos" },
    { value: "checkout", label: "Checkout" },
  ];

  return (
    <LandingLayout>
      <main className="min-h-screen bg-background py-16 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              {content.title}
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {content.subtitle}
            </p>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Suporte ao Lojista */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Headset className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{content.supportTitle}</CardTitle>
                </div>
                <CardDescription className="text-base">
                  {content.supportText}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setOpenForm("support")} className="w-full">
                  Solicitar suporte
                </Button>
              </CardContent>
            </Card>

            {/* Financeiro e Cobranças */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{content.financialTitle}</CardTitle>
                </div>
                <CardDescription className="text-base">
                  {content.financialText}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setOpenForm("financial")} className="w-full">
                  Falar com financeiro
                </Button>
              </CardContent>
            </Card>

            {/* Privacidade e Dados (LGPD) */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{content.privacyTitle}</CardTitle>
                </div>
                <CardDescription className="text-base">
                  {content.privacyText}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <a
                  href={`mailto:${content.dpoEmail}`}
                  className="flex items-center gap-2 p-3 bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                >
                  <Mail className="h-5 w-5 text-primary" />
                  <span className="font-medium text-foreground">{content.dpoEmail}</span>
                </a>
              </CardContent>
            </Card>

            {/* Comercial e Parcerias */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Handshake className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{content.commercialTitle}</CardTitle>
                </div>
                <CardDescription className="text-base">
                  {content.commercialText}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => setOpenForm("commercial")} className="w-full">
                  Contato comercial
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Support Form Modal */}
      <Dialog open={openForm === "support"} onOpenChange={(open) => !open && setOpenForm(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Suporte ao Lojista</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para que possamos ajudar você.
            </DialogDescription>
          </DialogHeader>
          <Form {...supportForm}>
            <form onSubmit={supportForm.handleSubmit((data) => submitForm("support", data))} className="space-y-4">
              <FormField
                control={supportForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supportForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="seu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supportForm.control}
                name="store_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>URL ou nome da loja (opcional)</FormLabel>
                    <FormControl>
                      <Input placeholder="minhaloja.shopdrive.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supportForm.control}
                name="problem_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de problema</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {problemTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={supportForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva seu problema..." className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar solicitação
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Financial Form Modal */}
      <Dialog open={openForm === "financial"} onOpenChange={(open) => !open && setOpenForm(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Financeiro e Cobranças</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para resolver questões financeiras.
            </DialogDescription>
          </DialogHeader>
          <Form {...financialForm}>
            <form onSubmit={financialForm.handleSubmit((data) => submitForm("financial", data))} className="space-y-4">
              <FormField
                control={financialForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={financialForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="seu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={financialForm.control}
                name="cpf_cnpj"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF ou CNPJ</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={financialForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva o problema..." className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar solicitação
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Commercial Form Modal */}
      <Dialog open={openForm === "commercial"} onOpenChange={(open) => !open && setOpenForm(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Comercial e Parcerias</DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo para entrar em contato conosco.
            </DialogDescription>
          </DialogHeader>
          <Form {...commercialForm}>
            <form onSubmit={commercialForm.handleSubmit((data) => submitForm("commercial", data))} className="space-y-4">
              <FormField
                control={commercialForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input placeholder="Seu nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={commercialForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome da empresa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={commercialForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="seu@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={commercialForm.control}
                name="message"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mensagem</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Descreva sua proposta..." className="min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar mensagem
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </LandingLayout>
  );
};

export default ContactPage;
