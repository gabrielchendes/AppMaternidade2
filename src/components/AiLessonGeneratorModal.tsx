import React, { useState } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  Settings2,
  Eye,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Check,
  RefreshCw,
  Wand2,
  FileText,
  CheckSquare,
  HelpCircle,
  MessageSquare,
  Play,
  Award,
  Layers,
  Save,
  Image as ImageIcon,
  Upload,
  Camera
} from 'lucide-react';
import { Course, Module, LessonBlock, LessonBlockType, LessonBlockItem } from '../types/lms';
import { BlockLessonViewer } from './BlockLessonViewer';
import { toast } from 'sonner';
import { AiImageSuggestionsModal } from './AiImageSuggestionsModal';

interface AiLessonGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  courses: Course[];
  initialCourseId?: string;
  initialModuleId?: string;
  initialChapterId?: string;
  initialLessonTitle?: string;
  initialLessonGoal?: string;
  initialBlocks?: LessonBlock[];
  modulesMap?: Record<string, Module[]>;
  onLessonCreated: (chapter: any) => void;
}

export const AiLessonGeneratorModal: React.FC<AiLessonGeneratorModalProps> = ({
  isOpen,
  onClose,
  courses = [],
  initialCourseId,
  initialModuleId,
  initialChapterId,
  initialLessonTitle,
  initialLessonGoal,
  initialBlocks,
  modulesMap = {},
  onLessonCreated
}) => {
  const [selectedCourseId, setSelectedCourseId] = useState<string>(initialCourseId || courses[0]?.id || '');
  const [selectedModuleId, setSelectedModuleId] = useState<string>(initialModuleId || '');
  const [lessonTitle, setLessonTitle] = useState<string>(initialLessonTitle || '');
  const [lessonGoal, setLessonGoal] = useState<string>(initialLessonGoal || '');
  const [aiInstructions, setAiInstructions] = useState<string>('');
  const [referenceImage, setReferenceImage] = useState<{ mimeType: string; data: string; fileName: string } | null>(null);

  const [generating, setGenerating] = useState<boolean>(false);
  const [improvementPrompt, setImprovementPrompt] = useState<string>('');
  const [improving, setImproving] = useState<boolean>(false);

  // Handle reference image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload a valid image file (PNG, JPG, WebP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be under 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReferenceImage({
        mimeType: file.type,
        data: result,
        fileName: file.name
      });
      toast.success('Reference image uploaded successfully!');
    };
    reader.readAsDataURL(file);
  };

  // Generated lesson state
  const [generatedLesson, setGeneratedLesson] = useState<{
    title: string;
    description: string;
    duration_minutes: number;
    blocks: LessonBlock[];
  } | null>(() => {
    if (initialBlocks && initialBlocks.length > 0) {
      return {
        title: initialLessonTitle || '',
        description: initialLessonGoal || '',
        duration_minutes: 15,
        blocks: initialBlocks
      };
    }
    return null;
  });

  React.useEffect(() => {
    if (isOpen) {
      setSelectedCourseId(initialCourseId || courses[0]?.id || '');
      setSelectedModuleId(initialModuleId || '');
      setLessonTitle(initialLessonTitle || '');
      setLessonGoal(initialLessonGoal || '');
      if (initialBlocks && initialBlocks.length > 0) {
        setGeneratedLesson({
          title: initialLessonTitle || '',
          description: initialLessonGoal || '',
          duration_minutes: 15,
          blocks: initialBlocks
        });
      } else if (!initialChapterId) {
        setGeneratedLesson(null);
      }
    }
  }, [isOpen, initialCourseId, initialModuleId, initialChapterId, initialLessonTitle, initialLessonGoal, initialBlocks]);

  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('preview');
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentModules = selectedCourseId ? modulesMap[selectedCourseId] || [] : [];
  const activeModuleId = selectedModuleId || currentModules[0]?.id || '';

  // Trigger AI generation endpoint
  const handleGenerate = async (actionType: 'generate' | 'improve' | 'regenerate' = 'generate') => {
    if (!lessonGoal.trim() && !aiInstructions.trim() && !referenceImage && actionType === 'generate') {
      toast.error('Informe o objetivo, instruções ou carregue uma imagem de referência!');
      return;
    }

    try {
      if (actionType === 'improve') setImproving(true);
      else setGenerating(true);

      const courseObj = courses.find(c => c.id === selectedCourseId);
      const moduleObj = currentModules.find(m => m.id === activeModuleId);

      const response = await fetch('/api/v1/generate-lesson', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseTitle: courseObj?.title || 'Curso',
          moduleTitle: moduleObj?.title || 'Módulo',
          lessonTitle,
          lessonGoal,
          aiInstructions: actionType === 'improve' ? improvementPrompt : aiInstructions,
          action: actionType,
          existingBlocks: actionType === 'improve' ? generatedLesson?.blocks : [],
          referenceImage: referenceImage ? { mimeType: referenceImage.mimeType, data: referenceImage.data } : undefined
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success || !data.lesson) {
        throw new Error(data.error || 'Falha ao gerar aula com IA');
      }

      setGeneratedLesson(data.lesson);
      if (data.lesson.title) setLessonTitle(data.lesson.title);
      setActiveTab('preview');
      setImprovementPrompt('');
      toast.success(actionType === 'improve' ? 'Aula aprimorada com IA!' : 'Aula gerada com sucesso pela IA!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro na IA: ' + err.message);
    } finally {
      setGenerating(false);
      setImproving(false);
    }
  };

  // Block management functions
  const handleUpdateBlock = (blockId: string, updates: Partial<LessonBlock>) => {
    if (!generatedLesson) return;
    const newBlocks = generatedLesson.blocks.map(b => (b.id === blockId ? { ...b, ...updates } : b));
    setGeneratedLesson({ ...generatedLesson, blocks: newBlocks });
  };

  const handleAddBlock = (type: LessonBlockType) => {
    if (!generatedLesson) return;
    const newBlock: LessonBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      title: type === 'checklist' ? 'Checklist de Ação' : type === 'quiz' ? 'Questionário de Validação' : type === 'reflection' ? 'Reflexão Pessoal' : 'Novo Bloco',
      description: 'Descrição orientadora',
      content: type === 'text' ? 'Digite o conteúdo explicativo aqui...' : undefined,
      items: (type === 'checklist' || type === 'quiz' || type === 'action_plan' || type === 'exercise') ? [
        {
          id: `item_${Date.now()}`,
          title: 'Primeira tarefa ou pergunta',
          description: 'Detalhes da etapa',
          required: true,
          options: type === 'quiz' ? ['Opção A', 'Opção B', 'Opção C'] : undefined,
          correct_option_index: 0
        }
      ] : undefined
    };
    setGeneratedLesson({ ...generatedLesson, blocks: [...generatedLesson.blocks, newBlock] });
    setEditingBlockId(newBlock.id);
  };

  const handleDeleteBlock = (blockId: string) => {
    if (!generatedLesson) return;
    setGeneratedLesson({
      ...generatedLesson,
      blocks: generatedLesson.blocks.filter(b => b.id !== blockId)
    });
    if (editingBlockId === blockId) setEditingBlockId(null);
  };

  const handleMoveBlock = (index: number, direction: 'up' | 'down') => {
    if (!generatedLesson) return;
    const newBlocks = [...generatedLesson.blocks];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;

    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[targetIndex];
    newBlocks[targetIndex] = temp;
    setGeneratedLesson({ ...generatedLesson, blocks: newBlocks });
  };

  // Final Publish handler
  const handlePublish = () => {
    if (!generatedLesson) return;
    if (!selectedCourseId || !activeModuleId) {
      toast.error('Selecione o curso e módulo antes de publicar!');
      return;
    }

    const createdChapterData = {
      ...(initialChapterId ? { id: initialChapterId } : {}),
      module_id: activeModuleId,
      title: generatedLesson.title || lessonTitle || 'Aula Interativa',
      description: generatedLesson.description || '',
      content_type: 'interactive',
      rich_text: JSON.stringify({
        blocks: generatedLesson.blocks,
        generated_by_ai: true,
        duration_minutes: generatedLesson.duration_minutes || 15
      }),
      duration_minutes: generatedLesson.duration_minutes || 15
    };

    onLessonCreated(createdChapterData);
    toast.success(initialChapterId ? 'Aula atualizada com sucesso!' : 'Aula criada e adicionada com sucesso!');
    onClose();
  };

  const [isImageModalOpen, setIsImageModalOpen] = useState(false);

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
        <div className="w-full max-w-5xl bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-left my-auto">
          {/* Modal Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-emerald-950/80 via-zinc-900 to-zinc-900 border-b border-white/10 flex items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                <Sparkles size={22} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-white italic uppercase tracking-tight">
                  Criar Aula Interativa com IA
                </h2>
                <p className="text-xs text-gray-400">
                  A IA analisa o seu objetivo e projeta aulas com blocos interativos e salvamento de progresso.
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsImageModalOpen(true)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-cyan-300 border border-cyan-500/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Sugerir Imagens e Prompts de IA para a Aula"
              >
                <Camera size={14} className="text-cyan-400" />
                <span className="hidden sm:inline">Ideias Visuais</span>
              </button>

              <button
                onClick={onClose}
                className="p-2.5 text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>
          </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {!generatedLesson ? (
            /* STAGE 1: FORM PROMPT INPUT */
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="p-5 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Wand2 size={16} /> Como funciona?
                </h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  Descreva o tema ou o objetivo prático que deseja ensinar. A IA criará automaticamente uma aula completa composta por textos explicativos, checklists de tarefas, questionários e exercícios de reflexão.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Selecione o Curso
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={e => {
                      setSelectedCourseId(e.target.value);
                      setSelectedModuleId('');
                    }}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    {courses.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                    Selecione o Módulo
                  </label>
                  <select
                    value={activeModuleId}
                    onChange={e => setSelectedModuleId(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500 outline-none"
                  >
                    {currentModules.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Título Sugerido para a Aula (Opcional)
                </label>
                <input
                  type="text"
                  value={lessonTitle}
                  onChange={e => setLessonTitle(e.target.value)}
                  placeholder="Ex: Checklist de 7 Dias para Reconexão Emocional"
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Objetivo Principal da Aula (O que a aluna vai aprender/fazer?) *
                </label>
                <textarea
                  value={lessonGoal}
                  onChange={e => setLessonGoal(e.target.value)}
                  rows={4}
                  placeholder="Ex: Quero ensinar a aluna a identificar hábitos de afastamento no relacionamento e criar um plano de ação prático em 5 etapas para reaproximação com segurança emocional."
                  className="w-full bg-black border border-white/10 rounded-xl p-4 text-xs text-white focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Instruções Adicionais para a IA (Opcional)
                </label>
                <input
                  type="text"
                  value={aiInstructions}
                  onChange={e => setAiInstructions(e.target.value)}
                  placeholder="Ex: Inclua um gráfico de hábitos, simulador de cenários e um exercício de escrita reflexiva."
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-emerald-500 outline-none"
                />
              </div>

              {/* Reference Image Upload (Optional) */}
              <div className="space-y-2 p-4 bg-zinc-900/80 rounded-2xl border border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-emerald-400" /> Imagem de Referência (Opcional)
                  </label>
                  <span className="text-[10px] text-gray-500">PNG, JPG, WebP (Max 5MB)</span>
                </div>
                <p className="text-[11px] text-gray-400">
                  Envie um print, rascunho ou mockup visual. A IA analisará o layout, campos e botões para recriar a estrutura como um mini app.
                </p>

                {referenceImage ? (
                  <div className="relative rounded-xl border border-emerald-500/40 overflow-hidden bg-black p-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <img
                        src={referenceImage.data}
                        alt="Reference preview"
                        className="w-12 h-12 object-cover rounded-lg border border-white/10 shrink-0"
                      />
                      <div className="truncate">
                        <span className="text-xs font-bold text-white block truncate">{referenceImage.fileName}</span>
                        <span className="text-[10px] text-emerald-400 font-mono">Pronta para envio à IA</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setReferenceImage(null)}
                      className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg shrink-0 transition-all"
                      title="Remover Imagem"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-white/10 hover:border-emerald-500/40 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-black/40 hover:bg-black/60 transition-all text-center">
                    <Upload size={20} className="text-gray-400 mb-1" />
                    <span className="text-xs font-bold text-gray-300">Clique ou arraste uma imagem aqui</span>
                    <span className="text-[10px] text-gray-500 mt-0.5">A IA usará a imagem como modelo visual para montar a aula</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleGenerate('generate')}
                  disabled={generating}
                  className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="animate-spin" size={18} /> Projetando Aula com IA...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} /> Criar Aula com IA
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* STAGE 2: PREVIEW & EDITOR INTERFACE */
            <div className="space-y-6">
              {/* Top Controls Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-900 rounded-2xl border border-white/10">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                      {generatedLesson.blocks?.length || 0} Blocos Interativos
                    </span>
                    <span className="text-[9px] font-mono text-gray-400">
                      ~{generatedLesson.duration_minutes || 15} min
                    </span>
                  </div>
                  <h3 className="text-base font-black text-white">{generatedLesson.title}</h3>
                </div>

                {/* Tab Switcher */}
                <div className="flex items-center gap-2">
                  <div className="flex p-1 bg-black/60 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                        activeTab === 'preview'
                          ? 'bg-emerald-600 text-white shadow-lg'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Eye size={14} /> Visão da Aluna
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('editor')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                        activeTab === 'editor'
                          ? 'bg-emerald-600 text-white shadow-lg'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      <Settings2 size={14} /> Editar Blocos
                    </button>
                  </div>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'preview' ? (
                <div className="p-4 sm:p-6 bg-black rounded-3xl border border-white/10">
                  <BlockLessonViewer
                    chapterId="admin_preview"
                    blocks={generatedLesson.blocks}
                    title={generatedLesson.title}
                    description={generatedLesson.description}
                    isReadOnlyPreview={true}
                  />
                </div>
              ) : (
                /* BLOCK EDITOR */
                <div className="space-y-6">
                  {/* Add Block Bar */}
                  <div className="p-4 bg-zinc-900/60 rounded-2xl border border-white/10 space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                      + Adicionar Bloco à Aula
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleAddBlock('text')}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5"
                      >
                        <FileText size={14} className="text-emerald-400" /> Texto Explicativo
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBlock('checklist')}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5"
                      >
                        <CheckSquare size={14} className="text-emerald-400" /> Checklist / Tarefas
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBlock('quiz')}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5"
                      >
                        <HelpCircle size={14} className="text-emerald-400" /> Quiz / Teste
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBlock('reflection')}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5"
                      >
                        <MessageSquare size={14} className="text-emerald-400" /> Reflexão Pessoal
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAddBlock('exercise')}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-white text-xs font-bold rounded-xl border border-white/10 flex items-center gap-1.5"
                      >
                        <Award size={14} className="text-emerald-400" /> Exercício Prático
                      </button>
                    </div>
                  </div>

                  {/* List of Blocks */}
                  <div className="space-y-4">
                    {generatedLesson.blocks.map((block, idx) => {
                      const isEditing = editingBlockId === block.id;

                      return (
                        <div
                          key={block.id}
                          className="p-4 sm:p-5 bg-zinc-900/80 rounded-2xl border border-white/10 space-y-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex flex-col gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(idx, 'up')}
                                  disabled={idx === 0}
                                  className="p-1 text-gray-500 hover:text-white disabled:opacity-20"
                                >
                                  <ArrowUp size={12} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(idx, 'down')}
                                  disabled={idx === generatedLesson.blocks.length - 1}
                                  className="p-1 text-gray-500 hover:text-white disabled:opacity-20"
                                >
                                  <ArrowDown size={12} />
                                </button>
                              </div>

                              <span className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 text-xs font-mono font-black shrink-0">
                                #{idx + 1}
                              </span>

                              <div className="min-w-0">
                                <span className="text-[10px] font-black uppercase text-emerald-400 block">
                                  Tipo: {block.type}
                                </span>
                                <h4 className="text-xs font-bold text-white truncate">
                                  {block.title || 'Sem título'}
                                </h4>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleDeleteBlock(block.id)}
                                className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg border border-red-500/20"
                              >
                                <Trash2 size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingBlockId(isEditing ? null : block.id)}
                                className="px-3 py-1.5 text-xs font-bold text-gray-300 bg-white/10 hover:bg-white/20 rounded-xl"
                              >
                                {isEditing ? 'Fechar' : 'Editar Bloco'}
                              </button>
                            </div>
                          </div>

                          {isEditing && (
                            <div className="pt-4 border-t border-white/10 space-y-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-gray-400">
                                    Título do Bloco
                                  </label>
                                  <input
                                    type="text"
                                    value={block.title || ''}
                                    onChange={e =>
                                      handleUpdateBlock(block.id, { title: e.target.value })
                                    }
                                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-gray-400">
                                    Subtítulo / Descrição
                                  </label>
                                  <input
                                    type="text"
                                    value={block.description || ''}
                                    onChange={e =>
                                      handleUpdateBlock(block.id, { description: e.target.value })
                                    }
                                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none"
                                  />
                                </div>
                              </div>

                              {(block.type === 'text' || block.type === 'reflection' || block.type === 'exercise') && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-black uppercase text-gray-400">
                                    Conteúdo do Bloco
                                  </label>
                                  <textarea
                                    value={block.content || ''}
                                    onChange={e =>
                                      handleUpdateBlock(block.id, { content: e.target.value })
                                    }
                                    rows={3}
                                    className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white outline-none resize-none"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Improvement Footer Bar */}
              <div className="p-4 bg-zinc-900/90 rounded-2xl border border-emerald-500/30 flex flex-col sm:flex-row items-center gap-3">
                <input
                  type="text"
                  value={improvementPrompt}
                  onChange={e => setImprovementPrompt(e.target.value)}
                  placeholder="✨ Peça uma melhoria para a IA (ex: adicione mais 2 perguntas de reflexão)..."
                  className="w-full sm:flex-1 bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                />
                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                  <button
                    type="button"
                    onClick={() => handleGenerate('improve')}
                    disabled={improving || !improvementPrompt.trim()}
                    className="px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 font-black text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-40"
                  >
                    {improving ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />}
                    Melhorar com IA
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerate('regenerate')}
                    disabled={generating}
                    className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10"
                    title="Gerar novamente do zero"
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 sm:p-5 bg-zinc-900/90 border-t border-white/10 flex items-center justify-between gap-4 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl"
          >
            Cancelar
          </button>

          {generatedLesson && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGeneratedLesson(null)}
                className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                ← Reiniciar Form
              </button>
              <button
                type="button"
                onClick={handlePublish}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
              >
                <Check size={16} /> Publicar Aula no Curso
              </button>
            </div>
          )}
        </div>
      </div>
    </div>

    {/* AI Image Suggestions Modal */}
    <AiImageSuggestionsModal
      isOpen={isImageModalOpen}
      onClose={() => setIsImageModalOpen(false)}
      initialTopic={lessonTitle || lessonGoal || 'Aula Interativa'}
      contextType="lesson_illustration"
    />
  </>
);
};
