
-- Create store_events table for conversion funnel tracking
CREATE TABLE public.store_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL,
  product_id UUID NULL,
  event_type TEXT NOT NULL,
  session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add index for efficient querying by store and date
CREATE INDEX idx_store_events_store_created ON public.store_events (store_id, created_at DESC);
CREATE INDEX idx_store_events_type ON public.store_events (store_id, event_type, created_at DESC);
CREATE INDEX idx_store_events_session ON public.store_events (store_id, session_id, event_type);

-- Enable RLS
ALTER TABLE public.store_events ENABLE ROW LEVEL SECURITY;

-- Allow anyone to insert events (public store visitors)
CREATE POLICY "Anyone can insert store events"
  ON public.store_events
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only store owner can read their events
CREATE POLICY "Store owners can read own events"
  ON public.store_events
  FOR SELECT
  TO authenticated
  USING (store_id = auth.uid());
