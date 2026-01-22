
-- Create enum types for banner status, link type and badge type
CREATE TYPE banner_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TYPE banner_link_type AS ENUM ('internal', 'external');
CREATE TYPE banner_badge_type AS ENUM ('default', 'info', 'success', 'warning', 'sponsored');
CREATE TYPE banner_event_type AS ENUM ('impression', 'click');

-- Create the main banners table
CREATE TABLE public.vm_dashboard_banners (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL CHECK (char_length(title) <= 60),
  subtitle TEXT CHECK (char_length(subtitle) <= 90),
  status banner_status NOT NULL DEFAULT 'draft',
  priority INTEGER NOT NULL DEFAULT 0,
  badge_text TEXT CHECK (char_length(badge_text) <= 30),
  badge_type banner_badge_type DEFAULT 'default',
  is_sponsored BOOLEAN NOT NULL DEFAULT false,
  link_type banner_link_type NOT NULL DEFAULT 'internal',
  internal_route TEXT,
  external_url TEXT,
  open_in_new_tab BOOLEAN NOT NULL DEFAULT true,
  image_desktop_url TEXT NOT NULL,
  image_mobile_url TEXT,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT valid_internal_route CHECK (
    link_type != 'internal' OR (link_type = 'internal' AND internal_route IS NOT NULL AND internal_route != '')
  ),
  CONSTRAINT valid_external_url CHECK (
    link_type != 'external' OR (link_type = 'external' AND external_url IS NOT NULL AND external_url LIKE 'http%')
  )
);

-- Create banner events table for tracking impressions and clicks
CREATE TABLE public.vm_dashboard_banner_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  banner_id UUID NOT NULL REFERENCES public.vm_dashboard_banners(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL,
  event_type banner_event_type NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  meta JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for performance
CREATE INDEX idx_vm_dashboard_banners_status ON public.vm_dashboard_banners(status);
CREATE INDEX idx_vm_dashboard_banners_priority ON public.vm_dashboard_banners(priority);
CREATE INDEX idx_vm_dashboard_banners_dates ON public.vm_dashboard_banners(starts_at, ends_at);
CREATE INDEX idx_vm_dashboard_banner_events_banner_id ON public.vm_dashboard_banner_events(banner_id);
CREATE INDEX idx_vm_dashboard_banner_events_merchant_id ON public.vm_dashboard_banner_events(merchant_id);
CREATE INDEX idx_vm_dashboard_banner_events_created_at ON public.vm_dashboard_banner_events(created_at);
CREATE INDEX idx_vm_dashboard_banner_events_type ON public.vm_dashboard_banner_events(event_type);

-- Enable RLS
ALTER TABLE public.vm_dashboard_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vm_dashboard_banner_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for banners
-- Admins can do everything
CREATE POLICY "Admins can manage banners"
ON public.vm_dashboard_banners
FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can view active banners (for merchant dashboard)
CREATE POLICY "Users can view active banners"
ON public.vm_dashboard_banners
FOR SELECT
USING (
  status = 'active' 
  AND (starts_at IS NULL OR starts_at <= now()) 
  AND (ends_at IS NULL OR ends_at >= now())
);

-- RLS Policies for events
-- Admins can view all events
CREATE POLICY "Admins can view all events"
ON public.vm_dashboard_banner_events
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can insert their own events
CREATE POLICY "Users can insert their own events"
ON public.vm_dashboard_banner_events
FOR INSERT
WITH CHECK (auth.uid() = merchant_id);

-- Create trigger for updated_at
CREATE TRIGGER update_vm_dashboard_banners_updated_at
BEFORE UPDATE ON public.vm_dashboard_banners
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to get active banners count
CREATE OR REPLACE FUNCTION public.get_active_banners_count()
RETURNS TABLE (total_active INTEGER, sponsored_active INTEGER)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    COUNT(*)::INTEGER as total_active,
    COUNT(*) FILTER (WHERE is_sponsored = true)::INTEGER as sponsored_active
  FROM public.vm_dashboard_banners
  WHERE status = 'active'
    AND (starts_at IS NULL OR starts_at <= now())
    AND (ends_at IS NULL OR ends_at >= now());
$$;

-- Create function to get banner metrics
CREATE OR REPLACE FUNCTION public.get_banner_metrics(
  p_banner_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  impressions BIGINT,
  clicks BIGINT,
  ctr NUMERIC
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
      COUNT(*) FILTER (WHERE event_type = 'click') as clicks
    FROM public.vm_dashboard_banner_events
    WHERE banner_id = p_banner_id
      AND created_at >= now() - (p_days || ' days')::INTERVAL
  )
  SELECT 
    impressions,
    clicks,
    CASE WHEN impressions > 0 THEN ROUND((clicks::NUMERIC / impressions::NUMERIC) * 100, 2) ELSE 0 END as ctr
  FROM stats;
$$;
