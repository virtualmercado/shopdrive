import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useTemplateBySlug, useIncrementLinkClicks } from '@/hooks/useBrandTemplates';
import { Loader2 } from 'lucide-react';
import TemplateUnavailable from './TemplateUnavailable';

const TemplateSignup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const templateSlug = searchParams.get('template');
  const [hasTrackedClick, setHasTrackedClick] = useState(false);
  
  const { data: template, isLoading, error } = useTemplateBySlug(templateSlug);
  const incrementClicksMutation = useIncrementLinkClicks();

  useEffect(() => {
    // If template is valid and active, track click and redirect to register
    if (template && template.is_link_active && !hasTrackedClick) {
      setHasTrackedClick(true);
      
      // Track the click
      if (templateSlug) {
        incrementClicksMutation.mutate(templateSlug);
      }
      
      // Redirect to register page with template info
      navigate(`/register?template=${templateSlug}`, { replace: true });
    }
  }, [template, templateSlug, hasTrackedClick, navigate, incrementClicksMutation]);

  // Show loading while checking template
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

  // Show unavailable page if template doesn't exist, is inactive, or link is disabled
  if (error || !template || !template.is_link_active) {
    return <TemplateUnavailable />;
  }

  // While redirecting, show loading
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
