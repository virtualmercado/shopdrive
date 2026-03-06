
-- Table to log individual click events for anti-fraud tracking
CREATE TABLE public.template_click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.brand_templates(id) ON DELETE CASCADE,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  is_bot BOOLEAN DEFAULT false,
  counted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for deduplication queries
CREATE INDEX idx_template_click_events_dedup 
  ON public.template_click_events (template_id, ip_address, created_at DESC);

CREATE INDEX idx_template_click_events_session 
  ON public.template_click_events (template_id, session_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.template_click_events ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (clicks come from unauthenticated users)
CREATE POLICY "Allow anonymous click inserts"
  ON public.template_click_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can read click events
CREATE POLICY "Admins can read click events"
  ON public.template_click_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RPC function for anti-fraud click tracking
CREATE OR REPLACE FUNCTION public.track_template_click(
  p_template_slug TEXT,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_template_id UUID;
  v_is_bot BOOLEAN := false;
  v_recent_click_exists BOOLEAN;
  v_session_click_exists BOOLEAN;
BEGIN
  -- Find template by slug
  SELECT id INTO v_template_id
  FROM brand_templates
  WHERE template_slug = p_template_slug AND is_link_active = true;

  IF v_template_id IS NULL THEN
    RETURN false;
  END IF;

  -- Bot detection: check user agent against known crawlers
  IF p_user_agent IS NOT NULL THEN
    IF p_user_agent ~* '(facebookexternalhit|WhatsApp|TelegramBot|Discordbot|Twitterbot|Slackbot|LinkedInBot|Googlebot|bingbot|Baiduspider|YandexBot|Sogou|DuckDuckBot|ia_archiver|AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|Bytespider)' THEN
      v_is_bot := true;
    END IF;
  END IF;

  -- Always log the event (for auditing), but only count non-bot clicks
  IF v_is_bot THEN
    INSERT INTO template_click_events (template_id, ip_address, user_agent, session_id, is_bot, counted)
    VALUES (v_template_id, p_ip_address, p_user_agent, p_session_id, true, false);
    RETURN false;
  END IF;

  -- Check for duplicate click from same session (ever)
  IF p_session_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM template_click_events
      WHERE template_id = v_template_id
        AND session_id = p_session_id
        AND counted = true
    ) INTO v_session_click_exists;

    IF v_session_click_exists THEN
      -- Log but don't count
      INSERT INTO template_click_events (template_id, ip_address, user_agent, session_id, is_bot, counted)
      VALUES (v_template_id, p_ip_address, p_user_agent, p_session_id, false, false);
      RETURN false;
    END IF;
  END IF;

  -- Check for duplicate click from same IP within 10 minutes
  IF p_ip_address IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM template_click_events
      WHERE template_id = v_template_id
        AND ip_address = p_ip_address
        AND counted = true
        AND created_at > now() - interval '10 minutes'
    ) INTO v_recent_click_exists;

    IF v_recent_click_exists THEN
      INSERT INTO template_click_events (template_id, ip_address, user_agent, session_id, is_bot, counted)
      VALUES (v_template_id, p_ip_address, p_user_agent, p_session_id, false, false);
      RETURN false;
    END IF;
  END IF;

  -- Valid click: log and increment
  INSERT INTO template_click_events (template_id, ip_address, user_agent, session_id, is_bot, counted)
  VALUES (v_template_id, p_ip_address, p_user_agent, p_session_id, false, true);

  UPDATE brand_templates
  SET link_clicks = link_clicks + 1
  WHERE id = v_template_id;

  RETURN true;
END;
$$;
