import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface AppSettings {
  app_name: string;
  admin_email: string;
  app_description: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  logo_url: string | null;
  favicon_url: string | null;
  pwa_icon_url: string | null;
  support_whatsapp: string;
  support_email: string;
  support_whatsapp_message: string;
  auth_method: 'password' | 'passwordless';
  show_support_login: boolean;
  show_support_app: boolean;
  support_whatsapp_enabled: boolean;
  support_email_enabled: boolean;
  support_whatsapp_floating_enabled: boolean;
  support_whatsapp_floating_community_enabled: boolean;
  support_whatsapp_floating_profile_enabled: boolean;
  support_whatsapp_home_enabled: boolean;
  support_email_home_enabled: boolean;
  support_whatsapp_community_enabled: boolean;
  support_email_community_enabled: boolean;
  support_whatsapp_profile_enabled: boolean;
  support_email_profile_enabled: boolean;
  support_whatsapp_login_enabled: boolean;
  support_email_login_enabled: boolean;
  support_whatsapp_app_enabled: boolean;
  support_email_app_enabled: boolean;
  support_whatsapp_course_enabled: boolean;
  support_email_course_enabled: boolean;
  support_whatsapp_floating_course_enabled: boolean;
  login_display_type: 'title' | 'logo' | 'both';
  login_install_button_pulsing: 'pulsing' | 'static' | 'hidden' | boolean;
  logo_height?: number;
  custom_texts: { [key: string]: string };
  banner_images: string[];
  banner_interval: number;
  banner_config: Array<{ scale: number, x: number, y: number, stretch?: boolean, link?: string }>;
  banner_images_mobile?: string[];
  banner_config_mobile?: Array<{ scale: number, x: number, y: number, stretch?: boolean, link?: string }>;
  banner_sync?: boolean;
}

const defaultSettings: AppSettings = {
  app_name: 'AppMaternidade',
  admin_email: 'gabrielchendes@gmail.com',
  app_description: 'Acesse sua área exclusiva',
  primary_color: '#ef4444',
  secondary_color: '#dc2626',
  background_color: '#0f0f0f',
  logo_url: null,
  favicon_url: null,
  pwa_icon_url: null,
  support_whatsapp: '5531997433488',
  support_email: 'gabrielchendes@hotmail.com',
  support_whatsapp_message: 'Olá, gostaria de tirar uma dúvida sobre o curso.',
  auth_method: 'passwordless',
  show_support_login: true,
  show_support_app: true,
  support_whatsapp_enabled: true,
  support_email_enabled: true,
  support_whatsapp_floating_enabled: true,
  support_whatsapp_floating_community_enabled: true,
  support_whatsapp_floating_profile_enabled: true,
  support_whatsapp_home_enabled: true,
  support_email_home_enabled: true,
  support_whatsapp_community_enabled: true,
  support_email_community_enabled: true,
  support_whatsapp_profile_enabled: true,
  support_email_profile_enabled: true,
  support_whatsapp_login_enabled: true,
  support_email_login_enabled: true,
  support_whatsapp_app_enabled: true,
  support_email_app_enabled: true,
  support_whatsapp_course_enabled: true,
  support_email_course_enabled: true,
  support_whatsapp_floating_course_enabled: true,
  login_display_type: 'title',
  login_install_button_pulsing: 'pulsing',
  logo_height: 64,
  custom_texts: {
    'auth.welcome': 'Bem-vinda de volta!',
    'auth.subtitle': 'Acesse sua área exclusiva para mamães',
    'community.title': 'Comunidade',
    'community.subtitle': 'Compartilhe sua jornada com outras mães',
    'courses.title': 'Meus Cursos',
    'courses.subtitle': 'Continue seu aprendizado',
    'admin.courses.paid': 'Meus Cursos',
    'admin.courses.free': 'Novos Lançamentos',
    'admin.courses.bonus': 'Meus Bônus',
    'admin.security.error_length': 'A senha deve ter pelo menos 4 caracteres',
    'admin.security.error_mismatch': 'As senhas não coincidem',
    'admin.security.success': 'Senha do administrador atualizada com sucesso!',
    'auth.user_not_found': 'Usuário não encontrado.',
  },
  banner_images: [
    'https://picsum.photos/seed/maternity-banner-1/1200/600',
    'https://picsum.photos/seed/maternity-banner-2/1200/600'
  ],
  banner_interval: 5000,
  banner_config: [
    { scale: 100, x: 50, y: 50, stretch: true },
    { scale: 100, x: 50, y: 50, stretch: true }
  ],
  banner_images_mobile: [],
  banner_config_mobile: [],
  banner_sync: true
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

    // Create a timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Settings fetch timed out, using defaults');
        setLoading(false);
      }
    }, 3500);

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        console.error('Supabase error fetching settings:', error);
      }

      if (data) {
        setSettings(data);
        applyTheme(data);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const applyTheme = (s: AppSettings) => {
    // Apply colors to CSS variables
    document.documentElement.style.setProperty('--primary', s.primary_color);
    document.documentElement.style.setProperty('--primary-hover', s.secondary_color);
    document.documentElement.style.setProperty('--bg-main', s.background_color || '#0f0f0f');
    
    // Also update RGB for shadows
    const r = parseInt(s.primary_color.slice(1, 3), 16);
    const g = parseInt(s.primary_color.slice(3, 5), 16);
    const b = parseInt(s.primary_color.slice(5, 7), 16);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      document.documentElement.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    }
    
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
