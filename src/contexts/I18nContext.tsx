import React, { createContext, useContext, ReactNode } from 'react';
import { useSettings } from './SettingsContext';
import { languagePresets } from '../constants/languagePresets';

interface I18nContextType {
  t: (key: string, variables?: { [key: string]: any }) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();

  const t = (key: string, variables?: { [key: string]: any }) => {
    // 1. Prioridade máxima: Texto customizado pelo administrador no banco
    let text = settings.custom_texts?.[key];
    
    // 2. Segunda prioridade: Preset do idioma selecionado (en, es, pt)
    if (!text) {
      const currentLang = (settings.custom_texts?.['app.language'] as any) || 'pt';
      text = languagePresets[currentLang as keyof typeof languagePresets]?.[key];
    }
    
    // 3. Fallback final: Função de fallback legada ou a própria chave
    if (!text) {
      text = getFallbackTranslations(key);
    }

    if (variables) {
      Object.keys(variables).forEach((v) => {
        text = text!.replace(`{${v}}`, variables[v]);
      });
    }
    return text || key;
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
    'auth.logout_success': 'Até logo!',
    'auth.master_password': 'Senha Mestre',
    'auth.welcome_back': 'Bem-vindo de volta!',
    'auth.subtitle': 'Acesse sua área exclusiva',
    'auth.support_box': 'Ainda está com dúvidas?',
    'auth.whatsapp_label': 'Chamar no WhatsApp',
    'auth.email_label': 'Enviar um E-mail',
    'auth.disclaimer': 'Ao entrar, você concorda com nossos Termos de Uso e Política de Privacidade.',
    'admin.dashboard': 'Painel de Controle',
    'admin.courses': 'Cursos',
    'admin.settings': 'Configurações',
    'course.next_module': 'Próximo módulo liberado',
    'course.progress': 'Progresso',
    'course.your_progress': 'Seu Progresso',
    'course.lessons': 'Aulas',
    'course.content': 'Conteúdo',
    'course.no_media': 'Aula sem conteúdo de mídia',
    'course.lesson_completed': 'Aula concluída!',
    'course.prev_lesson': 'Aula Anterior',
    'course.next_lesson': 'Próxima Aula',
    'course.materials': 'Materiais de Apoio',
    'course.premium_content': 'CONTEÚDO PREMIUM',
    'course.lifetime_access': 'Acesso Vitalício',
    'course.default_description': 'Este conteúdo exclusivo oferece insights valiosos e ferramentas práticas para sua jornada na maternidade.',
    'course.unlock_button': 'LIBERAR ACESSO AGORA',
    'course.secure_payment': 'Pagamento 100% Seguro • Acesso Imediato',
    'course.schedule_title': 'Cronograma do Curso',
    'course.completed': 'CONCLUÍDO',
    'course.continue': 'CONTINUAR',
    'course.start': 'COMEÇAR',
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
    'community.delete_success': 'Publicação excluída com sucesso!',
    'community.delete_error': 'Erro ao excluir publicação',
    'community.comment_delete_success': 'Comentário excluído com sucesso!',
    'community.comment_delete_error': 'Erro ao excluir comentário',
    'community.date_format': 'd MMM, HH:mm',
    'community.locale': 'ptBR',
    'global.save': 'Salvar',
    'global.cancel': 'Cancelar',
    'global.delete': 'Excluir',
    'global.back': 'Voltar',
    'global.logout': 'Sair',
    'notifications.title': 'Notificações',
    'notifications.clear_all': 'LIMPAR TUDO',
    'notifications.close': 'FECHAR PAINEL',
    'notifications.mark_as_read': 'marcar como lida',
    'notifications.empty': 'Você está em dia!',
    'notifications.empty_desc': 'Nenhuma notificação por aqui.',
  };
  return fallbacks[key] || key;
}
