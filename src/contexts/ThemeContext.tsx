import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface ThemeColors {
  primaryColor: string;
  secondaryColor: string;
  footerTextColor: string;
  fontFamily: string;
  fontWeight: number;
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
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchColors = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('primary_color, secondary_color, footer_text_color, font_family, font_weight')
        .eq('id', user.id)
        .single();

      if (profile) {
        const newColors = {
          primaryColor: profile.primary_color || '#6a1b9a',
          secondaryColor: profile.secondary_color || '#FB8C00',
          footerTextColor: profile.footer_text_color || '#FFFFFF',
          fontFamily: profile.font_family || 'Inter',
          fontWeight: profile.font_weight || 400,
        };
        setColors(newColors);
        
        // Apply CSS variables immediately
        document.documentElement.style.setProperty('--user-font-family', newColors.fontFamily);
        document.documentElement.style.setProperty('--user-font-weight', String(newColors.fontWeight));
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
          };
          setColors(newColors);
          
          // Apply CSS variables in real-time
          document.documentElement.style.setProperty('--user-font-family', newColors.fontFamily);
          document.documentElement.style.setProperty('--user-font-weight', String(newColors.fontWeight));
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
