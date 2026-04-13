import React, { useState, useEffect } from 'react';
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
  Globe
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Module, Chapter, UserProgress } from '../types/lms';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import ReactPlayer from 'react-player';
import { useI18n } from '../contexts/I18nContext';

const Player = ReactPlayer as any;

interface CourseViewerProps {
  courseId: string;
  userId: string;
  onClose: () => void;
}

export default function CourseViewer({ courseId, userId, onClose, isProfessor = false }: CourseViewerProps & { isProfessor?: boolean }) {
  const { t } = useI18n();
  const [course, setCourse] = useState<Course | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetchCourseData();
  }, [courseId]);

  useEffect(() => {
    if (activeChapter) {
      console.log('Active Chapter changed:', {
        id: activeChapter.id,
        title: activeChapter.title,
        type: activeChapter.content_type,
        url: activeChapter.video_url || activeChapter.pdf_url
      });
    }
  }, [activeChapter]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      
      // Fetch course and modules first
      const { data: courseData, error: courseError } = await supabase.from('courses').select('*').eq('id', courseId).single();
      if (courseError) throw courseError;
      setCourse(courseData);

      const { data: modulesData, error: modulesError } = await supabase.from('modules').select('*').eq('course_id', courseId).order('order_index');
      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      const moduleIds = (modulesData || []).map(m => m.id);
      
      if (moduleIds.length > 0) {
        const { data: chaptersData, error: chaptersError } = await supabase
          .from('chapters')
          .select('*')
          .in('module_id', moduleIds)
          .order('order_index');
        
        if (chaptersError) throw chaptersError;
        setChapters(chaptersData || []);

        // Fetch progress
        const { data: progressData } = await supabase.from('user_progress').select('*').eq('user_id', userId);
        setProgress(progressData || []);

        // Set initial chapter
        const sortedChapters = [...(chaptersData || [])].sort((a, b) => {
          const modA = modulesData?.find(m => m.id === a.module_id)?.order_index || 0;
          const modB = modulesData?.find(m => m.id === b.module_id)?.order_index || 0;
          if (modA !== modB) return modA - modB;
          return a.order_index - b.order_index;
        });

        if (sortedChapters.length > 0) {
          const firstUncompleted = sortedChapters.find(ch => !progressData?.find(p => p.chapter_id === ch.id)?.completed);
          setActiveChapter(firstUncompleted || sortedChapters[0]);
        }
      }
    } catch (err) {
      console.error('Error fetching course data:', err);
      toast.error('Erro ao carregar curso');
    } finally {
      setLoading(false);
    }
  };

  const isChapterLocked = (chapter: Chapter) => {
    if (isProfessor) return false;
    
    const sortedChapters = [...chapters].sort((a, b) => {
      const modA = modules.find(m => m.id === a.module_id)?.order_index || 0;
      const modB = modules.find(m => m.id === b.module_id)?.order_index || 0;
      if (modA !== modB) return modA - modB;
      return a.order_index - b.order_index;
    });

    const index = sortedChapters.findIndex(ch => ch.id === chapter.id);
    if (index <= 0) return false;

    const previousChapter = sortedChapters[index - 1];
    const isPreviousCompleted = progress.find(p => p.chapter_id === previousChapter.id)?.completed;
    return !isPreviousCompleted;
  };

  const markAsCompleted = async (chapterId: string) => {
    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: userId,
          chapter_id: chapterId,
          completed: true,
          completed_at: new Date().toISOString()
        }, { onConflict: 'user_id,chapter_id' });

      if (error) {
        console.error('Error saving progress:', error);
        toast.error('Erro ao salvar progresso: ' + error.message);
        throw error;
      }
      
      setProgress(prev => {
        const existing = prev.find(p => p.chapter_id === chapterId);
        if (existing) return prev.map(p => p.chapter_id === chapterId ? { ...p, completed: true } : p);
        return [...prev, { user_id: userId, chapter_id: chapterId, completed: true }];
      });

      toast.success('Aula concluída!');
      
      // Auto-advance to next chapter
      const sortedChapters = [...chapters].sort((a, b) => {
        const modA = modules.find(m => m.id === a.module_id)?.order_index || 0;
        const modB = modules.find(m => m.id === b.module_id)?.order_index || 0;
        if (modA !== modB) return modA - modB;
        return a.order_index - b.order_index;
      });
      const currentIndex = sortedChapters.findIndex(ch => ch.id === chapterId);
      if (currentIndex < sortedChapters.length - 1) {
        setActiveChapter(sortedChapters[currentIndex + 1]);
      }
    } catch (err) {
      console.error('Error saving progress:', err);
      toast.error('Erro ao salvar progresso');
    }
  };

  const calculateProgress = () => {
    if (chapters.length === 0) return 0;
    const completedCount = progress.filter(p => p.completed).length;
    return Math.round((completedCount / chapters.length) * 100);
  };

  const renderVideo = () => {
    if (!activeChapter?.video_url) return null;

    const url = activeChapter.video_url;

    // YouTube detection
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      try {
        if (url.includes('v=')) {
          videoId = url.split('v=')[1].split('&')[0];
        } else if (url.includes('youtu.be/')) {
          videoId = url.split('youtu.be/')[1].split('?')[0];
        } else if (url.includes('youtube.com/shorts/')) {
          videoId = url.split('youtube.com/shorts/')[1].split('?')[0];
        } else if (url.includes('embed/')) {
          videoId = url.split('embed/')[1].split('?')[0];
        }
      } catch (e) {
        console.error('Error parsing YouTube ID:', e);
      }

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

    // Vimeo detection
    if (url.includes('vimeo.com')) {
      try {
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
      } catch (e) {
        console.error('Error parsing Vimeo ID:', e);
      }
    }

    // Google Drive detection
    if (url.includes('drive.google.com')) {
      try {
        let videoId = '';
        if (url.includes('/d/')) {
          videoId = url.split('/d/')[1].split('/')[0];
        } else if (url.includes('id=')) {
          videoId = url.split('id=')[1].split('&')[0];
        } else if (url.includes('/file/d/')) {
          videoId = url.split('/file/d/')[1].split('/')[0];
        }

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
      } catch (e) {
        console.error('Error parsing Google Drive ID:', e);
      }
    }

    // Fallback to ReactPlayer for MP4 and other formats
    return (
      <Player 
        key={url}
        url={url} 
        width="100%" 
        height="100%" 
        controls 
        playing
        playsinline
        onEnded={() => markAsCompleted(activeChapter.id)}
        onError={(e: any) => {
          console.error('Video Player Error:', e);
          toast.error('Erro ao carregar o vídeo. Verifique o link.');
        }}
      />
    );
  };

  if (loading) return <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center z-[200]"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>;

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] z-[200] flex flex-col text-white font-sans">
      {/* Header */}
      <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-6 bg-black/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </button>
          <div className="hidden md:block">
            <h2 className="text-sm font-bold text-white truncate max-w-[300px]">{course?.title}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <div className="w-32 h-1.5 bg-white/10 rounded-full overflow-hidden">
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

        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="md:hidden p-2 hover:bg-white/5 rounded-lg"
        >
          {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
            <CheckCircle2 size={14} className="text-primary" />
            <span className="text-xs font-bold">{progress.filter(p => p.completed).length}/{chapters.length}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar: Course Content */}
        <aside className={`
          absolute md:relative inset-y-0 left-0 z-50 w-full md:w-80 bg-zinc-900 border-r border-white/10 flex flex-col transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:-ml-80'}
        `}>
          <div className="p-4 border-b border-white/10">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Conteúdo do Curso</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {modules.map((module) => (
              <div key={module.id} className="space-y-1">
                <div className="px-3 py-2">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-tighter">{module.title}</h4>
                </div>
                <div className="space-y-0.5">
                  {chapters.filter(ch => ch.module_id === module.id).map((chapter, idx) => {
                    const isLocked = isChapterLocked(chapter);
                    const isCompleted = progress.find(p => p.chapter_id === chapter.id)?.completed;
                    const isActive = activeChapter?.id === chapter.id;

                    return (
                      <button
                        key={chapter.id}
                        disabled={isLocked}
                        onClick={() => {
                          setActiveChapter(chapter);
                          if (window.innerWidth < 768) setSidebarOpen(false);
                        }}
                        className={`
                          w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all group
                          ${isActive ? 'bg-primary/20 text-primary border border-primary/30' : 'text-gray-400 hover:bg-white/5 hover:text-white'}
                          ${isLocked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                        `}
                      >
                        <div className="shrink-0">
                          {isLocked ? <Lock size={14} /> : isCompleted ? <CheckCircle2 size={16} className="text-primary" /> : <span className="text-[10px] font-black w-4 text-center block">{idx + 1}</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{chapter.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {chapter.content_type === 'video' && <PlayCircle size={10} />}
                            {chapter.content_type === 'pdf' && <FileText size={10} />}
                            {chapter.content_type === 'text' && <Type size={10} />}
                            <span className="text-[9px] uppercase font-black opacity-50">{chapter.duration_minutes} min</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main Content: Player & Details */}
        <main className="flex-1 overflow-y-auto bg-black flex flex-col">
          <div className="flex-1 flex flex-col">
            {/* Content Display */}
            <div className="aspect-video bg-zinc-900 relative group">
              {activeChapter?.content_type === 'video' && activeChapter.video_url ? (
                <>
                  {renderVideo()}
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all z-10">
                    <a 
                      href={activeChapter.video_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="bg-black/60 backdrop-blur-md text-white p-2 rounded-lg flex items-center gap-2 text-[10px] font-bold hover:bg-primary transition-all"
                    >
                      <Globe size={14} /> ABRIR EM NOVA ABA
                    </a>
                  </div>
                </>
              ) : activeChapter?.content_type === 'pdf' ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <FileText size={80} className="text-primary mb-6" />
                  <h3 className="text-2xl font-bold mb-4">{activeChapter.title}</h3>
                  <p className="text-gray-400 mb-8 max-w-md">Esta aula contém um material em PDF para leitura e acompanhamento.</p>
                  <a 
                    href={activeChapter.pdf_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-white text-black px-8 py-4 rounded-2xl font-bold flex items-center gap-3 hover:scale-105 transition-all"
                  >
                    <FileText size={20} /> Abrir Material PDF
                  </a>
                </div>
              ) : (
                <div className="h-full flex items-center justify-center">
                  <p className="text-gray-500 italic">Selecione uma aula para começar</p>
                </div>
              )}
            </div>

            {/* Lesson Info */}
            <div className="p-6 md:p-10 max-w-4xl mx-auto w-full space-y-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{activeChapter?.title}</h1>
                  <div className="flex items-center gap-4 text-gray-500 text-sm">
                    <span className="flex items-center gap-1.5"><Clock size={14} /> {activeChapter?.duration_minutes} minutos</span>
                    <span className="flex items-center gap-1.5 capitalize"><Layout size={14} /> {activeChapter?.content_type}</span>
                  </div>
                </div>
                
                {!progress.find(p => p.chapter_id === activeChapter?.id)?.completed && (
                  <button 
                    onClick={() => activeChapter && markAsCompleted(activeChapter.id)}
                    className="bg-primary hover:bg-primary-hover text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 transition-all active:scale-95"
                  >
                    <CheckCircle2 size={20} /> Concluir Aula
                  </button>
                )}
              </div>

              <div 
                className="prose prose-invert max-w-none text-gray-300 leading-relaxed text-lg"
                dangerouslySetInnerHTML={{ __html: activeChapter?.rich_text || '' }}
              />

              {/* Navigation */}
              <div className="pt-12 border-t border-white/10 flex items-center justify-between">
                <button className="flex items-center gap-2 text-gray-500 hover:text-white font-bold transition-all">
                  <ChevronLeft size={20} /> Aula Anterior
                </button>
                <button className="flex items-center gap-2 text-primary hover:text-primary-hover font-bold transition-all">
                  Próxima Aula <ChevronRight size={20} />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
