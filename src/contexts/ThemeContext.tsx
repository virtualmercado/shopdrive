import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface ThemeColors {
  primaryColor: string;
  secondaryColor: string;
  footerTextColor: string;
  fontFamily: string;
  fontWeight: number;
  productImageFormat: string;
  productBorderStyle: string;
  productTextAlignment: string;
  productButtonDisplay: string;
  buttonBorderStyle: string;
  buttonBgColor: string;
  buttonTextColor: string;
}

interface ThemeContextType extends ThemeColors {
  loading: boolean;
  // Original merchant colors (for use in store, receipts, catalogs)
  merchantColors: ThemeColors;
}

// VM Official Colors - These are used in the merchant dashboard (backoffice)
const VM_OFFICIAL_COLORS: ThemeColors = {
  primaryColor: '#6a1b9a',
  secondaryColor: '#FB8C00',
  footerTextColor: '#FFFFFF',
  fontFamily: 'Inter',
  fontWeight: 400,
  productImageFormat: 'square',
  productBorderStyle: 'rounded',
  productTextAlignment: 'left',
  productButtonDisplay: 'below',
  buttonBorderStyle: 'rounded',
  buttonBgColor: '#6a1b9a',
  buttonTextColor: '#FFFFFF',
};

const ThemeContext = createContext<ThemeContextType>({
  ...VM_OFFICIAL_COLORS,
  loading: true,
  merchantColors: VM_OFFICIAL_COLORS,
});

export const useTheme = () => useContext(ThemeContext);

// Hook to get merchant colors specifically (for store, receipts, catalogs)
export const useMerchantTheme = () => {
  const context = useContext(ThemeContext);
  return {
    ...context.merchantColors,
    loading: context.loading,
  };
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [merchantColors, setMerchantColors] = useState<ThemeColors>(VM_OFFICIAL_COLORS);
  const [loading, setLoading] = useState(true);

  // Helper function to apply all merchant CSS variables
  // This is ONLY called for store/public pages, not for dashboard
  const applyMerchantCSSVariables = (colors: ThemeColors) => {
    const root = document.documentElement;
    
    // Core merchant colors
    root.style.setProperty('--merchant-primary', colors.primaryColor);
    root.style.setProperty('--merchant-secondary', colors.secondaryColor);
    root.style.setProperty('--merchant-button-bg', colors.buttonBgColor);
    root.style.setProperty('--merchant-button-text', colors.buttonTextColor);
    root.style.setProperty('--merchant-footer-text', colors.footerTextColor);
    
    // Derived colors for hover/focus states (with transparency)
    root.style.setProperty('--merchant-primary-hover', `${colors.primaryColor}dd`);
    root.style.setProperty('--merchant-primary-light', `${colors.primaryColor}15`);
    root.style.setProperty('--merchant-primary-ring', `${colors.primaryColor}33`);
    root.style.setProperty('--merchant-button-hover', `${colors.buttonBgColor}dd`);
    
    // Font settings - only apply on store pages
    root.style.setProperty('--user-font-family', colors.fontFamily);
    root.style.setProperty('--user-font-weight', String(colors.fontWeight));
  };

  // Helper function to reset to VM official colors (for dashboard)
  const applyVMOfficialCSSVariables = () => {
    const root = document.documentElement;
    
    // Reset to VM official colors
    root.style.setProperty('--merchant-primary', VM_OFFICIAL_COLORS.primaryColor);
    root.style.setProperty('--merchant-secondary', VM_OFFICIAL_COLORS.secondaryColor);
    root.style.setProperty('--merchant-button-bg', VM_OFFICIAL_COLORS.buttonBgColor);
    root.style.setProperty('--merchant-button-text', VM_OFFICIAL_COLORS.buttonTextColor);
    root.style.setProperty('--merchant-footer-text', VM_OFFICIAL_COLORS.footerTextColor);
    
    // Derived colors
    root.style.setProperty('--merchant-primary-hover', `${VM_OFFICIAL_COLORS.primaryColor}dd`);
    root.style.setProperty('--merchant-primary-light', `${VM_OFFICIAL_COLORS.primaryColor}15`);
    root.style.setProperty('--merchant-primary-ring', `${VM_OFFICIAL_COLORS.primaryColor}33`);
    root.style.setProperty('--merchant-button-hover', `${VM_OFFICIAL_COLORS.buttonBgColor}dd`);
    
    // Reset font settings to default
    root.style.setProperty('--user-font-family', 'Inter');
    root.style.setProperty('--user-font-weight', '400');
  };

  // Check if current route is a dashboard route (backoffice)
  const isDashboardRoute = () => {
    const pathname = window.location.pathname;
    return pathname.startsWith('/lojista');
  };

  // Set up auth state listener
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Listen for route changes to apply correct colors
  useEffect(() => {
    const handleRouteChange = () => {
      if (isDashboardRoute()) {
        // Dashboard routes use VM official colors
        applyVMOfficialCSSVariables();
      } else {
        // Store/public pages use merchant colors
        applyMerchantCSSVariables(merchantColors);
      }
    };

    // Initial check
    handleRouteChange();

    // Listen for popstate (browser back/forward)
    window.addEventListener('popstate', handleRouteChange);
    
    // Create observer for URL changes (for React Router)
    const observer = new MutationObserver(() => {
      handleRouteChange();
    });
    
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      observer.disconnect();
    };
  }, [merchantColors]);

  useEffect(() => {
    const fetchColors = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('primary_color, secondary_color, footer_text_color, font_family, font_weight, product_image_format, product_border_style, product_text_alignment, product_button_display, button_border_style, button_bg_color, button_text_color')
        .eq('id', user.id)
        .single();

      if (profile) {
        const newColors = {
          primaryColor: profile.primary_color || '#6a1b9a',
          secondaryColor: profile.secondary_color || '#FB8C00',
          footerTextColor: profile.footer_text_color || '#FFFFFF',
          fontFamily: profile.font_family || 'Inter',
          fontWeight: profile.font_weight || 400,
          productImageFormat: profile.product_image_format || 'square',
          productBorderStyle: profile.product_border_style || 'rounded',
          productTextAlignment: profile.product_text_alignment || 'left',
          productButtonDisplay: profile.product_button_display || 'below',
          buttonBorderStyle: profile.button_border_style || 'rounded',
          buttonBgColor: profile.button_bg_color || '#6a1b9a',
          buttonTextColor: profile.button_text_color || '#FFFFFF',
        };
        setMerchantColors(newColors);
        
        // Only apply merchant colors if NOT on dashboard route
        if (!isDashboardRoute()) {
          applyMerchantCSSVariables(newColors);
        }
      }
      setLoading(false);
    };

    fetchColors();

    // Subscribe to real-time changes
    const channel = supabase
      .channel('profile-colors')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user?.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          const newColors = {
            primaryColor: updated.primary_color || '#6a1b9a',
            secondaryColor: updated.secondary_color || '#FB8C00',
            footerTextColor: updated.footer_text_color || '#FFFFFF',
            fontFamily: updated.font_family || 'Inter',
            fontWeight: updated.font_weight || 400,
            productImageFormat: updated.product_image_format || 'square',
            productBorderStyle: updated.product_border_style || 'rounded',
            productTextAlignment: updated.product_text_alignment || 'left',
            productButtonDisplay: updated.product_button_display || 'below',
            buttonBorderStyle: updated.button_border_style || 'rounded',
            buttonBgColor: updated.button_bg_color || '#6a1b9a',
            buttonTextColor: updated.button_text_color || '#FFFFFF',
          };
          setMerchantColors(newColors);
          
          // Only apply merchant colors if NOT on dashboard route
          if (!isDashboardRoute()) {
            applyMerchantCSSVariables(newColors);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // For the dashboard (backoffice), always return VM official colors
  // The merchantColors are still available via the separate property for receipts/catalogs/store
  const contextValue: ThemeContextType = {
    ...VM_OFFICIAL_COLORS,
    loading,
    merchantColors,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};
