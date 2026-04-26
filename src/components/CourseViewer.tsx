import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
  Lock, 
  PlayCircle, 
  FileText, 
  Type,
  Menu,
  X,
  Clock,
  ArrowLeft,
  Layout,
  Loader2,
  Globe,
  Phone,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Module, Chapter, UserProgress } from '../types/lms';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import ReactPlayer from 'react-player';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';
import FloatingWhatsApp from './FloatingWhatsApp';

interface CourseViewerProps {
  courseId: string;
  userId: string;
  onClose: () => void;
}

export default function CourseViewer({ courseId, userId, onClose, isProfessor = false }: CourseViewerProps & { isProfessor?: boolean }) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'player'>('grid');
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => {
      const modA = modules.find(m => m.id === a.module_id)?.order_index || 0;
      const modB = modules.find(m => m.id === b.module_id)?.order_index || 0;
      if (modA !== modB) return modA - modB;
      return a.order_index - b.order_index;
    });
  }, [chapters, modules]);

  const isChapterLocked = useCallback((chapter: Chapter) => {
    return false; // All lessons are released according to user request
  }, []);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      console.log('🚀 Loading course:', courseId);
      
      const [courseRes, modulesRes, progressRes] = await Promise.all([
        supabase.from('courses').select('*').eq('id', courseId).single(),
        supabase.from('modules').select('*').eq('course_id', courseId).order('order_index'),
        supabase.from('user_progress').select('*').eq('user_id', userId)
      ]);

      if (courseRes.error) {
        console.error('Course fetch error:', courseRes.error);
        throw new Error('Curso não encontrado');
      }
      
      const courseData = courseRes.data;
      const modulesData = modulesRes.data || [];
      const progressData = progressRes.data || [];

      setCourse(courseData);
      setModules(modulesData);
      setProgress(progressData);

      const moduleIds = modulesData.map(m => m.id);
      
      if (moduleIds.length > 0) {
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('*')
          .in('module_id', moduleIds)
          .order('order_index');
        
        if (chaptersError) {
          console.error('Chapters fetch error:', chaptersError);
          throw chaptersError;
        }
        
        const finalChapters = chaptersData || [];
        setChapters(finalChapters);

        if (finalChapters.length === 1) {
          setActiveChapter(finalChapters[0]);
          setViewMode('player');
        } else {
          setViewMode('grid');
        }
      }
    } catch (err: any) {
      console.error('❌ Error in CourseViewer fetch:', err);
      toast.error(err.message || 'Erro ao carregar curso');
      if (err.message === 'Curso não encontrado') onClose();
    } finally {
      setLoading(false);
    }
  };

  const toggleCompletion = async (chapterId: string) => {
    try {
      const isCurrentlyCompleted = !!progress.find(p => p.chapter_id === chapterId)?.completed;
      const targetState = !isCurrentlyCompleted;

      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          chapter_id: chapterId,
          completed: targetState
        }, { onConflict: 'user_id,chapter_id' });

      if (error) throw error;
      
      setProgress(prev => {
        const exists = prev.some(p => p.chapter_id === chapterId);
        if (exists) {
          return prev.map(p => p.chapter_id === chapterId ? { ...p, completed: targetState } : p);
        }
        return [...prev, { user_id: userId, chapter_id: chapterId, completed: targetState }];
      });

      if (targetState) {
        toast.success(t('course.lesson_completed') || 'Aula concluída!');
      } else {
        toast.info(t('course.lesson_unmarked') || 'Aula marcada como não concluída');
      }
    } catch (err) {
      console.error('Error toggling progress:', err);
      toast.error('Erro ao atualizar progresso');
    }
  };

  const calculateProgress = () => {
    if (chapters.length === 0) return 0;
    const courseChapterIds = new Set(chapters.map(ch => ch.id));
    const completedInCourse = progress.filter(p => p.completed && courseChapterIds.has(p.chapter_id)).length;
    return Math.min(100, Math.round((completedInCourse / chapters.length) * 100));
  };

  const renderVideo = () => {
    if (!activeChapter?.video_url || activeChapter.video_url === 'undefined') return null;

    const url = activeChapter.video_url;

    // YouTube, Vimeo, and Drive logic kept as before
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
      else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
      else if (url.includes('youtube.com/shorts/')) videoId = url.split('youtube.com/shorts/')[1].split('?')[0];
      else if (url.includes('embed/')) videoId = url.split('embed/')[1].split('?')[0];

      if (videoId) {
        return (
          <iframe
            key={videoId}
            src={`https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&autoplay=1`}
            className="w-full h-full border-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        );
      }
    }

    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1].split('?')[0];
      if (videoId) {
        return (
          <iframe
            key={videoId}
            src={`https://player.vimeo.com/video/${videoId}?autoplay=1&dnt=1`}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
          />
        );
      }
    }

    if (url.includes('drive.google.com')) {
      let videoId = '';
      if (url.includes('/d/')) videoId = url.split('/d/')[1].split('/')[0];
      else if (url.includes('id=')) videoId = url.split('id=')[1].split('&')[0];
      else if (url.includes('/file/d/')) videoId = url.split('/file/d/')[1].split('/')[0];

      if (videoId) {
        return (
          <iframe
            key={videoId}
            src={`https://drive.google.com/file/d/${videoId}/preview`}
            className="w-full h-full border-0"
            allow="autoplay; encrypted-media"
            allowFullScreen
          />
        );
      }
    }

    const PlayerComponent = ReactPlayer as any;
    return (
      <div className="w-full h-full flex items-center justify-center bg-black">
        <PlayerComponent 
          key={url}
          url={url} 
          width="100%" 
          height="100%" 
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          controls 
          playing
          playsinline
          onEnded={() => {
            if (activeChapter) {
              const isCompleted = progress.find(p => p.chapter_id === activeChapter.id)?.completed;
              if (!isCompleted) toggleCompletion(activeChapter.id);
            }
          }}
        />
      </div>
    );
  };

  const SupportSection = () => {
    const whatsappEnabled = settings.support_whatsapp_course_enabled && settings.support_whatsapp;
    const emailEnabled = settings.support_email_course_enabled && settings.support_email;

    if (!whatsappEnabled && !emailEnabled) return null;

    return (
      <div className="p-6 md:p-10 border-t border-white/5">
        <div className="bg-zinc-900 border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">
              {t('auth.support_box')}
            </h3>
            <p className="text-gray-500 text-sm font-medium">{t('course.support_description') || 'Nossa equipe está pronta para te ajudar.'}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {whatsappEnabled && settings.support_whatsapp && (
              <a 
                href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, '')}${settings.support_whatsapp_message ? `?text=${encodeURIComponent(settings.support_whatsapp_message)}` : ''}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-black rounded-xl text-xs transition-all active:scale-95"
              >
                <Phone size={16} /> {t('auth.whatsapp_label')}
              </a>
            )}
            {emailEnabled && settings.support_email && (
              <a 
                href={`mailto:${settings.support_email}`}
                className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white font-black rounded-xl border border-white/10 text-xs transition-all active:scale-95"
              >
                <Mail size={16} /> {t('auth.email_label')}
              </a>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="fixed inset-0 bg-bg-main flex flex-col items-center justify-center z-[200]">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-bg-main z-[200] flex flex-col text-white font-sans overflow-hidden">
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-6 bg-black/40 backdrop-blur-md shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={viewMode === 'player' && chapters.length > 1 ? () => setViewMode('grid') : onClose} 
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-[300px]">{course?.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-24 sm:w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${calculateProgress()}%` }}
                   className="h-full bg-primary"
                />
              </div>
              <span className="text-[10px] font-black text-gray-500 uppercase">{calculateProgress()}% {t('course.progress')}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <CheckCircle2 size={14} className="text-primary" />
            <span className="text-xs font-bold">{progress.filter(p => p.completed).length}/{chapters.length}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-hide relative bg-bg-main">
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-7xl mx-auto w-full p-6 sm:p-10 pb-32"
            >
              <div className="mb-12 flex flex-col md:flex-row gap-8 items-start">
                <div className="w-full md:w-80 shrink-0 aspect-[2/3] rounded-3xl overflow-hidden shadow-2xl border border-white/10">
                  <img src={course?.cover_url} className="w-full h-full object-cover" alt={course?.title} referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1 space-y-4">
                  <h1 className="text-4xl sm:text-5xl font-black italic uppercase tracking-tighter leading-[0.9]">{course?.title}</h1>
                  <p className="text-gray-400 text-lg max-w-2xl font-medium">{course?.description}</p>
                  <div className="flex items-center gap-8 pt-6">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{t('course.your_progress') || 'Seu Progresso'}</span>
                      <span className="text-3xl font-black text-primary italic leading-none">{calculateProgress()}%</span>
                    </div>
                    <div className="w-px h-10 bg-white/10" />
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{t('course.lessons') || 'Aulas'}</span>
                      <span className="text-3xl font-black text-white italic leading-none">{chapters.length}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-16">
                {modules.map((module) => (
                  <div key={module.id} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <div className="h-px flex-1 bg-white/10" />
                      <h3 className="text-[11px] font-black text-primary uppercase tracking-[0.4em] px-4 italic">
                        {module.title === 'Conteúdo' ? (t('course.content') || 'Conteúdo') : module.title}
                      </h3>
                      <div className="h-px flex-1 bg-white/10" />
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
                      {sortedChapters.filter(ch => ch.module_id === module.id).map((chapter, idx) => {
                        const isCompleted = progress.find(p => p.chapter_id === chapter.id)?.completed;
                        
                        return (
                          <motion.button
                            whileHover={{ y: -5 }}
                            whileTap={{ scale: 0.98 }}
                            key={chapter.id}
                            onClick={() => {
                              setActiveChapter(chapter);
                              setViewMode('player');
                            }}
                            className="group relative flex flex-col text-left transition-all"
                          >
                            <div className="relative aspect-[16/10] rounded-2xl overflow-hidden mb-3 border border-white/10 shadow-lg bg-zinc-900">
                              <img 
                                src={chapter.cover_url || course?.cover_url} 
                                className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" 
                                alt={chapter.title} 
                                referrerPolicy="no-referrer"
                              />
                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className="w-10 h-10 rounded-full border border-white/20 bg-black/40 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 group-hover:bg-primary transition-all">
                                  {chapter.content_type === 'video' ? <PlayCircle size={20} className="text-white ml-0.5" /> : chapter.content_type === 'pdf' ? <FileText size={20} className="text-white" /> : <Type size={20} className="text-white" />}
                                </div>
                              </div>
                              {isCompleted && (
                                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full p-1 shadow-lg">
                                  <CheckCircle2 size={12} />
                                </div>
                              )}
                              <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-[8px] font-black px-1.5 py-0.5 rounded border border-white/10">
                                {chapter.duration_minutes} MIN
                              </div>
                            </div>
                            <h4 className="font-bold text-xs text-shite line-clamp-2 leading-tight pr-4 transition-colors group-hover:text-primary">
                              {idx + 1}. {chapter.title}
                            </h4>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              <SupportSection />
            </motion.div>
          ) : (
            <motion.div
              key="player"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="min-h-full w-full bg-bg-main flex flex-col overflow-y-auto custom-scrollbar"
            >
              {/* Header Info */}
              <div className="max-w-4xl mx-auto w-full px-6 pt-20 pb-12 text-center space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h1 className="text-4xl md:text-6xl font-serif font-black leading-tight text-white mb-4">
                    {activeChapter?.title}
                  </h1>
                  <p className="text-gray-500 text-lg md:text-xl font-medium max-w-2xl mx-auto">
                    {activeChapter?.description || course?.description}
                  </p>
                </motion.div>
              </div>

              {/* Video Player Section with Elegant Frame */}
              <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 relative group">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="relative aspect-video rounded-[2.5rem] overflow-hidden border border-white/10 shadow-[0_0_50px_-12px_rgba(255,255,255,0.1)] bg-zinc-950"
                >
                  {activeChapter?.content_type === 'video' ? (
                    <div className="w-full h-full">{renderVideo()}</div>
                  ) : activeChapter?.content_type === 'pdf' ? (
                    <div className="w-full h-full relative">
                      <iframe 
                        src={`${activeChapter.pdf_url}#toolbar=0&navpanes=0&scrollbar=0`}
                        className="w-full h-full border-0 hidden sm:block"
                        title={activeChapter.title}
                      />
                      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-8 text-center sm:hidden">
                        <FileText size={64} className="text-primary mb-4 mx-auto" strokeWidth={1} />
                        <h3 className="text-xl font-bold mb-2 uppercase tracking-wide">{activeChapter.title}</h3>
                        <a 
                          href={activeChapter.pdf_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="bg-white text-black px-8 py-3 rounded-2xl font-black flex items-center justify-center gap-3 hover:scale-105 transition-all text-sm uppercase"
                        >
                          <FileText size={18} /> Abrir Material PDF
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-gray-500 italic">{t('course.no_media') || 'Aula sem conteúdo de mídia'}</p>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Action Area */}
              <div className="max-w-4xl mx-auto w-full px-6 py-16 space-y-12">
                {/* Completion Button */}
                <div className="flex justify-center">
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    onClick={() => activeChapter && toggleCompletion(activeChapter.id)}
                    className={`
                      px-12 py-5 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] uppercase tracking-widest text-sm
                      ${progress.find(p => p.chapter_id === activeChapter?.id)?.completed 
                        ? 'bg-zinc-800 text-green-500 border border-green-500/30' 
                        : 'bg-white text-black hover:bg-gray-100 shadow-[0_20px_40px_-15px_rgba(255,255,255,0.2)]'}
                    `}
                  >
                    {progress.find(p => p.chapter_id === activeChapter?.id)?.completed ? (
                      <><CheckCircle2 size={20} /> {t('course.lesson_completed_btn') || 'AULA CONCLUÍDA'}</>
                    ) : (
                      t('course.complete_lesson_btn') || 'CONCLUIR AULA'
                    )}
                  </motion.button>
                </div>

                {/* Navigation Controls */}
                <div className="pt-8 border-t border-white/5 grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => {
                      const idx = sortedChapters.findIndex(ch => ch.id === activeChapter?.id);
                      if (idx > 0) setActiveChapter(sortedChapters[idx - 1]);
                    }}
                    disabled={sortedChapters.findIndex(ch => ch.id === activeChapter?.id) === 0}
                    className="flex flex-col items-start gap-1 p-6 bg-white/5 hover:bg-white/10 rounded-3xl transition-all disabled:opacity-20 group text-left"
                  >
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-primary transition-colors flex items-center gap-1">
                      <ChevronLeft size={12} /> {t('course.prev_lesson') || 'Aula Anterior'}
                    </span>
                    <span className="text-sm font-bold text-white line-clamp-1">
                      {sortedChapters[sortedChapters.findIndex(ch => ch.id === activeChapter?.id) - 1]?.title || t('nav.home') || 'Início'}
                    </span>
                  </button>

                  <button 
                    onClick={() => {
                      const idx = sortedChapters.findIndex(ch => ch.id === activeChapter?.id);
                      if (idx < sortedChapters.length - 1) setActiveChapter(sortedChapters[idx + 1]);
                    }}
                    disabled={sortedChapters.findIndex(ch => ch.id === activeChapter?.id) === sortedChapters.length - 1}
                    className="flex flex-col items-end gap-1 p-6 bg-white/5 hover:bg-white/10 rounded-3xl transition-all disabled:opacity-20 group text-right"
                  >
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-primary transition-colors flex items-center gap-1">
                      {t('course.next_lesson') || 'Próxima Aula'} <ChevronRight size={12} />
                    </span>
                    <span className="text-sm font-bold text-white line-clamp-1">
                      {sortedChapters[sortedChapters.findIndex(ch => ch.id === activeChapter?.id) + 1]?.title || t('course.end_label') || 'Fim'}
                    </span>
                  </button>
                </div>

                {/* Support Section */}
                <SupportSection />

                {/* Lesson List (Sitemap feel) */}
                {chapters.length > 1 && (
                  <div className="pt-16 border-t border-white/5">
                    <h3 className="text-[10px] font-black text-gray-600 uppercase tracking-widest mb-8 text-center italic">{t('course.schedule_title') || 'Cronograma do Curso'}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sortedChapters.map((chapter, idx) => {
                        const isActive = activeChapter?.id === chapter.id;
                        const isCompleted = progress.find(p => p.chapter_id === chapter.id)?.completed;
                        
                        return (
                          <button
                            key={chapter.id}
                            onClick={() => setActiveChapter(chapter)}
                            className={`
                              w-full flex items-center gap-4 p-4 rounded-2xl text-left transition-all border
                              ${isActive ? 'bg-white/5 border-white/20' : 'bg-transparent border-transparent hover:bg-white/5'}
                            `}
                          >
                            <div className="w-8 h-8 rounded-full bg-zinc-900 flex items-center justify-center shrink-0 border border-white/5">
                              {isCompleted ? <CheckCircle2 size={16} className="text-green-500" /> : <span className="text-[10px] font-black text-gray-500">{idx + 1}</span>}
                            </div>
                            <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-gray-500'}`}>
                              {chapter.title}
                            </span>
                            {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
              
              <FloatingWhatsApp page="course" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <FloatingWhatsApp page="course" />
    </div>
  );
}
