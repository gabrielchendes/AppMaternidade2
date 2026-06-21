import React, { useState, useEffect } from 'react';
import { 
  Plus,
  Trash2,
  Video,
  FileText,
  Save,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Clock,
  X,
  Loader2,
  CheckCircle2,
  Settings,
  PlusCircle,
  Image as ImageIcon,
  Check,
  Play,
  Sparkles,
  Star,
  PlayCircle,
  ShieldCheck,
  Layout,
  Layers,
  Monitor,
  Eye,
  Users,
  Award,
  MessageSquare,
  Link,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Module, Chapter } from '../types/lms';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import CoursePreviewViewer from './CoursePreviewViewer';

interface CourseEditorProps {
  courseId?: string;
  onClose: () => void;
  packages?: any[];
}

export default function CourseEditor({ courseId: initialCourseId, onClose, packages: externalPackages }: CourseEditorProps) {
  const [courseId, setCourseId] = useState<string | undefined>(initialCourseId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showModuleEditor, setShowModuleEditor] = useState(false);
  const [editingModule, setEditingModule] = useState<Partial<Module>>({ title: '' });

  // Course State
  const [course, setCourse] = useState<Partial<Course>>({
    title: '',
    description: '',
    is_active: true,
    is_free: true,
    is_bonus: false,
    cover_url: '',
    price: 0,
    old_price: 0,
    subtitle: '',
    benefits: [],
    order_index: 0,
    cta_text: 'QUERO COMEÇAR AGORA',
    preview_bonus_title: 'Benefícios Exclusivos Inclusos',
    preview_url: '',
    preview_text: '',
    preview_enabled: false,
    premium_badge_text: '',
    offer_badge_text: '',
    social_proof: '',
    show_lifetime_badge: true,
    lifetime_badge_text: '',
    payment_label_text: '',
    secure_payment_label: '',
    instant_access_label: '',
    premium_cover_url: '',
    checkout_url: '',
    hotmart_product_id: '',
    preview_title: '',
    preview_subtitle: '',
    preview_type: 'video',
    preview_video_url: '',
    preview_pdf_url: '',
    preview_rich_text: '',
    preview_link_text: '',
    preview_link_url: '',
    preview_link_color: '#3b82f6',
    linked_package_id: '',
    is_package_exclusive_bonus: false
  });

  // Lesson State
  const [editingChapter, setEditingChapter] = useState<Partial<Chapter>>({
    title: '',
    content_type: 'video',
    video_url: '',
    pdf_url: '',
    button_link_text: '',
    button_link_url: '',
    button_link_color: '#10b981',
    cover_url: '',
    description: '',
    rich_text: '',
    duration_minutes: 0
  });

  const [modules, setModules] = useState<Module[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [packages, setPackages] = useState<any[]>(externalPackages || []);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  useEffect(() => {
    if (!externalPackages) {
      fetchPackages();
    } else {
      setPackages(externalPackages);
    }
    
    if (courseId) {
      fetchCourseData();
    } else {
      setLoading(false);
    }
  }, [courseId, externalPackages]);

  const fetchPackages = async () => {
    try {
      const { data: pkgs } = await supabase
        .from('course_packages')
        .select('id, title, price, hotmart_checkout_url, hotmart_product_id');
      setPackages(pkgs || []);
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  };

  useEffect(() => {
    if (course.linked_package_id && packages.length > 0) {
      const selectedPkg = packages.find(p => p.id === course.linked_package_id);
      if (selectedPkg) {
        setCourse(prev => ({
          ...prev,
          price: selectedPkg.price || 0,
          checkout_url: selectedPkg.hotmart_checkout_url || '',
          hotmart_product_id: selectedPkg.hotmart_product_id || ''
        }));
      }
    }
  }, [course.linked_package_id, packages]);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      
      const { data: courseData, error: courseError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single();
      
      if (courseError) throw courseError;
      setCourse(courseData);

      const { data: modulesData, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .eq('course_id', courseId)
        .order('order_index');
      
      if (modulesError) throw modulesError;
      setModules(modulesData || []);

      const moduleIds = (modulesData || []).map(m => m.id);
      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*')
        .in('module_id', moduleIds)
        .order('order_index');
      
      if (chaptersError) throw chaptersError;
      const chaptersList = chaptersData || [];
      setChapters(chaptersList);
      
      setExpandedChapters([]);
    } catch (err) {
      console.error('Error fetching course:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCourse = async () => {
    if (!course.title) {
      toast.error('O título do curso é obrigatório');
      return;
    }

    try {
      setSaving(true);
      const isFree = course.is_free;
      const courseData = {
        title: course.title,
        description: course.description || '',
        cover_url: course.cover_url,
        is_active: course.is_active,
        is_free: isFree,
        is_bonus: course.is_bonus,
        price: (isFree && course.is_bonus) ? 0 : course.price,
        old_price: course.old_price || 0,
        subtitle: course.subtitle || '',
        benefits: (course.benefits || []).filter(b => b.trim() !== ''),
        cta_text: course.cta_text || '',
        preview_url: course.preview_url || '',
        preview_text: course.preview_text || '',
        preview_enabled: course.preview_enabled || false,
        premium_cover_url: course.premium_cover_url || '',
        premium_badge_text: course.premium_badge_text || '',
        offer_badge_text: course.offer_badge_text || '',
        social_proof: course.social_proof || '',
        show_lifetime_badge: course.show_lifetime_badge !== undefined ? course.show_lifetime_badge : true,
        lifetime_badge_text: course.lifetime_badge_text || '',
        payment_label_text: course.payment_label_text || '',
        secure_payment_label: course.secure_payment_label || '',
        instant_access_label: course.instant_access_label || '',
        preview_rating: course.preview_rating || '',
        preview_students_label: course.preview_students_label || '',
        preview_students_tag: course.preview_students_tag || '',
        preview_guarantee_label: course.preview_guarantee_label || '',
        preview_risk_zero_label: course.preview_risk_zero_label || '',
        preview_support_vip_label: course.preview_support_vip_label || '',
        preview_support_label: course.preview_support_label || '',
        preview_modules_label: course.preview_modules_label || '',
        preview_guarantee_title: course.preview_guarantee_title || '',
        preview_guarantee_subtitle: course.preview_guarantee_subtitle || '',
        preview_guarantee_description: course.preview_guarantee_description || '',
        preview_footer_cta: course.preview_footer_cta || '',
        order_index: course.order_index || 0,
        preview_bonus_title: course.preview_bonus_title || '',
        preview_title: course.preview_title || '',
        preview_subtitle: course.preview_subtitle || '',
        preview_type: course.preview_type || 'video',
        preview_video_url: course.preview_video_url || '',
        preview_pdf_url: course.preview_pdf_url || '',
        preview_rich_text: course.preview_rich_text || '',
        preview_link_text: course.preview_link_text || '',
        preview_link_url: course.preview_link_url || '',
        preview_link_color: course.preview_link_color || '#3b82f6',
        preview_show_social_proof: course.preview_show_social_proof !== undefined ? course.preview_show_social_proof : true,
        preview_show_bonus: course.preview_show_bonus !== undefined ? course.preview_show_bonus : true,
        preview_show_trust: course.preview_show_trust !== undefined ? course.preview_show_trust : true,
        checkout_url: (isFree && course.is_bonus) ? null : course.checkout_url,
        hotmart_product_id: (isFree && course.is_bonus) ? null : course.hotmart_product_id,
        linked_package_id: course.linked_package_id || null,
        is_package_exclusive_bonus: course.is_package_exclusive_bonus || false
      };

      if (courseId) {
        const { error } = await supabase.from('courses').update(courseData).eq('id', courseId);
        if (error) throw error;
        toast.success('Informações salvas!');
      } else {
        const { data, error } = await supabase.from('courses').insert([courseData]).select().single();
        if (error) throw error;
        setCourseId(data.id);
        setCourse(data);
        toast.success('Curso criado!');
      }
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChapter = async () => {
    if (!editingChapter.title) {
      toast.error('O título da aula é obrigatório');
      return;
    }

    try {
      setSaving(true);
      
      let currentCourseId = courseId;

      // Automatically save course if it doesn't exist yet
      if (!currentCourseId) {
        if (!course.title) {
          toast.error('O título do curso é obrigatório');
          setSaving(false);
          return;
        }

        const isFree = course.is_free;
        const courseData = {
          title: course.title,
          description: course.description || '',
          cover_url: course.cover_url,
          is_active: course.is_active,
          is_free: isFree,
          is_bonus: course.is_bonus,
          price: (isFree && course.is_bonus) ? 0 : course.price,
          old_price: course.old_price || 0,
          subtitle: course.subtitle || '',
          benefits: (course.benefits || []).filter(b => b.trim() !== ''),
          cta_text: course.cta_text || '',
          preview_url: course.preview_url || '',
          preview_text: course.preview_text || '',
          preview_enabled: course.preview_enabled || false,
          premium_cover_url: course.premium_cover_url || '',
          premium_badge_text: course.premium_badge_text || '',
          offer_badge_text: course.offer_badge_text || '',
          social_proof: course.social_proof || '',
          show_lifetime_badge: course.show_lifetime_badge !== undefined ? course.show_lifetime_badge : true,
          lifetime_badge_text: course.lifetime_badge_text || '',
          payment_label_text: course.payment_label_text || '',
          secure_payment_label: course.secure_payment_label || '',
          instant_access_label: course.instant_access_label || '',
          preview_rating: course.preview_rating || '',
          preview_students_label: course.preview_students_label || '',
          preview_students_tag: course.preview_students_tag || '',
          preview_guarantee_label: course.preview_guarantee_label || '',
          preview_risk_zero_label: course.preview_risk_zero_label || '',
          preview_support_vip_label: course.preview_support_vip_label || '',
          preview_support_label: course.preview_support_label || '',
          preview_modules_label: course.preview_modules_label || '',
          preview_guarantee_title: course.preview_guarantee_title || '',
          preview_guarantee_subtitle: course.preview_guarantee_subtitle || '',
          preview_guarantee_description: course.preview_guarantee_description || '',
          preview_footer_cta: course.preview_footer_cta || '',
          order_index: course.order_index || 0,
          preview_bonus_title: course.preview_bonus_title || '',
          preview_title: course.preview_title || '',
          preview_subtitle: course.preview_subtitle || '',
          preview_type: course.preview_type || 'video',
          preview_video_url: course.preview_video_url || '',
          preview_pdf_url: course.preview_pdf_url || '',
          preview_rich_text: course.preview_rich_text || '',
          preview_link_text: course.preview_link_text || '',
          preview_link_url: course.preview_link_url || '',
          preview_link_color: course.preview_link_color || '#3b82f6',
          preview_show_social_proof: course.preview_show_social_proof !== undefined ? course.preview_show_social_proof : true,
          preview_show_bonus: course.preview_show_bonus !== undefined ? course.preview_show_bonus : true,
          preview_show_trust: course.preview_show_trust !== undefined ? course.preview_show_trust : true,
          checkout_url: (isFree && course.is_bonus) ? null : course.checkout_url,
          hotmart_product_id: (isFree && course.is_bonus) ? null : course.hotmart_product_id,
          linked_package_id: course.linked_package_id || null,
          is_package_exclusive_bonus: course.is_package_exclusive_bonus || false
        };

        const { data: newCourse, error: courseError } = await supabase.from('courses').insert([courseData]).select().single();
        if (courseError) throw courseError;
        
        currentCourseId = newCourse.id;
        setCourseId(newCourse.id);
        setCourse(newCourse);
        toast.success('Curso criado automaticamente!');
      }
      
      let targetModuleId = editingChapter.module_id || modules[0]?.id;
      if (!targetModuleId) {
        const { data: newMod, error: modError } = await supabase
          .from('modules')
          .insert([{ course_id: currentCourseId, title: 'Conteúdo', order_index: 0 }])
          .select()
          .single();
        if (modError) throw modError;
        targetModuleId = newMod.id;
        setModules([newMod]);
      }

      const lessonData = {
        module_id: targetModuleId,
        title: editingChapter.title,
        description: editingChapter.description,
        content_type: editingChapter.content_type,
        video_url: editingChapter.video_url,
        pdf_url: editingChapter.pdf_url,
        button_link_text: editingChapter.button_link_text,
        button_link_url: editingChapter.button_link_url,
        button_link_color: editingChapter.button_link_color,
        cover_url: editingChapter.cover_url,
        rich_text: editingChapter.rich_text,
        duration_minutes: editingChapter.duration_minutes,
        order_index: editingChapter.id ? editingChapter.order_index : chapters.length
      };

      if (editingChapter.id) {
        const { error } = await supabase.from('chapters').update(lessonData).eq('id', editingChapter.id);
        if (error) throw error;
        toast.success('Aula atualizada!');
      } else {
        const { data: newChapter, error } = await supabase.from('chapters').insert([lessonData]).select().single();
        if (error) throw error;
        setChapters([...chapters, newChapter]);
        toast.success('Aula adicionada!');
      }
      
      fetchCourseData();
      setSelectedChapterId(null);
      setEditingChapter({
        title: '',
        content_type: 'video',
        video_url: '',
        pdf_url: '',
        cover_url: '',
        description: '',
        rich_text: '',
        duration_minutes: 0
      });
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setCourse({ ...course, price: parseInt(value) || 0 });
  };

  const formatPrice = (value: number) => {
    return (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  if (loading) return <div className="fixed inset-0 bg-bg-main flex items-center justify-center z-50"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  return (
    <div className="fixed inset-0 bg-bg-main z-50 flex flex-col pt-safe animate-in fade-in duration-300">
      <div className="flex items-center justify-between px-10 py-6 border-b border-white/5 bg-bg-main/80 backdrop-blur-xl sticky top-0 z-20">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all text-gray-500 hover:text-white">
            <X size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic text-white leading-none">
              {courseId ? 'Editar Treinamento' : 'Novo Treinamento'}
            </h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Configuração de Plataforma LMS</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={handleSaveCourse}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg shadow-blue-600/20"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            SALVAR O CURSO COMPLETO
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-bg-main">
        <div className="max-w-5xl mx-auto py-12 px-6 space-y-12 pb-32">
          {/* Section 1: Course Info */}
          <section className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                <Settings size={22} />
              </div>
              <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Configurações do Curso</h3>
            </div>

            <div className="bg-white/5 rounded-[40px] border border-white/10 p-10 space-y-10 shadow-2xl relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] pointer-events-none group-hover:bg-blue-600/10 transition-colors" />
              
              <div className="grid md:grid-cols-[1fr_350px] gap-12">
                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Título do Curso</label>
                    <input 
                      type="text" 
                      value={course.title}
                      onChange={e => setCourse({...course, title: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-xl font-bold text-white focus:border-blue-500 outline-none transition-all placeholder:text-gray-700"
                      placeholder="Ex: O Segredo da Maternidade Leve"
                    />
                  </div>

                  <div className="grid md:grid-cols-1 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Status de Visibilidade</label>
                      <button 
                        onClick={() => setCourse({...course, is_active: !course.is_active})}
                        className={`w-full h-[58px] rounded-2xl border transition-all flex items-center justify-center gap-3 font-black text-xs tracking-widest ${course.is_active ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10 text-gray-500'}`}
                      >
                        <CheckCircle2 size={18} /> {course.is_active ? 'APLICATIVO PUBLICADO' : 'EM RASCUNHO (OCULTO)'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Descrição do Curso</label>
                    <textarea 
                      value={course.description}
                      onChange={e => setCourse({...course, description: e.target.value})}
                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all min-h-[140px] resize-none placeholder:text-gray-700"
                      placeholder="Explique o que suas alunas vão aprender neste treinamento..."
                    />
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center block">Capa do Treinamento</label>
                    <div className="aspect-[3/4] rounded-3xl border-2 border-dashed border-white/10 overflow-hidden relative bg-black group/cover">
                      {course.cover_url ? (
                        <img src={course.cover_url} className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-110" alt="Capa" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700">
                          <ImageIcon className="mb-2 opacity-20" size={48} />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40 text-center px-4">Arraste uma imagem ou cole a URL abaixo</span>
                        </div>
                      )}
                      
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                        <p className="text-[10px] font-black text-white uppercase tracking-widest">Alterar Imagem</p>
                      </div>
                    </div>
                    <div className="relative group/url">
                      <input 
                        type="text" 
                        value={course.cover_url || ''}
                        onChange={e => setCourse({...course, cover_url: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-[10px] text-gray-400 focus:border-blue-500 outline-none transition-all font-mono"
                        placeholder="https://sua-imagem.com/capa.jpg"
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-blue-500/5 rounded-[32px] border border-blue-500/10 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 text-center">Configurações de Venda</h4>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => setCourse({...course, is_free: true, is_bonus: false})}
                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border ${course.is_free && !course.is_bonus ? 'bg-blue-600 border-blue-600 text-white' : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'}`}
                      >
                        PRODUTO PRINCIPAL (LIBERADO)
                      </button>
                      <button 
                        onClick={() => setCourse({...course, is_free: false, is_bonus: true})}
                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border ${course.is_bonus ? 'bg-purple-600 border-purple-600 text-white' : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'}`}
                      >
                        BÔNUS
                      </button>
                      <button 
                        onClick={() => setCourse({...course, is_free: false, is_bonus: false})}
                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border ${!course.is_free && !course.is_bonus ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'}`}
                      >
                        PAGO
                      </button>
                    </div>

                    {(course.is_bonus || (!course.is_free && !course.is_bonus)) && (
                      <div className={`mt-4 p-4 rounded-2xl border animate-in fade-in zoom-in-95 duration-300 ${course.is_bonus ? 'bg-purple-500/5 border-purple-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <button 
                            type="button"
                            onClick={() => setCourse({...course, is_package_exclusive_bonus: !course.is_package_exclusive_bonus})}
                            className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${course.is_package_exclusive_bonus ? (course.is_bonus ? 'bg-purple-600' : 'bg-emerald-600') : 'bg-black/40 border border-white/10'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${course.is_package_exclusive_bonus ? 'left-5' : 'left-1'}`} />
                          </button>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">Bloquear curso, liberação somente por pacote</span>
                            <span className="text-[7px] text-gray-500 uppercase font-black">Será invisível para alunos até que comprem o pacote vinculado</span>
                          </div>
                        </label>
                      </div>
                    )}

                      {!course.is_free && !course.is_bonus && (
                        <div className="mt-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                           <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                              <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest ml-1 mb-2 block">Modalidade de Liberação</label>
                              <div className="flex gap-2">
                                 <button 
                                   type="button"
                                   onClick={() => setCourse({...course, linked_package_id: '', is_package_exclusive_bonus: false})}
                                   className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all border ${!course.is_package_exclusive_bonus ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-black/20 border-white/5 text-gray-500'}`}
                                 >
                                   INDIVIDUAL
                                 </button>
                                 <button 
                                   type="button"
                                   onClick={() => setCourse({...course, linked_package_id: '', is_package_exclusive_bonus: true})}
                                   className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all border ${course.is_package_exclusive_bonus ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-black/20 border-white/5 text-gray-500'}`}
                                 >
                                   PACOTE
                                 </button>
                              </div>
                           </div>
                        </div>
                      )}
                    {!course.is_bonus && !course.is_package_exclusive_bonus && (
                      <div className="space-y-4 pt-2 animate-in fade-in zoom-in-95 duration-300">
                        {course.is_free ? (
                          <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-2 text-center">
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">🎯 Configuração Global Ativa</span>
                            <p className="text-[8px] text-gray-400 uppercase font-bold tracking-wider leading-relaxed">
                              Este curso se comporta como um Produto Principal. O ID do produto da Hotmart, o preço e o link do checkout são definidos de forma ÚNICA no Painel Administrativo ("Configurar Vendas") e se aplicam a todos os Cursos Principais cadastrados.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center ml-1">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Preço (R$)</label>
                                {course.linked_package_id && course.linked_package_id !== 'locked' && <span className="text-[7px] text-emerald-500 font-black uppercase italic tracking-tighter animate-pulse">Sincronizado com Pacote</span>}
                              </div>
                              <input 
                                type="text" 
                                value={formatPrice(course.price || 0)}
                                onChange={handlePriceChange}
                                readOnly={!!course.linked_package_id && course.linked_package_id !== 'locked'}
                                className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none text-center font-bold transition-all ${(course.linked_package_id && course.linked_package_id !== 'locked') ? 'opacity-50 cursor-not-allowed' : ''}`}
                              />
                            </div>
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Link de Check-out (Hotmart)</label>
                                <input 
                                  type="text" 
                                  value={course.checkout_url || ''}
                                  onChange={e => setCourse({...course, checkout_url: e.target.value})}
                                  readOnly={!!course.linked_package_id && course.linked_package_id !== 'locked'}
                                  className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-gray-400 focus:border-blue-500 outline-none transition-all ${(course.linked_package_id && course.linked_package_id !== 'locked') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  placeholder="Link de Check-out..."
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">ID do Produto Hotmart (Webhook)</label>
                                <input 
                                  type="text" 
                                  value={course.hotmart_product_id || ''}
                                  onChange={e => setCourse({...course, hotmart_product_id: e.target.value})}
                                  readOnly={!!course.linked_package_id && course.linked_package_id !== 'locked'}
                                  className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-gray-400 focus:border-blue-500 outline-none transition-all font-mono ${(course.linked_package_id && course.linked_package_id !== 'locked') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  placeholder="ID Numérico do Produto..."
                                />
                                <p className="text-[8px] text-gray-600 uppercase font-black ml-1 tracking-tighter">Utilizado para validação automática de compra via Webhook.</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Configuração Estratégica de Venda */}
          {!course.is_free && !course.is_bonus && (
            <section className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-600/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none">Configuração do Funil de Vendas</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Configure o modal de compra e a página de preview</p>
                </div>
              </div>

              {/* STEP 1: COMPRA MODAL */}
              <div className="bg-zinc-900/40 rounded-[40px] border border-white/10 p-10 space-y-10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-600/5 blur-[100px] pointer-events-none group-hover:bg-amber-600/10 transition-colors" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-black text-xs">1</div>
                    <div>
                      <h4 className="text-lg font-black uppercase italic tracking-tighter text-white">Configuração do Modal de Venda</h4>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Informações que aparecem ao clicar no curso bloqueado</p>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subtítulo Emocional (Modal)</label>
                      <input 
                        type="text" 
                        value={course.subtitle || ''}
                        onChange={e => setCourse({...course, subtitle: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all placeholder:text-gray-700"
                        placeholder="Ex: A jornada definitiva para sua autonomia"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Benefícios / Bullets (Um por linha)</label>
                      <textarea 
                        value={course.benefits?.join('\n') || ''}
                        onChange={e => setCourse({...course, benefits: e.target.value.split('\n').filter(b => b.trim() !== '')})}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all min-h-[120px] resize-none placeholder:text-gray-700"
                        placeholder="Ex: Acesso Vitalício&#10;Suporte 24h&#10;Certificado Incluso"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto do Botão (CTA)</label>
                        <input 
                          type="text" 
                          value={course.cta_text || ''}
                          onChange={e => setCourse({...course, cta_text: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all placeholder:text-gray-700 font-bold"
                          placeholder="LIBERAR ACESSO"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Preço Antigo (Riscado)</label>
                        <input 
                          type="text" 
                          value={formatPrice(course.old_price || 0)}
                          onChange={e => {
                            const val = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                            setCourse({...course, old_price: val});
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all text-center font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Capa Personalizada para o Modal</label>
                      <div className="grid grid-cols-[120px_1fr] gap-4 bg-black/40 p-3 rounded-2xl border border-white/5">
                        <div className="aspect-video rounded-xl bg-zinc-900 overflow-hidden relative border border-white/5">
                          <img 
                            src={course.premium_cover_url || course.cover_url} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/400x225?text=Preview')}
                          />
                        </div>
                        <div className="space-y-2">
                          <input 
                            type="text" 
                            value={course.premium_cover_url || ''}
                            onChange={e => setCourse({...course, premium_cover_url: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] text-gray-400 focus:border-amber-500 outline-none font-mono"
                            placeholder="URL da Imagem (Opcional)"
                          />
                          <p className="text-[8px] text-gray-600 font-black uppercase ml-1 shrink-0">Recomendado: 1920x1080px</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center block">Visualização do Modal</label>
                    <div className="bg-zinc-950 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl relative max-w-[300px] mx-auto scale-95 origin-top">
                      <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
                        <img 
                          src={course.premium_cover_url || course.cover_url || 'https://picsum.photos/seed/preview/800/450'} 
                          className="w-full h-full object-cover opacity-80" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60" />
                      </div>
                      <div className="p-5 flex flex-col items-center text-center space-y-3">
                         <h4 className="text-sm font-black text-white uppercase italic tracking-tighter truncate w-full">{course.title || 'Título do Curso'}</h4>
                         <p className="text-[7px] font-bold text-gray-500 italic line-clamp-1 opacity-70 uppercase tracking-tight">{course.subtitle || 'Subtítulo do curso'}</p>
                         
                         <div className="grid grid-cols-2 gap-2 w-full py-2 border-y border-white/5">
                            {(course.benefits?.length ? course.benefits : ['Acesso Vitalício', 'Certificado']).slice(0, 4).map((b, i) => (
                              <div key={i} className="flex items-center gap-1.5 overflow-hidden text-left">
                                <Check size={6} className="text-green-500" />
                                <span className="text-[6px] font-bold text-gray-400 truncate uppercase tracking-tight">{b}</span>
                              </div>
                            ))}
                         </div>

                         <div className="text-lg font-black text-white italic tracking-tighter leading-none mt-2">{(course.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                         <div className="w-full py-2 bg-amber-500 rounded-lg text-[8px] font-black text-black uppercase tracking-[0.1em] italic">
                           {course.cta_text || 'LIBERAR ACESSO'}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2: PÁGINA DE PREVIEW */}
              <div className="bg-zinc-900/40 rounded-[40px] border border-white/10 p-10 space-y-10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none group-hover:bg-primary/10 transition-colors" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-xs">2</div>
                    <div>
                      <h4 className="text-lg font-black uppercase italic tracking-tighter text-white">Configuração da Página de Preview</h4>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Informações detalhadas da página de venda</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setCourse({...course, preview_enabled: !course.preview_enabled})}
                    className={`h-10 px-6 rounded-xl border transition-all flex items-center gap-3 font-black text-[10px] tracking-widest ${course.preview_enabled ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white/5 border-white/10 text-gray-500'}`}
                  >
                    <PlayCircle size={16} /> {course.preview_enabled ? 'HABILITADO' : 'DESABILITADO'}
                  </button>
                </div>

                {course.preview_enabled && (
                  <div className="grid lg:grid-cols-2 gap-12 animate-in fade-in zoom-in-95 duration-300">
                    <div className="space-y-8">
                       {/* 1. SEÇÃO HERO */}
                       <div className="space-y-4">
                         <div className="flex items-center gap-2 mb-2">
                           <Monitor size={14} className="text-primary" />
                           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">1. Topo da Página (Hero)</span>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Headline Principal</label>
                             <input 
                               type="text" 
                               value={course.preview_title || ''}
                               onChange={e => setCourse({...course, preview_title: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all placeholder:text-gray-700"
                               placeholder="Título principal..."
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subheadline</label>
                             <input 
                               type="text" 
                               value={course.preview_subtitle || ''}
                               onChange={e => setCourse({...course, preview_subtitle: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all placeholder:text-gray-700"
                               placeholder="Promessa principal..."
                             />
                           </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Texto de Avaliação (Ex: 4.98 Avaliação)</label>
                            <input 
                              type="text" 
                              value={course.preview_rating || ''}
                              onChange={e => setCourse({...course, preview_rating: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                              placeholder="4.98 Avaliação"
                            />
                         </div>
                       </div>

                       {/* 2. SEÇÃO DE CONTEÚDO (MÍDIA) */}
                       <div className="space-y-4 pt-4 border-t border-white/5">
                         <div className="flex items-center gap-2 mb-2">
                           <PlayCircle size={14} className="text-primary" />
                           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">2. Conteúdo em Destaque (Mídia)</span>
                         </div>
                         <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1 mb-4">
                            {(['video', 'pdf', 'link', 'text'] as const).map(type => (
                              <button
                                key={type}
                                onClick={() => setCourse({...course, preview_type: type})}
                                className={`flex-1 py-1.5 rounded-lg text-root font-black uppercase text-[8px] tracking-widest transition-all ${course.preview_type === type ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
                              >
                                {type === 'video' ? 'VÍDEO' : type === 'pdf' ? 'PDF' : type === 'link' ? 'LINK' : 'TEXTO'}
                              </button>
                            ))}
                         </div>

                         {course.preview_type === 'video' && (
                           <div className="p-6 bg-black/40 border border-white/10 rounded-2xl space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL do Vídeo (YouTube/Vimeo)</label>
                                <input 
                                  type="text" 
                                  value={course.preview_video_url || ''}
                                  onChange={e => setCourse({...course, preview_video_url: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-primary focus:border-primary outline-none transition-all font-mono"
                                  placeholder="https://youtube.com/watch?v=..."
                                />
                              </div>
                           </div>
                         )}

                         {course.preview_type === 'pdf' && (
                           <div className="p-6 bg-black/40 border border-white/10 rounded-2xl space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL do Material PDF</label>
                                <input 
                                  type="text" 
                                  value={course.preview_pdf_url || ''}
                                  onChange={e => setCourse({...course, preview_pdf_url: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-primary focus:border-primary outline-none transition-all font-mono"
                                  placeholder="https://domain.com/material.pdf"
                                />
                              </div>
                           </div>
                         )}

                         {course.preview_type === 'link' && (
                           <div className="p-6 bg-black/40 border border-white/10 rounded-2xl space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto do Botão</label>
                                 <input 
                                   type="text" 
                                   value={course.preview_link_text || ''}
                                   onChange={e => setCourse({...course, preview_link_text: e.target.value})}
                                   className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-primary outline-none transition-all"
                                   placeholder="CLIQUE AQUI"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Cor do Botão</label>
                                 <input 
                                   type="color" 
                                   value={course.preview_link_color || '#3b82f6'}
                                   onChange={e => setCourse({...course, preview_link_color: e.target.value})}
                                   className="w-full bg-black/60 border border-white/10 rounded-xl h-[42px] p-1 cursor-pointer"
                                 />
                               </div>
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Link de Destino</label>
                               <input 
                                 type="text" 
                                 value={course.preview_link_url || ''}
                                 onChange={e => setCourse({...course, preview_link_url: e.target.value})}
                                 className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-primary outline-none transition-all font-mono"
                                 placeholder="https://..."
                                />
                             </div>
                           </div>
                         )}

                         {course.preview_type === 'text' && (
                           <div className="p-6 bg-black/40 border border-white/10 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto Descritivo / HTML (Preview)</label>
                                   <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest">Modo Texto/HTML</span>
                                </div>
                                <textarea 
                                  value={course.preview_rich_text || ''}
                                  onChange={e => setCourse({...course, preview_rich_text: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-5 py-4 text-xs text-gray-300 focus:border-primary outline-none transition-all h-64 resize-none font-medium font-mono"
                                  placeholder="Cole aqui o texto, depoimentos ou HTML da sua página de venda..."
                                />
                              </div>
                           </div>
                         )}
                       </div>

                       {/* 3. SEÇÃO DE MÓDULOS */}
                       <div className="space-y-4 pt-4 border-t border-white/5">
                         <div className="flex items-center gap-2 mb-2">
                           <Layers size={14} className="text-primary" />
                           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">3. Seção de Módulos (Conteúdo)</span>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Título da Seção de Módulos</label>
                            <input 
                              type="text" 
                              value={course.preview_modules_label || ''}
                              onChange={e => setCourse({...course, preview_modules_label: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                              placeholder="O que te espera lá dentro"
                            />
                         </div>
                       </div>
                    </div>

                    <div className="space-y-8">
                       {/* 4. SEÇÃO STATS / PROVA SOCIAL */}
                       <div className="space-y-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Users size={14} className="text-amber-500" />
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">4. Marcadores e Prova Social</span>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                             <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-3">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Bloco 1 (Total de Alunos)</span>
                                <div className="grid grid-cols-2 gap-3">
                                   <input 
                                     type="text" 
                                     value={course.preview_students_label || ''}
                                     onChange={e => setCourse({...course, preview_students_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Valor: 1.2k+"
                                   />
                                   <input 
                                     type="text" 
                                     value={course.preview_students_tag || ''}
                                     onChange={e => setCourse({...course, preview_students_tag: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Tag: Alunos"
                                   />
                                </div>
                             </div>

                             <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-3">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Bloco 2 (Configuração de Garantia)</span>
                                <div className="grid grid-cols-2 gap-3">
                                   <input 
                                     type="text" 
                                     value={course.preview_guarantee_label || ''}
                                     onChange={e => setCourse({...course, preview_guarantee_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Valor: 7 Dias"
                                   />
                                   <input 
                                     type="text" 
                                     value={course.preview_risk_zero_label || ''}
                                     onChange={e => setCourse({...course, preview_risk_zero_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Tag: Risque Zero"
                                   />
                                </div>
                             </div>

                             <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-3">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Bloco 3 (Configuração de Suporte)</span>
                                <div className="grid grid-cols-2 gap-3">
                                   <input 
                                     type="text" 
                                     value={course.preview_support_vip_label || ''}
                                     onChange={e => setCourse({...course, preview_support_vip_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Valor: 24/7"
                                   />
                                   <input 
                                     type="text" 
                                     value={course.preview_support_label || ''}
                                     onChange={e => setCourse({...course, preview_support_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Tag: Acompanhamento"
                                   />
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* 5. SEÇÃO GARANTIA DETALHADA */}
                       <div className="space-y-6 pt-4 border-t border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">5. Garantia Incondicional</span>
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Título do Selo</label>
                             <input 
                               type="text" 
                               value={course.preview_guarantee_title || ''}
                               onChange={e => setCourse({...course, preview_guarantee_title: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                               placeholder="Garantia Incondicional de 7 Dias"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subtítulo de Satisfação</label>
                             <input 
                               type="text" 
                               value={course.preview_guarantee_subtitle || ''}
                               onChange={e => setCourse({...course, preview_guarantee_subtitle: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                               placeholder="Sua satisfação ou seu dinheiro de volta"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto de Descrição da Garantia</label>
                             <textarea 
                               value={course.preview_guarantee_description || ''}
                               onChange={e => setCourse({...course, preview_guarantee_description: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white focus:border-primary outline-none transition-all h-24 resize-none"
                               placeholder="Eu tiro todo o risco das suas costas..."
                             />
                          </div>
                       </div>

                       {/* 6. SEÇÃO RODAPÉ / CTA FINAL */}
                       <div className="space-y-6 pt-4 border-t border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                             <Sparkles size={14} className="text-primary" />
                             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">6. Rodapé e Oferta Final</span>
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Frase de Oferta Final (Acima do Botão)</label>
                             <input 
                               type="text" 
                               value={course.preview_footer_cta || ''}
                               onChange={e => setCourse({...course, preview_footer_cta: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all italic font-bold"
                               placeholder="Ex: Aproveite as condições especiais de lançamento"
                             />
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-6">
                             <button
                               onClick={() => setCourse({...course, preview_show_social_proof: course.preview_show_social_proof === false ? true : false})}
                               className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${course.preview_show_social_proof !== false ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-white/5 border-white/5 text-zinc-600'}`}
                             >
                               <Users size={16} />
                               <span className="text-[8px] font-black uppercase tracking-widest">Prova Social</span>
                             </button>
                             <button
                               onClick={() => setCourse({...course, preview_show_trust: !course.preview_show_trust})}
                               className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${course.preview_show_trust !== false ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-white/5 border-white/5 text-zinc-600'}`}
                             >
                               <ShieldCheck size={16} />
                               <span className="text-[8px] font-black uppercase tracking-widest">Selo Confiança</span>
                             </button>
                             <button
                                onClick={() => setShowLivePreview(true)}
                                className="p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all flex flex-col items-center gap-2 group md:col-span-2"
                              >
                               <Monitor size={16} className="text-gray-400 group-hover:text-primary transition-colors" />
                               <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white">Abrir Visualizador de Preview</span>
                             </button>
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 3: Lessons List */}

          {/* Section 3: Lessons List */}
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                <div className="flex lg:flex-row flex-col lg:items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                      <Play size={22} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Conteúdo das Aulas</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total de {chapters.length} aulas em {modules.length} módulos</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      onClick={() => {
                        setEditingModule({ title: '' });
                        setShowModuleEditor(true);
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl font-black text-[10px] flex items-center gap-2 transition-all border border-white/10 tracking-widest"
                    >
                      <Layers size={16} /> GERENCIAR MÓDULOS
                    </button>
                    
                    <button 
                      onClick={() => {
                        setEditingChapter({ title: '', content_type: 'video', description: '', video_url: '', pdf_url: '', cover_url: '', duration_minutes: 0, module_id: modules[0]?.id });
                        setSelectedChapterId('new');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-xl shadow-emerald-900/40 hover:scale-105 active:scale-95"
                    >
                      <PlusCircle size={18} /> ADICIONAR NOVA AULA
                    </button>
                  </div>
                </div>

                <div className="bg-white/5 rounded-[40px] border border-white/10 p-10 space-y-12 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 blur-[100px] pointer-events-none group-hover:bg-emerald-600/10 transition-colors" />
                  
                  <div className="space-y-12 relative z-10">
              {/* Module Editor Modal */}
              <AnimatePresence>
                {showModuleEditor && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[40px] p-10 overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] pointer-events-none" />
                      
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                            <Layers size={20} />
                          </div>
                          <h3 className="text-xl font-black uppercase tracking-tighter italic text-white font-serif">Gerenciar Módulos</h3>
                        </div>
                        <button onClick={() => setShowModuleEditor(false)} className="text-gray-500 hover:text-white transition-colors">
                          <X size={24} />
                        </button>
                      </div>

                      <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide">
                        <div className="space-y-6">
                        {modules.map((mod, idx) => (
                          <div key={mod.id} className="flex items-center gap-4 group">
                            <div className="flex-1 space-y-2">
                               <input 
                                 type="text" 
                                 defaultValue={mod.title}
                                 onBlur={async (e) => {
                                   if (e.target.value !== mod.title) {
                                      await supabase.from('modules').update({ title: e.target.value }).eq('id', mod.id);
                                      fetchCourseData();
                                      toast.success('Módulo atualizado');
                                   }
                                 }}
                                 className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all"
                               />
                            </div>
                            <button 
                              onClick={async () => {
                                if (chapters.some(c => c.module_id === mod.id)) {
                                  toast.error('Não é possível excluir um módulo que contém aulas.');
                                  return;
                                }
                                if (window.confirm('Excluir este módulo?')) {
                                  await supabase.from('modules').delete().eq('id', mod.id);
                                  fetchCourseData();
                                  toast.success('Módulo excluído');
                                }
                              }}
                              className="p-3 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}

                        <div className="pt-4 border-t border-white/5">
                           <div className="flex items-center gap-4">
                             <input 
                               type="text" 
                               value={editingModule.title}
                               onChange={e => setEditingModule({ title: e.target.value })}
                               className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all font-bold"
                               placeholder="Nome do Novo Módulo..."
                               onKeyDown={async (e) => {
                                 if (e.key === 'Enter' && editingModule.title) {
                                   if (!courseId) {
                                      toast.error('Salve o curso antes de criar módulos');
                                      return;
                                   }
                                   await supabase.from('modules').insert([{ course_id: courseId, title: editingModule.title, order_index: modules.length }]);
                                   setEditingModule({ title: '' });
                                   fetchCourseData();
                                   toast.success('Módulo criado');
                                 }
                               }}
                             />
                             <button 
                               onClick={async () => {
                                 if (!editingModule.title) return;
                                 if (!courseId) {
                                    toast.error('Salve o curso antes de criar módulos');
                                    return;
                                 }
                                 await supabase.from('modules').insert([{ course_id: courseId, title: editingModule.title, order_index: modules.length }]);
                                 setEditingModule({ title: '' });
                                 fetchCourseData();
                                 toast.success('Módulo criado');
                               }}
                               className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg"
                             >
                                <Plus size={20} />
                              </button>
                            </div>
                        </div>

                           <div className="pt-8 border-t border-white/5 space-y-8">
                              <div className="flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-500 font-black" />
                                <h6 className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">Personalização da Página de Preview</h6>
                              </div>

                              <div className="space-y-10">
                                <p className="text-[10px] text-zinc-600 italic uppercase font-bold tracking-widest text-center py-10">Use a seção principal para personalizar sua página de preview.</p>
                              </div>
                           </div>
                        </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-white/10 flex justify-end gap-4">
                        <button onClick={() => setShowModuleEditor(false)} className="px-8 py-3 bg-white hover:bg-gray-100 text-black font-black rounded-xl text-xs transition-all uppercase tracking-widest">
                          Concluir
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Course Preview Modal */}
              <AnimatePresence>
                {showLivePreview && (
                  <CoursePreviewViewer 
                    course={course as Course} 
                    onClose={() => setShowLivePreview(false)} 
                    onPurchase={() => toast.info('Este é apenas um preview')}
                  />
                )}
              </AnimatePresence>

              <div className="space-y-12">
                {/* Add New Lesson Logic or Existing Lessons list */}
              {selectedChapterId === 'new' && (
                 <div className="bg-emerald-600/5 rounded-[40px] border border-emerald-500/20 p-10 space-y-8 shadow-2xl relative animate-in zoom-in-95 slide-in-from-top-4 duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <h4 className="text-xl font-black uppercase tracking-tighter italic text-emerald-500">Configurando Nova Aula</h4>
                      <button onClick={() => setSelectedChapterId(null)} className="text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
                    </div>
                    
                    <div className="grid md:grid-cols-[1fr_300px] gap-10">
                      <div className="space-y-6">
                        <div className="grid sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Título da Aula</label>
                            <input 
                              type="text" 
                              value={editingChapter.title}
                              onChange={e => setEditingChapter({...editingChapter, title: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-5 text-lg font-bold text-white focus:border-emerald-500 outline-none transition-all"
                              placeholder="Ex: Aula 01 - Introdução ao Método"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Selecionar Módulo</label>
                            <select 
                              value={editingChapter.module_id || ''}
                              onChange={e => setEditingChapter({...editingChapter, module_id: e.target.value})}
                              className="w-full h-[68px] bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs font-bold text-white focus:border-emerald-500 outline-none transition-all appearance-none uppercase tracking-widest"
                            >
                              <option value="">Sem Módulo (Global)</option>
                              {modules.map(m => (
                                <option key={m.id} value={m.id}>{m.title}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tipo da Aula</label>
                            <div className="flex p-1 bg-black/60 rounded-xl border border-white/5">
                              {['video', 'pdf', 'link'].map((type) => (
                                <button 
                                  key={type}
                                  onClick={() => setEditingChapter({...editingChapter, content_type: type as any})}
                                  className={`flex-1 py-3 rounded-lg text-[10px] font-black transition-all uppercase ${editingChapter.content_type === type ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
                                >
                                  {type === 'link' ? 'BOTAO' : type}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Duração (Min)</label>
                             <input 
                              type="number" 
                              value={editingChapter.duration_minutes || ''}
                              onChange={e => setEditingChapter({...editingChapter, duration_minutes: parseInt(e.target.value) || 0})}
                              className="w-full bg-black/40 border border-white/10 rounded-xl px-6 py-3.5 text-white focus:border-emerald-500 outline-none transition-all font-bold"
                              placeholder="15"
                            />
                          </div>
                        </div>

                        {editingChapter.content_type !== 'link' ? (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                              {editingChapter.content_type === 'video' ? 'URL do Vídeo' : 'URL do PDF'}
                            </label>
                            <input 
                              type="text" 
                              value={editingChapter.content_type === 'video' ? (editingChapter.video_url || '') : (editingChapter.pdf_url || '')}
                              onChange={e => setEditingChapter({...editingChapter, [editingChapter.content_type === 'video' ? 'video_url' : 'pdf_url']: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-gray-800"
                              placeholder={editingChapter.content_type === 'video' ? "https://youtube.com/..." : "https://drive.google.com/..."}
                            />
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto do Botão</label>
                              <input 
                                type="text" 
                                value={editingChapter.button_link_text || ''}
                                onChange={e => setEditingChapter({...editingChapter, button_link_text: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all"
                                placeholder="Ex: Acessar Material Externo"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL do Link</label>
                              <input 
                                type="text" 
                                value={editingChapter.button_link_url || ''}
                                onChange={e => setEditingChapter({...editingChapter, button_link_url: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all"
                                placeholder="https://..."
                              />
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Resumo da Aula</label>
                          <textarea 
                            value={editingChapter.description || ''}
                            onChange={e => setEditingChapter({...editingChapter, description: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all min-h-[100px] resize-none"
                            placeholder="O que será abordado nesta aula?"
                          />
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center block">Capa da Aula (Thumb)</label>
                          <div className="aspect-video rounded-2xl border-2 border-dashed border-white/10 overflow-hidden relative bg-black group/lessonaura">
                            {editingChapter.cover_url ? (
                              <img src={editingChapter.cover_url} className="w-full h-full object-cover" alt="Thumb" referrerPolicy="no-referrer" />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-700">
                                <ImageIcon className="mb-2 opacity-20" size={32} />
                                <span className="text-[9px] font-black uppercase tracking-widest opacity-40">Thumbnail da Aula</span>
                              </div>
                            )}
                          </div>
                          <input 
                            type="text" 
                            value={editingChapter.cover_url || ''}
                            onChange={e => setEditingChapter({...editingChapter, cover_url: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-gray-400 focus:border-emerald-500 outline-none transition-all font-mono"
                            placeholder="URL da Imagem da Aula..."
                          />
                        </div>

                        <button 
                          onClick={handleSaveChapter}
                          disabled={saving}
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-900/20 active:scale-95"
                        >
                          {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                          CRIAR ESTA AULA
                        </button>
                      </div>
                    </div>
                 </div>
              )}

              {/* Modules & Chapters List */}
              <div className="space-y-16">
                {(modules.length > 0 ? modules : [{ id: 'none', title: 'Aulas Globais' }]).map((module, mIdx) => {
                  const moduleChapters = chapters.filter(c => module.id === 'none' ? !c.module_id : c.module_id === module.id);
                  if (moduleChapters.length === 0 && module.id === 'none' && modules.length > 0) return null;

                  return (
                    <div key={module.id} className="space-y-6">
                      <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-500">
                          <Layers size={14} />
                        </div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-white italic">{module.title === 'Conteúdo' ? 'CONTEÚDO PRINCIPAL' : module.title}</h4>
                        <span className="text-[10px] font-bold text-gray-500 ml-auto">{moduleChapters.length} AULAS</span>
                      </div>

                      <div className="space-y-4">
                        {moduleChapters.map((ch, idx) => {
                          const isExpanded = selectedChapterId === ch.id;
                          
                          return (
                            <div 
                              key={ch.id} 
                              className={`bg-white/5 rounded-[32px] border transition-all duration-500 overflow-hidden ${isExpanded ? 'border-blue-500/40 ring-1 ring-blue-500/20 shadow-2xl bg-zinc-900' : 'border-white/5 hover:border-white/10 shadow-lg'}`}
                            >
                              {/* Header Row */}
                              <div 
                                onClick={() => setSelectedChapterId(isExpanded ? null : ch.id)}
                                className="p-6 flex items-center justify-between cursor-pointer group/item"
                              >
                                <div className="flex items-center gap-6 flex-1 min-w-0">
                                  <div className="relative w-24 h-14 rounded-xl bg-black/60 border border-white/10 overflow-hidden shrink-0">
                                    <img src={ch.cover_url || course.cover_url} className="w-full h-full object-cover opacity-60 group-hover/item:scale-110 transition-transform duration-500" referrerPolicy="no-referrer" />
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      {ch.content_type === 'video' ? <Video size={16} className="text-white/40" /> : <FileText size={16} className="text-white/40" />}
                                    </div>
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded-md">
                                      <span className="text-[8px] font-black text-white">{idx + 1}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="flex-1 min-w-0">
                                    <h4 className={`text-lg font-bold truncate transition-colors ${isExpanded ? 'text-blue-500' : 'text-gray-200 group-hover/item:text-white'}`}>
                                      {ch.title}
                                    </h4>
                                    <div className="flex items-center gap-4 mt-1">
                                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                        {ch.content_type === 'video' ? <Video size={10} /> : <FileText size={10} />} {ch.content_type.toUpperCase()}
                                      </span>
                                      <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                                        <Clock size={10} /> {ch.duration_minutes || 0} MIN
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-4">
                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm('Excluir esta aula permanentemente?')) {
                                        supabase.from('chapters').delete().eq('id', ch.id).then(() => {
                                          toast.success('Aula excluída');
                                          fetchCourseData();
                                        });
                                      }
                                    }}
                                    className="p-3 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover/item:opacity-100"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                  <div className={`p-2 rounded-xl bg-white/5 transition-transform duration-300 ${isExpanded ? 'rotate-180 bg-blue-500/10 text-blue-500' : 'text-gray-600'}`}>
                                    <ChevronDown size={20} />
                                  </div>
                                </div>
                              </div>

                              {/* Content Row (Collapsible) */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                                    className="border-t border-white/5"
                                  >
                                    <div className="p-10 space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
                                      <div className="grid md:grid-cols-[1fr_300px] gap-10">
                                        <div className="space-y-6">
                                          <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Título da Aula</label>
                                              <input 
                                                type="text" 
                                                defaultValue={ch.title}
                                                onBlur={e => {
                                                  if (e.target.value !== ch.title) {
                                                    supabase.from('chapters').update({ title: e.target.value }).eq('id', ch.id).then(() => {
                                                      fetchCourseData();
                                                      toast.success('Título atualizado');
                                                    });
                                                  }
                                                }}
                                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-lg font-bold text-white focus:border-blue-500 outline-none transition-all"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Módulo</label>
                                              <select 
                                                defaultValue={ch.module_id || ''}
                                                onChange={async (e) => {
                                                  await supabase.from('chapters').update({ module_id: e.target.value || null }).eq('id', ch.id);
                                                  fetchCourseData();
                                                  toast.success('Módulo atualizado');
                                                }}
                                                className="w-full h-[58px] bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-white focus:border-blue-500 outline-none transition-all appearance-none"
                                              >
                                                <option value="">Sem Módulo</option>
                                                {modules.map(m => (
                                                  <option key={m.id} value={m.id}>{m.title}</option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                               <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Duração (Min)</label>
                                               <input 
                                                type="number" 
                                                defaultValue={ch.duration_minutes}
                                                onBlur={e => {
                                                  const val = parseInt(e.target.value) || 0;
                                                  if (val !== ch.duration_minutes) {
                                                    supabase.from('chapters').update({ duration_minutes: val }).eq('id', ch.id).then(() => {
                                                      fetchCourseData();
                                                    });
                                                  }
                                                }}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-6 py-3.5 text-white focus:border-blue-500 outline-none transition-all font-bold"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tipo de Conteúdo</label>
                                              <div className="flex p-1 bg-black/60 rounded-xl border border-white/5">
                                                {['video', 'pdf', 'link'].map((type) => (
                                                  <button 
                                                    key={type}
                                                    onClick={async () => {
                                                      await supabase.from('chapters').update({ content_type: type as any }).eq('id', ch.id);
                                                      fetchCourseData();
                                                    }}
                                                    className={`flex-1 py-2 text-[8px] font-black rounded-lg transition-all uppercase ${ch.content_type === type ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                                                  >
                                                    {type === 'link' ? 'BOTAO' : type}
                                                  </button>
                                                ))}
                                              </div>
                                            </div>
                                          </div>

                                          {ch.content_type !== 'link' ? (
                                            <div className="space-y-2">
                                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                                                {ch.content_type === 'video' ? 'URL do Vídeo' : 'URL do PDF'}
                                              </label>
                                              <input 
                                                type="text" 
                                                defaultValue={ch.content_type === 'video' ? ch.video_url : ch.pdf_url}
                                                onBlur={e => {
                                                  const field = ch.content_type === 'video' ? 'video_url' : 'pdf_url';
                                                  if (e.target.value !== ch[field as keyof Chapter]) {
                                                    supabase.from('chapters').update({ [field]: e.target.value }).eq('id', ch.id).then(() => {
                                                      fetchCourseData();
                                                      toast.success('Conteúdo atualizado');
                                                    });
                                                  }
                                                }}
                                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-gray-400 font-mono focus:border-blue-500 outline-none transition-all"
                                              />
                                            </div>
                                          ) : (
                                            <div className="grid grid-cols-2 gap-4">
                                              <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto do Botão</label>
                                                <input 
                                                  type="text" 
                                                  defaultValue={ch.button_link_text || ''}
                                                  onBlur={async (e) => {
                                                    if (e.target.value !== ch.button_link_text) {
                                                      await supabase.from('chapters').update({ button_link_text: e.target.value }).eq('id', ch.id);
                                                      fetchCourseData();
                                                      toast.success('Botão atualizado');
                                                    }
                                                  }}
                                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white focus:border-blue-500 outline-none transition-all"
                                                />
                                              </div>
                                              <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL do Link</label>
                                                <input 
                                                  type="text" 
                                                  defaultValue={ch.button_link_url || ''}
                                                  onBlur={async (e) => {
                                                    if (e.target.value !== ch.button_link_url) {
                                                      await supabase.from('chapters').update({ button_link_url: e.target.value }).eq('id', ch.id);
                                                      fetchCourseData();
                                                      toast.success('Link atualizado');
                                                    }
                                                  }}
                                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white focus:border-blue-500 outline-none transition-all"
                                                />
                                              </div>
                                            </div>
                                          )}

                                          <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Resumo da Aula</label>
                                            <textarea 
                                              defaultValue={ch.description}
                                              onBlur={e => {
                                                if (e.target.value !== ch.description) {
                                                  supabase.from('chapters').update({ description: e.target.value }).eq('id', ch.id).then(() => {
                                                    fetchCourseData();
                                                  });
                                                }
                                              }}
                                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-gray-300 focus:border-blue-500 outline-none transition-all min-h-[120px] resize-none"
                                            />
                                          </div>
                                        </div>

                                        <div className="space-y-8">
                                          <div className="space-y-3">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center block">Capa desta Aula</label>
                                            <div className="aspect-video rounded-3xl overflow-hidden relative bg-black border border-white/10">
                                              {ch.cover_url ? (
                                                <img src={ch.cover_url} className="w-full h-full object-cover" alt="Thumb" referrerPolicy="no-referrer" />
                                              ) : (
                                                <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-800">
                                                  <ImageIcon size={32} />
                                                </div>
                                              )}
                                            </div>
                                            <input 
                                              type="text" 
                                              defaultValue={ch.cover_url || ''}
                                              onBlur={e => {
                                                if (e.target.value !== ch.cover_url) {
                                                  supabase.from('chapters').update({ cover_url: e.target.value }).eq('id', ch.id).then(() => {
                                                    fetchCourseData();
                                                    toast.success('Thumbnail atualizada');
                                                  });
                                                }
                                              }}
                                              className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-gray-500 focus:border-blue-500 outline-none font-mono"
                                              placeholder="URL da Imagem da Aula..."
                                            />
                                          </div>

                                          <div className="flex flex-col gap-3">
                                            <div className="flex items-center justify-between px-4 py-3 bg-white/5 rounded-2xl border border-white/5">
                                              <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Tipo: {ch.content_type.toUpperCase()}</span>
                                              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                                            </div>
                                            <button 
                                              onClick={() => setSelectedChapterId(null)}
                                              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl"
                                            >
                                              FECHAR EDIÇÃO
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {chapters.length === 0 && selectedChapterId !== 'new' && (
                  <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[40px] bg-white/5 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 mx-auto flex items-center justify-center text-gray-700">
                      <Plus size={32} />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-400">Nenhuma aula ainda</p>
                      <p className="text-xs text-gray-600 uppercase font-black tracking-widest">Clique no botão acima para adicionar sua primeira aula</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      </div>
    </div>
  </div>
);
}
