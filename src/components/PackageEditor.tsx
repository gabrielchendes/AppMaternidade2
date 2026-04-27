import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  X, 
  Save, 
  Loader2, 
  Plus, 
  Trash2, 
  Search,
  Check
} from 'lucide-react';
import { toast } from 'sonner';

interface PackageEditorProps {
  packageId: string | null;
  onClose: () => void;
  onSave: () => void;
  courses: any[];
}

export default function PackageEditor({ packageId, onClose, onSave, courses }: PackageEditorProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [hotmartId, setHotmartId] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (packageId) {
      fetchPackage();
    }
  }, [packageId]);

  const fetchPackage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_packages')
        .select('*, package_courses(course_id)')
        .eq('id', packageId)
        .single();

      if (error) throw error;

      setTitle(data.title);
      setHotmartId(data.hotmart_product_id || '');
      setCheckoutUrl(data.hotmart_checkout_url || '');
      setDescription(data.description || '');
      setSelectedCourses(data.package_courses.map((pc: any) => pc.course_id));
    } catch (err: any) {
      toast.error('Erro ao carregar pacote: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!title) {
      toast.error('O título é obrigatório');
      return;
    }

    setSaving(true);
    try {
      let id = packageId;

      if (!id) {
        const { data, error } = await supabase
          .from('course_packages')
          .insert({ 
            title, 
            hotmart_product_id: hotmartId,
            hotmart_checkout_url: checkoutUrl,
            description 
          })
          .select()
          .single();

        if (error) throw error;
        id = data.id;
      } else {
        const { error } = await supabase
          .from('course_packages')
          .update({ 
            title, 
            hotmart_product_id: hotmartId,
            hotmart_checkout_url: checkoutUrl,
            description 
          })
          .eq('id', id);

        if (error) throw error;
      }

      // Sync courses
      // First delete current relationships
      const { error: deleteError } = await supabase
        .from('package_courses')
        .delete()
        .eq('package_id', id);

      if (deleteError) throw deleteError;

      // Then insert new ones
      if (selectedCourses.length > 0) {
        const { error: insertError } = await supabase
          .from('package_courses')
          .insert(selectedCourses.map(courseId => ({
            package_id: id,
            course_id: courseId
          })));

        if (insertError) throw insertError;
      }

      toast.success('Pacote salvo com sucesso!');
      onSave();
    } catch (err: any) {
      toast.error('Erro ao salvar pacote: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleCourse = (courseId: string) => {
    setSelectedCourses(prev => 
      prev.includes(courseId) 
        ? prev.filter(id => id !== courseId) 
        : [...prev, courseId]
    );
  };

  const filteredCourses = courses.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-4xl max-h-[90vh] rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-zinc-900/50 backdrop-blur-xl">
          <div>
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">
              {packageId ? 'Editar' : 'Novo'} <span className="text-blue-500">Pacote</span>
            </h2>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
              Configure as entregas do pacote
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white rounded-2xl transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
          {/* Main Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Nome do Pacote</label>
                <input 
                  type="text" 
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-bold"
                  placeholder="Ex: Formação Maternidade Premium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Hotmart Product ID</label>
                <input 
                  type="text" 
                  value={hotmartId}
                  onChange={e => setHotmartId(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all font-mono"
                  placeholder="Ex: 1234567"
                />
                <p className="text-[10px] text-gray-600">Este ID será usado para liberar automaticamente os cursos deste pacote.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Link de Venda (Checkout Hotmart)</label>
                <input 
                  type="url" 
                  value={checkoutUrl}
                  onChange={e => setCheckoutUrl(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all"
                  placeholder="Ex: https://pay.hotmart.com/..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Descrição (Opcional)</label>
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-blue-500 outline-none transition-all min-h-[160px] resize-none"
                placeholder="Detalhes sobre o pacote..."
              />
            </div>
          </div>

          {/* Courses Selection */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Cursos Inclusos</h3>
                <p className="text-[10px] text-gray-500">Selecione quais cursos serão liberados ao adquirir este pacote</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar curso..."
                  className="bg-black/50 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:border-blue-500 outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredCourses.map(course => {
                const isSelected = selectedCourses.includes(course.id);
                return (
                  <button
                    key={course.id}
                    onClick={() => toggleCourse(course.id)}
                    className={`flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                      isSelected 
                        ? 'bg-blue-600/10 border-blue-500/50' 
                        : 'bg-black/20 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="w-12 h-16 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                      <img src={course.cover_url} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs font-bold leading-tight ${isSelected ? 'text-white' : 'text-gray-400'}`}>
                        {course.title}
                      </h4>
                      <p className="text-[10px] text-gray-600 font-black uppercase mt-1">
                        {course.is_free ? '💎 Produto Principal' : course.is_bonus ? '🎁 BÔNUS' : '💳 PAGO'}
                      </p>
                    </div>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border ${
                      isSelected ? 'bg-blue-600 border-blue-500' : 'border-white/10'
                    }`}>
                      {isSelected && <Check size={14} className="text-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-zinc-900/50 backdrop-blur-xl flex justify-between items-center">
          <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
            {selectedCourses.length} curso(s) selecionado(s)
          </p>
          <div className="flex gap-4">
            <button 
              onClick={onClose}
              className="px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-3 bg-blue-600 hover:bg-blue-700 text-white px-10 py-4 rounded-2xl font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-600/20 active:scale-95 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Salvar Pacote
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
