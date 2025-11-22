import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useTickets = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchTickets = async (filters?: {
    status?: string;
    priority?: string;
    category?: string;
    assigned_to?: string;
    search?: string;
  }) => {
    try {
      setLoading(true);
      let query = supabase
        .from('support_tickets')
        .select('*, profiles!customer_id(full_name, store_name), profiles!assigned_to(full_name)')
        .order('created_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters?.category) {
        query = query.eq('category', filters.category);
      }
      if (filters?.assigned_to) {
        query = query.eq('assigned_to', filters.assigned_to);
      }
      if (filters?.search) {
        query = query.or(`ticket_number.ilike.%${filters.search}%,subject.ilike.%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching tickets:', error);
      }
      toast({
        title: 'Erro ao carregar tickets',
        description: 'Não foi possível carregar os tickets.',
        variant: 'destructive',
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  const createTicket = async (data: {
    customer_id: string;
    subject: string;
    description: string;
    category: string;
    priority?: string;
  }) => {
    try {
      setLoading(true);
      const { data: ticket, error } = await supabase
        .from('support_tickets')
        .insert([{
          customer_id: data.customer_id,
          subject: data.subject,
          description: data.description,
          category: data.category,
          priority: data.priority || 'medium',
          ticket_number: '',
        }])
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Ticket criado',
        description: `Ticket ${ticket.ticket_number} criado com sucesso.`,
      });
      return ticket;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error creating ticket:', error);
      }
      toast({
        title: 'Erro ao criar ticket',
        description: 'Não foi possível criar o ticket.',
        variant: 'destructive',
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const updateTicket = async (id: string, data: {
    status?: string;
    priority?: string;
    category?: string;
    assigned_to?: string;
  }) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('support_tickets')
        .update(data)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Ticket atualizado',
        description: 'Ticket atualizado com sucesso.',
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error updating ticket:', error);
      }
      toast({
        title: 'Erro ao atualizar',
        description: 'Não foi possível atualizar o ticket.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const addMessage = async (ticketId: string, message: string, isInternal: boolean) => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('ticket_messages').insert({
        ticket_id: ticketId,
        sender_id: user.id,
        message,
        is_internal: isInternal,
      });

      if (error) throw error;

      // Update ticket's updated_at
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      toast({
        title: 'Mensagem enviada',
        description: 'Mensagem adicionada ao ticket.',
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error adding message:', error);
      }
      toast({
        title: 'Erro ao enviar mensagem',
        description: 'Não foi possível enviar a mensagem.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const assignTicket = async (ticketId: string, userId: string) => {
    return updateTicket(ticketId, { assigned_to: userId });
  };

  const closeTicket = async (ticketId: string) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;

      toast({
        title: 'Ticket fechado',
        description: 'Ticket fechado com sucesso.',
      });
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error closing ticket:', error);
      }
      toast({
        title: 'Erro ao fechar ticket',
        description: 'Não foi possível fechar o ticket.',
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('ticket_messages')
        .select('*, profiles!sender_id(full_name)')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error fetching messages:', error);
      }
      return [];
    }
  };

  return {
    loading,
    fetchTickets,
    createTicket,
    updateTicket,
    addMessage,
    assignTicket,
    closeTicket,
    fetchMessages,
  };
};
