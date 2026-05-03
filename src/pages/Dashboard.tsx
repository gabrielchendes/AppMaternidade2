import { useState, useEffect, useCallback, useMemo, memo, lazy, Suspense } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import BannerCarousel from '../components/BannerCarousel';
import Carousel from '../components/Carousel';
import ProductCard from '../components/ProductCard';
import FloatingWhatsApp from '../components/FloatingWhatsApp';
import PWAInstallModal from '../components/PWAInstallModal';
import { getDeviceType, isPWAInstalled } from '../lib/pwa';
import { toast } from 'sonner';
import { X, ShoppingBag, Loader2, Play, BookOpen, Star, Sparkles, Phone, Mail as MailIcon, MessageCircle, Book, Bell, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requestNotificationPermission, onForegroundMessage } from '../lib/pushNotifications';
import { createNotification } from '../lib/notifications';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { Course } from '../types/lms';

// Lazy load heavy components
const Profile = lazy(() => import('../components/Profile'));
const Community = lazy(() => import('../components/Community'));
const AdminPanel = lazy(() => import('../components/AdminPanel'));
const CourseViewer = lazy(() => import('../components/CourseViewer'));

import { dataCache } from '../lib/cache';

const ComponentLoader = () => (
  <div className="w-full py-20 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

const SupportSection = memo(({ page, settings, t }: { page: 'home' | 'community' | 'profile', settings: any, t: any }) => {
  const whatsappEnabled = settings[`support_whatsapp_${page}_enabled` as keyof typeof settings] && settings.support_whatsapp;
  const emailEnabled = settings[`support_email_${page}_enabled` as keyof typeof settings] && settings.support_email;

  if (!whatsappEnabled && !emailEnabled) return null;

  return (
    <div className="px-6 md:px-16 pt-12 pb-20">
      <div className="bg-zinc-900/50 border border-white/10 rounded-[2.5rem] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic">
            {settings.custom_texts?.['auth.support_box'] || 'Precisa de Suporte?'}
          </h3>
          <p className="text-gray-500 font-medium max-w-md">
            {settings.custom_texts?.['auth.support_description'] || t('auth.support_description') || 'Nossa equipe está pronta para te ajudar com qualquer dúvida ou problema técnico.'}
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          {whatsappEnabled && settings.support_whatsapp && (
            <a 
              href={`https://wa.me/${settings.support_whatsapp.replace(/\D/g, '')}${settings.support_whatsapp_message ? `?text=${encodeURIComponent(settings.support_whatsapp_message)}` : ''}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 transition-all active:scale-95"
            >
              <Phone size={24} /> {settings.custom_texts?.['auth.whatsapp_label'] || 'WHATSAPP'}
            </a>
          )}
          {emailEnabled && settings.support_email && (
            <a 
              href={`mailto:${settings.support_email}`}
              className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl border border-white/10 transition-all active:scale-95"
            >
              <MailIcon size={24} /> {settings.custom_texts?.['auth.email_label'] || 'EMAIL'}
            </a>
          )}
        </div>
      </div>
    </div>
  );
});

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseChapters, setCourseChapters] = useState<Record<string, string[]>>({});
  const [courseStats, setCourseStats] = useState<Record<string, { lessons: number, materials: number }>>({});
  const [purchases, setPurchases] = useState<string[]>([]);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'profile' | 'community' | 'admin'>(() => {
    const hash = window.location.hash.replace('#', '');
    if (['home', 'profile', 'community', 'admin'].includes(hash)) {
      return hash as any;
    }
    return 'home';
  });

  useEffect(() => {
    // Only update hash if it's not already correct to avoid unnecessary history changes
    if (window.location.hash !== `#${activeTab}`) {
      window.history.replaceState(null, '', `#${activeTab}`);
    }
    // Always scroll to top when changing tabs
    window.scrollTo(0, 0);
  }, [activeTab]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showPWAInstall, setShowPWAInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(!isPWAInstalled());

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    // Check if actually installed
    const checkInstallation = () => {
      if (isPWAInstalled()) {
        setCanInstall(false);
      }
    };
    
    const interval = setInterval(checkInstallation, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    fetchData();
    
    // Preload banner images
    if (settings.banner_images?.length) {
      settings.banner_images.slice(0, 3).forEach((url: string) => {
        const img = new Image();
        img.src = url;
      });
    }

    // Check if we should show the welcome notification modal
    const checkInitialNotifications = async () => {
      if (typeof window === 'undefined') return;
      
      // If permission is already granted, refresh token
      if ('Notification' in window && Notification.permission === 'granted') {
        onForegroundMessage();
        await requestNotificationPermission(user.id);
        return;
      }

      // If default, show the modal right after login if not dismissed before
      if ('Notification' in window && Notification.permission === 'default') {
        const dismissed = localStorage.getItem(`push_modal_dismissed_${user.id}`);
        if (!dismissed) {
          // Delay slightly to ensure smooth entrance
          setTimeout(() => setShowWelcomeModal(true), 500);
        }
      }
    };

    checkInitialNotifications();

    // Low-friction registration check
    const checkPushStatus = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      
      // Always try to listen for foreground messages if supported
      onForegroundMessage();

      // If already granted, ensure token is saved/refreshed in Supabase
      if (Notification.permission === 'granted') {
        await requestNotificationPermission(user.id);
      }
    };

    // Run once on load
    checkPushStatus();
    
    // Optional: Re-check if user changes permission in browser settings
    const interval = setInterval(checkPushStatus, 60000); // Check once per minute
    return () => clearInterval(interval);
  }, [user.id]);

  const fetchData = async () => {
    // Try to get from cache first
    const cacheKey = `dashboard_data_${user.id}`;
    const cachedData = dataCache.get(cacheKey);
    
    if (cachedData) {
      setCourses(cachedData.courses);
      setPurchases(cachedData.purchases);
      setUserProgress(cachedData.userProgress);
      setCourseStats(cachedData.courseStats);
      setCourseChapters(cachedData.courseChapters);
      setLoading(false);
      return;
    }

    try {
      const [coursesRes, purchasesRes, progressRes, packagesRes] = await Promise.all([
        supabase.from('courses').select('*').eq('is_active', true),
        supabase.from('purchases').select('product_id').eq('user_id', user.id),
        supabase.from('user_progress').select('*').eq('user_id', user.id),
        supabase.from('course_packages').select('id, hotmart_product_id, hotmart_checkout_url, package_courses(course_id)')
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (purchasesRes.error) throw purchasesRes.error;
      if (progressRes.error) throw progressRes.error;

      const basePurchases = purchasesRes.data?.map(p => p.product_id) || [];
      const unlockedByPackages = new Set<string>();
      const courseToPackageCheckout: Record<string, string> = {};

      packagesRes.data?.forEach(pkg => {
        if (pkg.hotmart_checkout_url) {
          pkg.package_courses?.forEach((pc: any) => {
            if (!courseToPackageCheckout[pc.course_id]) {
              courseToPackageCheckout[pc.course_id] = pkg.hotmart_checkout_url!;
            }
          });
        }

        if (pkg.hotmart_product_id && basePurchases.includes(pkg.hotmart_product_id)) {
          pkg.package_courses?.forEach((pc: any) => {
            unlockedByPackages.add(pc.course_id);
          });
        }
      });

      const processedCourses = coursesRes.data?.map(c => ({
        ...c,
        checkout_url: courseToPackageCheckout[c.id] || c.checkout_url
      })) || [];
      const allPurchases = [...basePurchases, ...Array.from(unlockedByPackages)];

      setCourses(processedCourses);
      setPurchases(allPurchases);
      setUserProgress(progressRes.data || []);

      const { data: chaptersData } = await supabase.from('chapters').select('id, content_type, modules!inner(course_id)');
      let stats: Record<string, { lessons: number, materials: number }> = {};
      let chapterMap: Record<string, string[]> = {};

      if (chaptersData) {
        chaptersData.forEach((ch: any) => {
          const courseId = ch.modules.course_id;
          if (!stats[courseId]) stats[courseId] = { lessons: 0, materials: 0 };
          if (!chapterMap[courseId]) chapterMap[courseId] = [];
          
          chapterMap[courseId].push(ch.id);
          if (ch.content_type === 'video') stats[courseId].lessons++;
          else stats[courseId].materials++;
        });
        setCourseStats(stats);
        setCourseChapters(chapterMap);
      }

      // Save to cache
      dataCache.set(cacheKey, {
        courses: processedCourses,
        purchases: allPurchases,
        userProgress: progressRes.data || [],
        courseStats: stats,
        courseChapters: chapterMap
      }, 120000); // 2 minutes cache for dashboard

    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error(t('dashboard.loading_error') || 'Erro ao carregar conteúdos');
    } finally {
      setLoading(false);
    }
  };

  const isUnlocked = useCallback((course: Course) => {
    return course.is_free || course.is_bonus || purchases.includes(course.id);
  }, [purchases]);

  const handleOpenCourse = useCallback(async (course: Course) => {
    if (isUnlocked(course)) {
      // Check if the course has modules or chapters in the stats
      const hasContent = (courseStats[course.id]?.lessons || 0) + (courseStats[course.id]?.materials || 0) > 0;
      
      // If it's pure PDF (no internal lessons/modules) and has a PDF URL, open it directly
      if (course.pdf_url && !hasContent && !viewingCourseId) {
        window.open(course.pdf_url, '_blank');
        return;
      }
      
      // Otherwise, open the viewer (even if empty, it will handle it)
      setViewingCourseId(course.id);
    } else {
      setSelectedCourse(course);
    }
  }, [viewingCourseId, isUnlocked, courseStats]);

  const handleSimulatePurchase = useCallback(async () => {
    if (!selectedCourse) return;
    
    if (selectedCourse.checkout_url) {
      window.location.href = selectedCourse.checkout_url;
      return;
    }

    toast.error(t('course.purchase_unavailable') || 'Este curso ainda não possui um link de compra configurado.');
  }, [selectedCourse]);

  const getCourseProgress = useCallback((courseId: string) => {
    const chaptersInCourse = courseChapters[courseId] || [];
    if (chaptersInCourse.length === 0) return 0;
    
    // Filter progress to only include completions for this course's chapters
    const completedCount = userProgress.filter(p => 
      p.completed && chaptersInCourse.includes(p.chapter_id)
    ).length;
    
    return Math.min(100, Math.round((completedCount / chaptersInCourse.length) * 100));
  }, [courseChapters, userProgress]);

  const unlockedCourses = useMemo(() => courses.filter(p => isUnlocked(p) && !p.is_bonus), [courses, isUnlocked]);
  const lockedCourses = useMemo(() => courses.filter(p => !isUnlocked(p)), [courses, isUnlocked]);
  const bonusCourses = useMemo(() => courses.filter(p => p.is_bonus && isUnlocked(p)), [courses, isUnlocked]);

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-bg-main">
      <AnimatePresence>
        {viewingCourseId && (
          <Suspense fallback={<div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
            <CourseViewer 
              courseId={viewingCourseId} 
              userId={user.id} 
              onClose={() => setViewingCourseId(null)} 
            />
          </Suspense>
        )}
      </AnimatePresence>

      {/* Welcome Notification Modal */}
      <AnimatePresence>
        {showWelcomeModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-sm bg-zinc-900 border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]" />
              <div className="p-10 text-center">
                <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-primary/20 rotate-3">
                  <Bell className="text-primary animate-pulse" size={36} />
                </div>
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic mb-4">
                  {settings.custom_texts?.['push.title'] || t('push.title') || 'Avisos Importantes!'}
                </h3>
                <p className="text-gray-400 text-sm mb-10 leading-relaxed font-medium">
                  {settings.custom_texts?.['push.description'] || t('push.description') || 'Deseja receber avisos de novas aulas, materiais e comunicados importantes diretamente no seu celular?'}
                </p>
                <div className="flex flex-col gap-4">
                  <button 
                    onClick={async () => {
                      localStorage.setItem(`push_modal_dismissed_${user.id}`, 'true');
                      setShowWelcomeModal(false);
                      const granted = await requestNotificationPermission(user.id);
                      if (granted) {
                        toast.success(settings.custom_texts?.['push.success'] || t('push.success') || 'Notificações ativadas com sucesso!');
                      }
                    }}
                    className="w-full bg-primary hover:bg-primary-hover text-white font-black py-5 rounded-2xl shadow-2xl shadow-primary/30 active:scale-95 transition-all text-xs tracking-[0.2em] uppercase italic"
                  >
                    {settings.custom_texts?.['push.allow'] || t('push.allow') || 'Ativar Notificações'}
                  </button>
                  <button 
                    onClick={() => {
                      localStorage.setItem(`push_modal_dismissed_${user.id}`, 'true');
                      setShowWelcomeModal(false);
                    }}
                    className="w-full py-3 text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em] hover:text-white transition-colors"
                  >
                    {settings.custom_texts?.['push.deny'] || t('push.deny') || 'Agora não'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Navbar 
        user={user} 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
        canInstall={canInstall}
        onInstall={() => setShowPWAInstall(true)}
      />

      {activeTab === 'home' ? (
        <>
          {/* Banner Section */}
          <div className="w-full pb-8">
            <BannerCarousel 
              images={(settings.banner_sync !== false) 
                ? (settings.banner_images || []) 
                : (getDeviceType() !== 'desktop' ? (settings.banner_images_mobile || settings.banner_images || []) : (settings.banner_images || []))
              } 
              interval={settings.banner_interval || 5000} 
              config={(settings.banner_sync !== false)
                ? (settings.banner_config || [])
                : (getDeviceType() !== 'desktop' ? (settings.banner_config_mobile || settings.banner_config || []) : (settings.banner_config || []))
              }
            />
          </div>

          {/* Content Sections */}
          <div className="relative z-10 space-y-12 pb-20">
            <Carousel title={settings.custom_texts?.['dashboard.courses_paid'] || 'Meus Cursos'}>
              {unlockedCourses.length > 0 ? (
                unlockedCourses.map(course => (
                  <ProductCard
                    key={course.id}
                    product={course}
                    isUnlocked={true}
                    progress={getCourseProgress(course.id)}
                    stats={courseStats[course.id]}
                    onOpen={handleOpenCourse}
                  />
                ))
              ) : (
                <div className="w-full h-48 flex flex-col items-center justify-center text-gray-600 border border-white/5 rounded-3xl mx-12 bg-white/5">
                  <Book size={32} className="mb-4 opacity-20" />
                  <p className="font-bold text-xs uppercase tracking-widest">{t('dashboard.empty_locked') || 'Em breve novos conteúdos'}</p>
                </div>
              )}
            </Carousel>

            <Carousel title={settings.custom_texts?.['dashboard.courses_free'] || 'Produtos Principais'}>
              {lockedCourses.length > 0 ? (
                lockedCourses.map(course => (
                  <ProductCard
                    key={course.id}
                    product={course}
                    isUnlocked={false}
                    stats={courseStats[course.id]}
                    onOpen={handleOpenCourse}
                  />
                ))
              ) : (
                <div className="w-full py-16 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl mx-12">
                  <p className="font-bold">{t('dashboard.empty_all_unlocked') || 'Você já possui todos os cursos disponíveis!'}</p>
                </div>
              )}
            </Carousel>

            {bonusCourses.length > 0 && (
              <Carousel title={settings.custom_texts?.['dashboard.courses_bonus'] || 'Meus Bônus'}>
                {bonusCourses.map(course => (
                  <ProductCard
                    key={course.id}
                    product={course}
                    isUnlocked={true}
                    progress={getCourseProgress(course.id)}
                    stats={courseStats[course.id]}
                    onOpen={handleOpenCourse}
                  />
                ))}
              </Carousel>
            )}

            <SupportSection page="home" settings={settings} t={t} />
          </div>
        </>
      ) : activeTab === 'community' ? (
        <div className="pt-24">
          <Suspense fallback={<ComponentLoader />}>
            <Community user={user} />
          </Suspense>
          <SupportSection page="community" settings={settings} t={t} />
        </div>
      ) : activeTab === 'admin' ? (
        <div className="pt-24">
          <Suspense fallback={<ComponentLoader />}>
            <AdminPanel user={user} />
          </Suspense>
        </div>
      ) : (
        <div className="pt-24">
          <Suspense fallback={<ComponentLoader />}>
            <Profile user={user} />
          </Suspense>
          <SupportSection page="profile" settings={settings} t={t} />
        </div>
      )}

      {/* Course Detail / Purchase Modal */}
      <AnimatePresence>
        {selectedCourse && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedCourse(null)}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-zinc-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10"
            >
              <button
                onClick={() => setSelectedCourse(null)}
                className="absolute top-6 right-6 z-10 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors"
              >
                <X size={24} />
              </button>

              <div className="grid md:grid-cols-2">
                <div className="aspect-video md:aspect-auto relative">
                  <img
                    src={selectedCourse.cover_url || `https://picsum.photos/seed/${selectedCourse.id}/1200/800`}
                    className="w-full h-full object-cover"
                    alt={selectedCourse.title}
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent md:hidden" />
                </div>

                <div className="p-10 md:p-14 flex flex-col gap-8">
          <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-black text-[10px] tracking-[0.2em] uppercase">
                      <Star size={12} className="fill-primary" /> {t('course.premium_content') || 'CONTEÚDO PREMIUM'}
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black leading-[0.9] text-white">{selectedCourse.title}</h2>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-black text-white">
                        R$ {(selectedCourse.price / 100).toFixed(2).replace('.', ',')}
                      </div>
                      <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest border border-white/10">
                        {t('course.lifetime_access') || 'Acesso Vitalício'}
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-400 leading-relaxed text-lg font-medium">
                    {selectedCourse.description || t('course.default_description') || 'Este conteúdo exclusivo oferece insights valiosos e ferramentas práticas para sua jornada na maternidade.'}
                  </p>

                  <div className="mt-auto pt-8 border-t border-white/5 space-y-6">
                    <button
                      onClick={handleSimulatePurchase}
                      className="w-full bg-primary hover:bg-primary-hover text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 transition-all active:scale-[0.98]"
                    >
                      <ShoppingBag size={24} />
                      {t('course.unlock_button') || 'LIBERAR ACESSO AGORA'}
                    </button>
                    <p className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                      {t('course.secure_payment') || 'Pagamento 100% Seguro • Acesso Imediato'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!viewingCourseId && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} userEmail={user.email} />}
      <FloatingWhatsApp page={activeTab as any} />
      
      <PWAInstallModal 
        isOpen={showPWAInstall} 
        onClose={() => setShowPWAInstall(false)}
        onInstall={async () => {
          if (deferredPrompt) {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            if (outcome === 'accepted') {
              setDeferredPrompt(null);
              setCanInstall(false);
              return true;
            }
          }
          return false;
        }}
      />
    </div>
  );
}
