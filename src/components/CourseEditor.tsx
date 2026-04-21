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
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Module, Chapter } from '../types/lms';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface CourseEditorProps {
  courseId?: string;
  onClose: () => void;
}

export default function CourseEditor({ courseId: initialCourseId, onClose }: CourseEditorProps) {
  const [courseId, setCourseId] = useState<string | undefined>(initialCourseId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);

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
    cover_url: '',
    description: '',
    rich_text: '',
    duration_minutes: 0
  });

  const [modules, setModules] = useState<Module[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

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
      const isFree = course.is_bonus ? true : course.is_free;
      const courseData = {
        title: course.title,
        description: course.description || '',
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

        const isFree = course.is_bonus ? true : course.is_free;
        const courseData = {
          title: course.title,
          description: course.description || '',
          category: course.category,
          cover_url: course.cover_url,
          is_active: course.is_active,
          is_free: isFree,
          is_bonus: course.is_bonus,
          price: isFree ? 0 : course.price,
          checkout_url: isFree ? null : course.checkout_url,
          hotmart_product_id: isFree ? null : course.hotmart_product_id
        };

        const { data: newCourse, error: courseError } = await supabase.from('courses').insert([courseData]).select().single();
        if (courseError) throw courseError;
        
        currentCourseId = newCourse.id;
        setCourseId(newCourse.id);
        setCourse(newCourse);
        toast.success('Curso criado automaticamente!');
      }
      
      let targetModuleId = modules[0]?.id;
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

  if (loading) return <div className="fixed inset-0 bg-bg-main flex items-center justify-center z-50"><Loader2 className="animate-spin text-blue-500" size={48} /></div>;

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

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Categoria</label>
                      <input 
                        type="text" 
                        value={course.category}
                        onChange={e => setCourse({...course, category: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all placeholder:text-gray-700"
                        placeholder="Ex: Saúde, Mentalidade..."
                      />
                    </div>
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
                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border ${course.is_free ? 'bg-blue-600 border-blue-600 text-white' : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'}`}
                      >
                        PRODUTO PRINCIPAL (LIBERADO)
                      </button>
                      <button 
                        onClick={() => setCourse({...course, is_free: false, is_bonus: true})}
                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border ${course.is_bonus ? 'bg-purple-600 border-purple-600 text-white' : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'}`}
                      >
                        BÔNUS (PARA ALUNOS)
                      </button>
                      <button 
                        onClick={() => setCourse({...course, is_free: false, is_bonus: false})}
                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border ${!course.is_free && !course.is_bonus ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'}`}
                      >
                        PAGO (VENDA INDIVIDUAL)
                      </button>
                    </div>

                    {!course.is_free && !course.is_bonus && (
                      <div className="space-y-4 pt-2 animate-in fade-in zoom-in-95 duration-300">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Preço (R$)</label>
                          <input 
                            type="text" 
                            value={formatPrice(course.price || 0)}
                            onChange={handlePriceChange}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none text-center font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Link Hotmart</label>
                          <input 
                            type="text" 
                            value={course.checkout_url || ''}
                            onChange={e => setCourse({...course, checkout_url: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-gray-400 focus:border-blue-500 outline-none"
                            placeholder="Link Checkout..."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Lessons List */}
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                  <Play size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Conteúdo das Aulas</h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total de {chapters.length} aulas cadastradas</p>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  setEditingChapter({ title: '', content_type: 'video', description: '', video_url: '', pdf_url: '', cover_url: '', duration_minutes: 0 });
                  setSelectedChapterId('new');
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-xl shadow-emerald-900/40 hover:scale-105 active:scale-95"
              >
                <PlusCircle size={18} /> ADICIONAR NOVA AULA
              </button>
            </div>

            <div className="space-y-4">
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

                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tipo da Aula</label>
                            <div className="flex p-1 bg-black/60 rounded-xl border border-white/5">
                              <button 
                                onClick={() => setEditingChapter({...editingChapter, content_type: 'video'})}
                                className={`flex-1 py-3 rounded-lg text-[10px] font-black transition-all ${editingChapter.content_type === 'video' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
                              >
                                VÍDEO
                              </button>
                              <button 
                                onClick={() => setEditingChapter({...editingChapter, content_type: 'pdf'})}
                                className={`flex-1 py-3 rounded-lg text-[10px] font-black transition-all ${editingChapter.content_type === 'pdf' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
                              >
                                PDF
                              </button>
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

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{editingChapter.content_type === 'video' ? 'URL do Vídeo' : 'URL do PDF'}</label>
                          <input 
                            type="text" 
                            value={editingChapter.content_type === 'video' ? (editingChapter.video_url || '') : (editingChapter.pdf_url || '')}
                            onChange={e => setEditingChapter({...editingChapter, [editingChapter.content_type === 'video' ? 'video_url' : 'pdf_url']: e.target.value})}
                            className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-gray-800"
                            placeholder={editingChapter.content_type === 'video' ? "https://youtube.com/..." : "https://drive.google.com/..."}
                          />
                        </div>

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

              {/* Chapters List */}
              <div className="space-y-4">
                {chapters.map((ch, idx) => {
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
                                  </div>

                                  <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{ch.content_type === 'video' ? 'URL do Vídeo' : 'URL do PDF'}</label>
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
          </section>
        </div>
      </div>
    </div>
  );
}
