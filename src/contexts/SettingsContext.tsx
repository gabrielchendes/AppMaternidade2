import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface AppSettings {
  app_name: string;
  app_description: string;
  primary_color: string;
  secondary_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  pwa_icon_url: string | null;
  support_whatsapp: string;
  support_email: string;
}

const defaultSettings: AppSettings = {
  app_name: 'Maternidade Premium',
  app_description: 'Acesse sua área exclusiva',
  primary_color: '#ec4899',
  secondary_color: '#be185d',
  logo_url: null,
  favicon_url: null,
  pwa_icon_url: null,
  support_whatsapp: '5531997433488',
  support_email: 'gabrielchendes@hotmail.com',
};

interface SettingsContextType {
  settings: AppSettings;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const fetchSettings = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (data) {
        setSettings(data);
        applyTheme(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (s: AppSettings) => {
    // Apply colors to CSS variables
    document.documentElement.style.setProperty('--primary', s.primary_color);
    document.documentElement.style.setProperty('--primary-hover', s.secondary_color);
    
    // Update title
    document.title = s.app_name;

    // Update favicon
    if (s.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = s.favicon_url;
    }

    // Update PWA icon (Apple Touch Icon)
    if (s.pwa_icon_url) {
      let appleLink = document.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement;
      if (!appleLink) {
        appleLink = document.createElement('link');
        appleLink.rel = 'apple-touch-icon';
        document.getElementsByTagName('head')[0].appendChild(appleLink);
      }
      appleLink.href = s.pwa_icon_url;
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
