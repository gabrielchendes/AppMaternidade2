import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, CheckCircle2, Sparkles, RefreshCw, Layers, ShieldCheck, AlertCircle } from 'lucide-react';
import { Checklist, ChecklistItem } from '../types/lms';
import {
  fetchChecklistByChapterId,
  fetchUserChecklistProgress,
  saveUserChecklistProgressItem
} from '../services/checklistService';

interface InteractiveChecklistProps {
  chapterId: string;
  userId: string;
  initialChecklist?: Checklist | null;
  onAllCompletedChange?: (completed: boolean) => void;
  accentColor?: string;
}

export const InteractiveChecklist: React.FC<InteractiveChecklistProps> = ({
  chapterId,
  userId,
  initialChecklist,
  onAllCompletedChange,
  accentColor = '#10b981'
}) => {
  const [checklist, setChecklist] = useState<Checklist | null>(initialChecklist || null);
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(!initialChecklist);
  const [showCelebration, setShowCelebration] = useState<boolean>(false);

  // Load checklist structure and user progress
  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      if (!chapterId) return;

      setLoading(true);

      // Fetch checklist data if not provided
      let currentChecklist = initialChecklist;
      if (!currentChecklist) {
        currentChecklist = await fetchChecklistByChapterId(chapterId);
      }

      if (isMounted) {
        setChecklist(currentChecklist);
      }

      // Fetch user's progress map
      if (userId) {
        const userProgress = await fetchUserChecklistProgress(userId, chapterId);
        if (isMounted) {
          setProgressMap(userProgress);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [chapterId, userId, initialChecklist]);

  // Active items only
  const activeItems = useMemo(() => {
    if (!checklist?.items) return [];
    return checklist.items
      .filter(item => item.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [checklist]);

  // Group items by stage/category if provided
  const groupedItems = useMemo(() => {
    const groups: { category: string; items: ChecklistItem[] }[] = [];
    const map = new Map<string, ChecklistItem[]>();

    activeItems.forEach(item => {
      const cat = item.category || 'Geral';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      map.get(cat)!.push(item);
    });

    map.forEach((items, category) => {
      groups.push({ category, items });
    });

    return groups;
  }, [activeItems]);

  // Calculate completion stats
  const totalCount = activeItems.length;
  const completedCount = useMemo(() => {
    if (totalCount === 0) return 0;
    return activeItems.filter(item => !!progressMap[item.id]).length;
  }, [activeItems, progressMap, totalCount]);

  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const isAllCompleted = totalCount > 0 && completedCount === totalCount;

  // Notify parent component when completion state changes
  useEffect(() => {
    if (onAllCompletedChange) {
      onAllCompletedChange(isAllCompleted);
    }
    if (isAllCompleted && totalCount > 0) {
      setShowCelebration(true);
    }
  }, [isAllCompleted, totalCount, onAllCompletedChange]);

  // Toggle item status with optimistic update
  const handleToggleItem = (item: ChecklistItem) => {
    if (!item.id || !userId || !chapterId) return;

    const currentStatus = !!progressMap[item.id];
    const newStatus = !currentStatus;

    // 1. Optimistic local state update (0ms response time)
    setProgressMap(prev => ({
      ...prev,
      [item.id]: newStatus
    }));

    // 2. Persist to Supabase asynchronously
    saveUserChecklistProgressItem(
      userId,
      chapterId,
      item.id,
      newStatus,
      checklist?.id
    );
  };

  if (loading) {
    return (
      <div className="w-full py-16 flex flex-col items-center justify-center space-y-4">
        <RefreshCw size={28} className="animate-spin text-emerald-500" />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Carregando sua checklist...
        </p>
      </div>
    );
  }

  if (!checklist || activeItems.length === 0) {
    return (
      <div className="w-full p-8 rounded-3xl bg-zinc-900/50 border border-white/10 text-center space-y-3">
        <AlertCircle size={32} className="mx-auto text-amber-500/80" />
        <h4 className="text-sm font-black text-white uppercase tracking-wider">
          Nenhum item configurado
        </h4>
        <p className="text-xs text-gray-400 max-w-md mx-auto">
          Esta checklist ainda não possui itens ativos cadastrados.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 text-left">
      {/* Header & Instructions */}
      <div className="space-y-4">
        {checklist.image_url && (
          <div className="w-full aspect-video rounded-3xl overflow-hidden border border-white/10 shadow-xl mb-6">
            <img
              src={checklist.image_url}
              alt={checklist.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {checklist.instructions && (
          <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs sm:text-sm font-medium leading-relaxed flex items-start gap-3">
            <ShieldCheck size={20} className="shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <span className="font-bold uppercase tracking-wider block text-[10px] text-emerald-400 mb-1">
                Instruções da Tarefa
              </span>
              {checklist.instructions}
            </div>
          </div>
        )}
      </div>

      {/* Progress Card */}
      <div className="p-6 sm:p-8 rounded-3xl bg-zinc-900/90 border border-white/10 shadow-2xl space-y-5 relative overflow-hidden backdrop-blur-xl">
        {/* Ambient Top Glow */}
        <div
          className="absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none transition-all duration-700"
          style={{ backgroundColor: accentColor }}
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">
              Seu Progresso
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              {completedCount} de {totalCount} tarefas concluídas
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="px-4 py-2 rounded-2xl text-lg font-black text-white border border-white/10 shadow-inner flex items-center gap-1.5"
              style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
            >
              <Sparkles size={16} className="text-amber-400" />
              <span>{percentage}%</span>
            </div>
          </div>
        </div>

        {/* Progress Bar Container */}
        <div className="w-full bg-black/60 rounded-full h-4 p-1 border border-white/10 overflow-hidden relative">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 15 }}
            className="h-full rounded-full relative"
            style={{
              background: `linear-gradient(90deg, ${accentColor} 0%, #34d399 100%)`,
              boxShadow: `0 0 15px ${accentColor}80`
            }}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse rounded-full" />
          </motion.div>
        </div>

        {/* Status Text */}
        <div className="flex items-center justify-between text-xs font-semibold text-gray-400 pt-1">
          <span>{isAllCompleted ? '🎉 Todas as tarefas concluídas!' : 'Continue no seu ritmo'}</span>
          <span>{totalCount - completedCount} pendente(s)</span>
        </div>
      </div>

      {/* Completion Celebration Banner */}
      <AnimatePresence>
        {isAllCompleted && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-emerald-950/80 via-zinc-900 to-zinc-900 border border-emerald-500/40 shadow-2xl text-center space-y-3 relative overflow-hidden"
          >
            <div className="inline-flex p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30 mb-1">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-xl sm:text-2xl font-black text-white">
              Checklist Concluída com Sucesso!
            </h3>
            <p className="text-xs sm:text-sm text-emerald-200/90 max-w-lg mx-auto leading-relaxed">
              Você concluiu todas as etapas com empenho e dedicação. Lembre-se de colocar em prática os aprendizados no seu dia a dia.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checklist Items List */}
      <div className="space-y-8">
        {groupedItems.map((group, gIdx) => (
          <div key={`group_${gIdx}_${group.category}`} className="space-y-4">
            {/* Group Header (if categories exist) */}
            {groupedItems.length > 1 || group.category !== 'Geral' ? (
              <div className="flex items-center gap-3 pt-2">
                <div className="p-2 bg-white/5 rounded-xl text-emerald-400 border border-white/10">
                  <Layers size={16} />
                </div>
                <h4 className="text-xs font-black uppercase tracking-widest text-emerald-400">
                  {group.category}
                </h4>
                <div className="h-px bg-white/10 flex-1 ml-2" />
              </div>
            ) : null}

            {/* Items Cards */}
            <div className="space-y-3">
              {group.items.map((item, index) => {
                const isChecked = !!progressMap[item.id];

                return (
                  <motion.div
                    key={item.id || `item_${index}`}
                    layout
                    whileTap={{ scale: 0.99 }}
                    onClick={() => handleToggleItem(item)}
                    className={`
                      group cursor-pointer rounded-2xl p-5 sm:p-6 border transition-all duration-300 flex items-start gap-4 sm:gap-5 relative overflow-hidden select-none
                      ${
                        isChecked
                          ? 'bg-zinc-900/40 border-emerald-500/30 shadow-[0_4px_20px_rgba(16,185,129,0.08)]'
                          : 'bg-zinc-900/80 border-white/10 hover:border-white/20 hover:bg-zinc-800/80 shadow-lg'
                      }
                    `}
                  >
                    {/* Left Checkbox/Toggle Control */}
                    <div className="shrink-0 pt-0.5">
                      <div
                        className={`
                          w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center transition-all duration-300 border
                          ${
                            isChecked
                              ? 'bg-emerald-500 border-emerald-400 text-black shadow-[0_0_15px_rgba(16,185,129,0.5)]'
                              : 'bg-black/50 border-white/20 text-transparent group-hover:border-emerald-500/50'
                          }
                        `}
                      >
                        <Check size={18} strokeWidth={3} className={isChecked ? 'scale-100' : 'scale-0'} />
                      </div>
                    </div>

                    {/* Item Text Content */}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h5
                          className={`text-sm sm:text-base font-bold transition-colors duration-300 ${
                            isChecked ? 'text-gray-400 line-through decoration-emerald-500/50' : 'text-white'
                          }`}
                        >
                          {item.title}
                        </h5>
                        {item.required && (
                          <span className="shrink-0 text-[9px] font-black uppercase tracking-wider text-amber-400/90 bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                            Obrigatório
                          </span>
                        )}
                      </div>

                      {item.description && (
                        <p
                          className={`text-xs sm:text-sm leading-relaxed transition-colors duration-300 ${
                            isChecked ? 'text-gray-600' : 'text-gray-400'
                          }`}
                        >
                          {item.description}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
