import React, { useMemo, useState } from 'react';
import { Trophy, Star, Zap, Flame, Rocket, Crown, X, CheckCircle2, ChevronRight, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface SmartHomeHeaderProps {
  totalProgress: number;
  lastCourse?: {
    id: string;
    title: string;
    cover_url: string;
    progress: number;
  };
  onContinueCourse?: (course: any) => void;
  settings?: any;
  t: (key: string, variables?: { [key: string]: any }) => string;
}

export default function SmartHomeHeader({ totalProgress, lastCourse, onContinueCourse, settings, t }: SmartHomeHeaderProps) {
  const [showModal, setShowModal] = useState(false);

  // Gamified levels and colors
  const levelInfo = useMemo(() => {
    const getLevelText = (id: number) => settings?.custom_texts?.[`gamification.level_${id}_label`] || t(`gamification.level_${id}_label`);
    const getReqText = (id: number) => settings?.custom_texts?.[`gamification.level_${id}_req`] || t(`gamification.level_${id}_req`);

    if (totalProgress < 1) return { 
      id: 0,
      label: getLevelText(0), 
      color: 'from-zinc-500 to-zinc-400',
      textColor: 'text-zinc-400',
      glow: 'shadow-[0_0_15px_rgba(161,161,170,0.3)]',
      icon: <Star size={12} />,
      bigIcon: <Star size={40} />,
      requirement: getReqText(0)
    };
    if (totalProgress <= 25) return { 
      id: 1,
      label: getLevelText(1), 
      color: 'from-orange-500 to-red-500',
      textColor: 'text-red-400',
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.3)]',
      icon: <Flame size={12} />,
      bigIcon: <Flame size={40} />,
      requirement: getReqText(1)
    };
    if (totalProgress <= 50) return { 
      id: 2,
      label: getLevelText(2), 
      color: 'from-blue-500 to-cyan-400',
      textColor: 'text-blue-400',
      glow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]',
      icon: <Zap size={12} />,
      bigIcon: <Zap size={40} />,
      requirement: getReqText(2)
    };
    if (totalProgress <= 75) return { 
      id: 3,
      label: getLevelText(3), 
      color: 'from-purple-500 to-indigo-500',
      textColor: 'text-purple-400',
      glow: 'shadow-[0_0_15px_rgba(139,92,246,0.3)]',
      icon: <Rocket size={12} />,
      bigIcon: <Rocket size={40} />,
      requirement: getReqText(3)
    };
    if (totalProgress < 100) return { 
      id: 4,
      label: getLevelText(4), 
      color: 'from-yellow-400 to-amber-600',
      textColor: 'text-amber-400',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.3)]',
      icon: <Trophy size={12} />,
      bigIcon: <Trophy size={40} />,
      requirement: getReqText(4)
    };
    return { 
      id: 5,
      label: getLevelText(5), 
      color: 'from-emerald-400 to-green-600',
      textColor: 'text-emerald-400',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.3)]',
      icon: <Crown size={12} />,
      bigIcon: <Crown size={40} />,
      requirement: getReqText(5)
    };
  }, [totalProgress, settings, t]);

  const progressTitle = settings?.custom_texts?.['dashboard.progress_title'] || t('dashboard.progress_title') || 'Progresso do Curso';

  const milestones = [
    { label: settings?.custom_texts?.['gamification.level_1_label'] || t('gamification.level_1_label'), progress: 1, icon: <Flame size={14} />, color: 'bg-red-500' },
    { label: settings?.custom_texts?.['gamification.level_2_label'] || t('gamification.level_2_label'), progress: 25, icon: <Zap size={14} />, color: 'bg-blue-500' },
    { label: settings?.custom_texts?.['gamification.level_3_label'] || t('gamification.level_3_label'), progress: 50, icon: <Rocket size={14} />, color: 'bg-purple-500' },
    { label: settings?.custom_texts?.['gamification.level_4_label'] || t('gamification.level_4_label'), progress: 75, icon: <Trophy size={14} />, color: 'bg-amber-500' },
    { label: settings?.custom_texts?.['gamification.level_5_label'] || t('gamification.level_5_label'), progress: 100, icon: <Crown size={14} />, color: 'bg-emerald-500' },
  ];

  return (
    <div className="px-6 mb-4">
      <motion.div 
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative group cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        {/* Ambient Glow */}
        <div className={cn(
          "absolute -inset-1 bg-gradient-to-r opacity-10 blur-xl transition duration-1000",
          levelInfo.color
        )} />

        <div className="relative bg-zinc-900/60 backdrop-blur-md border border-white/5 rounded-2xl px-4 py-3 flex flex-col gap-2 overflow-hidden shadow-2xl group-hover:bg-zinc-800/80 transition-colors">
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-6 h-6 rounded-lg flex items-center justify-center text-white bg-gradient-to-br transition-all duration-500 group-hover:scale-110",
                levelInfo.color,
                levelInfo.glow
              )}>
                {levelInfo.icon}
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-white italic uppercase tracking-tight">
                  {levelInfo.label} • {totalProgress}%
                </span>
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest leading-none mt-0.5">
                  {progressTitle}
                </span>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <span className="text-[8px] font-black text-primary uppercase tracking-[0.2em] italic">
                {t('gamification.ranking_label')}
              </span>
              <ChevronRight size={10} className="text-primary" />
            </div>
          </div>
          
          <div className="relative h-1 bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${totalProgress}%` }}
              transition={{ duration: 2, ease: [0.34, 1.56, 0.64, 1] }}
              className={cn(
                "h-full rounded-full relative",
                "bg-gradient-to-r shadow-[0_0_10px_rgba(255,255,255,0.2)]",
                levelInfo.color
              )}
            >
              {/* Energy Flow Animation */}
              <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] w-1/2 animate-shimmer -translate-x-full" />
              
              {/* Glowing Tip */}
              <div className={cn(
                "absolute right-0 top-0 bottom-0 w-8 blur-md rounded-full opacity-50",
                levelInfo.color.includes('from-') ? "bg-white" : ""
              )} />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,1)] z-10" />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Gamification Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-xl"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-md bg-zinc-950 border border-white/10 rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Modal Content */}
              <div className="relative p-6 sm:p-8 flex flex-col items-center text-center overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-primary/20 to-transparent pointer-events-none" />
                
                <button 
                  onClick={() => setShowModal(false)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>

                {/* Level Badge */}
                <motion.div 
                  initial={{ rotate: -20, scale: 0 }}
                  animate={{ rotate: 0, scale: 1 }}
                  transition={{ type: "spring", damping: 12, delay: 0.2 }}
                  className={cn(
                    "w-24 h-24 rounded-[32px] flex items-center justify-center text-white bg-gradient-to-br shadow-2xl mb-6 relative",
                    levelInfo.color,
                    levelInfo.glow
                  )}
                >
                  <div className="absolute -top-2 -right-2 bg-zinc-950 rounded-full p-1.5 border border-white/10 text-[10px] font-black italic">
                    {t('gamification.level_short')} {levelInfo.id}
                  </div>
                  {levelInfo.bigIcon}
                </motion.div>

                <h2 className="text-2xl font-black text-white italic uppercase tracking-tight mb-1">
                  {t('gamification.modal_title', { level: levelInfo.label })}
                </h2>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] mb-8">
                  {t('gamification.progress_label', { progress: totalProgress })}
                </p>

                <div className="w-full space-y-3 mb-8">
                  {milestones.map((ms, index) => {
                    const milestoneLevel = index + 1;
                    const isCompleted = totalProgress >= ms.progress;
                    const isCurrent = levelInfo.id === milestoneLevel;
                    const isNext = milestoneLevel === levelInfo.id + 1;
                    const isLocked = milestoneLevel > levelInfo.id + 1;
                    
                    return (
                      <div 
                        key={ms.label}
                        className={cn(
                          "flex items-center gap-4 p-3 rounded-2xl border transition-all duration-300",
                          isCurrent ? "bg-primary/10 border-primary/30 ring-2 ring-primary/20 scale-[1.02] shadow-lg shadow-primary/5" : 
                          isCompleted ? "bg-white/5 border-white/10 opacity-70" : 
                          isNext ? "bg-zinc-900/40 border-white/5 opacity-50" : 
                          "bg-transparent border-white/5 opacity-20"
                        )}
                      >
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 transition-transform duration-500",
                          isCurrent ? ms.color + " shadow-lg shadow-black/40 scale-110" : 
                          isCompleted ? "bg-zinc-800" : "bg-zinc-900"
                        )}>
                          {isCompleted && !isCurrent ? <CheckCircle2 size={18} className="text-emerald-400" /> : ms.icon}
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-xs font-black uppercase tracking-tight italic",
                                isCurrent ? "text-white" : isCompleted ? "text-zinc-300" : "text-zinc-600"
                              )}>
                                {ms.label}
                              </span>
                              {isCurrent && (
                                <span className="bg-primary text-[8px] px-1.5 py-0.5 rounded-full text-black font-black italic animate-pulse">
                                  {t('gamification.you_label')}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] font-bold text-zinc-500">
                              {ms.progress}%
                            </span>
                          </div>
                          {isCurrent && totalProgress < 100 && (
                            <p className="text-[9px] text-primary/80 mt-0.5 font-bold leading-none italic uppercase tracking-wider">
                              {t('gamification.target_label', { left: milestones[index].progress > totalProgress ? milestones[index].progress - totalProgress : (milestones[index+1]?.progress || 100) - totalProgress })}
                            </p>
                          )}
                          {!isCompleted && !isCurrent && index > 0 && (
                            <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                              <div className="h-full bg-zinc-800 w-0" />
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Next Reward / Incentive */}
                <div className="w-full bg-zinc-900/50 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 relative overflow-hidden group/reward">
                  <div className="flex items-center gap-3 relative z-10">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <Target size={20} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest italic leading-none mb-1">
                        {t('gamification.next_achievement')}
                      </span>
                      <h4 className="text-xs font-black text-white uppercase">{levelInfo.requirement}</h4>
                    </div>
                  </div>
                  <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-primary/10 to-transparent group-hover/reward:w-32 transition-all duration-700" />
                  <div className="absolute top-1/2 -right-4 -translate-y-1/2 text-primary/10">
                    {levelInfo.bigIcon}
                  </div>
                </div>

                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full mt-8 py-4 rounded-2xl bg-zinc-100 text-black font-black uppercase tracking-[0.2em] italic hover:bg-white transition-colors flex items-center justify-center gap-2"
                >
                  {t('gamification.continue_journey')} <Rocket size={18} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
}


