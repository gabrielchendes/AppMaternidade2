import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  GripVertical, 
  Trash2, 
  Video, 
  FileText, 
  Save, 
  ChevronDown, 
  ChevronRight,
  Layout,
  Clock,
  X,
  Loader2,
  ArrowRight,
  CheckCircle2,
  Settings,
  PlusCircle,
  Image as ImageIcon,
  ArrowLeft,
  Upload,
  Layers,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Course, Module, Chapter } from '../types/lms';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { uploadFile } from '../lib/storage';

interface CourseEditorProps {
  courseId?: string;
  onClose: () => void;
}

type EditorStep = 'BASIC_INFO' | 'CONTENT' | 'ADVANCED';

export default function CourseEditor({ courseId: initialCourseId, onClose }: CourseEditorProps) {
  const [courseId, setCourseId] = useState<string | undefined>(initialCourseId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'content'>('info');
  const [courseType, setCourseType] = useState<'single' | 'multiple' | null>(null);

  // Course State
  const [course, setCourse] = useState<Partial<Course>>({
    title: '',
    description: '',
    is_active: true,
    is_free: false,
    is_bonus: false,
    cover_url: '',
    price: 0,
    category: '',
    checkout_url: '',
    hotmart_product_id: ''
  });

  // Lesson State
  const [editingChapter, setEditingChapter] = useState<Partial<Chapter>>({
    title: '',
    content_type: 'video',
    video_url: '',
    pdf_url: '',
    description: '',
    rich_text: '',
    duration_minutes: 0
  });

  // Advanced State
  const [modules, setModules] = useState<Module[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<string[]>([]);

  useEffect(() => {
    if (courseId) {
      fetchCourseData();
    } else {
      setLoading(false);
    }
  }, [courseId]);

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

      const { data: chaptersData, error: chaptersError } = await supabase
        .from('chapters')
        .select('*, modules!inner(course_id)')
        .eq('modules.course_id', courseId)
        .order('order_index');
      
      if (chaptersError) throw chaptersError;
      const chaptersList = chaptersData || [];
      setChapters(chaptersList);
      
      // Auto-detect course type
      if (chaptersList.length === 1 && (modulesData?.length || 0) <= 1) {
        setCourseType('single');
        setEditingChapter(chaptersList[0]);
      } else if (chaptersList.length > 1) {
        setCourseType('multiple');
      }

      setExpandedModules((modulesData || []).map(m => m.id));
    } catch (err) {
      console.error('Error fetching course:', err);
      toast.error('Erro ao carregar curso');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSingleCourse = async () => {
    if (!course.title) {
      toast.error('O título do curso é obrigatório');
      return;
    }
    if (!editingChapter.title) {
      toast.error('O título da aula é obrigatório');
      return;
    }

    try {
      setSaving(true);
      
      // 1. Save Course
      const courseData = {
        title: course.title,
        description: course.description,
        cover_url: course.cover_url,
        category: course.category,
        is_active: course.is_active,
        is_free: course.is_free,
        is_bonus: course.is_bonus,
        price: (course.is_free || course.is_bonus) ? 0 : course.price,
        checkout_url: (course.is_free || course.is_bonus) ? null : course.checkout_url,
        hotmart_product_id: (course.is_free || course.is_bonus) ? null : course.hotmart_product_id
      };

      let currentCourseId = courseId;
      if (courseId) {
        const { error } = await supabase.from('courses').update(courseData).eq('id', courseId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('courses').insert([courseData]).select().single();
        if (error) throw error;
        currentCourseId = data.id;
        setCourseId(data.id);
      }

      // 2. Ensure Module exists
      let targetModuleId = modules[0]?.id;
      if (!targetModuleId) {
        const { data: newMod, error: modError } = await supabase
          .from('modules')
          .insert([{ course_id: currentCourseId, title: 'Conteúdo', order_index: 0 }])
          .select()
          .single();
        if (modError) throw modError;
        targetModuleId = newMod.id;
      }

      // 3. Save Chapter
      const lessonData = {
        module_id: targetModuleId,
        title: editingChapter.title,
        description: editingChapter.description,
        content_type: editingChapter.content_type,
        video_url: editingChapter.video_url,
        pdf_url: editingChapter.pdf_url,
        rich_text: editingChapter.rich_text,
        duration_minutes: editingChapter.duration_minutes,
        order_index: 0
      };

      if (editingChapter.id) {
        const { error } = await supabase.from('chapters').update(lessonData).eq('id', editingChapter.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('chapters').insert([lessonData]);
        if (error) throw error;
      }

      toast.success('Curso e aula salvos com sucesso!');
      onClose();
    } catch (err: any) {
      toast.error('Erro ao salvar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCourse = async () => {
    if (!course.title) {
      toast.error('O título do curso é obrigatório');
      return;
    }

    try {
      setSaving(true);
      const isFree = course.is_bonus ? true : course.is_free;
      const courseData = {
        title: course.title,
        description: course.description,
        category: course.category,
        cover_url: course.cover_url,
        is_active: course.is_active,
        is_free: isFree,
        is_bonus: course.is_bonus,
        price: isFree ? 0 : course.price,
        checkout_url: isFree ? null : course.checkout_url,
        hotmart_product_id: isFree ? null : course.hotmart_product_id
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
    if (!courseId) {
      toast.error('Salve as informações do curso primeiro');
      return;
    }
    if (!editingChapter.title) {
      toast.error('O título da aula é obrigatório');
      return;
    }

    try {
      setSaving(true);
      
      let targetModuleId = modules[0]?.id;
      if (!targetModuleId) {
        const { data: newMod, error: modError } = await supabase
          .from('modules')
          .insert([{ course_id: courseId, title: 'Conteúdo', order_index: 0 }])
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
        rich_text: editingChapter.rich_text,
        duration_minutes: editingChapter.duration_minutes,
        order_index: editingChapter.id ? editingChapter.order_index : chapters.filter(c => c.module_id === targetModuleId).length
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
      
      setEditingChapter({
        title: '',
        content_type: 'video',
        video_url: '',
        pdf_url: '',
        description: '',
        rich_text: '',
        duration_minutes: 0
      });
      fetchCourseData();
    } catch (err: any) {
      toast.error('Erro ao salvar aula: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'cover') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      const bucket = 'course_covers';
      const path = `${courseId || 'temp'}/${Date.now()}_${file.name}`;
      const url = await uploadFile(bucket, path, file);
      
      setCourse({ ...course, cover_url: url });
      toast.success('Upload concluído!');
    } catch (err: any) {
      toast.error('Erro no upload: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center z-50"><Loader2 className="animate-spin text-primary" size={48} /></div>;

  if (!courseId && !courseType) {
    return (
      <div className="fixed inset-0 bg-[#0f0f0f] z-50 flex items-center justify-center p-6">
        <div className="max-w-2xl w-full space-y-8 text-center">
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter uppercase italic text-white">Como será seu curso?</h1>
            <p className="text-gray-500">Escolha o formato que melhor se adapta ao seu conteúdo.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <button 
              onClick={() => setCourseType('single')}
              className="group bg-zinc-900 border border-white/10 p-8 rounded-3xl hover:border-primary/50 transition-all text-left space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <FileText size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Aula Única</h3>
                <p className="text-sm text-gray-500 mt-1">Ideal para um único PDF, vídeo ou material direto.</p>
              </div>
            </button>
            <button 
              onClick={() => setCourseType('multiple')}
              className="group bg-zinc-900 border border-white/10 p-8 rounded-3xl hover:border-primary/50 transition-all text-left space-y-4"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <Layers size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Várias Aulas</h3>
                <p className="text-sm text-gray-500 mt-1">Estrutura completa com módulos e múltiplas aulas.</p>
              </div>
            </button>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white font-bold text-sm">Cancelar</button>
        </div>
      </div>
    );
  }

  const formatPrice = (value: number) => {
    return (value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '');
    setCourse({ ...course, price: parseInt(value) || 0 });
  };

  return (
    <div className="fixed inset-0 bg-[#0f0f0f] z-50 flex flex-col text-white font-sans overflow-hidden">
      {/* Header */}
      <div className="h-20 border-b border-white/10 flex items-center justify-between px-8 bg-black/40 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-6">
          <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
            <X size={24} />
          </button>
          <div>
            <h2 className="text-xl font-black tracking-tighter uppercase italic">
              {course.title || 'Novo Curso'}
            </h2>
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${courseId ? 'bg-green-500' : 'bg-amber-500'}`} />
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
              {courseId ? 'Editando Curso' : 'Criando Novo Curso'}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
          {courseType === 'multiple' && (
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
              <button 
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'info' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
              >
                Informações
              </button>
              <button 
                onClick={() => setActiveTab('content')}
                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'content' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
              >
                Aulas
              </button>
            </div>
          )}
          <button 
            onClick={courseType === 'single' ? handleSaveSingleCourse : handleSaveCourse}
            disabled={saving}
            className="bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg shadow-primary/20"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
            SALVAR CURSO
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto py-12 px-6">
          <AnimatePresence mode="wait">
            {courseType === 'single' ? (
              <motion.div
                key="single-flow"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-12"
              >
                {/* Combined Info and Lesson */}
                <div className="grid md:grid-cols-[1fr_350px] gap-12">
                  <div className="space-y-10">
                    <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-8">
                      <h3 className="text-lg font-black uppercase tracking-widest text-primary">Informações do Curso</h3>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Título do Curso</label>
                        <input 
                          type="text" 
                          value={course.title}
                          onChange={e => setCourse({...course, title: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                          placeholder="Ex: Guia Prático de Amamentação"
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Categoria</label>
                          <input 
                            type="text" 
                            value={course.category}
                            onChange={e => setCourse({...course, category: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Status</label>
                          <button 
                            onClick={() => setCourse({...course, is_active: !course.is_active})}
                            className={`w-full h-[58px] rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-xs ${course.is_active ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10 text-gray-500'}`}
                          >
                            <CheckCircle2 size={16} /> {course.is_active ? 'ATIVO' : 'INATIVO'}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Descrição</label>
                        <textarea 
                          value={course.description}
                          onChange={e => setCourse({...course, description: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all min-h-[100px]"
                        />
                      </div>
                    </div>

                    <div className="p-8 bg-white/5 rounded-3xl border border-white/10 space-y-8">
                      <h3 className="text-lg font-black uppercase tracking-widest text-primary">Conteúdo da Aula</h3>
                      
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Título da Aula</label>
                        <input 
                          type="text" 
                          value={editingChapter.title}
                          onChange={e => setEditingChapter({...editingChapter, title: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                          placeholder="Ex: Aula 1 - Introdução"
                        />
                      </div>

                      <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Tipo de Conteúdo</label>
                          <div className="flex p-1 bg-black/40 rounded-xl border border-white/10">
                            <button 
                              onClick={() => setEditingChapter({...editingChapter, content_type: 'video'})}
                              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black transition-all ${editingChapter.content_type === 'video' ? 'bg-primary text-white' : 'text-gray-500'}`}
                            >
                              VÍDEO
                            </button>
                            <button 
                              onClick={() => setEditingChapter({...editingChapter, content_type: 'pdf'})}
                              className={`flex-1 py-2.5 rounded-lg text-[10px] font-black transition-all ${editingChapter.content_type === 'pdf' ? 'bg-primary text-white' : 'text-gray-500'}`}
                            >
                              PDF
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Duração (min)</label>
                          <input 
                            type="number" 
                            value={editingChapter.duration_minutes || ''}
                            onChange={e => setEditingChapter({...editingChapter, duration_minutes: parseInt(e.target.value) || 0})}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                          />
                        </div>
                      </div>

                      {editingChapter.content_type === 'video' ? (
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">URL do Vídeo</label>
                          <input 
                            type="text" 
                            value={editingChapter.video_url}
                            onChange={e => setEditingChapter({...editingChapter, video_url: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                            placeholder="YouTube, Vimeo ou Link Direto..."
                          />
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Link do PDF</label>
                          <input 
                            type="text" 
                            value={editingChapter.pdf_url}
                            onChange={e => setEditingChapter({...editingChapter, pdf_url: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                            placeholder="Link do Google Drive, Dropbox..."
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Capa do Curso</h3>
                      <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 relative group">
                        {course.cover_url ? (
                          <img src={course.cover_url} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-600">
                            <ImageIcon size={40} className="mb-2 opacity-20" />
                            <span className="text-[10px] font-black uppercase">Sem Capa</span>
                          </div>
                        )}
                        <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center cursor-pointer">
                          <input type="file" className="hidden" onChange={e => handleFileUpload(e, 'cover')} />
                          <div className="flex flex-col items-center gap-2">
                            <Plus size={24} />
                            <span className="text-[10px] font-black uppercase">Alterar Capa</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-6">
                      <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Configuração de Venda</h3>
                      <div className="space-y-4">
                        <div className="flex p-1 bg-black/40 rounded-xl border border-white/10">
                          <button 
                            onClick={() => setCourse({...course, is_free: true, is_bonus: false})}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${course.is_free ? 'bg-primary text-white' : 'text-gray-500'}`}
                          >
                            GRÁTIS
                          </button>
                          <button 
                            onClick={() => setCourse({...course, is_free: false, is_bonus: true})}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${course.is_bonus ? 'bg-primary text-white' : 'text-gray-500'}`}
                          >
                            BÔNUS
                          </button>
                          <button 
                            onClick={() => setCourse({...course, is_free: false, is_bonus: false})}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-black transition-all ${!course.is_free && !course.is_bonus ? 'bg-primary text-white' : 'text-gray-500'}`}
                          >
                            PAGO
                          </button>
                        </div>

                        {!course.is_free && !course.is_bonus && (
                          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preço (R$)</label>
                              <input 
                                type="text" 
                                value={formatPrice(course.price)}
                                onChange={handlePriceChange}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Link Hotmart</label>
                              <input 
                                type="text" 
                                value={course.checkout_url || ''}
                                onChange={e => setCourse({...course, checkout_url: e.target.value})}
                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none text-xs"
                                placeholder="Link de checkout..."
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : activeTab === 'info' ? (
              <motion.div 
                key="info"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid md:grid-cols-[1fr_350px] gap-12"
              >
                <div className="space-y-10">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Título do Curso</label>
                    <input 
                      type="text" 
                      value={course.title}
                      onChange={e => setCourse({...course, title: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-5 text-2xl font-bold text-white focus:border-primary outline-none transition-all"
                      placeholder="Ex: Guia Prático de Amamentação"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Categoria</label>
                      <input 
                        type="text" 
                        value={course.category}
                        onChange={e => setCourse({...course, category: e.target.value})}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                        placeholder="Ex: Maternidade, Saúde..."
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Status</label>
                      <div className="flex items-center gap-4 h-[58px]">
                        <button 
                          onClick={() => setCourse({...course, is_active: !course.is_active})}
                          className={`flex-1 h-full rounded-2xl border transition-all flex items-center justify-center gap-2 font-bold text-xs ${course.is_active ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/10 text-gray-500'}`}
                        >
                          <CheckCircle2 size={16} /> {course.is_active ? 'ATIVO' : 'INATIVO'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Descrição Curta</label>
                    <textarea 
                      value={course.description}
                      onChange={e => setCourse({...course, description: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all min-h-[120px]"
                      placeholder="Uma breve frase sobre o que as alunas aprenderão..."
                    />
                  </div>

                  <div className="space-y-6 bg-white/5 p-8 rounded-3xl border border-white/10">
                    <h3 className="text-sm font-black uppercase tracking-widest text-primary">Configurações de Preço</h3>
                    
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <div 
                            onClick={() => setCourse({...course, is_bonus: !course.is_bonus})}
                            className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${course.is_bonus ? 'bg-primary border-primary' : 'border-white/10 group-hover:border-white/30'}`}
                          >
                            {course.is_bonus && <Check size={16} className="text-white" />}
                          </div>
                          <span className="text-sm font-bold text-gray-300">Este curso é um BÔNUS</span>
                        </label>

                        {!course.is_bonus && (
                          <label className="flex items-center gap-3 cursor-pointer group">
                            <div 
                              onClick={() => setCourse({...course, is_free: !course.is_free})}
                              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${course.is_free ? 'bg-primary border-primary' : 'border-white/10 group-hover:border-white/30'}`}
                            >
                              {course.is_free && <Check size={16} className="text-white" />}
                            </div>
                            <span className="text-sm font-bold text-gray-300">Este curso é GRATUITO</span>
                          </label>
                        )}
                      </div>

                      {!course.is_bonus && !course.is_free && (
                        <div className="space-y-6">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preço (R$)</label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">R$</span>
                              <input 
                                type="text" 
                                value={formatPrice(course.price || 0)}
                                onChange={handlePriceChange}
                                className="w-full bg-black/20 border border-white/10 rounded-2xl pl-12 pr-6 py-4 text-white focus:border-primary outline-none transition-all font-bold"
                                placeholder="0,00"
                              />
                            </div>
                          </div>

                          <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Link de Checkout (Hotmart)</label>
                              <input 
                                type="text" 
                                value={course.checkout_url || ''}
                                onChange={e => setCourse({...course, checkout_url: e.target.value})}
                                className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                                placeholder="https://pay.hotmart.com/..."
                              />
                            </div>
                            <div className="space-y-2">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">ID do Produto Hotmart</label>
                              <input 
                                type="text" 
                                value={course.hotmart_product_id || ''}
                                onChange={e => setCourse({...course, hotmart_product_id: e.target.value})}
                                className="w-full bg-black/20 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                                placeholder="Ex: 123456"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Capa do Curso</label>
                    <div className="aspect-video rounded-3xl border-2 border-dashed border-white/10 overflow-hidden relative group bg-white/5">
                      {course.cover_url ? (
                        <>
                          <img src={course.cover_url} className="w-full h-full object-cover" alt="Capa" />
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                            <label className="cursor-pointer bg-white text-black px-4 py-2 rounded-xl font-bold text-xs">
                              ALTERAR IMAGEM
                              <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'cover')} />
                            </label>
                          </div>
                        </>
                      ) : (
                        <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all">
                          <Upload className="text-gray-600 mb-2" size={32} />
                          <span className="text-[10px] font-black uppercase text-gray-500">Upload da Capa</span>
                          <input type="file" className="hidden" accept="image/*" onChange={e => handleFileUpload(e, 'cover')} />
                        </label>
                      )}
                      {uploading && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                          <Loader2 className="animate-spin text-primary" size={32} />
                        </div>
                      )}
                    </div>
                    <input 
                      type="text" 
                      value={course.cover_url}
                      onChange={e => setCourse({...course, cover_url: e.target.value})}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] text-gray-500 outline-none mt-2"
                      placeholder="Ou cole a URL aqui..."
                    />
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid md:grid-cols-[350px_1fr] gap-12"
              >
                {/* Sidebar: Lesson List */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-gray-500 uppercase tracking-widest">Aulas do Curso</h3>
                    <button 
                      onClick={() => setEditingChapter({ title: '', content_type: 'video' })}
                      className="p-2 hover:bg-white/5 rounded-lg text-primary transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {chapters.map((ch, idx) => (
                      <button 
                        key={ch.id}
                        onClick={() => setEditingChapter(ch)}
                        className={`w-full flex items-center gap-3 p-4 rounded-2xl text-left transition-all border ${editingChapter.id === ch.id ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center shrink-0">
                          {ch.content_type === 'video' ? <Video size={14} /> : <FileText size={14} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{ch.title}</p>
                          <p className="text-[9px] font-black opacity-50 uppercase tracking-tighter">Aula {idx + 1}</p>
                        </div>
                      </button>
                    ))}
                    {chapters.length === 0 && (
                      <div className="text-center py-12 border-2 border-dashed border-white/5 rounded-3xl">
                        <p className="text-xs text-gray-600">Nenhuma aula ainda</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Main: Lesson Editor */}
                <div className="bg-white/5 rounded-3xl border border-white/10 p-8 space-y-8">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black tracking-tighter uppercase italic">
                      {editingChapter.id ? 'Editar Aula' : 'Nova Aula'}
                    </h2>
                    {editingChapter.id && (
                      <button 
                        onClick={async () => {
                          if (!confirm('Excluir esta aula?')) return;
                          await supabase.from('chapters').delete().eq('id', editingChapter.id);
                          toast.success('Aula excluída');
                          fetchCourseData();
                          setEditingChapter({ title: '', content_type: 'video' });
                        }}
                        className="p-2 text-gray-600 hover:text-red-500 transition-all"
                      >
                        <Trash2 size={20} />
                      </button>
                    )}
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Título da Aula</label>
                      <input 
                        type="text" 
                        value={editingChapter.title}
                        onChange={e => setEditingChapter({...editingChapter, title: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                        placeholder="Ex: Introdução ao Módulo"
                      />
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Tipo de Conteúdo</label>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setEditingChapter({...editingChapter, content_type: 'video'})}
                            className={`flex-1 py-3 rounded-xl border transition-all font-bold text-[10px] ${editingChapter.content_type === 'video' ? 'bg-primary/10 border-primary text-primary' : 'bg-black/20 border-white/10 text-gray-500'}`}
                          >
                            VÍDEO
                          </button>
                          <button 
                            onClick={() => setEditingChapter({...editingChapter, content_type: 'pdf'})}
                            className={`flex-1 py-3 rounded-xl border transition-all font-bold text-[10px] ${editingChapter.content_type === 'pdf' ? 'bg-primary/10 border-primary text-primary' : 'bg-black/20 border-white/10 text-gray-500'}`}
                          >
                            PDF
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Duração (minutos)</label>
                        <input 
                          type="number" 
                          value={editingChapter.duration_minutes || ''}
                          onChange={e => setEditingChapter({...editingChapter, duration_minutes: parseInt(e.target.value) || 0})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                        />
                      </div>
                    </div>

                    {editingChapter.content_type === 'video' ? (
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">URL do Vídeo</label>
                        <input 
                          type="text" 
                          value={editingChapter.video_url || ''}
                          onChange={e => setEditingChapter({...editingChapter, video_url: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                          placeholder="YouTube, Vimeo ou Link Direto (mp4)..."
                        />
                        <p className="text-[10px] text-gray-500 italic">Dica: Use links diretos .mp4 ou links do YouTube/Vimeo.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Link do Arquivo PDF</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="text" 
                            value={editingChapter.pdf_url || ''}
                            onChange={e => setEditingChapter({...editingChapter, pdf_url: e.target.value})}
                            className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                            placeholder="Cole o link do PDF aqui (Google Drive, Dropbox, etc)..."
                          />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Descrição da Aula</label>
                      <textarea 
                        value={editingChapter.description || ''}
                        onChange={e => setEditingChapter({...editingChapter, description: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all min-h-[100px]"
                        placeholder="Breve resumo da aula..."
                      />
                    </div>

                    <div className="pt-4">
                      <button 
                        onClick={handleSaveChapter}
                        disabled={saving}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all"
                      >
                        {saving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        SALVAR AULA
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
