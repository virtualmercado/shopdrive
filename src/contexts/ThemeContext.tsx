import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
}

const ThemeContext = createContext<ThemeContextType>({
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
  loading: true,
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [colors, setColors] = useState<ThemeColors>({
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
  });
  const [loading, setLoading] = useState(true);

  // Helper function to apply all merchant CSS variables
  const applyMerchantCSSVariables = (merchantColors: ThemeColors) => {
    const root = document.documentElement;
    
    // Core merchant colors
    root.style.setProperty('--merchant-primary', merchantColors.primaryColor);
    root.style.setProperty('--merchant-secondary', merchantColors.secondaryColor);
    root.style.setProperty('--merchant-button-bg', merchantColors.buttonBgColor);
    root.style.setProperty('--merchant-button-text', merchantColors.buttonTextColor);
    root.style.setProperty('--merchant-footer-text', merchantColors.footerTextColor);
    
    // Derived colors for hover/focus states (with transparency)
    root.style.setProperty('--merchant-primary-hover', `${merchantColors.primaryColor}dd`);
    root.style.setProperty('--merchant-primary-light', `${merchantColors.primaryColor}15`);
    root.style.setProperty('--merchant-primary-ring', `${merchantColors.primaryColor}33`);
    root.style.setProperty('--merchant-button-hover', `${merchantColors.buttonBgColor}dd`);
    
    // Font settings
    root.style.setProperty('--user-font-family', merchantColors.fontFamily);
    root.style.setProperty('--user-font-weight', String(merchantColors.fontWeight));
  };

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
        setColors(newColors);
        
        // Apply all merchant CSS variables immediately
        applyMerchantCSSVariables(newColors);
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
          setColors(newColors);
          
          // Apply all merchant CSS variables in real-time
          applyMerchantCSSVariables(newColors);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <ThemeContext.Provider value={{ ...colors, loading }}>
      {children}
    </ThemeContext.Provider>
  );
};
