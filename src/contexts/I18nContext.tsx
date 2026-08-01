import React, { createContext, useContext, ReactNode, useCallback, useState, useEffect } from 'react';
import { useSettings } from './SettingsContext';
import { languagePresets } from '../constants/languagePresets';

interface I18nContextType {
  t: (key: string, variables?: { [key: string]: any }) => string;
  language: 'pt' | 'en' | 'es';
  setLanguage: (lang: 'pt' | 'en' | 'es') => void;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const FALLBACK_TRANSLATIONS: { [key: string]: string } = {
  'auth.login': 'Entrar',
  'auth.email': 'E-mail',
  'auth.password': 'Senha',
  'auth.login_with_email': 'Entrar com Email (Sem senha)',
  'auth.login_with_password': 'Entrar com Email e Senha',
  'auth.restricted_access': 'Acesso Restrito',
  'auth.restricted_access_msg': 'Acesso restrito a usuários cadastrados.',
  'auth.logout_success': 'Até logo!',
  'auth.master_password': 'Master Password',
  'auth.welcome_back': 'Bem-vindo de volta!',
  'auth.subtitle': 'Acesse sua área exclusiva',
  'auth.support_box': 'Ainda está com dúvidas?',
  'auth.whatsapp_label': 'Chamar no WhatsApp',
  'auth.email_label': 'Enviar um E-mail',
  'auth.user_not_found': 'Usuário não encontrado',
  'auth.invalid_password': 'Senha incorreta. Verifique e tente novamente.',
  'auth.fill_this_field': 'Por favor, preencha este campo',
  'auth.invalid_email': 'Por favor, digite um endereço de e-mail válido',
  'auth.invalid_response': 'Falha na comunicação com o servidor. Tente novamente em instantes.',
  'auth.credentials_error': 'Falha ao gerar credenciais de acesso',
  'auth.generic_error': 'Ocorreu um erro. Tente novamente.',
  'auth.verify_access': 'Verificar Acesso',
  'auth.admin_identified': 'Identificamos um acesso administrativo. Por favor, insira a senha mestre para continuar.',
  'auth.disclaimer': 'Ao entrar, você concorda com nossos Termos de Uso e Política de Privacidade.',
  'admin.dashboard': 'Painel de Controle',
  'admin.courses': 'Cursos',
  'admin.settings': 'Configurações',
  'course.module': 'Módulo',
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
  'course.completed_lowercase': 'concluído',
  'course.question_sent': 'Dúvida enviada com sucesso! O expert responderá em breve.',
  'course.admin_answer': 'Resposta do Expert',
  'course.continue': 'CONTINUAR',
  'course.start': 'COMEÇAR',
  'course.exclusive': 'Exclusivo',
  'course.available': 'Disponível',
  'course.buy_button': 'QUERO GARANTIR MINHA VAGA',
  'course.preview_badge': 'PREVIEW',
  'course.buy_exclusive_package': 'Liberação somente por pacote',
  'dashboard.courses_paid': 'Meus Cursos  📚',
  'dashboard.courses_free': 'Acelere sua Evolução  🚀',
  'dashboard.courses_bonus': 'Meus Bônus  🎁',
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
  'community.subtitle': 'Compartilhe sua jornada',
  'community.input_placeholder': 'O que você quer compartilhar?',
  'community.admin_placeholder': 'Configure uma persona acima para postar...',
  'community.empty_title': 'Ainda não há publicações.',
  'community.empty_subtitle': 'Comece compartilhando algo com a comunidade!',
  'community.post': 'Publicar',
  'community.send_reply': 'Enviar Resposta',
  'community.reply': 'Responder',
  'community.replying_to': 'Em resposta a',
  'community.like': 'Curtir',
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
  'dashboard.level_0': 'Novo Jogador',
  'dashboard.level_1': 'Iniciante',
  'dashboard.level_2': 'Aprendiz',
  'dashboard.level_3': 'Mestre',
  'dashboard.level_4': 'Elite',
  'dashboard.level_5': 'Lendário',
  'dashboard.progress_title': 'Progresso do Curso',
  'celebration.25': '🔥 Parabéns! Você já conquistou 25% do conteúdo! Continue assim!',
  'celebration.50': '⭐ Sensacional! Metade do caminho já foi! O topo está próximo!',
  'celebration.75': '🚀 Impressionante! 75% concluído. Você é pura determinação!',
  'celebration.100': '🏆 LENDÁRIO! 100% CONCLUÍDO! Você dominou todo o conteúdo! Parabéns!',
  'badge.locked': 'MÉTODO PREMIUM',
  'cta.unlock': 'ADQUIRIR AGORA',
  'badge.completed': 'CONCLUÍDO',
  'cta.completed': 'ASSISTIR NOVAMENTE',
  'badge.in_progress': 'CONTINUAR',
  'cta.in_progress': 'RETOMAR AULA',
  'badge.new': 'COMEÇAR',
  'cta.new': 'COMEÇAR AGORA',
  'course.progresso': 'Progresso',
  'course.exclusive_content': 'Conteúdo Exclusivo',
  'dashboard.resume_label': 'Comece de onde parou',
  'gamification.modal_title': 'NÍVEL: {level}',
  'gamification.progress_label': 'Seu progresso total atingiu {progress}%',
  'gamification.next_achievement': 'Próxima Conquista',
  'gamification.continue_journey': 'CONTINUAR JORNADA',
  'gamification.ranking_label': 'VER MEU RANKING',
  'gamification.level_up': 'LEVEL UP',
  'gamification.target_label': 'Objetivo Atual • Falta {left}% para o próximo level',
  'gamification.level_short': 'Nível',
  'gamification.level_0_label': 'Novo Jogador',
  'gamification.level_1_label': 'Iniciante',
  'gamification.level_2_label': 'Aprendiz',
  'gamification.level_3_label': 'Mestre',
  'gamification.level_4_label': 'Elite',
  'gamification.level_5_label': 'Lendário',
  'gamification.level_0_req': 'Complete sua primeira aula',
  'gamification.level_1_req': 'Chegue a 25% de progresso total',
  'gamification.level_2_req': 'Chegue a 50% de progresso total',
  'gamification.level_3_req': 'Chegue a 75% de progresso total',
  'gamification.level_4_req': 'Conclua 100% dos conteúdos',
  'gamification.level_5_req': 'Você atingiu o topo!',
  'gamification.you_label': 'VOCÊ',
  'gamification.view_progress_tooltip': 'Ver Progresso & Medalhas',
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  const [language, setLanguage] = useState<'pt' | 'en' | 'es'>('pt');

  useEffect(() => {
    if (settings?.custom_texts?.['app.language']) {
      setLanguage(settings.custom_texts['app.language'] as any);
    }
  }, [settings?.custom_texts]);

  const t = useCallback((key: string, variables?: { [key: string]: any }) => {
    // 1. Prioridade máxima: Texto customizado pelo administrador no banco
    let text = settings?.custom_texts?.[key];

    // Ignore old "Teacher's Answer", "Resposta do Professor", etc., to let them fallback to current localized presets
    if (key === 'course.admin_answer' && text && (
      text.toLowerCase().includes('teacher') || 
      text.toLowerCase().includes('professora') || 
      text.toLowerCase().includes('professor')
    )) {
      text = undefined;
    }
    
    // 2. Segunda prioridade: Preset do idioma selecionado (en, es, pt)
    if (!text) {
      const currentLang = (settings?.custom_texts?.['app.language'] as any) || 'pt';
      text = languagePresets[currentLang as keyof typeof languagePresets]?.[key];
    }
    
    // 3. Fallback final
    if (!text) {
      text = FALLBACK_TRANSLATIONS[key] || key;
    }

    if (variables && text) {
      Object.keys(variables).forEach((v) => {
        text = text!.replace(`{${v}}`, variables[v]);
      });
    }
    return text || key;
  }, [settings]);

  return (
    <I18nContext.Provider value={{ t, language, setLanguage }}>
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
