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
  Mail,
  Maximize2,
  Play,
  AlertCircle
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
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCourseData();
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo(0, 0);
    }
  }, [courseId]);

  useEffect(() => {
    if (activeChapter && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [activeChapter]);

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

  const markChapterComplete = async (chapterId: string) => {
    try {
      const isCurrentlyCompleted = !!progress.find(p => p.chapter_id === chapterId)?.completed;
      if (isCurrentlyCompleted) return;

      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          chapter_id: chapterId,
          completed: true
        }, { onConflict: 'user_id,chapter_id' });

      if (error) throw error;
      
      setProgress(prev => {
        const exists = prev.some(p => p.chapter_id === chapterId);
        if (exists) {
          return prev.map(p => p.chapter_id === chapterId ? { ...p, completed: true } : p);
        }
        return [...prev, { user_id: userId, chapter_id: chapterId, completed: true }];
      });

      toast.success(t('course.lesson_completed') || 'Aula concluída!');
    } catch (err) {
      console.error('Error marking progress:', err);
    }
  };

  const courseChapterIds = useMemo(() => new Set(chapters.map(ch => ch.id)), [chapters]);

  const completedChaptersCount = useMemo(() => {
    const completedChapterIds = new Set(
      progress
        .filter(p => p.completed && courseChapterIds.has(p.chapter_id))
        .map(p => p.chapter_id)
    );
    return completedChapterIds.size;
  }, [progress, courseChapterIds]);

  const calculateProgress = useCallback(() => {
    if (chapters.length === 0) return 0;
    return Math.min(100, Math.round((completedChaptersCount / chapters.length) * 100));
  }, [chapters.length, completedChaptersCount]);

  const renderVideo = () => {
    if (!activeChapter?.video_url || activeChapter.video_url === 'undefined') return null;

    const url = activeChapter.video_url;
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    let content = null;
    let videoRef: any = null;

    // Handle YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
      else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
      else if (url.includes('youtube.com/shorts/')) videoId = url.split('youtube.com/shorts/')[1].split('?')[0];
      else if (url.includes('embed/')) videoId = url.split('embed/')[1].split('?')[0];

      if (videoId) {
        content = (
          <iframe
            key={videoId}
            src={`https://www.youtube.com/embed/${videoId}?modestbranding=1&rel=0&autoplay=1&playsinline=1`}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            title={activeChapter.title}
          />
        );
      }
    }
    // Handle Vimeo
    else if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1].split('?')[0];
      if (videoId) {
        content = (
          <iframe
            key={videoId}
            src={`https://player.vimeo.com/video/${videoId}?autoplay=1&dnt=1&playsinline=1`}
            className="w-full h-full border-0 absolute inset-0"
            allow="autoplay; fullscreen; picture-in-picture"
            title={activeChapter.title}
          />
        );
      }
    }
    // Handle Google Drive
    else if (url.includes('drive.google.com')) {
      let videoId = '';
      if (url.includes('/d/')) videoId = url.split('/d/')[1].split('/')[0];
      else if (url.includes('id=')) videoId = url.split('id=')[1].split('&')[0];
      else if (url.includes('/file/d/')) videoId = url.split('/file/d/')[1].split('/')[0];

      if (videoId) {
        content = (
          <iframe
            key={videoId}
            src={`https://drive.google.com/file/d/${videoId}/preview`}
            className="w-full h-full border-0 absolute inset-0"
            allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
            title={activeChapter.title}
          />
        );
      }
    }
    // OneDrive Support
    else if (url.includes('onedrive.live.com') || url.includes('1drv.ms')) {
      let embedUrl = url;
      if (url.includes('1drv.ms')) {
        embedUrl = url.replace('redir', 'embed').replace('view.aspx', 'embed.aspx');
      } else if (url.includes('onedrive.live.com') && !url.includes('embed')) {
        embedUrl = url.replace('view.aspx', 'embed.aspx').replace('redir', 'embed');
      }

      if (embedUrl.includes('?')) {
        if (!embedUrl.includes('nav=0')) embedUrl += '&nav=0';
      } else {
        embedUrl += '?nav=0';
      }

      content = (
        <iframe
          src={embedUrl}
          className="w-full h-full border-0 absolute inset-0"
          frameBorder="0"
          scrolling="no"
          allowFullScreen
          title={activeChapter.title}
          sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
        />
      );
    }
    // Cloudflare R2 or direct video links
    else if (url.includes('r2.dev') || url.match(/\.(mp4|webm|ogg)$/i)) {
      content = (
        <video
          src={url}
          controls
          autoPlay
          playsInline
          className="w-full h-full"
          onEnded={() => {
            if (activeChapter) {
              markChapterComplete(activeChapter.id);
            }
          }}
        />
      );
    }
    // Fallback to ReactPlayer
    else {
      const PlayerComponent = ReactPlayer as any;
      content = (
        <PlayerComponent 
          key={url}
          url={url} 
          width="100%" 
          height="100%" 
          style={{ position: 'absolute', top: 0, left: 0 }}
          controls 
          playing
          playsinline
          onEnded={() => {
            if (activeChapter) {
              markChapterComplete(activeChapter.id);
            }
          }}
        />
      );
    }

    const handleFullscreen = (e: React.MouseEvent) => {
      const container = e.currentTarget.parentElement?.parentElement;
      if (!container) return;
      
      const media = container.querySelector('video') || container.querySelector('iframe') || container.querySelector('div[style*="absolute"]');
      if (media) {
        if (media.requestFullscreen) media.requestFullscreen();
        else if ((media as any).webkitRequestFullscreen) (media as any).webkitRequestFullscreen();
        else if ((media as any).mozRequestFullScreen) (media as any).mozRequestFullScreen();
        else if ((media as any).msRequestFullscreen) (media as any).msRequestFullscreen();
        // Special case for mobile video elements that don't support the standard API directly on the container
        const videoElement = media.querySelector('video') || (media.tagName === 'VIDEO' ? media : null);
        if (videoElement && (videoElement as any).webkitEnterFullscreen) {
          (videoElement as any).webkitEnterFullscreen();
        }
      }
    };

    return (
      <div className="absolute inset-0 bg-black group/video-container overflow-hidden rounded-xl">
        {content}
        
        {/* OneDrive specific overlay remains if needed */}
        {(url.includes('onedrive.live.com') || url.includes('1drv.ms')) && (
          <div className="absolute bottom-0 right-0 w-32 h-12 z-10 pointer-events-none" />
        )}
      </div>
    );
  };

  const renderPdf = () => {
    if (!activeChapter?.pdf_url) return null;
    
    // Simple mobile detection
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // URL Encoding for special characters in R2 filenames
    const encodedUrl = encodeURIComponent(activeChapter.pdf_url);
    const googleDocsViewer = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
    
    // On mobile, Google Docs Viewer is sometimes more stable for rendering inside an iframe
    // On desktop, the native browser viewer is much more powerful and handles R2 links natively
    // We add PDF parameters to hide UI elements and navigation panes (chapters)
    const desktopUrl = activeChapter.pdf_url.includes('#') 
      ? activeChapter.pdf_url 
      : `${activeChapter.pdf_url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&pagemode=none`;
    
    const viewerUrl = isMobileDevice ? googleDocsViewer : desktopUrl;

    return (
      <div className="w-full h-full relative group/pdf bg-black overflow-hidden rounded-xl">
        <iframe 
          key={activeChapter.id}
          src={viewerUrl}
          className="w-full h-full border-none"
          title={activeChapter.title}
          allow="fullscreen"
        />
        
        {/* Fullscreen Trigger Overlay - Open in new tab for better visibility if iframe fails */}
        <div className="absolute top-4 right-4 z-50">
          <button 
            onClick={() => {
              window.open(activeChapter.pdf_url!, '_blank');
              markChapterComplete(activeChapter.id);
            }}
            className="bg-black/60 backdrop-blur-md text-white p-3 rounded-2xl hover:bg-black/80 transition-all hover:scale-110 active:scale-95 border border-white/20 shadow-2xl flex items-center justify-center group/btn"
            title={t('course.view_fullscreen') || "Ver em Tela Cheia"}
          >
            <Maximize2 size={24} className="drop-shadow-lg text-white group-hover/btn:scale-110 transition-transform" />
          </button>
        </div>
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
      <header className="h-16 sm:h-20 border-b border-white/5 flex items-center justify-between px-6 bg-black/80 backdrop-blur-2xl shrink-0 z-50">
        <div className="flex items-center">
          <button 
            onClick={viewMode === 'player' && chapters.length > 1 ? () => setViewMode('grid') : onClose} 
            className="group relative p-3 hover:bg-white/10 rounded-2xl transition-all active:scale-95 bg-white/5 border border-white/10 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <ArrowLeft size={18} className="text-white/80 relative z-10" />
          </button>
        </div>

        <div className="flex-1 max-w-sm mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between">
             <span className="text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">
                {completedChaptersCount} / {chapters.length} {t('course.lessons') || 'Aulas'}
              </span>
              <span className={`text-xs font-black italic leading-none ${
                calculateProgress() === 100 ? 'text-green-500' : 
                calculateProgress() === 0 ? 'text-yellow-500' : 'text-blue-500'
              }`}>{calculateProgress()}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${calculateProgress()}%` }}
               className={`h-full shadow-lg transition-all duration-1000 ${
                 calculateProgress() === 100 ? 'bg-green-500 shadow-green-500/20' : 
                 calculateProgress() === 0 ? 'bg-yellow-500 shadow-yellow-500/20' : 'bg-blue-700 shadow-blue-700/20'
               }`}
            />
          </div>
        </div>

        <div className="w-[44px] sm:w-[50px]" /> {/* Spacer to balance back button */}
      </header>

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto scrollbar-hide relative bg-bg-main"
      >
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            <motion.div
              key="grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-7xl mx-auto w-full p-6 sm:p-12 pb-32"
            >
              <div className="mb-16 space-y-4 text-center">
                <h1 className="text-4xl sm:text-7xl font-black italic uppercase tracking-tighter leading-[0.85] bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{course?.title}</h1>
                <p className="text-gray-400 text-lg sm:text-xl max-w-3xl mx-auto font-medium leading-relaxed">{course?.description}</p>
              </div>

              <div className="space-y-24">
                {modules.map((module, mIdx) => (
                  <div key={module.id} className="space-y-10 group/module">
                    {module.title === 'Conteúdo' ? (
                      <div className="flex flex-col items-center gap-4 border-b border-white/5 pb-10">
                        <div className="flex items-center gap-4">
                          <div className="h-px w-20 bg-gradient-to-r from-transparent to-primary/40" />
                          <span className="text-[12px] font-black text-primary uppercase tracking-[0.5em] italic">
                            {t('course.content') || 'CONTEÚDO'}
                          </span>
                          <div className="h-px w-20 bg-gradient-to-l from-transparent to-primary/40" />
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-end gap-6 border-b border-white/5 pb-6">
                        <span className="text-6xl font-black text-white/5 italic leading-none select-none">{(mIdx + 1).toString().padStart(2, '0')}</span>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] font-black text-primary uppercase tracking-widest italic">
                            {t('course.module') || 'MÓDULO'} {mIdx + 1}
                          </span>
                          <h3 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tighter leading-none">
                            {module.title}
                          </h3>
                        </div>
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-8 gap-y-12">
                      {sortedChapters.filter(ch => ch.module_id === module.id).map((chapter, idx) => {
                        const isCompleted = progress.find(p => p.chapter_id === chapter.id)?.completed;
                        
                        return (
                          <motion.button
                            whileHover={{ y: -8, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            key={chapter.id}
                            onClick={() => {
                              setActiveChapter(chapter);
                              setViewMode('player');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="group relative flex flex-col text-left transition-all"
                          >
                            <div className={`relative aspect-[16/9] rounded-3xl overflow-hidden mb-5 border-2 shadow-2xl bg-zinc-900 transition-all duration-500 ${isCompleted ? 'border-green-500/30' : 'border-white/5 group-hover:border-primary/50'}`}>
                              {chapter.cover_url ? (
                                <img 
                                  src={chapter.cover_url} 
                                  className={`w-full h-full object-cover transition-all duration-700 ${isCompleted ? 'opacity-30 grayscale-[50%]' : 'opacity-40 group-hover:opacity-60 group-hover:scale-110'}`} 
                                  alt={chapter.title} 
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full bg-zinc-950 flex items-center justify-center opacity-40 group-hover:opacity-60 transition-opacity">
                                  <PlayCircle size={40} className="text-white/10" />
                                </div>
                              )}
                              
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

                              <div className="absolute inset-0 flex items-center justify-center">
                                <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center transition-all duration-500 backdrop-blur-md ${isCompleted ? 'bg-green-500 border-green-400 scale-90' : 'bg-black/40 border-white/20 group-hover:bg-primary group-hover:border-primary group-hover:rotate-0'}`}>
                                  {isCompleted ? (
                                    <CheckCircle2 size={28} className="text-white" />
                                  ) : chapter.content_type === 'video' ? (
                                    <Play size={24} className="text-white fill-white ml-1" />
                                  ) : chapter.content_type === 'pdf' ? (
                                    <FileText size={24} className="text-white" />
                                  ) : (
                                    <Type size={24} className="text-white" />
                                  )}
                                </div>
                              </div>

                              {isCompleted && (
                                <div className="absolute top-4 left-4 bg-green-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-lg italic">
                                  {t('course.completed')}
                                </div>
                              )}

                              <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-[10px] font-black text-white/80 px-2 py-1 rounded-lg border border-white/10 uppercase tracking-widest italic">
                                {chapter.duration_minutes} MIN
                              </div>
                            </div>
                            
                            <div className="space-y-1.5 px-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic leading-none">
                                  {chapter.content_type === 'video' ? 'Videoaula' : chapter.content_type === 'pdf' ? 'Material PDF' : 'Leitura'}
                                </span>
                                {isCompleted && <div className="w-1 h-1 rounded-full bg-green-500" />}
                              </div>
                              <h4 className={`text-lg font-black uppercase italic tracking-tight leading-[1.1] transition-colors group-hover:text-primary ${isCompleted ? 'text-white/40' : 'text-white'}`}>
                                <span className="text-primary/40 mr-1.5 opacity-50">{(idx + 1).toString().padStart(2, '0')}.</span>
                                {chapter.title}
                              </h4>
                            </div>
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
              <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 relative">
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="relative aspect-video overflow-hidden border border-white/20 bg-black shadow-[0_0_60px_-15px_rgba(255,255,255,0.1)]"
                >
                  {activeChapter?.content_type === 'video' ? (
                    renderVideo()
                  ) : activeChapter?.content_type === 'pdf' ? (
                    renderPdf()
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
