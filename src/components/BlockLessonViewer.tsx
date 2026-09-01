import React, { useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import {
  CheckCircle2,
  Circle,
  HelpCircle,
  Send,
  Sparkles,
  Play,
  FileText,
  ExternalLink,
  ChevronRight,
  RotateCcw,
  CheckSquare,
  MessageSquare,
  Target,
  Award,
  Flame,
  ThermometerSnowflake,
  SunMedium,
  AlertTriangle,
  Clock,
  ShieldCheck,
  TrendingUp,
  Sliders,
  Calendar,
  Zap,
  Split,
  Layers,
  HeartHandshake
} from 'lucide-react';
import { LessonBlock, LessonBlockItem } from '../types/lms';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import { showToast } from '../lib/customToast';

interface BlockLessonViewerProps {
  chapterId: string;
  userId?: string;
  blocks: LessonBlock[];
  title?: string;
  description?: string;
  lessonLanguage?: string;
  onLessonComplete?: () => void;
  isReadOnlyPreview?: boolean;
}

export const BlockLessonViewer: React.FC<BlockLessonViewerProps> = ({
  chapterId,
  userId,
  blocks = [],
  title,
  description,
  lessonLanguage = 'en',
  onLessonComplete,
  isReadOnlyPreview = false
}) => {
  // Default Helper text dictionary for UI controls (en-US standard)
  const t = {
    interactiveExp: 'Interactive Lesson Experience',
    yourProgress: 'Your Lesson Progress',
    completed: 'Completed',
    analyzePrompt: 'Paste the message or text for AI to analyze:',
    analyzePlaceholder: 'Ex: "Hey, long time no see, how are you?"',
    analyzingBtn: 'Analyzing Message...',
    analyzeBtn: 'Analyze Message with AI',
    aiDiagnosis: 'AI Diagnosis',
    msgInterpretation: 'Message Interpretation:',
    identifiedSignals: 'Identified Signals in Message:',
    recommendations: '✅ Recommendations (What to do):',
    whatToAvoid: '❌ What NOT to do:',
    strategicPosture: '💡 Suggested Strategic Posture:',
    disclaimer: 'This is an educational interpretation based on lesson criteria. Isolated messages do not determine definitive feelings.',
    startTracker: '🔥 Start Tracker Now',
    currentStreak: 'Current Streak',
    day: 'Day',
    days: 'Days',
    totalHours: 'Total Hours',
    mainGoal: 'Main Goal',
    goalProgress: 'Goal Progress',
    milestones: 'Achievement Milestones:',
    sosBtn: 'SOS / Emergency Support',
    resetCount: 'Reset Count',
    emergencyGuidance: 'Emergency Guidance',
    emergencyText: 'Take a 10-minute pause. Remember: urges average 15 minutes. Take a deep breath, drink water, and review your lesson reflections before taking action!',
    scenario: 'Practical Scenario',
    yourChoice: 'Your Choice ✓',
    consequence: 'Educational Consequence:',
    calculatedLevel: 'Your Calculated Level',
    readinessTitle: 'Readiness Assessment',
    readinessSub: 'Answer the statements below to calculate your score.',
    reactiveApproach: '❌ Reactive Approach (Avoid)',
    strategicApproach: '✅ Strategic Approach (Recommended)',
    question: 'Question',
    correct: 'Correct ✓',
    pedagogicalExp: 'Pedagogical Explanation:',
    reflectionPlaceholder: 'Write your reflection here...',
    reflectionNote: 'Your responses are securely saved to your lesson journal.',
    saved: '✓ Saved!',
    autoSaved: 'Auto-saved',
    accessResource: 'Access External Resource',
    congratsTitle: 'Congratulations! Lesson Completed',
    congratsDesc: 'You have successfully completed all interactive exercises, simulators, and tasks in this lesson!'
  };
  // Saved responses state: blockId -> answer text or checked items map
  const [completedItems, setCompletedItems] = useState<Record<string, boolean>>({});
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [simulatorChoices, setSimulatorChoices] = useState<Record<string, number>>({});
  const [reflections, setReflections] = useState<Record<string, string>>({});
  const [savingState, setSavingState] = useState<Record<string, boolean>>({});

  // AI Analyzer states (blockId -> input/analysis)
  const [analyzerInputs, setAnalyzerInputs] = useState<Record<string, string>>({});
  const [analyzerResults, setAnalyzerResults] = useState<Record<string, any>>({});
  const [analyzerLoading, setAnalyzerLoading] = useState<Record<string, boolean>>({});

  // Tracker states (blockId -> start timestamp / logs)
  const [trackerStartDates, setTrackerStartDates] = useState<Record<string, string>>({});
  const [sosActiveBlock, setSosActiveBlock] = useState<string | null>(null);

  // Load saved student progress
  useEffect(() => {
    if (isReadOnlyPreview || !userId || !chapterId) return;

    async function loadProgress() {
      try {
        // Load checklist & task progress
        const { data: progressData } = await supabase
          .from('user_checklist_progress')
          .select('item_id, completed')
          .eq('user_id', userId)
          .eq('chapter_id', chapterId);

        if (progressData && progressData.length > 0) {
          const map: Record<string, boolean> = {};
          progressData.forEach((row: any) => {
            map[row.item_id] = row.completed;
          });
          setCompletedItems(map);
        }

        // Load local reflections and mini-app data cache
        const localKey = `lesson_responses_${userId}_${chapterId}`;
        const cached = localStorage.getItem(localKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (parsed.reflections) setReflections(parsed.reflections);
            if (parsed.quizAnswers) setQuizAnswers(parsed.quizAnswers);
            if (parsed.simulatorChoices) setSimulatorChoices(parsed.simulatorChoices);
            if (parsed.analyzerResults) setAnalyzerResults(parsed.analyzerResults);
            if (parsed.trackerStartDates) setTrackerStartDates(parsed.trackerStartDates);
            if (parsed.completedItems && (!progressData || progressData.length === 0)) {
              setCompletedItems(parsed.completedItems);
            }
          } catch (e) {
            console.error('Failed to parse cached responses:', e);
          }
        }
      } catch (err) {
        console.warn('Error loading user lesson progress:', err);
      }
    }

    loadProgress();
  }, [chapterId, userId, isReadOnlyPreview]);

  // Save changes to localStorage
  const saveLocalState = (
    newItems: Record<string, boolean>,
    newQuiz: Record<string, number>,
    newReflections: Record<string, string>,
    extraData: Record<string, any> = {}
  ) => {
    if (!userId || !chapterId) return;
    const localKey = `lesson_responses_${userId}_${chapterId}`;
    localStorage.setItem(
      localKey,
      JSON.stringify({
        completedItems: newItems,
        quizAnswers: newQuiz,
        simulatorChoices: extraData.simulatorChoices || simulatorChoices,
        analyzerResults: extraData.analyzerResults || analyzerResults,
        trackerStartDates: extraData.trackerStartDates || trackerStartDates,
        reflections: newReflections,
        updatedAt: new Date().toISOString()
      })
    );
  };

  // Toggle checklist item / task completion
  const handleToggleItem = async (itemId: string, itemIdOrKey: string) => {
    if (isReadOnlyPreview) return;

    const nextState = !completedItems[itemIdOrKey];
    const updatedMap = { ...completedItems, [itemIdOrKey]: nextState };
    setCompletedItems(updatedMap);
    saveLocalState(updatedMap, quizAnswers, reflections);

    if (userId && chapterId) {
      try {
        await supabase.from('user_checklist_progress').upsert(
          [
            {
              user_id: userId,
              chapter_id: chapterId,
              item_id: itemId,
              completed: nextState,
              completed_at: new Date().toISOString()
            }
          ],
          { onConflict: 'user_id,item_id' }
        );
      } catch (err) {
        console.warn('Failed to persist item state to DB:', err);
      }
    }

    checkOverallCompletion(updatedMap, quizAnswers, reflections);
  };

  // Select quiz option
  const handleSelectQuiz = (blockId: string, itemIdx: number, optionIdx: number) => {
    if (isReadOnlyPreview) return;

    const quizKey = `${blockId}_${itemIdx}`;
    const updatedQuiz = { ...quizAnswers, [quizKey]: optionIdx };
    setQuizAnswers(updatedQuiz);
    saveLocalState(completedItems, updatedQuiz, reflections);

    checkOverallCompletion(completedItems, updatedQuiz, reflections);
  };

  // Select simulator scenario option
  const handleSelectSimulator = (blockId: string, itemIdx: number, optionIdx: number) => {
    if (isReadOnlyPreview) return;
    const simKey = `${blockId}_${itemIdx}`;
    const updatedSim = { ...simulatorChoices, [simKey]: optionIdx };
    setSimulatorChoices(updatedSim);
    saveLocalState(completedItems, quizAnswers, reflections, { simulatorChoices: updatedSim });
  };

  // Execute AI Message Analysis
  const handleAnalyzeMessage = async (block: LessonBlock) => {
    const textToAnalyze = analyzerInputs[block.id];
    if (!textToAnalyze || !textToAnalyze.trim()) {
      showToast.error('Please paste or enter the message text to analyze.');
      return;
    }

    setAnalyzerLoading(prev => ({ ...prev, [block.id]: true }));

    try {
      const res = await fetch('/api/v1/analyze-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageText: textToAnalyze,
          lessonContext: block.title || title || 'Message Analysis',
          analysisCriteria: block.analyzer_criteria || 'Strategic message interpretation',
          lessonLanguage
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze message');
      }

      const updatedResults = { ...analyzerResults, [block.id]: data.analysis };
      setAnalyzerResults(updatedResults);
      saveLocalState(completedItems, quizAnswers, reflections, { analyzerResults: updatedResults });
      showToast.success('Analysis completed successfully!');
    } catch (err: any) {
      console.error('Analysis error:', err);
      showToast.error('Error analyzing message: ' + (err.message || 'Please try again'));
    } finally {
      setAnalyzerLoading(prev => ({ ...prev, [block.id]: false }));
    }
  };

  // Start Tracker Date
  const handleStartTracker = (blockId: string, customStartDate?: string) => {
    const startDate = customStartDate || new Date().toISOString();
    const updatedTracker = { ...trackerStartDates, [blockId]: startDate };
    setTrackerStartDates(updatedTracker);
    saveLocalState(completedItems, quizAnswers, reflections, { trackerStartDates: updatedTracker });
    showToast.success('Tracker started! Stay focused.');
  };

  // Reset Tracker
  const handleResetTracker = (blockId: string) => {
    if (window.confirm('Are you sure you want to reset your day streak?')) {
      const now = new Date().toISOString();
      const updatedTracker = { ...trackerStartDates, [blockId]: now };
      setTrackerStartDates(updatedTracker);
      saveLocalState(completedItems, quizAnswers, reflections, { trackerStartDates: updatedTracker });
      showToast.info('Streak reset. Starting over is a sign of resilience!');
    }
  };

  // Save reflection input text
  const handleSaveReflection = (blockId: string, text: string) => {
    const updatedReflections = { ...reflections, [blockId]: text };
    setReflections(updatedReflections);
    saveLocalState(completedItems, quizAnswers, updatedReflections);

    setSavingState(prev => ({ ...prev, [blockId]: true }));
    setTimeout(() => {
      setSavingState(prev => ({ ...prev, [blockId]: false }));
    }, 800);

    checkOverallCompletion(completedItems, quizAnswers, updatedReflections);
  };

  // Calculate Readiness Evaluator Score %
  const calculateReadinessScore = (block: LessonBlock) => {
    if (!block.items || block.items.length === 0) return 0;
    let totalMaxWeight = 0;
    let currentScore = 0;

    block.items.forEach((item, idx) => {
      const weight = item.weight || 10;
      totalMaxWeight += weight;
      const key = item.id || `${block.id}_${idx}`;
      if (completedItems[key]) {
        currentScore += weight;
      }
    });

    return totalMaxWeight > 0 ? Math.round((currentScore / totalMaxWeight) * 100) : 0;
  };

  // Total items required to complete lesson
  const totalInteractives = blocks.reduce((acc, block) => {
    if (block.type === 'checklist' || block.type === 'action_plan' || block.type === 'exercise' || block.type === 'readiness_evaluator') {
      return acc + (block.items?.length || 0);
    }
    if (block.type === 'quiz') {
      return acc + (block.items?.length || 1);
    }
    if (block.type === 'reflection' || block.type === 'ai_analyzer') {
      return acc + 1;
    }
    return acc;
  }, 0);

  // Completed items count
  const completedCount = blocks.reduce((acc, block, bIdx) => {
    if (block.type === 'checklist' || block.type === 'action_plan' || block.type === 'exercise' || block.type === 'readiness_evaluator') {
      const count = (block.items || []).filter((item, iIdx) => {
        const key = item.id || `${block.id}_${iIdx}`;
        return !!completedItems[key];
      }).length;
      return acc + count;
    }
    if (block.type === 'quiz') {
      const count = (block.items || []).filter((_, iIdx) => {
        const quizKey = `${block.id}_${iIdx}`;
        return quizAnswers[quizKey] !== undefined;
      }).length;
      return acc + count;
    }
    if (block.type === 'reflection') {
      return acc + (reflections[block.id]?.trim() ? 1 : 0);
    }
    if (block.type === 'ai_analyzer') {
      return acc + (analyzerResults[block.id] ? 1 : 0);
    }
    return acc;
  }, 0);

  const completionPercentage =
    totalInteractives > 0 ? Math.round((completedCount / totalInteractives) * 100) : 100;

  const checkOverallCompletion = (
    cItems: Record<string, boolean>,
    qAnswers: Record<string, number>,
    refls: Record<string, string>
  ) => {
    if (completionPercentage >= 100 && onLessonComplete) {
      onLessonComplete();
    }
  };

  return (
    <div className="w-full space-y-8 text-left max-w-4xl mx-auto py-2">
      {/* Lesson Header Banner */}
      {(title || description) && (
        <div className="p-6 sm:p-8 bg-gradient-to-br from-zinc-900 via-zinc-900 to-black rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none" />
          
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-[10px] font-black uppercase tracking-wider">
              <Sparkles size={12} /> {t.interactiveExp}
            </div>
            {title && <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">{title}</h2>}
            {description && <p className="text-sm text-gray-300 leading-relaxed max-w-2xl">{description}</p>}

            {/* Overall Progress Bar */}
            {totalInteractives > 0 && (
              <div className="pt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-400 uppercase tracking-widest text-[10px]">{t.yourProgress}</span>
                  <span className="text-emerald-400 font-mono font-black">{completionPercentage}% {t.completed}</span>
                </div>
                <div className="h-2.5 w-full bg-white/10 rounded-full overflow-hidden p-0.5">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500 shadow-lg shadow-emerald-500/30"
                    style={{ width: `${completionPercentage}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Render Blocks Sequentially */}
      <div className="space-y-6">
        {blocks.map((block, bIdx) => {
          return (
            <div
              key={block.id || `block_${bIdx}`}
              className="p-6 sm:p-8 bg-zinc-900/80 rounded-3xl border border-white/10 space-y-5 backdrop-blur-xl transition-all hover:border-white/15"
            >
              {/* Block Header */}
              {block.title && (
                <div className="flex items-start gap-3 border-b border-white/5 pb-4">
                  <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20 shrink-0 mt-0.5">
                    {block.type === 'checklist' && <CheckSquare size={20} />}
                    {block.type === 'quiz' && <HelpCircle size={20} />}
                    {block.type === 'reflection' && <MessageSquare size={20} />}
                    {block.type === 'action_plan' && <Target size={20} />}
                    {block.type === 'video' && <Play size={20} />}
                    {block.type === 'text' && <FileText size={20} />}
                    {block.type === 'exercise' && <Award size={20} />}
                    {block.type === 'ai_analyzer' && <Sparkles size={20} />}
                    {block.type === 'tracker' && <Clock size={20} />}
                    {block.type === 'simulator' && <Zap size={20} />}
                    {block.type === 'readiness_evaluator' && <TrendingUp size={20} />}
                    {block.type === 'comparison' && <Split size={20} />}
                    {block.type === 'timeline' && <Layers size={20} />}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">{block.title}</h3>
                    {block.description && (
                      <p className="text-xs text-gray-400 mt-0.5">{block.description}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Block Instructions */}
              {block.instructions && (
                <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 font-medium flex items-center gap-2">
                  <Sparkles size={14} className="shrink-0" />
                  <span>{block.instructions}</span>
                </div>
              )}

              {/* 1. TEXT BLOCK */}
              {block.type === 'text' && block.content && (
                <div className="text-sm text-gray-200 leading-relaxed font-normal">
                  {/<[a-z][\s\S]*>/i.test(block.content) ? (
                    <div
                      className="space-y-4 text-gray-200 
                        [&>h3]:text-base [&>h3]:sm:text-lg [&>h3]:font-black [&>h3]:text-amber-300 [&>h3]:tracking-tight [&>h3]:mt-6 [&>h3]:mb-2 [&>h3]:uppercase [&>h3]:italic
                        [&>h4]:text-sm [&>h4]:sm:text-base [&>h4]:font-bold [&>h4]:text-emerald-300 [&>h4]:mt-4 [&>h4]:mb-2
                        [&>p]:text-xs [&>p]:sm:text-sm [&>p]:leading-relaxed [&>p]:text-gray-300
                        [&>ul]:list-disc [&>ul]:list-inside [&>ul]:space-y-2 [&>ul]:text-gray-300 [&>ul]:text-xs [&>ul]:sm:text-sm
                        [&>ol]:list-decimal [&>ol]:list-inside [&>ol]:space-y-2 [&>ol]:text-gray-300 [&>ol]:text-xs [&>ol]:sm:text-sm
                        [&>blockquote]:border-l-4 [&>blockquote]:border-amber-400 [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-amber-200 [&>blockquote]:my-4 [&>blockquote]:bg-amber-500/5 [&>blockquote]:py-2 [&>blockquote]:rounded-r-xl"
                      dangerouslySetInnerHTML={{ __html: block.content }}
                    />
                  ) : (
                    <div className="text-xs sm:text-sm text-gray-200 leading-relaxed whitespace-pre-wrap font-normal space-y-3">
                      {block.content}
                    </div>
                  )}
                </div>
              )}

              {/* 2. MINI-APP: AI ANALYZER (Ex: Message Temperature Analyzer) */}
              {block.type === 'ai_analyzer' && (
                <div className="space-y-5 pt-1">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                      {block.instructions || t.analyzePrompt}
                    </label>
                    <textarea
                      value={analyzerInputs[block.id] || ''}
                      disabled={analyzerLoading[block.id] || isReadOnlyPreview}
                      onChange={e => setAnalyzerInputs({ ...analyzerInputs, [block.id]: e.target.value })}
                      rows={3}
                      placeholder={block.placeholder || t.analyzePlaceholder}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder-gray-500 focus:border-emerald-500 outline-none resize-none transition-all"
                    />
                    <button
                      type="button"
                      disabled={analyzerLoading[block.id] || isReadOnlyPreview}
                      onClick={() => handleAnalyzeMessage(block)}
                      className="w-full sm:w-auto px-6 py-3.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      {analyzerLoading[block.id] ? (
                        <>
                          <Sparkles size={16} className="animate-spin" /> {t.analyzingBtn}
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} /> {t.analyzeBtn}
                        </>
                      )}
                    </button>
                  </div>

                  {/* Render Analysis Results */}
                  {analyzerResults[block.id] && (() => {
                    const res = analyzerResults[block.id];
                    const lvl = (res.level || 'WARM').toUpperCase();

                    let badgeBg = 'bg-amber-500/20 border-amber-500/40 text-amber-300';
                    let icon = <SunMedium size={28} className="text-amber-400" />;
                    let expressiveBadge = '🌤️ WARM INTEREST';
                    let avatarBg = 'from-amber-950/40 via-zinc-900 to-zinc-950 border-amber-500/30';
                    let avatarTitle = 'Receptive & Curious Posture';
                    let avatarSubtitle = 'He is receptive to communication, open but waiting for strategic alignment.';
                    let avatarEmoji = '😐';

                    if (lvl === 'FRIO' || lvl === 'COLD') {
                      badgeBg = 'bg-sky-500/20 border-sky-500/40 text-sky-300';
                      icon = <ThermometerSnowflake size={28} className="text-sky-400" />;
                      expressiveBadge = '❄️ COLD INTEREST';
                      avatarBg = 'from-sky-950/50 via-zinc-900 to-zinc-950 border-sky-500/30';
                      avatarTitle = 'Distant & Frozen Posture';
                      avatarSubtitle = 'He is maintaining emotional distance or testing boundaries. Do not push or over-explain.';
                      avatarEmoji = '🧊';
                    } else if (lvl === 'QUENTE' || lvl === 'HOT') {
                      badgeBg = 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300';
                      icon = <Flame size={28} className="text-emerald-400 animate-pulse" />;
                      expressiveBadge = '🔥 HIGH INTEREST';
                      avatarBg = 'from-emerald-950/50 via-zinc-900 to-zinc-950 border-emerald-500/30';
                      avatarTitle = 'Passionate & High Engagement';
                      avatarSubtitle = 'Strong emotional investment and desire to connect. Maintain calm confidence.';
                      avatarEmoji = '🔥';
                    } else if (lvl === 'ALERTA' || lvl === 'ALERT') {
                      badgeBg = 'bg-rose-500/20 border-rose-500/40 text-rose-300';
                      icon = <AlertTriangle size={28} className="text-rose-400" />;
                      expressiveBadge = '⚠️ MANIPULATIVE OR DEFENSIVE';
                      avatarBg = 'from-rose-950/50 via-zinc-900 to-zinc-950 border-rose-500/30';
                      avatarTitle = 'Guarded & Defensive Posture';
                      avatarSubtitle = 'Potential guilt-tripping or boundary pushing detected. Protect your emotional state.';
                      avatarEmoji = '⚠️';
                    }

                    return (
                      <div className="p-6 bg-black/60 rounded-3xl border border-white/10 space-y-5 animate-in fade-in">
                        {/* Male Character Visual State Indicator Card */}
                        <div className={`p-5 rounded-2xl border bg-gradient-to-r ${avatarBg} flex items-center gap-4`}>
                          <div className="w-14 h-14 rounded-2xl bg-black/60 border border-white/10 flex items-center justify-center text-2xl shrink-0 shadow-lg">
                            {avatarEmoji}
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                              MALE CHARACTER STATE INDICATOR
                            </span>
                            <h4 className="text-sm font-black text-white uppercase">{avatarTitle}</h4>
                            <p className="text-xs text-gray-300">{avatarSubtitle}</p>
                          </div>
                        </div>

                        {/* Level Header */}
                        <div className={`p-4 rounded-2xl border ${badgeBg} flex items-center justify-between gap-4`}>
                          <div className="flex items-center gap-3">
                            {icon}
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-widest block opacity-75">
                                {t.aiDiagnosis}
                              </span>
                              <h4 className="text-sm font-black uppercase">{res.level_title || expressiveBadge}</h4>
                            </div>
                          </div>
                          <span className="text-xs font-mono font-black uppercase px-3 py-1 rounded-full bg-black/40 border border-white/10">
                            {lvl}
                          </span>
                        </div>

                        {/* Explanation */}
                        {res.explanation && (
                          <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                              {t.msgInterpretation}
                            </span>
                            <p className="text-xs text-gray-200 leading-relaxed bg-zinc-900/90 p-4 rounded-2xl border border-white/5">
                              {res.explanation}
                            </p>
                          </div>
                        )}

                        {/* Identified Signals */}
                        {res.signals && Array.isArray(res.signals) && res.signals.length > 0 && (
                          <div className="space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                              {t.identifiedSignals}
                            </span>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {res.signals.map((sig: string, sIdx: number) => (
                                <div key={sIdx} className="p-3 bg-zinc-900/60 rounded-xl border border-white/5 text-xs text-gray-300 flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                                  <span>{sig}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* What to do & What to avoid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          {res.recommended_actions && (
                            <div className="p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl space-y-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                                {t.recommendations}
                              </span>
                              <ul className="text-xs text-emerald-200 space-y-1.5 list-disc list-inside">
                                {res.recommended_actions.map((act: string, aIdx: number) => (
                                  <li key={aIdx}>{act}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {res.avoid_actions && (
                            <div className="p-4 bg-rose-950/30 border border-rose-500/20 rounded-2xl space-y-2">
                              <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 block">
                                {t.whatToAvoid}
                              </span>
                              <ul className="text-xs text-rose-200 space-y-1.5 list-disc list-inside">
                                {res.avoid_actions.map((act: string, aIdx: number) => (
                                  <li key={aIdx}>{act}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>

                        {/* Suggested response */}
                        {res.suggested_response && (
                          <div className="p-4 bg-teal-950/30 border border-teal-500/30 rounded-2xl space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-teal-300 block">
                              {t.strategicPosture}
                            </span>
                            <p className="text-xs text-teal-100 italic">{res.suggested_response}</p>
                          </div>
                        )}

                        {/* Disclaimer */}
                        <div className="pt-2 border-t border-white/5 text-[10px] text-gray-500 italic">
                          ⚠️ {res.disclaimer || t.disclaimer}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* 3. MINI-APP: TRACKER / NO CONTACT TRACKER */}
              {block.type === 'tracker' && (() => {
                const startDateStr = trackerStartDates[block.id];
                const hasStarted = !!startDateStr;

                let diffDays = 0;
                let diffHours = 0;

                if (hasStarted) {
                  const startMs = new Date(startDateStr).getTime();
                  const nowMs = new Date().getTime();
                  const totalDiffMs = Math.max(0, nowMs - startMs);
                  diffDays = Math.floor(totalDiffMs / (1000 * 60 * 60 * 24));
                  diffHours = Math.floor(totalDiffMs / (1000 * 60 * 60));
                }

                const targetDays = block.tracker_target_days || 30;
                const progressPct = Math.min(100, Math.round((diffDays / targetDays) * 100));

                // Generate dynamic chart data based on current streak
                const chartData = [];
                const totalPoints = Math.max(5, Math.min(targetDays, 30));
                for (let day = 1; day <= totalPoints; day++) {
                  chartData.push({
                    day: `Day ${day}`,
                    streak: day <= diffDays ? day : 0,
                    target: targetDays
                  });
                }

                return (
                  <div className="p-6 bg-gradient-to-br from-zinc-950 via-zinc-900 to-black rounded-3xl border border-white/10 space-y-6">
                    {!hasStarted ? (
                      <div className="text-center space-y-4 py-4 max-w-md mx-auto">
                        <div className="w-14 h-14 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-2xl flex items-center justify-center mx-auto">
                          <Flame size={32} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-base font-black text-white">{block.tracker_label || 'Focus Tracker'}</h4>
                          <p className="text-xs text-gray-400 max-w-sm mx-auto">
                            Select when your No-Contact started to calculate your streak and render your progression chart:
                          </p>
                        </div>

                        <div className="space-y-2 text-left">
                          <label className="text-[10px] font-black uppercase text-emerald-400 tracking-wider block">
                            Start Date of No-Contact:
                          </label>
                          <input
                            type="date"
                            defaultValue={new Date().toISOString().split('T')[0]}
                            id={`start_date_input_${block.id}`}
                            className="w-full px-4 py-3 bg-black/80 border border-white/20 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <button
                          type="button"
                          disabled={isReadOnlyPreview}
                          onClick={() => {
                            const inputEl = document.getElementById(`start_date_input_${block.id}`) as HTMLInputElement;
                            const chosenDate = inputEl?.value ? new Date(inputEl.value).toISOString() : new Date().toISOString();
                            handleStartTracker(block.id, chosenDate);
                          }}
                          className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                        >
                          {t.startTracker}
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Live Counter Display */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center">
                          <div className="p-4 bg-black/60 rounded-2xl border border-white/10 space-y-1">
                            <span className="text-[10px] font-black uppercase text-gray-400 block">{t.currentStreak}</span>
                            <div className="text-2xl sm:text-3xl font-black text-emerald-400 flex items-center justify-center gap-1">
                              <Flame size={24} /> {diffDays} {diffDays === 1 ? t.day : t.days}
                            </div>
                          </div>

                          <div className="p-4 bg-black/60 rounded-2xl border border-white/10 space-y-1">
                            <span className="text-[10px] font-black uppercase text-gray-400 block">{t.totalHours}</span>
                            <div className="text-2xl sm:text-3xl font-black text-teal-300 font-mono">
                              {diffHours}h
                            </div>
                          </div>

                          <div className="col-span-2 sm:col-span-1 p-4 bg-black/60 rounded-2xl border border-white/10 space-y-1">
                            <span className="text-[10px] font-black uppercase text-gray-400 block">{t.mainGoal}</span>
                            <div className="text-2xl sm:text-3xl font-black text-white">
                              {targetDays} {t.days}
                            </div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs font-bold">
                            <span className="text-gray-400 uppercase tracking-widest text-[10px]">{t.goalProgress}</span>
                            <span className="text-emerald-400 font-mono font-black">{progressPct}%</span>
                          </div>
                          <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden p-0.5">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Dynamic Recharts Progression Area Chart */}
                        <div className="space-y-2 p-4 bg-black/40 border border-white/10 rounded-2xl">
                          <div className="flex items-center justify-between text-xs font-bold text-gray-300 mb-2">
                            <span className="uppercase text-[10px] tracking-wider text-emerald-400 flex items-center gap-1.5">
                              <TrendingUp size={14} /> Continuous Evolution Chart
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              Started: {new Date(startDateStr).toLocaleDateString('en-US')}
                            </span>
                          </div>
                          <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={chartData}>
                                <defs>
                                  <linearGradient id={`colorStreak_${block.id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                  </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                                <XAxis dataKey="day" stroke="#666" fontSize={10} tickLine={false} />
                                <YAxis stroke="#666" fontSize={10} tickLine={false} />
                                <Tooltip
                                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
                                />
                                <Area type="monotone" dataKey="streak" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill={`url(#colorStreak_${block.id})`} />
                              </AreaChart>
                            </ResponsiveContainer>
                          </div>
                        </div>

                        {/* Milestones */}
                        {block.tracker_milestones && block.tracker_milestones.length > 0 && (
                          <div className="space-y-3">
                            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">
                              {t.milestones}
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {block.tracker_milestones.map((ms, mIdx) => {
                                const reached = diffDays >= ms.day;
                                return (
                                  <div
                                    key={mIdx}
                                    className={`p-3 rounded-xl border text-center space-y-1 transition-all ${
                                      reached
                                        ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-200 shadow-md'
                                        : 'bg-black/30 border-white/5 text-gray-500'
                                    }`}
                                  >
                                    <div className="text-base">{ms.reward_badge || '🏆'}</div>
                                    <div className="text-[10px] font-black uppercase">{t.day} {ms.day}</div>
                                    <div className="text-[9px] line-clamp-1">{ms.title}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* SOS Button & Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setSosActiveBlock(sosActiveBlock === block.id ? null : block.id)}
                            className="px-4 py-2.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all"
                          >
                            <AlertTriangle size={14} /> {t.sosBtn}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleResetTracker(block.id)}
                            className="text-[10px] font-black uppercase text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
                          >
                            <RotateCcw size={12} /> {t.resetCount}
                          </button>
                        </div>

                        {/* SOS Drawer Response */}
                        {sosActiveBlock === block.id && (
                          <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-2xl space-y-2 animate-in fade-in">
                            <h5 className="text-xs font-black text-rose-300 uppercase flex items-center gap-2">
                              <ShieldCheck size={16} /> {t.emergencyGuidance}
                            </h5>
                            <p className="text-xs text-rose-100 leading-relaxed">
                              {t.emergencyText}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* 3.1 DYNAMIC CHART BLOCK (recharts area/bar) */}
              {block.type === 'chart' && (() => {
                const items = block.items && block.items.length > 0 ? block.items : [
                  { id: 'c1', title: 'Day 1', day: 'Day 1', weight: 1 },
                  { id: 'c2', title: 'Day 7', day: 'Day 7', weight: 7 },
                  { id: 'c3', title: 'Day 14', day: 'Day 14', weight: 14 },
                  { id: 'c4', title: 'Day 30', day: 'Day 30', weight: 30 }
                ];

                const chartData = items.map(item => ({
                  name: item.title || item.day || 'Phase',
                  value: item.weight || 10
                }));

                return (
                  <div className="p-6 bg-black/60 rounded-3xl border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-emerald-400 flex items-center gap-2">
                        <TrendingUp size={16} /> {block.title || 'Interactive Chart'}
                      </span>
                    </div>
                    {block.description && <p className="text-xs text-gray-400">{block.description}</p>}
                    <div className="h-48 w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData}>
                          <defs>
                            <linearGradient id={`chart_grad_${block.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2dd4bf" stopOpacity={0.8}/>
                              <stop offset="95%" stopColor="#2dd4bf" stopOpacity={0.0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                          <XAxis dataKey="name" stroke="#888" fontSize={11} tickLine={false} />
                          <YAxis stroke="#888" fontSize={11} tickLine={false} />
                          <Tooltip
                            contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
                          />
                          <Area type="monotone" dataKey="value" stroke="#2dd4bf" strokeWidth={3} fillOpacity={1} fill={`url(#chart_grad_${block.id})`} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              })()}

              {/* 4. MINI-APP: SIMULATOR (Cenários "O que você faria?") */}
              {block.type === 'simulator' && (
                <div className="space-y-6 pt-1">
                  {(block.items || []).map((item, iIdx) => {
                    const simKey = `${block.id}_${iIdx}`;
                    const selectedOpt = simulatorChoices[simKey];
                    const hasChosen = selectedOpt !== undefined;

                    return (
                      <div key={simKey} className="p-5 bg-black/60 border border-white/10 rounded-2xl space-y-4">
                        <div className="space-y-1">
                          <span className="text-[10px] font-black text-teal-400 uppercase tracking-widest bg-teal-500/10 px-2 py-0.5 rounded-md border border-teal-500/20 inline-block">
                            {t.scenario} {iIdx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-white">{item.title}</h4>
                        </div>

                        <div className="space-y-2.5">
                          {(item.options || []).map((option, oIdx) => {
                            const isSelected = selectedOpt === oIdx;

                            return (
                              <button
                                key={oIdx}
                                type="button"
                                disabled={isReadOnlyPreview}
                                onClick={() => handleSelectSimulator(block.id, iIdx, oIdx)}
                                className={`w-full p-4 rounded-xl border text-xs font-medium text-left transition-all flex items-center justify-between gap-3 ${
                                  isSelected
                                    ? 'bg-teal-950/60 border-teal-500 text-teal-200 shadow-lg shadow-teal-500/10 font-bold'
                                    : 'bg-zinc-900 border-white/10 text-gray-200 hover:border-white/30'
                                }`}
                              >
                                <span>{option}</span>
                                {isSelected && (
                                  <span className="text-[10px] font-black uppercase text-teal-400 bg-teal-500/20 px-2 py-0.5 rounded-md shrink-0">
                                    {t.yourChoice}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Consequence Feedback */}
                        {hasChosen && item.consequences && item.consequences[selectedOpt] && (
                          <div className="p-4 bg-teal-950/30 border border-teal-500/30 rounded-xl text-xs text-teal-200 space-y-1 animate-in fade-in">
                            <span className="font-black uppercase tracking-wider text-[10px] text-teal-300 block">
                              {t.consequence}
                            </span>
                            <p className="leading-relaxed">{item.consequences[selectedOpt]}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 5. MINI-APP: READINESS EVALUATOR / CALCULATOR */}
              {block.type === 'readiness_evaluator' && (() => {
                const scorePct = calculateReadinessScore(block);

                let tierTitle = t.readinessTitle;
                let tierRec = t.readinessSub;

                if (block.result_tiers && block.result_tiers.length > 0) {
                  const matched = block.result_tiers.find(
                    t => scorePct >= t.min_score && scorePct <= t.max_score
                  );
                  if (matched) {
                    tierTitle = matched.title;
                    tierRec = matched.recommendation;
                  }
                }

                return (
                  <div className="space-y-6 pt-1">
                    {/* Score Meter Header */}
                    <div className="p-6 bg-black/60 rounded-3xl border border-white/10 text-center space-y-3">
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 block">
                        {t.calculatedLevel}
                      </span>
                      <div className="text-4xl sm:text-5xl font-black text-emerald-400 font-mono">
                        {scorePct}%
                      </div>
                      <div className="text-sm font-black text-white">{tierTitle}</div>
                      <p className="text-xs text-gray-300 max-w-md mx-auto leading-relaxed">{tierRec}</p>
                    </div>

                    {/* Interactive Affirmations */}
                    <div className="space-y-3">
                      {(block.items || []).map((item, iIdx) => {
                        const itemKey = item.id || `${block.id}_${iIdx}`;
                        const isChecked = !!completedItems[itemKey];

                        return (
                          <div
                            key={itemKey}
                            onClick={() => handleToggleItem(item.id, itemKey)}
                            className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 select-none ${
                              isChecked
                                ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200'
                                : 'bg-black/40 border-white/10 hover:border-white/20 text-white'
                            }`}
                          >
                            <span className="text-xs font-bold leading-snug">{item.title}</span>
                            <div className={`p-1.5 rounded-xl transition-all shrink-0 ${
                              isChecked ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-500'
                            }`}>
                              {isChecked ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* 6. MINI-APP: COMPARISON (Antes vs Depois) */}
              {block.type === 'comparison' && (
                <div className="space-y-4 pt-1">
                  {(block.items || []).map((item, iIdx) => (
                    <div key={iIdx} className="space-y-2">
                      {item.title && <h4 className="text-xs font-black uppercase text-gray-400">{item.title}</h4>}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="p-4 bg-rose-950/20 border border-rose-500/30 rounded-2xl space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 block">
                            {t.reactiveApproach}
                          </span>
                          <p className="text-xs text-rose-200 leading-relaxed">{item.before_text || item.description}</p>
                        </div>

                        <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-2xl space-y-1">
                          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">
                            {t.strategicApproach}
                          </span>
                          <p className="text-xs text-emerald-200 leading-relaxed">{item.after_text || item.title}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 7. MINI-APP: TIMELINE (Sequência de Etapas) */}
              {block.type === 'timeline' && (
                <div className="space-y-3 pt-1 relative border-l-2 border-emerald-500/30 ml-3 pl-4">
                  {(block.items || []).map((item, iIdx) => (
                    <div key={iIdx} className="relative space-y-1">
                      <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-black" />
                      <div className="flex items-center gap-2">
                        {item.day && (
                          <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                            {item.day}
                          </span>
                        )}
                        <h4 className="text-xs font-black text-white">{item.title}</h4>
                      </div>
                      {item.description && <p className="text-xs text-gray-300 leading-relaxed">{item.description}</p>}
                    </div>
                  ))}
                </div>
              )}

              {/* 8. CHECKLIST / ACTION PLAN / EXERCISE BLOCKS */}
              {(block.type === 'checklist' || block.type === 'action_plan' || block.type === 'exercise') && (
                <div className="space-y-3 pt-1">
                  {(block.items || []).map((item, iIdx) => {
                    const itemKey = item.id || `${block.id}_${iIdx}`;
                    const isDone = !!completedItems[itemKey];

                    return (
                      <div
                        key={itemKey}
                        onClick={() => handleToggleItem(item.id, itemKey)}
                        className={`p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 active:scale-[0.99] select-none ${
                          isDone
                            ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                            : 'bg-black/40 border-white/10 hover:border-white/20 text-white'
                        }`}
                      >
                        <button
                          type="button"
                          className={`p-1.5 rounded-xl transition-all shrink-0 mt-0.5 ${
                            isDone
                              ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/30'
                              : 'bg-white/5 text-gray-400 hover:text-white border border-white/10'
                          }`}
                        >
                          {isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                        </button>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.category && (
                              <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                {item.category}
                              </span>
                            )}
                            <span
                              className={`text-sm font-bold leading-snug ${
                                isDone ? 'line-through text-emerald-300/70' : 'text-white'
                              }`}
                            >
                              {item.title}
                            </span>
                          </div>
                          {item.description && (
                            <p
                              className={`text-xs leading-relaxed ${
                                isDone ? 'text-emerald-400/60' : 'text-gray-400'
                              }`}
                            >
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 9. QUIZ BLOCK */}
              {block.type === 'quiz' && (
                <div className="space-y-6 pt-1">
                  {(block.items || []).map((item, iIdx) => {
                    const quizKey = `${block.id}_${iIdx}`;
                    const selectedOpt = quizAnswers[quizKey];
                    const hasAnswered = selectedOpt !== undefined;

                    return (
                      <div key={quizKey} className="p-5 bg-black/50 border border-white/10 rounded-2xl space-y-4">
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <span className="text-xs font-mono font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
                            {t.question} {iIdx + 1}
                          </span>
                          {item.title}
                        </h4>

                        <div className="space-y-2.5">
                          {(item.options || []).map((option, oIdx) => {
                            const isSelected = selectedOpt === oIdx;
                            const isCorrect = item.correct_option_index === oIdx;

                            let optStyle = 'bg-zinc-900 border-white/10 text-gray-200 hover:border-white/30';
                            if (hasAnswered) {
                              if (isCorrect) {
                                optStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 shadow-lg shadow-emerald-500/10';
                              } else if (isSelected && !isCorrect) {
                                optStyle = 'bg-red-950/60 border-red-500 text-red-200';
                              } else {
                                optStyle = 'bg-zinc-950/40 border-white/5 text-gray-500 opacity-50';
                              }
                            }

                            return (
                              <button
                                key={oIdx}
                                type="button"
                                disabled={hasAnswered && isReadOnlyPreview}
                                onClick={() => handleSelectQuiz(block.id, iIdx, oIdx)}
                                className={`w-full p-4 rounded-xl border text-xs font-medium text-left transition-all flex items-center justify-between gap-3 ${optStyle}`}
                              >
                                <span>{option}</span>
                                {hasAnswered && isCorrect && (
                                  <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md shrink-0">
                                    {t.correct}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {hasAnswered && item.explanation && (
                          <div className="p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 space-y-1 animate-in fade-in">
                            <span className="font-bold block uppercase tracking-wider text-[10px] text-emerald-400">
                              {t.pedagogicalExp}
                            </span>
                            <p className="leading-relaxed">{item.explanation}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 10. REFLECTION BLOCK */}
              {block.type === 'reflection' && (
                <div className="space-y-3 pt-1">
                  {block.content && (
                    <p className="text-xs text-gray-300 leading-relaxed italic border-l-2 border-emerald-500 pl-3">
                      "{block.content}"
                    </p>
                  )}
                  <div className="space-y-2">
                    <textarea
                      value={reflections[block.id] || ''}
                      disabled={isReadOnlyPreview}
                      onChange={e => handleSaveReflection(block.id, e.target.value)}
                      rows={4}
                      placeholder={block.placeholder || t.reflectionPlaceholder}
                      className="w-full bg-black/60 border border-white/10 rounded-2xl p-4 text-xs text-white placeholder-gray-500 focus:border-emerald-500 outline-none resize-none transition-all"
                    />
                    <div className="flex items-center justify-between text-[10px] text-gray-500">
                      <span>{t.reflectionNote}</span>
                      {savingState[block.id] ? (
                        <span className="text-emerald-400 font-bold animate-pulse">{t.saved}</span>
                      ) : (
                        <span>{t.autoSaved}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 11. VIDEO BLOCK */}
              {block.type === 'video' && block.url && (
                <div className="space-y-3">
                  <div className="aspect-video w-full rounded-2xl overflow-hidden border border-white/10 bg-black">
                    {block.url.includes('r2.dev') || 
                     block.url.includes('cloudflare') || 
                     block.url.match(/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i) ? (
                      <video
                        src={block.url}
                        controls
                        playsInline
                        webkit-playsinline="true"
                        preload="metadata"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <iframe
                        src={block.url}
                        className="w-full h-full border-0"
                        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                      />
                    )}
                  </div>
                </div>
              )}

              {/* 12. BUTTON / CTA BLOCK */}
              {block.type === 'button_link' && block.button_url && (
                <div className="pt-2 flex justify-center">
                  <a
                    href={block.button_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2"
                  >
                    {block.button_text || t.accessResource} <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Completion Banner */}
      {completionPercentage === 100 && totalInteractives > 0 && (
        <div className="p-6 bg-gradient-to-r from-emerald-950 via-zinc-900 to-zinc-900 rounded-3xl border border-emerald-500/40 text-center space-y-3 shadow-2xl animate-in fade-in">
          <div className="w-12 h-12 bg-emerald-500 text-black font-black rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30 flex items-center justify-center">
            ✓
          </div>
          <h3 className="text-lg font-black text-white">{t.congratsTitle}</h3>
          <p className="text-xs text-emerald-300 max-w-md mx-auto">
            {t.congratsDesc}
          </p>
        </div>
      )}
    </div>
  );
};

