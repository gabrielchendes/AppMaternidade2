import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import BannerCarousel from '../components/BannerCarousel';
import Carousel from '../components/Carousel';
import ProductCard from '../components/ProductCard';
import Profile from '../components/Profile';
import Community from '../components/Community';
import AdminPanel from '../components/AdminPanel';
import CourseViewer from '../components/CourseViewer';
import FloatingWhatsApp from '../components/FloatingWhatsApp';
import { toast } from 'sonner';
import { X, ShoppingBag, Loader2, Play, BookOpen, Star, Sparkles, Phone, Mail as MailIcon, MessageCircle, Book } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requestNotificationPermission, onForegroundMessage } from '../lib/pushNotifications';
import { createNotification } from '../lib/notifications';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { Course } from '../types/lms';

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
            {settings.custom_texts?.['auth.support_description'] || 'Nossa equipe está pronta para te ajudar com qualquer dúvida ou problema técnico.'}
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
              <Phone size={20} /> {settings.custom_texts?.['auth.whatsapp_label'] || 'WHATSAPP'}
            </a>
          )}
          {emailEnabled && settings.support_email && (
            <a 
              href={`mailto:${settings.support_email}`}
              className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl border border-white/10 transition-all active:scale-95"
            >
              <MailIcon size={20} /> {settings.custom_texts?.['auth.email_label'] || 'EMAIL'}
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
  const [activeTab, setActiveTab] = useState<'home' | 'profile' | 'community' | 'admin'>('home');

  useEffect(() => {
    fetchData();
    
    // Preload banner images
    if (settings.banner_images?.length) {
      settings.banner_images.slice(0, 3).forEach((url: string) => {
        const img = new Image();
        img.src = url;
      });
    }

    // Low-friction registration check
    const checkPushStatus = async () => {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      
      // If already granted, ensure token is saved/refreshed in Supabase
      if (Notification.permission === 'granted') {
        onForegroundMessage();
        await requestNotificationPermission(user.id);
      } 
      // If default, we don't force anymore, just wait for a natural interaction
    };

    // Run once on load
    checkPushStatus();
    
    // Optional: Re-check if user changes permission in browser settings
    const interval = setInterval(checkPushStatus, 10000);
    return () => clearInterval(interval);
  }, [user.id]);

  const fetchData = async () => {
    try {
      console.log('🔎 Query Supabase: courses, purchases, user_progress, course_packages');
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

      // Logic: If user has a purchase with a Hotmart ID that matches a package, unlock all courses in that package
      packagesRes.data?.forEach(pkg => {
        // Map courses to their package checkout URL (preferring packages with checkout URLs)
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

      setCourses(coursesRes.data?.map(c => ({
        ...c,
        checkout_url: courseToPackageCheckout[c.id] || c.checkout_url // Fallback to course's own checkout if package doesn't have one
      })) || []);
      setPurchases([...basePurchases, ...Array.from(unlockedByPackages)]);
      setUserProgress(progressRes.data || []);

      // Fetch stats and chapter mappings for each course
      console.log('🔎 Query Supabase: chapters (select)');
      const { data: chaptersData } = await supabase.from('chapters').select('id, content_type, modules!inner(course_id)');
      if (chaptersData) {
        const stats: Record<string, { lessons: number, materials: number }> = {};
        const chapterMap: Record<string, string[]> = {};
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
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar conteúdos');
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

    toast.error('Este curso ainda não possui um link de compra configurado.');
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

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-main flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-bg-main">
      <AnimatePresence>
        {viewingCourseId && (
          <CourseViewer 
            courseId={viewingCourseId} 
            userId={user.id} 
            onClose={() => setViewingCourseId(null)} 
          />
        )}
      </AnimatePresence>

      <Navbar user={user} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'home' ? (
        <>
          {/* Banner Section */}
          <div className="w-full pb-12">
            <BannerCarousel 
              images={settings.banner_images || []} 
              interval={settings.banner_interval || 5000} 
            />
          </div>

          {/* Content Sections */}
          <div className="relative z-10 space-y-12 pb-20">
            <Carousel title={settings.custom_texts?.['dashboard.courses_paid'] || 'Meus Cursos'}>
              {courses.filter(p => isUnlocked(p) && !p.is_bonus).length > 0 ? (
                courses.filter(p => isUnlocked(p) && !p.is_bonus).map(course => (
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
              {courses.filter(p => !isUnlocked(p)).length > 0 ? (
                courses.filter(p => !isUnlocked(p)).map(course => (
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

            {courses.filter(p => p.is_bonus && isUnlocked(p)).length > 0 && (
              <Carousel title={settings.custom_texts?.['dashboard.courses_bonus'] || 'Meus Bônus'}>
                {courses.filter(p => p.is_bonus && isUnlocked(p)).map(course => (
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
          <Community user={user} />
          <SupportSection page="community" settings={settings} t={t} />
        </div>
      ) : activeTab === 'admin' ? (
        <div className="pt-24">
          <AdminPanel user={user} />
        </div>
      ) : (
        <div className="pt-24">
          <Profile user={user} />
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
    </div>
  );
}
