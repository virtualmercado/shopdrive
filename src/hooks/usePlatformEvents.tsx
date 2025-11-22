import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EventFilters {
  severity?: string;
  eventType?: string;
  startDate?: string;
  endDate?: string;
  subscriberId?: string;
}

export const usePlatformEvents = () => {
  const { toast } = useToast();

  const fetchEvents = async (filters?: EventFilters) => {
    try {
      let query = supabase
        .from('platform_events')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters?.severity) {
        query = query.eq('severity', filters.severity);
      }
      if (filters?.eventType) {
        query = query.eq('event_type', filters.eventType);
      }
      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters?.subscriberId) {
        query = query.eq('subscriber_id', filters.subscriberId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching events:', error);
      return [];
    }
  };

  const createEvent = async (event: {
    title: string;
    description: string;
    event_type: string;
    severity?: string;
    subscriber_id?: string;
    metadata?: any;
  }) => {
    try {
      const { error } = await supabase
        .from('platform_events')
        .insert({
          ...event,
          severity: event.severity || 'info'
        });

      if (error) throw error;
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error creating event:', error);
      }
      return false;
    }
  };

  const subscribeToEvents = (callback: (event: any) => void) => {
    const channel = supabase
      .channel('platform-events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'platform_events'
        },
        callback
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  return {
    fetchEvents,
    createEvent,
    subscribeToEvents
  };
};