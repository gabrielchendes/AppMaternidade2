import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Layers,
  Save,
  CheckSquare,
  Eye,
  Settings2,
  Image as ImageIcon
} from 'lucide-react';
import { Checklist, ChecklistItem } from '../types/lms';
import { RECONNECTION_CHECKLIST_TEMPLATE } from '../services/checklistService';
import { InteractiveChecklist } from './InteractiveChecklist';

interface AdminChecklistEditorProps {
  checklist: Checklist;
  onChange: (updated: Checklist) => void;
  onSave?: () => void;
  isSaving?: boolean;
}

export const AdminChecklistEditor: React.FC<AdminChecklistEditorProps> = ({
  checklist,
  onChange,
  onSave,
  isSaving = false
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'preview'>('editor');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Helper to trigger parent onChange
  const updateChecklist = (field: keyof Checklist, value: any) => {
    onChange({
      ...checklist,
      [field]: value
    });
  };

  const updateItems = (newItems: ChecklistItem[]) => {
    onChange({
      ...checklist,
      items: newItems
    });
  };

  // Item operations
  const handleAddItem = () => {
    const newItem: ChecklistItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      chapter_id: checklist.chapter_id,
      title: 'Nova tarefa da checklist',
      description: 'Descrição ou orientação para a aluna',
      category: 'Geral',
      sort_order: checklist.items.length + 1,
      required: false,
      is_active: true
    };
    updateItems([...checklist.items, newItem]);
    setEditingItemId(newItem.id);
  };

  const handleUpdateItem = (id: string, updates: Partial<ChecklistItem>) => {
    const newItems = checklist.items.map(item =>
      item.id === id ? { ...item, ...updates } : item
    );
    updateItems(newItems);
  };

  const handleDeleteItem = (id: string) => {
    updateItems(checklist.items.filter(item => item.id !== id));
    if (editingItemId === id) setEditingItemId(null);
  };

  const handleDuplicateItem = (item: ChecklistItem) => {
    const duplicated: ChecklistItem = {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title: `${item.title} (Cópia)`,
      sort_order: item.sort_order + 1
    };
    const index = checklist.items.findIndex(it => it.id === item.id);
    const newItems = [...checklist.items];
    newItems.splice(index + 1, 0, duplicated);
    // Recalculate sort order
    const ordered = newItems.map((it, idx) => ({ ...it, sort_order: idx + 1 }));
    updateItems(ordered);
  };

  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === checklist.items.length - 1)
    ) {
      return;
    }

    const newItems = [...checklist.items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;

    // Recalculate sort order
    const ordered = newItems.map((it, idx) => ({ ...it, sort_order: idx + 1 }));
    updateItems(ordered);
  };

  const handleLoadTemplate = () => {
    if (
      checklist.items.length > 0 &&
      !window.confirm(
        'Deseja carregar o modelo de Reconexão? Isso irá substituir os itens atuais da checklist.'
      )
    ) {
      return;
    }

    onChange({
      ...checklist,
      title: RECONNECTION_CHECKLIST_TEMPLATE.title || checklist.title,
      description: RECONNECTION_CHECKLIST_TEMPLATE.description || checklist.description,
      instructions: RECONNECTION_CHECKLIST_TEMPLATE.instructions || checklist.instructions,
      items: (RECONNECTION_CHECKLIST_TEMPLATE.items || []).map((item, idx) => ({
        ...item,
        id: `item_${Date.now()}_${idx}`,
        chapter_id: checklist.chapter_id
      }))
    });
  };

  return (
    <div className="w-full space-y-6 text-left">
      {/* Top Header & Tab Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 sm:p-5 bg-zinc-900/90 rounded-2xl border border-white/10 w-full overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 sm:p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 shrink-0">
            <CheckSquare size={20} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-black text-white truncate">Configuração da Checklist Interativa</h3>
            <p className="text-[11px] text-gray-400 truncate">
              Configure as tarefas, etapas e instruções que a aluna irá preencher.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 justify-start lg:justify-end">
          {/* Tab buttons */}
          <div className="flex p-1 bg-black/60 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('editor')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'editor'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Settings2 size={14} /> Editor ({checklist.items?.length || 0})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-all ${
                activeTab === 'preview'
                  ? 'bg-emerald-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Eye size={14} /> Preview
            </button>
          </div>

          {onSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs rounded-xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 disabled:opacity-50 shrink-0"
            >
              <Save size={14} /> {isSaving ? 'Salvando...' : 'Salvar Checklist'}
            </button>
          )}
        </div>
      </div>

      {activeTab === 'preview' ? (
        <div className="p-6 bg-black rounded-3xl border border-white/10">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest text-center mb-6">
            Pré-visualização do Aluno
          </p>
          <InteractiveChecklist
            chapterId={checklist.chapter_id || 'preview_chapter'}
            userId="preview_user"
            initialChecklist={checklist}
          />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Preset Template Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-zinc-900 to-zinc-900 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl mt-0.5">
                <Sparkles size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">
                  Modelo Pronto Demonstrativo
                </h4>
                <p className="text-xs text-gray-300">
                  Jornada de Reconexão e Autocuidado (12 tarefas em 4 etapas estruturadas).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLoadTemplate}
              className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-black transition-all shrink-0 flex items-center gap-1.5"
            >
              <Sparkles size={14} /> Carregar Modelo Exemplo
            </button>
          </div>

          {/* Basic Info Settings */}
          <div className="p-6 bg-zinc-900/60 rounded-2xl border border-white/10 space-y-4">
            <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
              <Settings2 size={14} className="text-emerald-400" /> Informações Básicas da Checklist
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Título da Checklist
                </label>
                <input
                  type="text"
                  value={checklist.title || ''}
                  onChange={e => updateChecklist('title', e.target.value)}
                  placeholder="Ex: Jornada de Reconexão e Autocuidado"
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  URL da Imagem de Capa (Opcional)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={checklist.image_url || ''}
                    onChange={e => updateChecklist('image_url', e.target.value)}
                    placeholder="https://..."
                    className="w-full bg-black border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                  />
                  <ImageIcon size={14} className="absolute left-3 top-3 text-gray-500" />
                </div>
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Descrição Geral
                </label>
                <textarea
                  value={checklist.description || ''}
                  onChange={e => updateChecklist('description', e.target.value)}
                  rows={2}
                  placeholder="Explicação breve sobre o objetivo desta checklist..."
                  className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none resize-none"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                  Instruções para a Aluna
                </label>
                <input
                  type="text"
                  value={checklist.instructions || ''}
                  onChange={e => updateChecklist('instructions', e.target.value)}
                  placeholder="Ex: Marque cada etapa à medida que vivenciar na sua rotina."
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-emerald-500 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Items Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <Layers size={14} className="text-emerald-400" /> Itens da Checklist ({checklist.items?.length || 0})
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
              >
                <Plus size={14} /> Adicionar Item
              </button>
            </div>

            {checklist.items?.length === 0 ? (
              <div className="p-8 text-center bg-zinc-900/40 rounded-2xl border border-dashed border-white/10 space-y-3">
                <p className="text-xs text-gray-400">Nenhum item adicionado ainda nesta checklist.</p>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="px-4 py-2 bg-emerald-500 text-black font-black text-xs rounded-xl hover:bg-emerald-400 transition-all"
                >
                  Criar Primeiro Item
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {checklist.items.map((item, idx) => {
                  const isExpanded = editingItemId === item.id;

                  return (
                    <div
                      key={item.id || `item_${idx}`}
                      className={`p-4 rounded-2xl border transition-all ${
                        item.is_active !== false
                          ? 'bg-zinc-900/80 border-white/10'
                          : 'bg-zinc-950/60 border-white/5 opacity-60'
                      }`}
                    >
                      {/* Compact Item Header Row */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Reorder arrows */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              onClick={() => handleMoveItem(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-gray-500 hover:text-white disabled:opacity-20"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveItem(idx, 'down')}
                              disabled={idx === checklist.items.length - 1}
                              className="p-1 text-gray-500 hover:text-white disabled:opacity-20"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>

                          <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setEditingItemId(isExpanded ? null : item.id)}>
                            <div className="flex items-center gap-2">
                              {item.category && (
                                <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                  {item.category}
                                </span>
                              )}
                              <span className="text-xs font-bold text-white truncate">
                                {item.title || 'Sem título'}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-[11px] text-gray-400 truncate mt-0.5">
                                {item.description}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Badges and Actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.is_active !== false}
                              onChange={e => handleUpdateItem(item.id, { is_active: e.target.checked })}
                              className="rounded accent-emerald-500"
                            />
                            Ativo
                          </label>

                          <button
                            type="button"
                            onClick={() => handleDuplicateItem(item)}
                            title="Duplicar item"
                            className="p-2 text-gray-400 hover:text-white bg-white/5 rounded-lg border border-white/5"
                          >
                            <Copy size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            title="Excluir item"
                            className="p-2 text-red-400 hover:text-red-300 bg-red-500/10 rounded-lg border border-red-500/20"
                          >
                            <Trash2 size={12} />
                          </button>

                          <button
                            type="button"
                            onClick={() => setEditingItemId(isExpanded ? null : item.id)}
                            className="px-2.5 py-1 text-[10px] font-bold text-gray-300 bg-white/10 hover:bg-white/20 rounded-lg"
                          >
                            {isExpanded ? 'Fechar' : 'Editar'}
                          </button>
                        </div>
                      </div>

                      {/* Expanded Item Edit Form */}
                      {isExpanded && (
                        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 gap-3 text-left">
                          <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                              Título da Tarefa
                            </label>
                            <input
                              type="text"
                              value={item.title}
                              onChange={e => handleUpdateItem(item.id, { title: e.target.value })}
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                              Categoria / Etapa (Opcional)
                            </label>
                            <input
                              type="text"
                              value={item.category || ''}
                              onChange={e => handleUpdateItem(item.id, { category: e.target.value })}
                              placeholder="Ex: Etapa 1 — Pare e avalie"
                              className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-emerald-500 outline-none"
                            />
                          </div>

                          <div className="flex items-center gap-4 pt-4">
                            <label className="flex items-center gap-2 text-xs text-white font-medium cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.required || false}
                                onChange={e => handleUpdateItem(item.id, { required: e.target.checked })}
                                className="rounded accent-emerald-500"
                              />
                              Tarefa Obrigatória
                            </label>
                          </div>

                          <div className="space-y-1 md:col-span-2">
                            <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                              Descrição / Orientação Adicional
                            </label>
                            <textarea
                              value={item.description || ''}
                              onChange={e => handleUpdateItem(item.id, { description: e.target.value })}
                              rows={2}
                              className="w-full bg-black border border-white/10 rounded-xl p-3 text-xs text-white focus:border-emerald-500 outline-none resize-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
