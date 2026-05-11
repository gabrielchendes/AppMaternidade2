import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChapterQuestion } from '../types/lms';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';
import { Send, User as UserIcon, Loader2, MessageSquare, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';

interface ChapterQuestionsProps {
  chapterId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string;
  isProfessor?: boolean;
}

export default function ChapterQuestions({ chapterId, userId: initialUserId, userName: initialUserName, userAvatarUrl: initialAvatar, isProfessor = false }: ChapterQuestionsProps) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [questions, setQuestions] = useState<ChapterQuestion[]>([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  // Real user data from session/profile
  const [userData, setUserData] = useState({
    id: initialUserId,
    name: initialUserName,
    avatar: initialAvatar
  });

  useEffect(() => {
    async function getRealProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle();
        setUserData({
          id: user.id,
          name: profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Estudante',
          avatar: profile?.avatar_url || user.user_metadata?.avatar_url || initialAvatar
        });
      }
    }
    getRealProfile();
  }, [initialUserId]);

  useEffect(() => {
    fetchQuestions();

    const channel = supabase
      .channel(`chapter_questions_${chapterId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chapter_questions', filter: `chapter_id=eq.${chapterId}` },
        () => fetchQuestions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chapterId]);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabase
        .from('chapter_questions')
        .select('*')
        .eq('chapter_id', chapterId)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === '42P01') {
          console.warn('Questions table not found. Please run the SQL setup in SUPABASE_SETUP.md');
          return;
        }
        throw error;
      }
      setQuestions(data || []);
    } catch (error) {
      console.error('Error fetching questions:', error);
    } finally {
      setLoading(false);
    }
  };

  const notifyAdmin = async (type: 'question' | 'community', content: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      
      const title = type === 'question' 
        ? (t('admin.notifications_question') || 'Nova dúvida na aula') 
        : (t('admin.notifications_community') || 'Nova atividade na comunidade');
      
      console.log('🔔 Chamando API de notificação para admin:', { title, type });

      // We directly call the API backend - the backend will find the admins to notify
      const response = await fetch('/api/v1/notifications?action=notify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          title,
          body: `${userData.name}: ${content.substring(0, 100)}${content.length > 100 ? '...' : ''}`
        })
      });

      if (!response.ok) {
         const errorData = await response.json().catch(() => ({}));
         console.error('Failed to notify admin via API:', response.status, errorData);
      } else {
         console.log('Admin notified successfully via API');
      }
    } catch (e) {
      console.error('Error notifying admin:', e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const questionText = newQuestion.trim();
    if (!questionText || sending) return;

    setSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Sessão expirada. Por favor, saia e entre novamente.');
      }
      
      const currentUserId = session.user.id;

      console.log('🔎 Enviando dúvida...', { chapter_id: chapterId, user_id: currentUserId });
      
      const { error } = await supabase.from('chapter_questions').insert({
        chapter_id: chapterId,
        user_id: currentUserId,
        user_name: userData.name,
        user_avatar_url: userData.avatar,
        question: questionText
      });

      if (error) {
        console.error('[ChapterQuestions] Erro no Banco de Dados:', error);
        throw new Error(error.message || 'Erro ao salvar sua dúvida');
      }

      toast.success(t('course.question_sent') || 'Dúvida enviada com sucesso!');
      
      // Notify Admin (async, don't block UI)
      notifyAdmin('question', questionText).catch(err => console.warn('Notification failed:', err));
      
      setNewQuestion('');
      fetchQuestions();
    } catch (error: any) {
      console.error('Error sending question:', error);
      toast.error(error.message || 'Erro ao enviar dúvida');
    } finally {
      setSending(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const locales: Record<string, any> = { ptBR, enUS, es };
      const locale = locales[t('community.locale') || 'ptBR'] || ptBR;
      return format(new Date(dateString), "d 'de' MMM, HH:mm", { locale });
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="w-full space-y-8 mt-12 mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex items-center gap-3 border-b border-white/5 pb-4">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
          <MessageSquare size={20} />
        </div>
        <h3 className="text-xl font-black uppercase italic tracking-tighter text-white">
          {t('course.questions_title') || 'Dúvidas sobre a Aula'}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="bg-zinc-900 border border-white/10 rounded-3xl p-6 space-y-4 shadow-2xl relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none" />
        
        <textarea
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder={t('course.question_placeholder') || 'Qual é a sua dúvida?'}
          className="w-full bg-black/40 border border-white/10 rounded-2xl p-4 text-white placeholder:text-gray-600 focus:border-primary/50 outline-none transition-all min-h-[100px] text-sm relative z-10"
        />
        
        <div className="flex justify-end relative z-10">
          <button
            type="submit"
            disabled={!newQuestion.trim() || sending}
            className="flex items-center gap-2 px-8 py-3 bg-primary hover:bg-primary-hover text-white font-black rounded-xl text-xs transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            {t('course.send_question') || 'ENVIAR DÚVIDA'}
          </button>
        </div>
      </form>

      <div className="space-y-6">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : questions.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-3xl border border-dashed border-white/10">
            <p className="text-gray-500 font-medium italic">
              {t('course.no_questions') || 'Nenhuma dúvida enviada ainda.'}
            </p>
          </div>
        ) : (
          questions.map((q) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              key={q.id}
              className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 space-y-4 hover:border-white/10 transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-zinc-800 flex items-center justify-center text-gray-500 border border-white/5 overflow-hidden">
                    {q.user_avatar_url ? (
                      <img src={q.user_avatar_url} alt={q.user_name} className="w-full h-full object-cover" />
                    ) : (
                      <UserIcon size={20} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-sm tracking-tight">{q.user_name}</h4>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">{formatDate(q.created_at)}</p>
                  </div>
                </div>
                {!q.answer && (
                  <div className="px-3 py-1 bg-yellow-500/10 text-yellow-500 text-[9px] font-black uppercase tracking-widest rounded-full border border-yellow-500/20 italic">
                    {t('course.waiting_answer') || 'Aguardando Resposta'}
                  </div>
                )}
              </div>

              <div className="bg-black/30 rounded-2xl p-4">
                <p className="text-gray-300 text-sm leading-relaxed">{q.question}</p>
              </div>

              <AnimatePresence>
                {q.answer && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="pt-4 border-t border-white/5 space-y-3"
                  >
                    <div className="flex items-center gap-2 text-primary">
                      <ShieldCheck size={14} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] italic">
                        {t('course.admin_answer') || 'Resposta do Professor'}
                      </span>
                    </div>
                    <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4">
                      <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                        {q.answer}
                      </p>
                      <div className="mt-2 flex items-center justify-end gap-2 text-[9px] font-black text-primary/40 uppercase tracking-widest italic">
                        <CheckCircle2 size={10} />
                        {t('course.answered_at') || 'Respondido em'} {formatDate(q.answered_at || q.updated_at)}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
