-- Create table for ticket response history
CREATE TABLE public.ticket_landing_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets_landing_page(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'email_enviado' CHECK (tipo IN ('email_enviado', 'nota_interna')),
  assunto TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  enviado_por UUID REFERENCES auth.users(id),
  email_destinatario TEXT,
  status_envio TEXT DEFAULT 'enviado' CHECK (status_envio IN ('enviado', 'falha', 'pendente')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.ticket_landing_responses ENABLE ROW LEVEL SECURITY;

-- Create policies for admin access (using user_roles table)
CREATE POLICY "Admins can view all ticket responses" 
ON public.ticket_landing_responses 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can create ticket responses" 
ON public.ticket_landing_responses 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Create index for faster lookups
CREATE INDEX idx_ticket_landing_responses_ticket_id ON public.ticket_landing_responses(ticket_id);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_landing_responses;

-- Add comment for documentation
COMMENT ON TABLE public.ticket_landing_responses IS 'Histórico de respostas enviadas para tickets da landing page';