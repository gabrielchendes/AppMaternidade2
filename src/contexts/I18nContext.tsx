import React, { createContext, useContext, ReactNode } from 'react';
import { useSettings } from './SettingsContext';

interface I18nContextType {
  t: (key: string, variables?: { [key: string]: any }) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();

  const t = (key: string, variables?: { [key: string]: any }) => {
    let text = settings.custom_texts?.[key] || key;
    
    // Fallback if key not in custom_texts
    if (text === key) {
      text = getFallbackTranslations(key);
    }

    if (variables) {
      Object.keys(variables).forEach((v) => {
        text = text.replace(`{${v}}`, variables[v]);
      });
    }
    return text;
  };

  return (
    <I18nContext.Provider value={{ t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

function getFallbackTranslations(key: string): string {
  const fallbacks: { [key: string]: string } = {
    'auth.login': 'Entrar',
    'auth.email': 'E-mail',
    'auth.password': 'Senha',
    'auth.login_with_email': 'Entrar com Email (Sem senha)',
    'auth.login_with_password': 'Entrar com Email e Senha',
    'auth.restricted_access': 'Acesso Restrito',
    'auth.master_password': 'Senha Mestre',
    'auth.welcome_back': 'Bem-vinda de volta!',
    'admin.dashboard': 'Painel de Controle',
    'admin.courses': 'Cursos',
    'admin.settings': 'Configurações',
    'course.next_module': 'Próximo módulo liberado',
    'course.progress': 'Progresso',
    'auth.restricted_access_msg': 'Acesso restrito a alunas cadastradas.',
    'auth.support_box': 'Caixa de Suporte',
  };
  return fallbacks[key] || key;
}
