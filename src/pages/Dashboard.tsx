import { useState, useEffect, useCallback, useMemo, memo, Suspense, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import BannerCarousel from '../components/BannerCarousel';
import Carousel from '../components/Carousel';
import ProductCard from '../components/ProductCard';
import CoursePurchaseModal from '../components/CoursePurchaseModal';
import FloatingWhatsApp from '../components/FloatingWhatsApp';
import SupportSection from '../components/SupportSection';
import PWAInstallModal from '../components/PWAInstallModal';
import PullToRefresh from '../components/PullToRefresh';
import WhatsAppIcon from '../components/WhatsAppIcon';
import SmartHomeHeader from '../components/SmartHomeHeader';
import { getDeviceType, isPWAInstalled } from '../lib/pwa';
import { toast } from 'sonner';
import { X, ShoppingBag, Loader2, Play, BookOpen, Star, Sparkles, Mail as MailIcon, MessageCircle, Book, Bell, Smartphone, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requestNotificationPermission, onForegroundMessage } from '../lib/pushNotifications';
import { createNotification } from '../lib/notifications';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { Course } from '../types/lms';
import { dataCache } from '../lib/cache';
import { cn } from '../lib/utils';
import { lazyWithRetry } from '../lib/lazyWithRetry';

import AiAssistantModal from '../components/AiAssistantModal';
import AccessDeniedModal from '../components/AccessDeniedModal';

// Lazy load heavy components
const Profile = lazyWithRetry(() => import('../components/Profile'));
const Community = lazyWithRetry(() => import('../components/Community'));
const AdminPanel = lazyWithRetry(() => import('../components/AdminPanel'));
const CourseViewer = lazyWithRetry(() => import('../components/CourseViewer'));
const CoursePreviewViewer = lazyWithRetry(() => import('../components/CoursePreviewViewer'));

const ComponentLoader = () => (
  <div className="w-full py-20 flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
  </div>
);

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseChapters, setCourseChapters] = useState<Record<string, string[]>>({});
  const [courseStats, setCourseStats] = useState<Record<string, { lessons: number, materials: number }>>({});
  const [purchases, setPurchases] = useState<{product_id: string, created_at: any}[]>([]);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [userProfile, setUserProfile] = useState<{ has_access?: boolean; has_unlimited_ai?: boolean; is_admin?: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [previewCourse, setPreviewCourse] = useState<Course | null>(null);
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

  useEffect(() => {
    if (isAiModalOpen && user?.id) {
      const fetchProfile = async () => {
        const isUUID = (str?: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

        let profileData = null;
        if (isUUID(user.id)) {
          const { data } = await supabase
            .from('profiles')
            .select('has_access, has_unlimited_ai, is_admin')
            .eq('id', user.id)
            .maybeSingle();
          profileData = data;
        }

        if (!profileData && user.email) {
          const { data } = await supabase
            .from('profiles')
            .select('has_access, has_unlimited_ai, is_admin')
            .eq('email', user.email.toLowerCase())
            .maybeSingle();
          profileData = data;
        }

        if (profileData) {
          setUserProfile(profileData);
        }
      };

      fetchProfile().catch(e => console.warn('Error fetching profile in AI modal:', e));
    }
  }, [isAiModalOpen, user?.id, user?.email]);
  const [activeTab, setActiveTab] = useState<'home' | 'profile' | 'community' | 'admin'>(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam === 'community' || tabParam === 'admin' || tabParam === 'profile' || tabParam === 'home') {
        return tabParam;
      }
      const hash = window.location.hash.replace('#', '');
      if (hash === 'community' || hash === 'admin' || hash === 'profile' || hash === 'home') {
        return hash as any;
      }
    }
    return 'home';
  });

  const handleGlobalRefresh = async () => {
    if (activeTab === 'home') {
      await fetchData(true); // Force refresh from DB when switching to home
    }
    setRefreshKey(prev => prev + 1);
    // Give a little extra feedback time
    await new Promise(resolve => setTimeout(resolve, 800));
  };

  // Refresh data when closing course viewer
  useEffect(() => {
    if (!viewingCourseId && courses.length > 0) {
      const cacheKey = `dashboard_data_${user.id}`;
      dataCache.invalidate(cacheKey);
      fetchData(true);
    }
  }, [viewingCourseId]);

  useEffect(() => {
    // Only update hash if it's not already correct to avoid unnecessary history changes
    if (window.location.hash !== `#${activeTab}`) {
      window.history.replaceState(null, '', `#${activeTab}`);
    }
    
    // If switching back to home, refresh progress
    if (activeTab === 'home' && courses.length > 0) {
       fetchData(true);
    }

    // Always scroll to top when changing tabs
    window.scrollTo(0, 0);
  }, [activeTab]);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showPWAInstall, setShowPWAInstall] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [canInstall, setCanInstall] = useState(!isPWAInstalled());

  // Check installation status less frequently
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    const interval = setInterval(() => {
      if (isPWAInstalled()) {
        setCanInstall(false);
      }
    }, 10000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    
    const init = async () => {
      if (mounted) {
        await fetchData();
      }
    };

    init();

    // Subscribe to real-time progress updates
    const channel = supabase
      .channel(`user_progress_dashboard_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_progress',
          filter: `user_id=eq.${user.id}`
        },
        async () => {
          console.log('Real-time progress update detected');
          // Invalidate cache and fetch only progress
          const cacheKey = `dashboard_data_${user.id}`;
          dataCache.invalidate(cacheKey);
          
          const { data: progressData } = await supabase
            .from('user_progress')
            .select('*')
            .eq('user_id', user.id);
            
          if (mounted && progressData) {
            setUserProgress(progressData);
          }
        }
      )
      .subscribe();
    
    const safetyTimeout = setTimeout(() => {
      if (mounted) setLoading(false);
    }, 8000);
    
    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  useEffect(() => {
    // Preload important assets
    if (settings.banner_images?.length) {
      settings.banner_images.slice(0, 2).forEach((url: string) => {
        const img = new Image();
        img.src = url;
      });
    }

    // Low-friction registration check
    const checkStatus = async () => {
      if (typeof window === 'undefined') return;
      
      onForegroundMessage();

      if ('Notification' in window) {
        if (Notification.permission === 'granted') {
          await requestNotificationPermission(user.id);
        } else if (Notification.permission === 'default') {
          const dismissed = localStorage.getItem(`push_modal_dismissed_${user.id}`);
          if (!dismissed) {
            setTimeout(() => setShowWelcomeModal(true), 2000);
          }
        }
      }
    };

    checkStatus();
  }, [user.id, settings.banner_images]);

  const fetchData = async (forceNoCache = false) => {
    if (!user?.id) return;
    
    const cacheKey = `dashboard_data_${user.id}`;
    const cachedData = forceNoCache ? null : dataCache.get(cacheKey);
    
    if (cachedData) {
      setCourses(cachedData.courses);
      setPurchases(cachedData.purchases);
      setUserProgress(cachedData.userProgress);
      setCourseStats(cachedData.courseStats);
      setCourseChapters(cachedData.courseChapters);
      setLoading(false);
    }

    try {
      const isUUID = (str?: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str || '');

      // Execute primary queries safely
      const [coursesRes, purchasesByIdRes, progressRes, packagesRes, chaptersRes] = await Promise.all([
        supabase.from('courses').select('*').eq('is_active', true),
        supabase.from('purchases').select('product_id, created_at').eq('user_id', user.id),
        supabase.from('user_progress').select('*').eq('user_id', user.id),
        supabase.from('course_packages').select('id, hotmart_product_id, hotmart_checkout_url, package_courses(course_id)'),
        supabase.from('chapters').select('id, content_type, modules!inner(course_id)'),
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (purchasesByIdRes.error) throw purchasesByIdRes.error;
      if (progressRes.error) throw progressRes.error;
      if (chaptersRes.error) throw chaptersRes.error;

      // Handle purchases by email if applicable (only if user.id is not a UUID or if table supports string user_id)
      let basePurchases = purchasesByIdRes.data || [];
      if (user.email && user.email.toLowerCase() !== user.id && !isUUID(user.id)) {
        try {
          const { data: emailPurchases, error: emailPurErr } = await supabase
            .from('purchases')
            .select('product_id, created_at')
            .eq('user_id', user.email.toLowerCase());
          if (!emailPurErr && emailPurchases && emailPurchases.length > 0) {
            const existingProductIds = new Set(basePurchases.map(p => p.product_id));
            emailPurchases.forEach(ep => {
              if (!existingProductIds.has(ep.product_id)) {
                basePurchases.push(ep);
                existingProductIds.add(ep.product_id);
              }
            });
          }
        } catch {
          // Ignore type mismatch errors
        }
      }

      // Handle profile safely
      let profileData = null;
      if (isUUID(user.id)) {
        const { data } = await supabase
          .from('profiles')
          .select('has_access, has_unlimited_ai, is_admin')
          .eq('id', user.id)
          .maybeSingle();
        profileData = data;
      }
      if (!profileData && user.email) {
        const { data } = await supabase
          .from('profiles')
          .select('has_access, has_unlimited_ai, is_admin')
          .eq('email', user.email.toLowerCase())
          .maybeSingle();
        profileData = data;
      }

      if (profileData) {
        setUserProfile(profileData);
      }
      const purchasedIds = basePurchases.map(p => p.product_id);
      
      const unlockedByPackages = new Set<string>();
      const packageUnlockDates: Record<string, string> = {}; 
      const courseToPackageCheckout: Record<string, string> = {};

      packagesRes.data?.forEach(pkg => {
        if (pkg.hotmart_checkout_url) {
          pkg.package_courses?.forEach((pc: any) => {
            if (!courseToPackageCheckout[pc.course_id]) {
              courseToPackageCheckout[pc.course_id] = pkg.hotmart_checkout_url!;
            }
          });
        }

        const purchase = basePurchases.find(p => p.product_id === pkg.hotmart_product_id || p.product_id === pkg.id);
        if (purchase) {
          pkg.package_courses?.forEach((pc: any) => {
            unlockedByPackages.add(pc.course_id);
            packageUnlockDates[pc.course_id] = purchase.created_at;
          });
        }
      });

      const mainPrice = parseFloat(settings?.custom_texts?.['main_price'] || '0') || 0;
      const mainCheckoutUrl = settings?.custom_texts?.['main_checkout_url'] || '';

      const processedCourses = coursesRes.data?.map(c => {
        const isMainCourse = !!c.is_free && !c.is_bonus;
        return {
          ...c,
          price: isMainCourse ? mainPrice : c.price,
          checkout_url: isMainCourse ? mainCheckoutUrl : (courseToPackageCheckout[c.id] || c.checkout_url)
        };
      }) || [];
      
      // Combine base purchases with package-unlocked courses
      const allPurchases = [...basePurchases];
      Array.from(unlockedByPackages).forEach(id => {
        if (!purchasedIds.includes(id)) {
          allPurchases.push({ product_id: id, created_at: packageUnlockDates[id] });
        }
      });

      let stats: Record<string, { lessons: number, materials: number }> = {};
      let chapterMap: Record<string, string[]> = {};

      if (chaptersRes.data) {
        chaptersRes.data.forEach((ch: any) => {
          const courseId = ch.modules.course_id;
          if (!stats[courseId]) stats[courseId] = { lessons: 0, materials: 0 };
          if (!chapterMap[courseId]) chapterMap[courseId] = [];
          
          chapterMap[courseId].push(ch.id);
          if (ch.content_type === 'video') stats[courseId].lessons++;
          else stats[courseId].materials++;
        });
      }

      setCourses(processedCourses);
      setPurchases(allPurchases);
      setUserProgress(progressRes.data || []);
      setCourseStats(stats);
      setCourseChapters(chapterMap);

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
      if (error && error.message?.includes('Refresh Token Not Found')) {
        console.warn('Session expired during usage, clearing...');
        localStorage.removeItem('maternidade_premium_auth');
        await supabase.auth.signOut();
        window.location.reload();
        return;
      }
      toast.error(t('dashboard.loading_error') || 'Erro ao carregar conteúdos');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = useMemo(() => {
    return !!user?.email && (
      (settings?.admin_email && user.email.toLowerCase() === settings.admin_email.toLowerCase()) ||
      user.email.toLowerCase() === 'gabrielchendes@gmail.com'
    );
  }, [user, settings]);

  const isUnlocked = useCallback((course: Course) => {
    // 1. If it has a direct purchase or is part of an owned package, it's unlocked
    if (purchases.some(p => p.product_id === course.id)) return true;

    // 2. If a course is a Main Product (is_free = true, is_bonus = false), it's always unlocked for all users
    const isMainCourse = !!course.is_free && !course.is_bonus;
    if (isMainCourse) return true;

    // 3. If it's exclusive to package, it's ONLY unlocked if owned (handled by purchases check above)
    if (course.is_package_exclusive_bonus) return false;

    // 4. If it's marked as free, it's unlocked (standard free courses)
    if (course.is_free) return true;
    
    // 5. If it's a general bonus course (not exclusive), it's usually unlocked for everyone
    if (course.is_bonus) return true;

    // 6. Administrador tem acesso mestre/liberado a todos os outros cursos, EXCEPT paid courses that are not purchased,
    // so they can test the purchase flow on the dashboard.
    const isPaidCourse = !course.is_free && !course.is_bonus;
    if (isAdmin && !isPaidCourse) return true;

    return false;
  }, [purchases, courses, isAdmin]);

  const handleOpenCourse = useCallback(async (course: Course) => {
    if (isUnlocked(course)) {
      // Update last viewed for the "Resume" button
      localStorage.setItem(`last_viewed_${user.id}`, JSON.stringify({
        courseId: course.id,
        timestamp: Date.now()
      }));

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

  const unlockedCourses = useMemo(() => {
    return courses.filter(p => isUnlocked(p) && !p.is_bonus);
  }, [courses, isUnlocked]);

  const mainCourses = useMemo(() => {
    // 1. Default free/main courses
    const defaultList = courses.filter(c => !!c.is_free && !c.is_bonus);
    const sortedDefault = [...defaultList].sort((a, b) => {
      const orderA = a.order_index ?? 9999;
      const orderB = b.order_index ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    // 2. Paid courses that are purchased
    const purchasedPaidList = courses.filter(c => !c.is_free && !c.is_bonus && purchases.some(p => p.product_id === c.id));
    const sortedPurchasedPaid = [...purchasedPaidList].sort((a, b) => {
      const orderA = a.order_index ?? 9999;
      const orderB = b.order_index ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    // 3. Combine: default free courses first, purchased paid courses always at the end!
    return [...sortedDefault, ...sortedPurchasedPaid];
  }, [courses, purchases]);

  const paidCourses = useMemo(() => {
    // Paid courses that are NOT purchased
    const list = courses.filter(c => !c.is_free && !c.is_bonus && !purchases.some(p => p.product_id === c.id));
    return [...list].sort((a, b) => {
      const orderA = a.order_index ?? 9999;
      const orderB = b.order_index ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
  }, [courses, purchases]);

  const bonusCourses = useMemo(() => {
    const list = courses.filter(p => !!p.is_bonus && isUnlocked(p));
    return [...list].sort((a, b) => {
      const orderA = a.order_index ?? 9999;
      const orderB = b.order_index ?? 9999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });
  }, [courses, isUnlocked]);

  const globalStats = useMemo(() => {
    const allUnlocked = [...unlockedCourses, ...bonusCourses];
    if (allUnlocked.length === 0) return { totalProgress: 0, lastCourse: undefined };

    let totalChapters = 0;
    let completedChapters = 0;
    let lastActiveCourse: any = undefined;
    let maxProgress = -1;

    // Try to get from localStorage first
    const lastViewedStr = localStorage.getItem(`last_viewed_${user.id}`);
    if (lastViewedStr) {
      try {
        const lastViewed = JSON.parse(lastViewedStr);
        const course = allUnlocked.find(c => c.id === lastViewed.courseId);
        if (course) {
           const progress = getCourseProgress(course.id);
           if (progress < 100) {
             lastActiveCourse = {
               id: course.id,
               title: course.title,
               cover_url: course.cover_url,
               progress: Math.round(progress)
             };
           }
        }
      } catch (e) {}
    }

    allUnlocked.forEach(course => {
      try {
        const chapters = courseChapters[course.id] || [];
        totalChapters += chapters.length;
        
        const compCount = userProgress.filter(p => 
          p && p.completed && chapters.includes(p.chapter_id)
        ).length;
        
        completedChapters += compCount;
        const progress = chapters.length > 0 ? (compCount / chapters.length) * 100 : 0;
        
        // Use highest progress that is not completed as "Continue watching"
        if (progress > 0 && progress < 100 && progress > maxProgress) {
          maxProgress = progress;
          lastActiveCourse = {
            id: course.id,
            title: course.title,
            cover_url: course.cover_url,
            progress: Math.round(progress)
          };
        }
      } catch (err) {
        console.warn('Error calculating stats for course:', course.id, err);
      }
    });

    // Fallback if none are in progress
    if (!lastActiveCourse && allUnlocked.length > 0) {
      const firstNotCompleted = allUnlocked.find(c => {
         const p = getCourseProgress(c.id);
         return p < 100;
      });
      if (firstNotCompleted) {
        lastActiveCourse = {
          id: firstNotCompleted.id,
          title: firstNotCompleted.title,
          cover_url: firstNotCompleted.cover_url,
          progress: getCourseProgress(firstNotCompleted.id)
        };
      }
    }

    const totalProgress = totalChapters > 0 ? Math.round((completedChapters / totalChapters) * 100) : 0;
    
    return { totalProgress, lastCourse: lastActiveCourse };
  }, [unlockedCourses, bonusCourses, courseChapters, userProgress]);

  const lastProgressRef = useRef<number>(globalStats.totalProgress);

  // Track milestones and show "Parabéns"
  useEffect(() => {
    // Check if progress actually increased
    const hasIncreased = globalStats.totalProgress > lastProgressRef.current;
    lastProgressRef.current = globalStats.totalProgress;

    if (!hasIncreased || globalStats.totalProgress <= 0) return;

    const storageKey = `milestone_celebrated_${user.id}`;
    const celebratedMilestones = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // Milestones are 25, 50, 75, 100
    const currentMilestone = [25, 50, 75, 100].reverse().find(m => globalStats.totalProgress >= m);

    if (currentMilestone && !celebratedMilestones.includes(currentMilestone)) {
      // Save to persistent localStorage so it never repeats for this user
      celebratedMilestones.push(currentMilestone);
      localStorage.setItem(storageKey, JSON.stringify(celebratedMilestones));
      
      const messages = {
        25: settings.custom_texts?.['celebration.25'] || t('celebration.25') || "🔥 Parabéns! Você já conquistou 25% do conteúdo! Continue assim!",
        50: settings.custom_texts?.['celebration.50'] || t('celebration.50') || "⭐ Sensacional! Metade do caminho já foi! O topo está próximo!",
        75: settings.custom_texts?.['celebration.75'] || t('celebration.75') || "🚀 Impressionante! 75% concluído. Você é pura determinação!",
        100: settings.custom_texts?.['celebration.100'] || t('celebration.100') || "🏆 LENDÁRIO! 100% CONCLUÍDO! Você dominou todo o conteúdo! Parabéns!"
      };

      toast.success(messages[currentMilestone as keyof typeof messages] || `Incrível! Você alcançou ${currentMilestone}% de progresso!`, {
        duration: 5000,
        icon: currentMilestone === 100 ? '🏆' : '✨',
        position: 'top-center'
      });
    }
  }, [globalStats.totalProgress, user.id]);

  // Full-screen loading only if we have NO data at all
  const hasCoursesLoaded = courses.length > 0;
  
  if (loading && !hasCoursesLoaded) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-[#0b0c10]">
      <AnimatePresence>
        {viewingCourseId && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[250]"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
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
        onOpenAi={() => setIsAiModalOpen(true)}
        isAiOpen={isAiModalOpen}
        canInstall={canInstall}
        onInstall={() => setShowPWAInstall(true)}
        totalProgress={globalStats.totalProgress}
        onOpenProgress={() => setShowProgressModal(true)}
      />

      {/* Tab Content and Transitions */}
      {isAiModalOpen ? (
        <div className="fixed inset-0 bg-black z-10 w-full h-full" />
      ) : (
        <div className={cn(
          "w-full pb-32",
          activeTab !== 'home' ? "pt-20 min-h-screen" : "min-h-screen"
        )}>
          {activeTab === 'home' ? (
              <PullToRefresh onRefresh={handleGlobalRefresh}>
                <div className="flex flex-col">
                  {/* Banner Section */}
                  <div className="w-full">
                    <BannerCarousel 
                      images={(settings.banner_sync !== false) 
                        ? (settings.banner_images || []) 
                        : (getDeviceType() === 'desktop' ? (settings.banner_images || []) : (settings.banner_images_mobile || settings.banner_images || []))
                      } 
                      interval={settings.banner_interval || 5000} 
                      config={(settings.banner_sync !== false)
                        ? (settings.banner_config || [])
                        : (getDeviceType() === 'desktop' ? (settings.banner_config || []) : (settings.banner_config_mobile || settings.banner_config || []))
                      }
                    />
                  </div>

                  {/* Gamification Header */}
                  <SmartHomeHeader 
                    totalProgress={globalStats.totalProgress} 
                    lastCourse={globalStats.lastCourse}
                    onContinueCourse={(course) => handleOpenCourse(course as any)}
                    settings={settings}
                    t={t}
                    showModal={showProgressModal}
                    onCloseModal={() => setShowProgressModal(false)}
                  />

                  {/* Content Sections */}
                  <div className="relative z-10 space-y-4 mt-2">
                    <Carousel 
                      title={settings.custom_texts?.['dashboard.courses_paid'] || t('dashboard.courses_paid') || 'Sua Jornada Principal  🔥'}
                    >
                      {mainCourses.length > 0 ? (
                        mainCourses.map(course => (
                          <ProductCard
                            key={course.id + refreshKey}
                            product={course}
                            isUnlocked={isUnlocked(course)}
                            progress={getCourseProgress(course.id)}
                            stats={courseStats[course.id]}
                            settings={settings}
                            onOpen={handleOpenCourse}
                          />
                        ))
                      ) : (
                        <div className="w-full h-48 flex flex-col items-center justify-center text-gray-600 border border-white/5 rounded-3xl bg-white/5">
                          <Book size={32} className="mb-4 opacity-20" />
                          <p className="font-bold text-xs uppercase tracking-widest text-center px-4">
                            {settings.custom_texts?.['dashboard.empty_locked'] || t('dashboard.empty_locked') || 'Você ainda não possui cursos liberados.'}
                          </p>
                        </div>
                      )}
                    </Carousel>

                    {bonusCourses.length > 0 && (
                      <Carousel 
                        title={settings.custom_texts?.['dashboard.courses_bonus'] || t('dashboard.courses_bonus') || 'Prêmios & Bônus Exclusivos  🎁'}
                      >
                        {bonusCourses.map(course => (
                          <ProductCard
                            key={course.id + refreshKey}
                            product={course}
                            isUnlocked={true}
                            progress={getCourseProgress(course.id)}
                            stats={courseStats[course.id]}
                            settings={settings}
                            onOpen={handleOpenCourse}
                          />
                        ))}
                      </Carousel>
                    )}

                    <Carousel 
                      title={settings.custom_texts?.['dashboard.courses_free'] || t('dashboard.courses_free') || 'Acelere sua Evolução  🚀'}
                    >
                      {paidCourses.length > 0 ? (
                        paidCourses.map(course => (
                          <ProductCard
                            key={course.id + refreshKey}
                            product={course}
                            isUnlocked={isUnlocked(course)}
                            progress={getCourseProgress(course.id)}
                            stats={courseStats[course.id]}
                            settings={settings}
                            onOpen={handleOpenCourse}
                          />
                        ))
                      ) : (
                        <div className="w-full py-16 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl">
                          <p className="font-bold text-center px-4">{settings.custom_texts?.['dashboard.empty_all_unlocked'] || t('dashboard.empty_all_unlocked') || 'Você já possui todos os cursos disponíveis!'}</p>
                        </div>
                      )}
                    </Carousel>

                    <SupportSection page="home" settings={settings} t={t} />
                  </div>
                </div>
              </PullToRefresh>
            ) : activeTab === 'community' ? (
                <PullToRefresh onRefresh={handleGlobalRefresh}>
                  <Suspense fallback={<ComponentLoader />}>
                    <Community key={`community-${refreshKey}`} user={user} />
                  </Suspense>
                  <SupportSection page="community" settings={settings} t={t} />
                </PullToRefresh>
              ) : activeTab === 'admin' ? (
                <Suspense fallback={<ComponentLoader />}>
                  <AdminPanel key={`admin-${refreshKey}`} user={user} />
                </Suspense>
              ) : (
                <PullToRefresh onRefresh={handleGlobalRefresh}>
                  <Suspense fallback={<ComponentLoader />}>
                    <Profile 
                      key={`profile-${refreshKey}`} 
                      user={user} 
                      canInstall={canInstall}
                      onInstall={() => setShowPWAInstall(true)}
                    />
                  </Suspense>
                  <SupportSection page="profile" settings={settings} t={t} />
                </PullToRefresh>
              )}
        </div>
      )}

      <CoursePurchaseModal
        isOpen={!!selectedCourse}
        onClose={() => setSelectedCourse(null)}
        title={selectedCourse?.title || ''}
        subtitle={selectedCourse?.subtitle}
        description={selectedCourse?.description || ''}
        image={selectedCourse?.premium_cover_url || selectedCourse?.cover_url || ''}
        price={selectedCourse?.price || 0}
        oldPrice={selectedCourse?.old_price}
        benefits={selectedCourse?.benefits}
        ctaText={selectedCourse?.cta_text}
        previewEnabled={selectedCourse?.preview_enabled}
        previewUrl={selectedCourse?.preview_url}
        previewText={selectedCourse?.preview_text}
        socialProof={selectedCourse?.social_proof}
        showLifetimeBadge={selectedCourse?.show_lifetime_badge}
        premiumBadgeText={selectedCourse?.premium_badge_text}
        offerBadgeText={selectedCourse?.offer_badge_text}
        lifetimeBadgeText={selectedCourse?.lifetime_badge_text}
        paymentLabelText={selectedCourse?.payment_label_text}
        securePaymentLabel={selectedCourse?.secure_payment_label}
        instantAccessLabel={selectedCourse?.instant_access_label}
        onPurchase={handleSimulatePurchase}
        onPreview={() => {
          if (selectedCourse) {
            setPreviewCourse(selectedCourse);
          }
        }}
      />

      {/* Improved Course Preview Experience */}
      <AnimatePresence>
        {previewCourse && (
          <Suspense fallback={<div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[310] backdrop-blur-md"><Loader2 className="animate-spin text-primary" size={48} /></div>}>
            <CoursePreviewViewer 
              course={previewCourse} 
              onClose={() => setPreviewCourse(null)}
              onPurchase={() => {
                setPreviewCourse(null);
                // handleSimulatePurchase uses selectedCourse, but we can call it directly if we ensure it's still set
                // or just handle it here Since we are in the dashboard, we know handleSimulatePurchase exists
                if (previewCourse.checkout_url) {
                  window.location.href = previewCourse.checkout_url;
                } else {
                  toast.error(t('course.purchase_unavailable') || 'Este curso ainda não possui um link de compra configurado.');
                }
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>

      {!viewingCourseId && (
        <BottomNav 
          activeTab={activeTab} 
          onTabChange={setActiveTab} 
          onOpenAi={() => setIsAiModalOpen(true)}
          isAiOpen={isAiModalOpen}
          userEmail={user.email} 
        />
      )}
      <FloatingWhatsApp page={activeTab as any} />
      <AiAssistantModal 
        userId={user?.id}
        userEmail={user?.email}
        userName={user?.user_metadata?.full_name || user?.email?.split('@')[0]} 
        userAvatar={user?.user_metadata?.avatar_url}
        isOpen={isAiModalOpen}
        onClose={() => setIsAiModalOpen(false)}
        hasUnlimitedAi={
          (userProfile?.has_unlimited_ai === false || user?.user_metadata?.has_unlimited_ai === false)
            ? false
            : Boolean(
                userProfile?.has_unlimited_ai === true || 
                userProfile?.is_admin === true ||
                user?.user_metadata?.has_unlimited_ai === true
              )
        }
      />
      
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

      {/* Access Denied / Inactive Subscription Overlay */}
      {userProfile && userProfile.has_access === false && !isAdmin && (
        <AccessDeniedModal userEmail={user.email || ''} />
      )}
    </div>
  );
}
