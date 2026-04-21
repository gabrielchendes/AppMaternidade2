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
    'auth.restricted_access_msg': 'Acesso restrito a alunas cadastradas.',
    'auth.master_password': 'Senha Mestre',
    'auth.welcome_back': 'Bem-vinda de volta!',
    'auth.subtitle': 'Acesse sua área exclusiva para mamães',
    'auth.support_box': 'Ainda está com dúvidas?',
    'auth.whatsapp_label': 'Chamar no WhatsApp',
    'auth.email_label': 'Enviar um E-mail',
    'auth.disclaimer': 'Ao entrar, você concorda com nossos Termos de Uso e Política de Privacidade.',
    'admin.dashboard': 'Painel de Controle',
    'admin.courses': 'Cursos',
    'admin.settings': 'Configurações',
    'course.next_module': 'Próximo módulo liberado',
    'course.progress': 'Progresso',
    'course.lesson_completed': 'Aula concluída!',
    'course.prev_lesson': 'Aula Anterior',
    'course.next_lesson': 'Próxima Aula',
    'course.materials': 'Materiais de Apoio',
    'course.premium_content': 'CONTEÚDO PREMIUM',
    'course.lifetime_access': 'Acesso Vitalício',
    'course.default_description': 'Este conteúdo exclusivo oferece insights valiosos e ferramentas práticas para sua jornada na maternidade.',
    'course.unlock_button': 'LIBERAR ACESSO AGORA',
    'course.secure_payment': 'Pagamento 100% Seguro • Acesso Imediato',
    'dashboard.courses_paid': 'Meus Cursos',
    'dashboard.courses_free': 'Novos Lançamentos',
    'dashboard.courses_bonus': 'Meus Bônus',
    'dashboard.empty_locked': 'Você ainda não possui cursos liberados.',
    'dashboard.empty_all_unlocked': 'Você já possui todos os cursos disponíveis!',
    'nav.home': 'Início',
    'nav.community': 'Comunidade',
    'nav.profile': 'Perfil',
    'nav.admin': 'Admin',
    'profile.title': 'Meu Perfil',
    'profile.subtitle': 'Gerencie suas informações',
    'profile.save_changes': 'Salvar Alterações',
    'profile.change_password': 'Alterar Senha',
    'community.title': 'Comunidade',
    'community.subtitle': 'Compartilhe sua jornada com outras mães',
    'community.input_placeholder': 'O que você quer compartilhar?',
    'community.admin_placeholder': 'Configure uma persona acima para postar...',
    'community.empty_title': 'Ainda não há publicações.',
    'community.empty_subtitle': 'Comece compartilhando algo com a comunidade!',
    'community.post': 'Publicar',
    'community.like': 'Curtir',
    'community.reply': 'Responder',
    'community.delete_post': 'Excluir Postagem',
    'global.save': 'Salvar',
    'global.cancel': 'Cancelar',
    'global.delete': 'Excluir',
    'global.back': 'Voltar',
    'global.logout': 'Sair',
  };
  return fallbacks[key] || key;
}
