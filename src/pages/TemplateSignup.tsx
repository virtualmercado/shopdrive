import { useEffect, useState, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTemplateBySlug } from '@/hooks/useBrandTemplates';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import TemplateUnavailable from './TemplateUnavailable';

// Known bot/crawler user-agent patterns
const BOT_PATTERNS = /facebookexternalhit|WhatsApp|TelegramBot|Discordbot|Twitterbot|Slackbot|LinkedInBot|Googlebot|bingbot|Baiduspider|YandexBot|Sogou|DuckDuckBot|ia_archiver|AhrefsBot|SemrushBot|MJ12bot|DotBot|PetalBot|Bytespider/i;

const generateSessionId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

const getOrCreateSessionId = (templateSlug: string): string => {
  const key = `template_click_session_${templateSlug}`;
  let sessionId = sessionStorage.getItem(key);
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem(key, sessionId);
  }
  return sessionId;
};

const TemplateSignup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateSlug = searchParams.get('template');
  const [hasTrackedClick, setHasTrackedClick] = useState(false);
  const trackingRef = useRef(false);
  
  const { data: template, isLoading, error } = useTemplateBySlug(templateSlug);

  useEffect(() => {
    if (!template || !template.is_link_active || !templateSlug) return;
    if (trackingRef.current) return;
    trackingRef.current = true;

    const userAgent = navigator.userAgent;

    // Client-side bot check (skip tracking entirely for bots)
    const isBot = BOT_PATTERNS.test(userAgent);

    const trackAndRedirect = async () => {
      if (!isBot) {
        const sessionId = getOrCreateSessionId(templateSlug);

        try {
          await supabase.rpc('track_template_click', {
            p_template_slug: templateSlug,
            p_ip_address: null, // IP captured server-side if needed
            p_user_agent: userAgent,
            p_session_id: sessionId,
          });
        } catch (err) {
          console.error('Error tracking click:', err);
        }
      }

      setHasTrackedClick(true);
      navigate(`/register?template=${templateSlug}`, { replace: true });
    };

    trackAndRedirect();
  }, [template, templateSlug, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Verificando link de ativação...</p>
        </div>
      </div>
    );
  }

  if (error || !template || !template.is_link_active) {
    return <TemplateUnavailable />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Preparando seu cadastro...</p>
      </div>
    </div>
  );
};

export default TemplateSignup;
