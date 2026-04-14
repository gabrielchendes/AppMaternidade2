import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import BottomNav from '../components/BottomNav';
import Carousel from '../components/Carousel';
import ProductCard from '../components/ProductCard';
import Profile from '../components/Profile';
import Community from '../components/Community';
import AdminPanel from '../components/AdminPanel';
import CourseViewer from '../components/CourseViewer';
import { toast } from 'sonner';
import { X, ShoppingBag, Loader2, Play, BookOpen, Star, Sparkles, Phone, Mail as MailIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { requestNotificationPermission, onForegroundMessage } from '../lib/pushNotifications';
import { createNotification } from '../lib/notifications';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { Course } from '../types/lms';

interface DashboardProps {
  user: User;
}

export default function Dashboard({ user }: DashboardProps) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseStats, setCourseStats] = useState<Record<string, { lessons: number, materials: number }>>({});
  const [purchases, setPurchases] = useState<string[]>([]);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'home' | 'profile' | 'community' | 'admin'>('home');

  useEffect(() => {
    fetchData();
    
    const setupPush = async () => {
      const granted = await requestNotificationPermission(user.id);
      if (granted) {
        onForegroundMessage();
      }
    };
    setupPush();
  }, [user.id]);

  const fetchData = async () => {
    try {
      const [coursesRes, productsRes, purchasesRes, progressRes] = await Promise.all([
        supabase.from('courses').select('*').eq('is_active', true),
        supabase.from('products').select('*').eq('is_active', true),
        supabase.from('purchases').select('product_id').eq('user_id', user.id),
        supabase.from('user_progress').select('*').eq('user_id', user.id)
      ]);

      if (coursesRes.error) throw coursesRes.error;
      if (productsRes.error) throw productsRes.error;
      if (purchasesRes.error) throw purchasesRes.error;
      if (progressRes.error) throw progressRes.error;

      // Merge courses and products (legacy)
      const allCourses: Course[] = [
        ...(coursesRes.data || []),
        ...(productsRes.data || []).map(p => ({
          ...p,
          tenant_id: p.tenant_id || 'default-tenant'
        }))
      ];

      // Remove duplicates by ID (preferring 'courses' table if same ID exists)
      const uniqueCourses = allCourses.reduce((acc: Course[], curr) => {
        if (!acc.find(c => c.id === curr.id)) {
          acc.push(curr);
        }
        return acc;
      }, []);

      setCourses(uniqueCourses);
      setPurchases(purchasesRes.data?.map(p => p.product_id) || []);
      setUserProgress(progressRes.data || []);

      // Fetch stats for each course
      const { data: chaptersData } = await supabase.from('chapters').select('id, content_type, modules!inner(course_id)');
      if (chaptersData) {
        const stats: Record<string, { lessons: number, materials: number }> = {};
        chaptersData.forEach((ch: any) => {
          const courseId = ch.modules.course_id;
          if (!stats[courseId]) stats[courseId] = { lessons: 0, materials: 0 };
          if (ch.content_type === 'video') stats[courseId].lessons++;
          else stats[courseId].materials++;
        });
        setCourseStats(stats);
      }
    } catch (error: any) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar conteúdos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCourse = (course: Course) => {
    if (isUnlocked(course)) {
      // If it's a legacy product with a PDF URL but no chapters/modules, open the PDF
      if (course.pdf_url && !viewingCourseId) {
        window.open(course.pdf_url, '_blank');
        return;
      }
      setViewingCourseId(course.id);
    } else {
      setSelectedCourse(course);
    }
  };

  const handleSimulatePurchase = async () => {
    if (!selectedCourse) return;
    
    if (selectedCourse.checkout_url) {
      window.location.href = selectedCourse.checkout_url;
      return;
    }

    // Fallback if no checkout URL is set
    toast.error('Este curso ainda não possui um link de compra configurado.');
  };

  const isUnlocked = (course: Course) => {
    return course.is_free || course.is_bonus || purchases.includes(course.id);
  };

  const getCourseProgress = (courseId: string) => {
    // This would ideally be calculated based on total chapters in the course
    // For now, we'll return a placeholder or calculate if we have chapters data
    return 0; 
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 bg-[#0f0f0f]">
      <Navbar user={user} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'home' ? (
        <>
          {/* Hero Section */}
          <div className="relative h-[85vh] w-full overflow-hidden mb-[-150px]">
            <img
              src="https://picsum.photos/seed/maternity-hero/1920/1080"
              className="w-full h-full object-cover opacity-50 scale-105"
              alt="Hero"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f0f0f] via-[#0f0f0f]/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-[#0f0f0f] via-transparent to-transparent" />
            
            <div className="absolute bottom-60 left-0 right-0 md:left-16 md:right-auto px-6 md:px-0 flex flex-col items-center md:items-start text-center md:text-left space-y-8">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-4 py-1.5 bg-primary/20 backdrop-blur-md rounded-full border border-primary/30"
              >
                <Sparkles className="text-primary" size={16} />
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Conteúdo Exclusivo</span>
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter leading-[0.9] text-white"
              >
                JORNADA DA <br /> <span className="text-primary italic">MATERNIDADE</span>
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-base md:text-xl text-gray-400 leading-relaxed max-w-md md:max-w-2xl font-medium"
              >
                O guia definitivo para mães de primeira viagem. Aprenda tudo sobre os primeiros meses, 
                cuidados essenciais e bem-estar emocional.
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-4 pt-4"
              >
              </motion.div>
            </div>
          </div>

          {/* Content Sections */}
          <div className="relative z-10 space-y-12 pb-20">
            <Carousel title="Meus Cursos 📚">
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
                <div className="w-full py-16 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-3xl mx-12">
                  <Star size={40} className="mb-4 opacity-20" />
                  <p className="font-bold">Você ainda não possui cursos liberados.</p>
                </div>
              )}
            </Carousel>

            {courses.filter(p => p.is_bonus && isUnlocked(p)).length > 0 && (
              <Carousel title="Meus Bônus 🎁">
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

            <Carousel title="Novos Lançamentos 🚀">
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
                  <p className="font-bold">Você já possui todos os cursos disponíveis!</p>
                </div>
              )}
            </Carousel>

            {settings.show_support_app && (
              <div className="px-6 md:px-16 pt-12 pb-20">
                <div className="bg-zinc-900/50 border border-white/10 rounded-[2.5rem] p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="space-y-2 text-center md:text-left">
                    <h3 className="text-2xl md:text-3xl font-black text-white uppercase tracking-tighter italic">
                      Precisa de <span className="text-primary">Suporte?</span>
                    </h3>
                    <p className="text-gray-500 font-medium max-w-md">
                      Nossa equipe está pronta para te ajudar com qualquer dúvida ou problema técnico.
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-4">
                    {settings.support_whatsapp_enabled && settings.support_whatsapp && (
                      <a 
                        href={`https://wa.me/${settings.support_whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-black rounded-2xl shadow-xl shadow-green-500/20 transition-all active:scale-95"
                      >
                        <Phone size={20} /> WHATSAPP
                      </a>
                    )}
                    {settings.support_email_enabled && settings.support_email && (
                      <a 
                        href={`mailto:${settings.support_email}`}
                        className="flex items-center gap-3 px-8 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl border border-white/10 transition-all active:scale-95"
                      >
                        <MailIcon size={20} /> EMAIL
                      </a>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      ) : activeTab === 'community' ? (
        <div className="pt-24">
          <Community user={user} />
        </div>
      ) : activeTab === 'admin' ? (
        <div className="pt-24">
          <AdminPanel user={user} />
        </div>
      ) : (
        <div className="pt-24">
          <Profile user={user} />
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
                      <Star size={12} className="fill-primary" /> CONTEÚDO PREMIUM
                    </div>
                    <h2 className="text-4xl md:text-5xl font-black leading-[0.9] text-white">{selectedCourse.title}</h2>
                    <div className="flex items-center gap-4">
                      <div className="text-3xl font-black text-white">
                        R$ {(selectedCourse.price / 100).toFixed(2).replace('.', ',')}
                      </div>
                      <span className="px-3 py-1 bg-white/5 rounded-full text-[10px] font-black text-gray-500 uppercase tracking-widest border border-white/10">
                        Acesso Vitalício
                      </span>
                    </div>
                  </div>

                  <p className="text-gray-400 leading-relaxed text-lg font-medium">
                    {selectedCourse.description || 'Este conteúdo exclusivo oferece insights valiosos e ferramentas práticas para sua jornada na maternidade. Desenvolvido por especialistas para garantir o melhor para você e seu bebê.'}
                  </p>

                  <div className="mt-auto pt-8 border-t border-white/5 space-y-6">
                    <button
                      onClick={handleSimulatePurchase}
                      className="w-full bg-primary hover:bg-primary-hover text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-primary/30 transition-all active:scale-[0.98]"
                    >
                      <ShoppingBag size={24} />
                      LIBERAR ACESSO AGORA
                    </button>
                    <p className="text-center text-[10px] text-gray-600 font-bold uppercase tracking-widest">
                      Pagamento 100% Seguro • Acesso Imediato
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Course Viewer Modal */}
      {viewingCourseId && (
        <CourseViewer 
          courseId={viewingCourseId} 
          userId={user.id} 
          onClose={() => setViewingCourseId(null)} 
        />
      )}

      {!viewingCourseId && <BottomNav activeTab={activeTab} onTabChange={setActiveTab} userEmail={user.email} />}
    </div>
  );
}
