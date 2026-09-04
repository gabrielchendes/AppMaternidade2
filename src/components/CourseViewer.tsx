import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
  Mail,
  Maximize2,
  Play,
  AlertCircle,
  ExternalLink,
  CheckSquare,
  Puzzle
} from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Module, Chapter, UserProgress } from '../types/lms';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { showToast } from '../lib/customToast';
import ReactPlayer from 'react-player';
import { useI18n } from '../contexts/I18nContext';
import { useSettings } from '../contexts/SettingsContext';
import ChapterQuestions from './ChapterQuestions';
import FloatingWhatsApp from './FloatingWhatsApp';
import SupportSection from './SupportSection';
import PullToRefresh from './PullToRefresh';
import { InteractiveChecklist } from './InteractiveChecklist';
import { BlockLessonViewer } from './BlockLessonViewer';
import HtmlAppViewer from './HtmlAppViewer';
import { fromDbChapter, isHtmlAppChapter, extractHtmlAppContent } from '../utils/htmlAppHelper';

import { dataCache } from '../lib/cache';

interface CourseViewerProps {
  courseId: string;
  userId: string;
  onClose: () => void;
  initialCourse?: Course | null;
  isProfessor?: boolean;
}

export default function CourseViewer({ courseId, userId, onClose, initialCourse, isProfessor = false }: CourseViewerProps) {
  const { t } = useI18n();
  const { settings } = useSettings();
  const [course, setCourse] = useState<Course | null>(initialCourse || null);
  const [modules, setModules] = useState<Module[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [progress, setProgress] = useState<UserProgress[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'player'>('grid');
  const [activeChapter, setActiveChapter] = useState<Chapter | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    }
  }, [courseId]);

  useEffect(() => {
    if (activeChapter) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
      // Track last viewed chapter for "Continue watching" feature
      try {
        localStorage.setItem(`last_viewed_${userId}`, JSON.stringify({
          courseId,
          chapterId: activeChapter.id,
          timestamp: Date.now()
        }));
      } catch (e) {
        console.warn('Storage write failed', e);
      }
    }
  }, [activeChapter]);

  const sortedChapters = useMemo(() => {
    return [...chapters].sort((a, b) => {
      const modA = modules.find(m => m.id === a.module_id)?.order_index ?? 0;
      const modB = modules.find(m => m.id === b.module_id)?.order_index ?? 0;
      if (modA !== modB) return modA - modB;
      return (a.order_index ?? 0) - (b.order_index ?? 0);
    });
  }, [chapters, modules]);

  const isChapterLocked = useCallback((chapter: Chapter) => {
    return false; // All lessons are released according to user request
  }, []);

  const fetchCourseData = async () => {
    try {
      setErrorMessage(null);
      const cacheKey = `course_full_${courseId}`;
      const cached = dataCache.get(cacheKey);

      if (cached) {
        if (cached.course) setCourse(cached.course);
        if (cached.modules) setModules(cached.modules);
        if (cached.chapters) {
          setChapters(cached.chapters);
          if (cached.chapters.length === 1) {
            setActiveChapter(cached.chapters[0]);
            setViewMode('player');
          }
        }
        if (cached.progress) setProgress(cached.progress);
        setLoading(false);
      } else {
        setLoading(true);
      }

      // Safe UUID verification to prevent Postgres type errors on user_progress
      const isUUID = (str?: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

      // Execute queries in parallel for high speed and fault tolerance
      const courseQuery = supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .maybeSingle();

      const modulesQuery = supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');

      const progressQuery = isUUID(userId)
        ? supabase.from('user_progress').select('*').eq('user_id', userId)
        : Promise.resolve({ data: [], error: null });

      const [courseRes, modulesRes, progressRes] = await Promise.allSettled([
        courseQuery,
        modulesQuery,
        progressQuery
      ]);

      // 1. Process course
      let currentCourse = initialCourse || course;
      if (courseRes.status === 'fulfilled' && courseRes.value?.data) {
        currentCourse = courseRes.value.data;
        setCourse(currentCourse);
      }

      // 2. Process modules
      let modulesData: Module[] = [];
      if (modulesRes.status === 'fulfilled' && modulesRes.value?.data) {
        modulesData = modulesRes.value.data;
        setModules(modulesData);
      }

      // 3. Process progress
      let progressData: UserProgress[] = [];
      if (progressRes.status === 'fulfilled' && progressRes.value?.data) {
        progressData = progressRes.value.data;
        setProgress(progressData);
      }

      // 4. Process chapters
      const moduleIds = modulesData.map(m => m.id);
      let finalChapters: Chapter[] = [];

      if (moduleIds.length > 0) {
        const { data: chaptersData } = await supabase
          .from('chapters')
          .select('*')
          .in('module_id', moduleIds)
          .order('order_index');

        finalChapters = (chaptersData || []).map(fromDbChapter);
      }

      // If course has direct pdf_url and no chapters created yet, synthesize a PDF lesson
      if (finalChapters.length === 0 && currentCourse?.pdf_url) {
        const pdfChapter: Chapter = {
          id: `pdf-${courseId}`,
          module_id: '',
          title: currentCourse.title || t('course.pdf_material') || 'Digital PDF Material',
          description: currentCourse.description || '',
          content_type: 'pdf',
          pdf_url: currentCourse.pdf_url,
          cover_url: currentCourse.cover_url || currentCourse.premium_cover_url,
          duration_minutes: 10,
          order_index: 0,
          is_preview: false,
          created_at: new Date().toISOString()
        };
        finalChapters = [pdfChapter];
      }

      setChapters(finalChapters);

      // Save to memory cache for instantaneous subsequent views (5 minutes)
      dataCache.set(cacheKey, {
        course: currentCourse,
        modules: modulesData,
        chapters: finalChapters,
        progress: progressData
      }, 300000);

      // Setup initial view
      if (finalChapters.length === 1) {
        setActiveChapter(finalChapters[0]);
        setViewMode('player');
      } else if (finalChapters.length > 1) {
        const lastViewedStr = localStorage.getItem(`last_viewed_${userId}`);
        if (lastViewedStr) {
          try {
            const lastViewed = JSON.parse(lastViewedStr);
            if (lastViewed.courseId === courseId) {
              const chapter = finalChapters.find(ch => ch.id === lastViewed.chapterId);
              if (chapter && !progressData.find(p => p.chapter_id === chapter.id)?.completed) {
                setActiveChapter(chapter);
                setViewMode('player');
              }
            }
          } catch (e) {
            console.warn('Error parsing last viewed:', e);
          }
        }
        if (!activeChapter) setViewMode('grid');
      } else {
        setViewMode('grid');
      }
    } catch (err: any) {
      console.error('❌ Error in CourseViewer fetch:', err);
      setErrorMessage(err?.message || t('course.loading_error') || 'Unable to load lessons at this time.');
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
        showToast.success('Lesson completed!', {
          description: 'Your progress has been saved successfully.'
        });
      } else {
        showToast.info('Lesson marked as incomplete');
      }
    } catch (err) {
      console.error('Error toggling progress:', err);
      showToast.error('Error updating progress');
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

      showToast.success('Lesson completed!', {
        description: 'Your progress has been saved successfully.'
      });
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

  const calculateModuleProgress = (moduleId: string) => {
    const moduleChapters = chapters.filter(ch => ch.module_id === moduleId);
    if (moduleChapters.length === 0) return 0;
    const completed = moduleChapters.filter(ch => progress.find(p => p.chapter_id === ch.id)?.completed).length;
    return Math.round((completed / moduleChapters.length) * 100);
  };

  const adjustColorBrightness = (hex: string, percent: number) => {
    try {
      let R = parseInt(hex.substring(1, 3), 16);
      let G = parseInt(hex.substring(3, 5), 16);
      let B = parseInt(hex.substring(5, 7), 16);

      R = Math.min(255, Math.max(0, R + percent));
      G = Math.min(255, Math.max(0, G + percent));
      B = Math.min(255, Math.max(0, B + percent));

      const rHex = R.toString(16).padStart(2, '0');
      const gHex = G.toString(16).padStart(2, '0');
      const bHex = B.toString(16).padStart(2, '0');

      return `#${rHex}${gHex}${bHex}`;
    } catch (e) {
      return hex;
    }
  };

  const renderLinkButton = () => {
    if (!activeChapter) return null;

    const [btnColor, btnStyle] = (activeChapter.button_link_color || '#10b981').split('|');
    const actualStyle = btnStyle || 'filled';
    const actualColor = btnColor || '#10b981';

    let buttonStyle: React.CSSProperties = {};
    const buttonClassName = "px-10 py-5 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center justify-center gap-3 transition-all duration-300 active:scale-95 shadow-xl cursor-pointer hover:brightness-110";

    if (actualStyle === 'filled') {
      buttonStyle = {
        backgroundColor: actualColor,
        color: '#ffffff',
        boxShadow: `0 10px 25px -5px ${actualColor}40`
      };
    } else if (actualStyle === 'outline') {
      buttonStyle = {
        backgroundColor: 'transparent',
        border: `2px solid ${actualColor}`,
        color: actualColor,
      };
    } else if (actualStyle === 'glow') {
      buttonStyle = {
        backgroundColor: actualColor,
        color: '#ffffff',
        boxShadow: `0 0 25px ${actualColor}, 0 5px 15px rgba(0,0,0,0.3)`
      };
    } else if (actualStyle === 'gradient') {
      const gradientEnd = adjustColorBrightness(actualColor, -25);
      buttonStyle = {
        backgroundImage: `linear-gradient(135deg, ${actualColor}, ${gradientEnd})`,
        color: '#ffffff',
        boxShadow: `0 10px 25px -5px ${actualColor}40`
      };
    }

    return (
      <a 
        href={activeChapter.button_link_url || '#'} 
        target="_blank" 
        rel="noopener noreferrer"
        className={buttonClassName}
        style={buttonStyle}
      >
        <span>{activeChapter.button_link_text || 'Acessar Conteúdo'}</span>
        <ExternalLink size={16} />
      </a>
    );
  };

  const renderVideo = () => {
    if (!activeChapter?.video_url || activeChapter.video_url === 'undefined') return null;

    const url = activeChapter.video_url;
    let content = null;

    // Handle YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      let videoId = '';
      if (url.includes('v=')) videoId = url.split('v=')[1]?.split('&')[0] || '';
      else if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1]?.split('?')[0] || '';
      else if (url.includes('youtube.com/shorts/')) videoId = url.split('youtube.com/shorts/')[1]?.split('?')[0] || '';
      else if (url.includes('embed/')) videoId = url.split('embed/')[1]?.split('?')[0] || '';

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
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0];
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
      if (url.includes('/d/')) videoId = url.split('/d/')[1]?.split('/')[0] || '';
      else if (url.includes('id=')) videoId = url.split('id=')[1]?.split('&')[0] || '';
      else if (url.includes('/file/d/')) videoId = url.split('/file/d/')[1]?.split('/')[0] || '';

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
    // Cloudflare Stream, Cloudflare R2, or any direct video link (mp4, webm, mov, ogg, etc.)
    else if (
      url.includes('r2.dev') || 
      url.includes('cloudflare') || 
      url.includes('videodelivery.net') || 
      url.includes('cloudflarestream.com') ||
      url.match(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i)
    ) {
      if (url.includes('iframe.videodelivery.net') || (url.includes('cloudflarestream.com') && url.includes('/iframe'))) {
        content = (
          <iframe
            src={url}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            title={activeChapter.title}
          />
        );
      } else if (url.includes('cloudflarestream.com') || url.includes('videodelivery.net')) {
        const streamId = url.split('/').pop()?.split('?')[0];
        content = (
          <iframe
            src={`https://iframe.videodelivery.net/${streamId}`}
            className="w-full h-full border-0 absolute inset-0"
            allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture;"
            allowFullScreen
            title={activeChapter.title}
          />
        );
      } else {
        content = (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            webkit-playsinline="true"
            preload="metadata"
            className="w-full h-full object-contain"
            onEnded={() => {
              if (activeChapter) {
                markChapterComplete(activeChapter.id);
              }
            }}
          />
        );
      }
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
          config={{
            file: {
              attributes: {
                preload: 'metadata',
                playsInline: true,
                'webkit-playsinline': 'true'
              }
            }
          }}
          onEnded={() => {
            if (activeChapter) {
              markChapterComplete(activeChapter.id);
            }
          }}
        />
      );
    }

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
    
    // Mechanism: Google Drive preview or Google Docs Viewer to avoid Chrome iframe PDF blocking
    let viewerUrl = '';
    if (activeChapter.pdf_url.includes('drive.google.com')) {
      let fileId = '';
      const match1 = activeChapter.pdf_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      const match2 = activeChapter.pdf_url.match(/id=([a-zA-Z0-9_-]+)/);
      const match3 = activeChapter.pdf_url.match(/\/d\/([a-zA-Z0-9_-]+)/);
      if (match1) fileId = match1[1];
      else if (match2) fileId = match2[1];
      else if (match3) fileId = match3[1];
      viewerUrl = fileId ? `https://drive.google.com/file/d/${fileId}/preview` : activeChapter.pdf_url;
    } else {
      const encodedUrl = encodeURIComponent(activeChapter.pdf_url);
      viewerUrl = `https://docs.google.com/viewer?url=${encodedUrl}&embedded=true`;
    }

    return (
      <div className="w-full h-full relative group/pdf bg-[#1a1a1a] overflow-hidden rounded-[2rem] sm:rounded-[3rem]">
        {/* Subtle Paper Texture Background */}
        <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:20px_20px]" />
        
        <iframe 
          key={activeChapter.id}
          src={viewerUrl}
          className="w-full h-full border-none relative z-10"
          title={activeChapter.title}
          allow="fullscreen"
          loading="lazy"
        />
        
        {/* Elegant Book Binding Shadow Effect */}
        <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-black/40 to-transparent z-20 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-black/20 to-transparent z-20 pointer-events-none" />

        {/* Fullscreen Trigger Overlay */}
        <div className="absolute top-6 right-6 z-50">
          <button 
            onClick={() => {
              window.open(activeChapter.pdf_url!, '_blank');
              if (settings?.course_pdf_auto_complete_fullscreen) {
                markChapterComplete(activeChapter.id);
              }
            }}
            className="bg-primary hover:bg-primary/90 text-black p-4 rounded-2xl transition-all hover:scale-110 active:scale-95 shadow-[0_8px_32px_rgba(var(--primary-rgb),0.3)] flex items-center justify-center group/btn cursor-pointer"
            title={t('course.view_fullscreen') || "View Fullscreen"}
          >
            <Maximize2 size={24} className="group-hover/btn:rotate-12 transition-transform" />
          </button>
        </div>
      </div>
    );
  };


  if (errorMessage && !course) {
    return (
      <div className="fixed inset-0 bg-[#0b0c10] z-[200] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mb-6">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mb-2">
          {t('course.loading_error') || 'Unable to load lessons'}
        </h2>
        <p className="text-sm text-gray-400 max-w-md mb-8">
          {errorMessage}
        </p>
        <div className="flex gap-4">
          <button
            onClick={() => { setErrorMessage(null); fetchCourseData(); }}
            className="px-6 py-3 rounded-xl bg-primary text-black font-black uppercase text-xs tracking-wider hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            {t('course.try_again') || 'Try Again'}
          </button>
          <button
            onClick={onClose}
            className="px-6 py-3 rounded-xl bg-white/10 text-white font-bold uppercase text-xs tracking-wider hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
          >
            {t('course.back_home') || 'Back to Home'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-bg-main z-[200] flex flex-col text-white font-sans overflow-hidden">
      <header className="h-14 sm:h-20 border-b border-white/5 flex items-center justify-between px-4 sm:px-6 bg-black/80 backdrop-blur-2xl shrink-0 z-50">
        <div className="flex items-center">
          <button 
            onClick={viewMode === 'player' && chapters.length > 1 ? () => setViewMode('grid') : onClose} 
            className="group relative p-3 hover:bg-white/10 rounded-2xl transition-all active:scale-95 bg-white/5 border border-white/10 overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <ArrowLeft size={18} className="text-white/80 relative z-10" />
          </button>
        </div>

        <div className="flex-1 max-w-[180px] sm:max-w-sm mx-auto flex flex-col gap-1 sm:gap-2">
          <div className="flex items-center justify-between">
             <span className="text-[9px] sm:text-[10px] font-black text-white/40 uppercase tracking-widest leading-none">
                {completedChaptersCount} / {chapters.length} {t('course.lessons') || 'Lessons'}
              </span>
              <span className={`text-[10px] sm:text-xs font-black italic leading-none ${
                calculateProgress() === 100 ? 'text-green-500' : 
                calculateProgress() === 0 ? 'text-yellow-500' : 'text-blue-500'
              }`}>{calculateProgress()}%</span>
          </div>
          <div className="h-1 sm:h-1.5 bg-white/10 rounded-full overflow-hidden shadow-inner">
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
        <PullToRefresh onRefresh={fetchCourseData}>
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
                  <p className="text-gray-400 text-lg sm:text-xl max-w-3xl mx-auto font-medium leading-relaxed whitespace-pre-line">{course?.description}</p>
                </div>

                <div className="space-y-24">
                  {loading && chapters.length === 0 ? (
                    <div className="space-y-10 animate-pulse">
                      <div className="flex items-center justify-center gap-4 pb-6 border-b border-white/5">
                        <div className="h-4 w-40 bg-white/10 rounded-full" />
                      </div>
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-6 sm:gap-x-8 sm:gap-y-12">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                          <div key={i} className="flex flex-col gap-3">
                            <div className="aspect-square rounded-2xl sm:rounded-[24px] bg-white/5 border border-white/10" />
                            <div className="h-4 w-3/4 bg-white/10 rounded-md" />
                            <div className="h-3 w-1/2 bg-white/5 rounded-md" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : sortedChapters.length === 0 ? (
                    <div className="max-w-xl mx-auto py-12 px-6 rounded-3xl bg-white/5 border border-white/10 text-center space-y-6">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary mx-auto flex items-center justify-center">
                        <FileText size={32} />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-black text-white uppercase italic">
                          {course?.pdf_url ? (t('course.pdf_material') || 'Digital PDF Material') : (t('course.content') || 'Course Content')}
                        </h3>
                        <p className="text-sm text-gray-400">
                          {course?.pdf_url 
                            ? (t('course.pdf_description') || 'This course includes exclusive digital material in PDF format.') 
                            : (t('course.lessons_available') || 'Course modules and lessons will be available here.')}
                        </p>
                      </div>
                      {course?.pdf_url ? (
                        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
                          <button
                            onClick={() => window.open(course.pdf_url!, '_blank')}
                            className="px-8 py-4 rounded-xl bg-primary text-black font-black uppercase text-xs tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                          >
                            <Maximize2 size={16} /> {t('course.open_pdf') || 'Open PDF Material'}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={onClose}
                          className="px-6 py-3 rounded-xl bg-white/10 text-white font-bold uppercase text-xs tracking-wider hover:bg-white/20 active:scale-95 transition-all cursor-pointer"
                        >
                          {t('course.back_home') || 'Back to Home'}
                        </button>
                      )}
                    </div>
                  ) : (
                    (modules.length > 0 ? modules : [{ id: null, title: null }]).map((module, mIdx) => {
                      const moduleChapters = sortedChapters.filter(ch => module.id === null ? !ch.module_id : ch.module_id === module.id);
                      if (moduleChapters.length === 0) return null;
                      const moduleProgress = module.id ? calculateModuleProgress(module.id) : 0;

                      return (
                        <div key={module.id || 'global'} className="space-y-10 group/module">
                      {!module.title || module.title === 'Conteúdo' ? (
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
                        <div className="border-b border-white/5 pb-6">
                           <div className="flex items-end gap-6 mb-4">
                             <span className="text-6xl font-black text-white/5 italic leading-none select-none">{(mIdx + 1).toString().padStart(2, '0')}</span>
                             <div className="flex-1 flex flex-col gap-1">
                               <span className="text-[10px] font-black text-primary uppercase tracking-widest italic">
                                 {t('course.module') || 'MÓDULO'} {mIdx + 1}
                               </span>
                               <div className="flex items-center justify-between gap-4">
                                  <h3 className="text-2xl sm:text-3xl font-black text-white uppercase italic tracking-tighter leading-none">
                                    {module.title}
                                  </h3>
                                  <span className="text-xs font-black text-primary italic">{moduleProgress}% {t('course.completed_lowercase') || 'concluído'}</span>
                               </div>
                             </div>
                           </div>
                           <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${moduleProgress}%` }}
                                className="h-full bg-primary shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
                              />
                           </div>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-3 gap-y-6 sm:gap-x-8 sm:gap-y-12">
                        {moduleChapters.map((chapter, idx) => {
                          const isCompleted = progress.find(p => p.chapter_id === chapter.id)?.completed;
                          const isChapterHtmlApp = chapter.content_type === 'html_app' || isHtmlAppChapter(chapter);
                          
                          return (
                            <motion.button
                            whileHover={{ y: -8, scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            key={chapter.id}
                            onMouseEnter={() => {
                              // Pre-fetch next potential media metadata
                              if (chapter.video_url && chapter.video_url.match(/\.(mp4|webm|ogg)$/i)) {
                                const link = document.createElement('link');
                                link.rel = 'preload';
                                link.as = 'video';
                                link.href = chapter.video_url;
                                document.head.appendChild(link);
                              }
                            }}
                            onClick={() => {
                              setActiveChapter(chapter);
                              setViewMode('player');
                              window.scrollTo({ top: 0, behavior: 'smooth' });
                            }}
                            className="group relative flex flex-col text-left transition-all w-full"
                          >
                            <div className={`relative aspect-square rounded-2xl sm:rounded-[24px] overflow-hidden mb-3 sm:mb-5 border shadow-2xl bg-zinc-950 transition-all duration-500 w-full ${
                              isCompleted 
                                ? 'border-emerald-500/40 ring-1 ring-emerald-500/30 shadow-[0_10px_30px_rgba(16,185,129,0.15)]' 
                                : 'border-white/15 ring-1 ring-inset ring-white/5 group-hover:border-primary/60 group-hover:ring-primary/30 group-hover:shadow-[0_16px_40px_rgba(244,63,94,0.25),0_0_20px_rgba(255,255,255,0.05)]'
                            }`}>
                              {/* Top Specular Light Beam */}
                              <div className="absolute top-0 inset-x-3 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent z-30 pointer-events-none group-hover:via-primary/50 transition-colors" />

                              {chapter.cover_url && chapter.cover_url.trim() ? (
                                <img 
                                  src={chapter.cover_url.trim()} 
                                  className={`w-full h-full object-cover transition-all duration-700 ${isCompleted ? 'opacity-75 grayscale-[20%]' : 'opacity-100 group-hover:scale-105'}`} 
                                  alt={chapter.title} 
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-white/30 group-hover:text-primary transition-colors">
                                  {isChapterHtmlApp ? (
                                    <Puzzle className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400/80" />
                                  ) : (
                                    <PlayCircle className="w-10 h-10 sm:w-12 sm:h-12" />
                                  )}
                                </div>
                              )}
                              
                              {/* Crisp Subtle Gradient to ensure text & badges pop without darkening the artwork */}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className={`w-11 h-11 sm:w-14 sm:h-14 rounded-2xl border flex items-center justify-center transition-all duration-500 shadow-xl backdrop-blur-md ${
                                  isCompleted 
                                    ? 'bg-emerald-500/90 border-emerald-400 text-white scale-90 shadow-[0_0_15px_rgba(16,185,129,0.5)]' 
                                    : isChapterHtmlApp
                                    ? 'bg-purple-950/70 border-purple-500/40 text-purple-300 group-hover:bg-purple-600 group-hover:border-purple-400 group-hover:text-white group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.6)]'
                                    : 'bg-black/50 border-white/30 text-white group-hover:bg-primary group-hover:border-primary group-hover:scale-110 group-hover:shadow-[0_0_20px_rgba(244,63,94,0.6)]'
                                }`}>
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                                  ) : isChapterHtmlApp ? (
                                    <Puzzle className="w-5 h-5 sm:w-6 sm:h-6 text-white drop-shadow-md" />
                                  ) : (
                                    <Play className="w-5 h-5 sm:w-6 sm:h-6 text-white fill-white ml-0.5 sm:ml-1 drop-shadow-md" />
                                  )}
                                </div>
                              </div>

                              {isCompleted && (
                                <div className="absolute top-2.5 left-2.5 sm:top-3.5 sm:left-3.5 bg-emerald-500 text-white text-[8px] sm:text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-widest shadow-lg italic flex items-center gap-1 border border-emerald-300/40">
                                  <CheckCircle2 size={10} />
                                  {t('course.completed')}
                                </div>
                              )}

                              <div className="absolute bottom-2.5 right-2.5 sm:bottom-3.5 sm:right-3.5 bg-black/80 backdrop-blur-md text-[8px] sm:text-[10px] font-black text-white px-2.5 py-1 rounded-lg border border-white/20 uppercase tracking-widest italic shadow-lg">
                                {chapter.duration_minutes || 5} MIN
                              </div>
                            </div>
                            
                            <div className="space-y-0.5 px-2">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] italic leading-none">
                                  {chapter.content_type === 'video' ? '' : chapter.content_type === 'pdf' ? '' : isChapterHtmlApp ? 'Mini App' : (t('course.reading') || 'Leitura')}
                                </span>
                                {isCompleted && <div className="w-1 h-1 rounded-full bg-green-500" />}
                              </div>
                              <h4 className={`text-xs sm:text-lg font-black uppercase italic tracking-tight leading-[1.1] transition-colors group-hover:text-primary ${isCompleted ? 'text-white/40' : 'text-white'}`}>
                                <span className="text-primary/40 mr-1 sm:mr-1.5 opacity-50">{(idx + 1).toString().padStart(2, '0')}.</span>
                                {chapter.title}
                              </h4>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                );
              }))}
            </div>
              
              <SupportSection page="course" settings={settings} t={t} />
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
              <div className={`${activeChapter?.content_type === 'pdf' ? 'max-w-3xl' : 'max-w-4xl'} mx-auto w-full px-6 pt-20 pb-12 text-center space-y-6`}>
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <h1 className="text-4xl md:text-6xl font-serif font-black leading-tight text-white mb-4">
                    {activeChapter?.title}
                  </h1>
                  <p className="text-gray-500 text-lg md:text-xl font-medium max-w-2xl mx-auto whitespace-pre-line">
                    {activeChapter?.description || course?.description}
                  </p>
                </motion.div>
              </div>

              {/* Media Player Section with Elegant Frame */}
              {(() => {
                const isCurrentHtmlApp = activeChapter?.content_type === 'html_app' || isHtmlAppChapter(activeChapter);
                return (
                  <div className={`mx-auto w-full px-4 sm:px-6 relative flex justify-center ${activeChapter?.content_type === 'checklist' || activeChapter?.content_type === 'interactive' || activeChapter?.content_type === 'text' || isCurrentHtmlApp ? 'max-w-5xl' : activeChapter?.content_type === 'pdf' ? 'max-w-3xl' : 'max-w-5xl'}`}>
                    {isCurrentHtmlApp ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center"
                      >
                        <HtmlAppViewer
                          htmlContent={extractHtmlAppContent(activeChapter?.rich_text)}
                          title={activeChapter?.title}
                          className="w-full flex flex-col items-center justify-center"
                        />
                      </motion.div>
                    ) : activeChapter?.content_type === 'interactive' || (activeChapter?.content_type === 'text' && activeChapter.rich_text?.startsWith('{')) ? (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="w-full"
                      >
                        {(() => {
                          let parsedBlocks = [];
                          try {
                            if (activeChapter.rich_text) {
                              const parsed = JSON.parse(activeChapter.rich_text);
                              parsedBlocks = parsed.blocks || [];
                            }
                          } catch (e) {
                            console.error('Failed to parse lesson blocks:', e);
                          }

                          return (
                            <BlockLessonViewer
                              chapterId={activeChapter.id}
                              userId={userId}
                              blocks={parsedBlocks}
                              title={activeChapter.title}
                              description={activeChapter.description}
                              onLessonComplete={() => {
                                if (activeChapter) {
                                  const currentProgress = progress.find(p => p.chapter_id === activeChapter.id);
                                  if (!currentProgress?.completed) {
                                    toggleCompletion(activeChapter.id);
                                  }
                                }
                              }}
                            />
                          );
                        })()}
                      </motion.div>
                    ) : activeChapter?.content_type === 'text' ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full max-w-4xl bg-zinc-950/80 border border-white/10 rounded-3xl p-6 sm:p-10 space-y-6 shadow-2xl backdrop-blur-sm"
                  >
                    <div className="border-b border-white/10 pb-4 space-y-1">
                      <h2 className="text-xl sm:text-2xl font-black text-white">{activeChapter.title}</h2>
                      {activeChapter.description && (
                        <p className="text-xs sm:text-sm text-gray-400">{activeChapter.description}</p>
                      )}
                    </div>
                    {/<[a-z][\s\S]*>/i.test(activeChapter.rich_text || '') ? (
                      <div
                        className="space-y-4 text-gray-200 
                          [&>h3]:text-lg [&>h3]:sm:text-xl [&>h3]:font-black [&>h3]:text-amber-300 [&>h3]:tracking-tight [&>h3]:mt-6 [&>h3]:mb-3
                          [&>h4]:text-base [&>h4]:sm:text-lg [&>h4]:font-bold [&>h4]:text-emerald-300 [&>h4]:mt-4 [&>h4]:mb-2
                          [&>p]:text-sm [&>p]:sm:text-base [&>p]:leading-relaxed [&>p]:text-gray-300 [&>p]:mb-4
                          [&>ul]:list-disc [&>ul]:list-inside [&>ul]:space-y-2 [&>ul]:text-gray-300 [&>ul]:text-sm [&>ul]:sm:text-base [&>ul]:mb-4
                          [&>ol]:list-decimal [&>ol]:list-inside [&>ol]:space-y-2 [&>ol]:text-gray-300 [&>ol]:text-sm [&>ol]:sm:text-base [&>ol]:mb-4
                          [&>blockquote]:border-l-4 [&>blockquote]:border-amber-400 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-amber-200 [&>blockquote]:my-6 [&>blockquote]:bg-amber-500/5 [&>blockquote]:py-3 [&>blockquote]:rounded-r-2xl"
                        dangerouslySetInnerHTML={{ __html: activeChapter.rich_text || '' }}
                      />
                    ) : (
                      <div className="text-sm sm:text-base text-gray-200 leading-relaxed whitespace-pre-line space-y-4">
                        {activeChapter.rich_text || activeChapter.description || ''}
                      </div>
                    )}
                  </motion.div>
                ) : activeChapter?.content_type === 'checklist' ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full"
                  >
                    <InteractiveChecklist
                      chapterId={activeChapter.id}
                      userId={userId}
                      onAllCompletedChange={(completed) => {
                        if (completed && activeChapter) {
                          const currentProgress = progress.find(p => p.chapter_id === activeChapter.id);
                          if (!currentProgress?.completed) {
                            toggleCompletion(activeChapter.id);
                          }
                        }
                      }}
                    />
                  </motion.div>
                ) : activeChapter?.content_type === 'link' ? (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="w-full flex items-center justify-center py-6"
                  >
                    {renderLinkButton()}
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                    className={`relative overflow-hidden border border-white/10 bg-black shadow-2xl transition-all duration-500 w-full ${
                      activeChapter?.content_type === 'pdf' 
                        ? 'aspect-[1/1.4] sm:aspect-[3/4] max-h-[85vh] rounded-[2rem] sm:rounded-[3rem] ring-8 ring-white/5 shadow-white/5' 
                        : 'aspect-video rounded-xl border-white/20'
                    }`}
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
                )}
              </div>
            );
          })()}

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
                      <><CheckCircle2 size={20} /> {t('course.lesson_completed_btn') || 'LESSON COMPLETED'}</>
                    ) : (
                      t('course.complete_lesson_btn') || 'COMPLETE LESSON'
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
                    className="flex flex-col items-start gap-1 p-6 bg-white/5 hover:bg-white/10 rounded-3xl transition-all disabled:opacity-20 group text-left cursor-pointer"
                  >
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-primary transition-colors flex items-center gap-1">
                      <ChevronLeft size={12} /> {t('course.prev_lesson') || 'Previous Lesson'}
                    </span>
                    <span className="text-sm font-bold text-white line-clamp-1">
                      {sortedChapters[sortedChapters.findIndex(ch => ch.id === activeChapter?.id) - 1]?.title || t('nav.home') || 'Home'}
                    </span>
                  </button>

                  <button 
                    onClick={() => {
                      const idx = sortedChapters.findIndex(ch => ch.id === activeChapter?.id);
                      if (idx < sortedChapters.length - 1) setActiveChapter(sortedChapters[idx + 1]);
                    }}
                    disabled={sortedChapters.findIndex(ch => ch.id === activeChapter?.id) === sortedChapters.length - 1}
                    className="flex flex-col items-end gap-1 p-6 bg-white/5 hover:bg-white/10 rounded-3xl transition-all disabled:opacity-20 group text-right cursor-pointer"
                  >
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-primary transition-colors flex items-center gap-1">
                      {t('course.next_lesson') || 'Next Lesson'} <ChevronRight size={12} />
                    </span>
                    <span className="text-sm font-bold text-white line-clamp-1">
                      {sortedChapters[sortedChapters.findIndex(ch => ch.id === activeChapter?.id) + 1]?.title || t('course.end_label') || 'End'}
                    </span>
                  </button>
                </div>

                {/* Lesson Questions Section */}
                {activeChapter && (
                  <ChapterQuestions 
                    chapterId={activeChapter.id} 
                    userId={userId}
                    userName={course?.title === 'Admin' ? 'Admin' : (progress[0]?.user_id === userId ? 'Você' : 'Aluno')} // Simple fallback, better get from auth/profile
                    userAvatarUrl={undefined}
                  />
                )}

                {/* Support Section */}
                <SupportSection page="lesson" settings={settings} t={t} />

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
              
              <FloatingWhatsApp page="lesson" />
            </motion.div>
          )}
        </AnimatePresence>
        </PullToRefresh>
      </div>

      <FloatingWhatsApp page={viewMode === 'grid' ? 'course' : 'lesson'} />
    </div>
  );
}
