import React, { useState, useRef } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  Check,
  RefreshCw,
  Wand2,
  FileText,
  DollarSign,
  ShieldCheck,
  Star,
  Users,
  Layers,
  ArrowRight,
  Eye,
  CheckCircle2,
  Layout,
  Flame,
  Info,
  PlayCircle,
  Plus,
  Trash2,
  Edit3,
  Globe,
  Zap,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  Compass,
  MessageSquare,
  Activity,
  Award,
  BookOpen,
  Calendar,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Module, Chapter } from '../types/lms';
import { supabase } from '../lib/supabase';
import { dataCache } from '../lib/cache';
import { showToast } from '../lib/customToast';
import { BlockLessonViewer } from './BlockLessonViewer';

interface AiCourseFactoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  packages?: any[];
  onCourseCreated?: (courseId: string) => void;
  onOpenInEditor?: (courseData: Partial<Course>, modulesData?: any[]) => void;
  onOpenManualEditor?: (data: { course: any; modules: any[] }) => void;
}

interface GenerationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
}

const DEFAULT_STEPS: GenerationStep[] = [
  { id: '1', title: 'Analyzing Course Concept & Positioning', description: 'Defining transformation promise, student archetype, and tone', status: 'pending' },
  { id: '2', title: 'Architecting Dynamic Pedagogical Curriculum', description: 'Structuring logical modules and progressive learning milestones', status: 'pending' },
  { id: '3', title: 'Selecting Optimal Interactive Lesson Types', description: 'Matching lessons with simulators, analyzers, trackers, and frameworks', status: 'pending' },
  { id: '4', title: 'Engineering Functional Mini-Apps & Exercises', description: 'Building interactive diagnostic tools, streak trackers, and quizzes', status: 'pending' },
  { id: '5', title: 'Curating High-Resolution Visual Assets', description: 'Harmonizing thematic editorial covers and visual art direction', status: 'pending' },
  { id: '6', title: 'Writing Direct-Response Sales Copy & FAQ', description: 'Crafting high-converting hook, problem agitation, and objection handling', status: 'pending' },
  { id: '7', title: 'Validating Integrity & Quality Consistency', description: 'Ensuring US English accuracy, responsive layout, and complete blocks', status: 'pending' },
  { id: '8', title: 'Finalizing Course Package', description: 'Assembling ready-to-publish educational product', status: 'pending' }
];

const PRESET_PROMPTS = [
  {
    label: 'Breakup & Reconnection Mastery',
    prompt: 'Create a complete masterclass teaching women how to rebuild irresistible attraction, master emotional non-reactivity, and reconnect with an ex from a position of calm, grounded self-worth.'
  },
  {
    label: 'Executive High-Performance & Focus',
    prompt: 'Create an intensive 30-day course for entrepreneurs to eliminate digital distraction, optimize dopamine baselines, and achieve deep creative flow.'
  },
  {
    label: 'Emotional Regulation & Boundaries',
    prompt: 'Create a practical transformation course teaching individuals how to set unshakeable personal boundaries, overcome people-pleasing, and speak with authentic authority.'
  },
  {
    label: 'Maternal Mental Health & Postpartum Wellness',
    prompt: 'Create a supportive, evidence-based course for new mothers navigating postpartum emotional shifts, nervous system restoration, and guilt-free self-care.'
  }
];

export const AiCourseFactoryModal: React.FC<AiCourseFactoryModalProps> = ({
  isOpen,
  onClose,
  packages = [],
  onCourseCreated,
  onOpenInEditor,
  onOpenManualEditor
}) => {
  // Navigation State
  const [modalStage, setModalStage] = useState<'input' | 'generating' | 'review' | 'preview_lesson'>('input');
  
  // Input parameters
  const [command, setCommand] = useState('');
  const [language, setLanguage] = useState<'en' | 'pt-BR' | 'es'>('en');
  const [priceTier, setPriceTier] = useState<number>(97);
  const [tone, setTone] = useState('authoritative_empathetic');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [visualMood, setVisualMood] = useState('editorial_luxury');

  // Generation state
  const [steps, setSteps] = useState<GenerationStep[]>(DEFAULT_STEPS);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Result state
  const [generatedCourse, setGeneratedCourse] = useState<any>(null);
  const [generatedModules, setGeneratedModules] = useState<any[]>([]);
  const [isFallbackNotice, setIsFallbackNotice] = useState(false);
  const [activeReviewTab, setActiveReviewTab] = useState<'curriculum' | 'sales_copy' | 'visuals'>('curriculum');
  const [expandedModuleIndex, setExpandedModuleIndex] = useState<number | null>(0);
  const [selectedLessonForPreview, setSelectedLessonForPreview] = useState<any>(null);

  // Edit with AI state & Undo History
  const [aiEditInstruction, setAiEditInstruction] = useState('');
  const [isApplyingAiEdit, setIsApplyingAiEdit] = useState(false);
  const [historyStack, setHistoryStack] = useState<{ course: any; modules: any[] }[]>([]);

  // Publishing state
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishingProgress, setPublishingProgress] = useState('');

  if (!isOpen) return null;

  // Handle Complete Generation
  const handleStartGeneration = async () => {
    if (!command.trim()) {
      showToast.error('Please enter a course concept or command.');
      return;
    }

    setModalStage('generating');
    setGenerationError(null);
    setCurrentStepIndex(0);

    // Initialize steps
    const newSteps = DEFAULT_STEPS.map((s, idx) => ({
      ...s,
      status: (idx === 0 ? 'in_progress' : 'pending') as GenerationStep['status']
    }));
    setSteps(newSteps);

    // Simulate animated step progression while backend processes
    const stepInterval = setInterval(() => {
      setCurrentStepIndex((prev) => {
        if (prev < 6) {
          const next = prev + 1;
          setSteps((currentSteps) =>
            currentSteps.map((s, i) => ({
              ...s,
              status: i < next ? 'completed' : i === next ? 'in_progress' : 'pending'
            }))
          );
          return next;
        }
        return prev;
      });
    }, 2800);

    try {
      const response = await fetch('/api/v1/build-complete-course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command,
          language,
          priceTier,
          tone,
          referenceImage: referenceImageUrl.trim() || undefined,
          includeOldPrice: true
        })
      });

      clearInterval(stepInterval);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate course with AI');
      }

      const data = await response.json();
      if (!data.course || !data.modules) {
        throw new Error('Incomplete course package returned by AI');
      }

      // Mark all steps completed
      setSteps((currentSteps) =>
        currentSteps.map((s) => ({ ...s, status: 'completed' }))
      );

      setGeneratedCourse(data.course);
      setGeneratedModules(data.modules);
      setIsFallbackNotice(!!data.isFallback);
      setHistoryStack([]);
      setModalStage('review');
      showToast.success('Complete course architecture generated successfully!');
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('[AI Course Factory Error]', err);
      setGenerationError(err.message || 'An error occurred during generation.');
      setSteps((currentSteps) =>
        currentSteps.map((s, i) =>
          i === currentStepIndex ? { ...s, status: 'error' } : s
        )
      );
    }
  };

  // Handle "Edit with AI" refinement
  const handleApplyAiEdit = async () => {
    if (!aiEditInstruction.trim()) {
      showToast.error('Please enter an instruction for the AI editor.');
      return;
    }

    setIsApplyingAiEdit(true);

    // Push current state to undo history
    setHistoryStack((prev) => [
      ...prev,
      {
        course: JSON.parse(JSON.stringify(generatedCourse)),
        modules: JSON.parse(JSON.stringify(generatedModules))
      }
    ]);

    try {
      const res = await fetch('/api/v1/ai-course-editor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope: 'course',
          instruction: aiEditInstruction,
          currentData: {
            course: generatedCourse,
            modules: generatedModules
          },
          language
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'AI edit failed.');
      }

      const data = await res.json();
      if (data.modifiedData) {
        if (data.modifiedData.course) setGeneratedCourse(data.modifiedData.course);
        if (data.modifiedData.modules) setGeneratedModules(data.modifiedData.modules);
        showToast.success('Course refined with AI!');
        setAiEditInstruction('');
      }
    } catch (err: any) {
      console.error('[AI Edit Error]', err);
      showToast.error(err.message || 'Failed to apply AI changes.');
    } finally {
      setIsApplyingAiEdit(false);
    }
  };

  // Handle Undo
  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setGeneratedCourse(previous.course);
    setGeneratedModules(previous.modules);
    setHistoryStack((prev) => prev.slice(0, prev.length - 1));
    showToast.info('Reverted to previous version.');
  };

  // Handle Save & Publish directly to Supabase
  const handleSaveToSupabase = async () => {
    if (!generatedCourse) return;
    setIsPublishing(true);
    setPublishingProgress('Creating course record...');

    try {
      // 1. Insert Course
      const { data: createdCourse, error: courseError } = await supabase
        .from('courses')
        .insert([
          {
            title: generatedCourse.title,
            subtitle: generatedCourse.subtitle || '',
            description: generatedCourse.description || '',
            cover_url: generatedCourse.cover_url || '',
            price: generatedCourse.price || 0,
            old_price: generatedCourse.old_price || 0,
            is_active: true,
            is_free: generatedCourse.is_free || false,
            is_bonus: generatedCourse.is_bonus || false,
            benefits: generatedCourse.benefits || [],
            cta_text: generatedCourse.cta_text || 'START TRANSFORMATION NOW',
            premium_badge_text: generatedCourse.premium_badge_text || '',
            offer_badge_text: generatedCourse.offer_badge_text || '',
            social_proof: generatedCourse.social_proof || '',
            payment_label_text: generatedCourse.payment_label_text || '',
            secure_payment_label: generatedCourse.secure_payment_label || '',
            instant_access_label: generatedCourse.instant_access_label || '',
            preview_enabled: true,
            preview_title: generatedCourse.preview_title || generatedCourse.title,
            preview_subtitle: generatedCourse.preview_subtitle || generatedCourse.subtitle,
            preview_rating: generatedCourse.preview_rating || '4.9 ⭐',
            preview_students_label: generatedCourse.preview_students_label || '+4,200 Students',
            preview_guarantee_label: generatedCourse.preview_guarantee_label || '7-Day Guarantee',
            preview_support_vip_label: generatedCourse.preview_support_vip_label || 'VIP Support',
            preview_bonus_title: generatedCourse.preview_bonus_title || 'Exclusive Bonuses Included',
            preview_modules_label: generatedCourse.preview_modules_label || 'Complete Curriculum',
            preview_students_tag: generatedCourse.preview_students_tag || 'Lifetime Access',
            preview_risk_zero_label: generatedCourse.preview_risk_zero_label || '100% Risk-Free',
            preview_guarantee_title: generatedCourse.preview_guarantee_title || '7-Day Money-Back Guarantee',
            preview_guarantee_subtitle: generatedCourse.preview_guarantee_subtitle || '',
            preview_guarantee_description: generatedCourse.preview_guarantee_description || '',
            preview_footer_cta: generatedCourse.preview_footer_cta || 'ENROLL NOW',
            preview_rich_text: generatedCourse.preview_rich_text || '',
            order_index: 0
          }
        ])
        .select()
        .single();

      if (courseError || !createdCourse) {
        throw new Error(courseError?.message || 'Could not insert course.');
      }

      const courseId = createdCourse.id;

      // 2. Insert Modules and Chapters sequentially to preserve order
      for (let mIdx = 0; mIdx < generatedModules.length; mIdx++) {
        const mod = generatedModules[mIdx];
        setPublishingProgress(`Creating module ${mIdx + 1} of ${generatedModules.length}...`);

        const { data: createdMod, error: modError } = await supabase
          .from('modules')
          .insert([
            {
              course_id: courseId,
              title: mod.title,
              order_index: mIdx
            }
          ])
          .select()
          .single();

        if (modError || !createdMod) {
          console.warn('Module insert issue:', modError);
          continue;
        }

        const moduleId = createdMod.id;
        const chapters = mod.chapters || [];

        for (let cIdx = 0; cIdx < chapters.length; cIdx++) {
          const chap = chapters[cIdx];
          setPublishingProgress(`Saving lesson: "${chap.title}"...`);

          const richTextString = chap.rich_text
            ? (typeof chap.rich_text === 'string' ? chap.rich_text : JSON.stringify(chap.rich_text))
            : (chap.interactive_content ? JSON.stringify(chap.interactive_content) : '');

          await supabase.from('chapters').insert([
            {
              module_id: moduleId,
              title: chap.title,
              description: chap.description || '',
              content_type: chap.content_type || 'interactive',
              rich_text: richTextString,
              cover_url: chap.cover_url || '',
              duration_minutes: chap.duration_minutes || 15,
              order_index: cIdx,
              is_preview: cIdx === 0
            }
          ]);
        }
      }

      // Invalidate cache
      dataCache.invalidate('courses_list');
      dataCache.invalidate('admin_courses');
      dataCache.invalidate(`course_full_${courseId}`);

      showToast.success('Course published to database successfully!');
      onCourseCreated?.(courseId);
      onClose();
    } catch (err: any) {
      console.error('[Publish Course Error]', err);
      showToast.error(err.message || 'Error saving course to database');
    } finally {
      setIsPublishing(false);
      setPublishingProgress('');
    }
  };

  // Helper to count interactive tools
  const getToolStats = () => {
    let trackers = 0;
    let simulators = 0;
    let analyzers = 0;
    let calculators = 0;
    let quizzes = 0;
    let comparisons = 0;
    let totalChapters = 0;

    generatedModules.forEach((m) => {
      (m.chapters || []).forEach((c: any) => {
        totalChapters++;
        try {
          const content = c.interactive_content || (c.rich_text ? JSON.parse(c.rich_text) : null);
          const blocks = content?.blocks || [];
          blocks.forEach((b: any) => {
            if (b.type === 'tracker') trackers++;
            if (b.type === 'simulator') simulators++;
            if (b.type === 'ai_analyzer') analyzers++;
            if (b.type === 'readiness_evaluator' || b.type === 'calculator') calculators++;
            if (b.type === 'quiz') quizzes++;
            if (b.type === 'comparison') comparisons++;
          });
        } catch (_) {}
      });
    });

    return {
      totalModules: generatedModules.length,
      totalChapters,
      trackers,
      simulators,
      analyzers,
      calculators,
      quizzes,
      comparisons,
      totalTools: trackers + simulators + analyzers + calculators + quizzes + comparisons
    };
  };

  const toolStats = generatedCourse ? getToolStats() : null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-xl overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        className="bg-[#0f1117] border border-white/10 rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-[0_25px_70px_rgba(0,0,0,0.8)] overflow-hidden text-white font-sans"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-600 p-[1px] flex items-center justify-center shadow-lg shadow-rose-500/20">
              <div className="w-full h-full bg-[#0f1117] rounded-2xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-300 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase italic text-white">
                  AI Course Factory
                </h2>
                <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  Autonomous Architect
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Generate a complete, high-converting digital product with interactive apps in a single command
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-white/10">
          {/* STAGE 1: INPUT & BLUEPRINT */}
          {modalStage === 'input' && (
            <div className="max-w-4xl mx-auto space-y-8 py-2">
              {/* Main Prompt Command */}
              <div className="space-y-3">
                <label className="text-sm font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Wand2 size={16} className="text-primary" />
                    What Course Do You Want to Create?
                  </span>
                  <span className="text-xs font-normal text-gray-400">Be as specific or visionary as you like</span>
                </label>
                <div className="relative">
                  <textarea
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    rows={4}
                    placeholder="e.g. Create a complete course teaching women how to rebuild attraction and reconnect with an ex after a breakup. Include communication frameworks, an urge pause tracker, an AI message tone analyzer, and realistic decision simulators."
                    className="w-full bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-base text-white placeholder-gray-500 focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all resize-none shadow-inner"
                  />
                </div>

                {/* Preset Chips */}
                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                    Quick Inspiration Blueprints:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_PROMPTS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCommand(item.prompt)}
                        className="text-xs px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/10 border border-white/5 hover:border-white/20 text-gray-300 hover:text-white transition-all text-left flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles size={12} className="text-amber-400" />
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Advanced Controls Accordion / Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                {/* Language (Default US English) */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <Globe size={14} className="text-blue-400" />
                    Language (Standard: US English)
                  </label>
                  <select
                    value={language}
                    onChange={(e: any) => setLanguage(e.target.value)}
                    className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="en">English (United States) - Default</option>
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="es">Español (Latam/España)</option>
                  </select>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    All curriculum, simulators, and copy will be generated natively in this language.
                  </p>
                </div>

                {/* Pricing / Offer Tier */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <DollarSign size={14} className="text-emerald-400" />
                    Target Price (USD)
                  </label>
                  <select
                    value={priceTier}
                    onChange={(e) => setPriceTier(Number(e.target.value))}
                    className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value={97}>$97 (Standard Masterclass)</option>
                    <option value={197}>$197 (High-Ticket Transformation)</option>
                    <option value={47}>$47 (Fast-Track Protocol)</option>
                    <option value={0}>$0 (Free Lead Magnet Course)</option>
                  </select>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    AI will automatically calculate discount anchors and risk-free guarantees.
                  </p>
                </div>

                {/* Visual Style */}
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-1.5">
                    <PaletteIcon className="w-3.5 h-3.5 text-purple-400" />
                    Art Direction Mood
                  </label>
                  <select
                    value={visualMood}
                    onChange={(e) => setVisualMood(e.target.value)}
                    className="w-full bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary cursor-pointer"
                  >
                    <option value="editorial_luxury">Editorial Luxury & Calm</option>
                    <option value="warm_cinematic">Warm Cinematic & Human</option>
                    <option value="modern_minimalist">Clean Modern Minimalist</option>
                  </select>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    Curates coherent photographic assets across covers and lessons.
                  </p>
                </div>
              </div>

              {/* Optional Blueprint Image Reference */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-amber-400" />
                    Reference Blueprint Image (Optional)
                  </span>
                  <span className="text-[11px] text-gray-500 font-normal">Acts as visual & structural blueprint</span>
                </label>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={referenceImageUrl}
                    onChange={(e) => setReferenceImageUrl(e.target.value)}
                    placeholder="Paste image URL (Unsplash, mockup, or layout blueprint)"
                    className="flex-1 bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  />
                  {referenceImageUrl && (
                    <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20 shrink-0">
                      <img src={referenceImageUrl} alt="Blueprint" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
              </div>

              {/* Start Generation CTA Button */}
              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleStartGeneration}
                  className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-amber-400 via-rose-500 to-indigo-600 hover:brightness-110 text-white font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 shadow-[0_10px_35px_rgba(244,63,94,0.3)] transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Sparkles size={18} />
                  <span>Build Complete Course with AI</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: REAL-TIME GENERATION PROGRESS */}
          {modalStage === 'generating' && (
            <div className="max-w-2xl mx-auto py-8 space-y-8">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto text-primary">
                  <Loader2 size={32} className="animate-spin" />
                </div>
                <h3 className="text-2xl font-black uppercase italic tracking-tight text-white">
                  Architecting Your Complete Academy
                </h3>
                <p className="text-sm text-gray-400 max-w-md mx-auto">
                  The AI is orchestrating curriculum, interactive mini-apps, direct-response copy, and visual covers in parallel.
                </p>
              </div>

              {/* Steps Progression List */}
              <div className="bg-white/[0.02] border border-white/10 rounded-3xl p-6 space-y-4">
                {steps.map((step, idx) => (
                  <div
                    key={step.id}
                    className={`flex items-start gap-4 p-3 rounded-2xl transition-all ${
                      step.status === 'in_progress'
                        ? 'bg-primary/10 border border-primary/30 shadow-lg shadow-primary/5'
                        : step.status === 'completed'
                        ? 'bg-white/[0.02]'
                        : 'opacity-40'
                    }`}
                  >
                    <div className="pt-0.5 shrink-0">
                      {step.status === 'completed' ? (
                        <div className="w-6 h-6 rounded-full bg-emerald-500 text-black flex items-center justify-center">
                          <Check size={14} className="stroke-[3]" />
                        </div>
                      ) : step.status === 'in_progress' ? (
                        <div className="w-6 h-6 rounded-full bg-primary/20 text-primary flex items-center justify-center">
                          <Loader2 size={14} className="animate-spin" />
                        </div>
                      ) : step.status === 'error' ? (
                        <div className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center text-xs font-bold">
                          !
                        </div>
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-white/10 text-gray-400 flex items-center justify-center text-xs font-bold">
                          {idx + 1}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className={`text-sm font-bold tracking-tight ${step.status === 'in_progress' ? 'text-primary' : 'text-white'}`}>
                          {step.title}
                        </h4>
                        {step.status === 'in_progress' && (
                          <span className="text-[10px] font-black uppercase tracking-wider text-primary px-2 py-0.5 rounded-full bg-primary/20 animate-pulse">
                            Processing...
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {generationError && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm space-y-3">
                  <div className="font-bold flex items-center gap-2">
                    <Info size={16} />
                    Generation encountered a hitch:
                  </div>
                  <p className="text-xs opacity-90">{generationError}</p>
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleStartGeneration}
                      className="px-4 py-2 rounded-xl bg-rose-500 text-white text-xs font-bold uppercase hover:bg-rose-600 transition-all cursor-pointer"
                    >
                      Retry Generation
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalStage('input')}
                      className="px-4 py-2 rounded-xl bg-white/10 text-white text-xs font-bold uppercase hover:bg-white/20 transition-all cursor-pointer"
                    >
                      Back to Prompt
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAGE 3: COURSE GENERATED - FULL REVIEW & INTERACTIVE TOOLS */}
          {modalStage === 'review' && generatedCourse && (
            <div className="space-y-6">
              {isFallbackNotice && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-3">
                  <Sparkles size={16} className="text-amber-400 shrink-0" />
                  <div className="flex-1">
                    <strong className="font-bold">Estrutura Curricular Concluída:</strong> O curso completo e todas as ferramentas interativas foram montados com sucesso para o seu comando. Você tem total liberdade para editar qualquer aula ou texto!
                  </div>
                </div>
              )}
              {/* Header Hero Summary */}
              <div className="bg-gradient-to-r from-white/[0.04] to-white/[0.01] border border-white/10 rounded-3xl p-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div className="space-y-2 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {generatedCourse.level || 'Masterclass'}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {generatedCourse.estimated_duration || '4-6 Weeks'}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        {language === 'en' ? 'US English' : language}
                      </span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight uppercase italic text-white">
                      {generatedCourse.title}
                    </h1>
                    <p className="text-sm text-gray-300 line-clamp-2">
                      {generatedCourse.subtitle || generatedCourse.description}
                    </p>
                  </div>

                  {/* High Impact Metrics */}
                  <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-white/10 pt-4 md:pt-0 md:pl-6 shrink-0">
                    <div className="text-center px-2">
                      <div className="text-2xl font-black text-white">{toolStats?.totalModules || 0}</div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Modules</div>
                    </div>
                    <div className="text-center px-2">
                      <div className="text-2xl font-black text-white">{toolStats?.totalChapters || 0}</div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Lessons</div>
                    </div>
                    <div className="text-center px-2">
                      <div className="text-2xl font-black text-primary">{toolStats?.totalTools || 0}</div>
                      <div className="text-[10px] uppercase font-bold text-primary tracking-wider">Mini-Apps</div>
                    </div>
                    <div className="text-center px-2">
                      <div className="text-2xl font-black text-emerald-400">
                        ${(generatedCourse.price / 100).toFixed(0)}
                      </div>
                      <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Price</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI ITERATION TOOLBAR ("Edit with AI") */}
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
                    <Sparkles size={14} />
                    <span>Edit this Course with AI (Surgical Refinement)</span>
                  </div>
                  {historyStack.length > 0 && (
                    <button
                      type="button"
                      onClick={handleUndo}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Revert last AI adjustment"
                    >
                      <RotateCcw size={12} />
                      Undo AI Change
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiEditInstruction}
                    onChange={(e) => setAiEditInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleApplyAiEdit();
                    }}
                    placeholder="e.g. 'Add a bonus module on maintaining attraction', 'Make the tone more direct and punchy', 'Add an urge pause tracker to Module 2'"
                    className="flex-1 bg-[#161922] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={handleApplyAiEdit}
                    disabled={isApplyingAiEdit}
                    className="px-5 py-2.5 rounded-xl bg-primary text-black font-black text-xs uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isApplyingAiEdit ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                    Refine with AI
                  </button>
                </div>
              </div>

              {/* Review Tabs */}
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('curriculum')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                    activeReviewTab === 'curriculum'
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Layers size={14} />
                  Curriculum & Mini-Apps ({generatedModules.length} Modules)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('sales_copy')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                    activeReviewTab === 'sales_copy'
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <FileText size={14} />
                  Direct-Response Sales Copy & FAQ
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('visuals')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                    activeReviewTab === 'visuals'
                      ? 'bg-white/10 text-white border border-white/20'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <ImageIcon size={14} />
                  Visual Identity & Covers
                </button>
              </div>

              {/* TAB CONTENT: CURRICULUM */}
              {activeReviewTab === 'curriculum' && (
                <div className="space-y-4">
                  {generatedModules.map((module, mIdx) => (
                    <div
                      key={mIdx}
                      className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden transition-all"
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedModuleIndex(expandedModuleIndex === mIdx ? null : mIdx)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-white/10 text-white font-mono">
                            MOD 0{mIdx + 1}
                          </span>
                          <div>
                            <h3 className="text-sm sm:text-base font-bold text-white">{module.title}</h3>
                            <p className="text-xs text-gray-400 line-clamp-1">{module.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-gray-400">
                            {module.chapters?.length || 0} Lessons
                          </span>
                          {expandedModuleIndex === mIdx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </div>
                      </button>

                      {expandedModuleIndex === mIdx && (
                        <div className="p-4 pt-0 border-t border-white/5 space-y-3 mt-2">
                          {(module.chapters || []).map((chapter: any, cIdx: number) => {
                            // Extract tool tags
                            let interactiveContent = null;
                            try {
                              interactiveContent = chapter.interactive_content || (chapter.rich_text ? JSON.parse(chapter.rich_text) : null);
                            } catch (_) {}

                            const blocks = interactiveContent?.blocks || [];
                            const hasTracker = blocks.some((b: any) => b.type === 'tracker');
                            const hasAnalyzer = blocks.some((b: any) => b.type === 'ai_analyzer');
                            const hasSimulator = blocks.some((b: any) => b.type === 'simulator');
                            const hasQuiz = blocks.some((b: any) => b.type === 'quiz');
                            const hasEvaluator = blocks.some((b: any) => b.type === 'readiness_evaluator' || b.type === 'calculator');

                            return (
                              <div
                                key={cIdx}
                                className="bg-[#141721] border border-white/5 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-white/20 transition-all"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/5 shrink-0 border border-white/10">
                                    {chapter.cover_url ? (
                                      <img src={chapter.cover_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        <PlayCircle size={20} />
                                      </div>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-gray-400 font-mono">
                                        {mIdx + 1}.{cIdx + 1}
                                      </span>
                                      <h4 className="text-sm font-bold text-white">{chapter.title}</h4>
                                    </div>
                                    <p className="text-xs text-gray-400 line-clamp-1">{chapter.description}</p>
                                    
                                    {/* Format Badges */}
                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                      {hasAnalyzer && (
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                          🌡️ AI Message Analyzer
                                        </span>
                                      )}
                                      {hasTracker && (
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                                          📅 Streak Tracker
                                        </span>
                                      )}
                                      {hasSimulator && (
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                                          🎮 Decision Simulator
                                        </span>
                                      )}
                                      {hasEvaluator && (
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                                          📊 Readiness Evaluator
                                        </span>
                                      )}
                                      {hasQuiz && (
                                        <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                                          🧠 Mastery Quiz
                                        </span>
                                      )}
                                      {!hasAnalyzer && !hasTracker && !hasSimulator && !hasEvaluator && !hasQuiz && (
                                        <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/10 text-gray-300">
                                          📖 Masterclass Framework
                                        </span>
                                      )}
                                      <span className="text-[9px] text-gray-400 px-1.5 py-0.5">
                                        {chapter.duration_minutes || 15} min
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedLessonForPreview(chapter);
                                    setModalStage('preview_lesson');
                                  }}
                                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-white flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                                >
                                  <Eye size={12} />
                                  Test Mini-App
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* TAB CONTENT: SALES COPY & MARKETING */}
              {activeReviewTab === 'sales_copy' && (
                <div className="space-y-6">
                  <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">Core Transformation & Positioning</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase">Target Student Archetype</span>
                        <p className="text-sm text-gray-200">{generatedCourse.target_audience}</p>
                      </div>
                      <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-1">
                        <span className="text-xs font-bold text-gray-400 uppercase">Transformation Deliverable</span>
                        <p className="text-sm text-gray-200">{generatedCourse.transformation_promise}</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <span className="text-xs font-bold text-gray-400 uppercase">Deliverables & Benefits</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {(generatedCourse.benefits || []).map((b: string, i: number) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-gray-300">
                            <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span>{b}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Rendered HTML Sales Letter Preview */}
                  {generatedCourse.preview_rich_text && (
                    <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-3">
                      <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                        Persuasive Sales Page Letter (Rendered)
                      </h3>
                      <div
                        className="prose prose-invert max-w-none text-sm text-gray-300 leading-relaxed bg-[#141721] p-6 rounded-xl border border-white/5"
                        dangerouslySetInnerHTML={{ __html: generatedCourse.preview_rich_text }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB CONTENT: VISUAL IDENTITY */}
              {activeReviewTab === 'visuals' && (
                <div className="space-y-6">
                  <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-6 space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-primary">
                      Main Course Cover
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-6 items-center">
                      <div className="w-full sm:w-64 aspect-video sm:aspect-square rounded-2xl overflow-hidden border border-white/10 shadow-2xl shrink-0">
                        <img
                          src={generatedCourse.cover_url}
                          alt="Cover"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="space-y-3 flex-1">
                        <p className="text-xs text-gray-400">
                          Curated high-resolution editorial visual matching the course mood and psychological depth.
                        </p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={generatedCourse.cover_url}
                            onChange={(e) =>
                              setGeneratedCourse({ ...generatedCourse, cover_url: e.target.value })
                            }
                            className="flex-1 bg-[#161922] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STAGE 4: INTERACTIVE LESSON PREVIEW */}
          {modalStage === 'preview_lesson' && selectedLessonForPreview && (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                    Interactive Mini-App Sandbox
                  </span>
                  <h3 className="text-xl font-black text-white italic uppercase">
                    {selectedLessonForPreview.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalStage('review')}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold uppercase transition-all cursor-pointer"
                >
                  Back to Course Overview
                </button>
              </div>

              {/* Render the actual block lesson viewer */}
              <div className="bg-[#141721] border border-white/10 rounded-3xl p-6">
                {(() => {
                  let blocks = [];
                  try {
                    const content = selectedLessonForPreview.interactive_content ||
                      (selectedLessonForPreview.rich_text ? JSON.parse(selectedLessonForPreview.rich_text) : null);
                    blocks = content?.blocks || [];
                  } catch (e) {
                    blocks = [];
                  }

                  if (blocks.length === 0) {
                    return (
                      <div className="text-center py-12 text-gray-400 text-sm">
                        No interactive blocks configured for this lesson.
                      </div>
                    );
                  }

                  return (
                    <BlockLessonViewer
                      chapterId="preview_chap"
                      userId="admin_preview"
                      blocks={blocks}
                      title={selectedLessonForPreview.title}
                      description={selectedLessonForPreview.description}
                      lessonLanguage={language}
                      onLessonComplete={() => {
                        showToast.success('Lesson marked complete in preview sandbox!');
                      }}
                    />
                  );
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Footer Actions */}
        {modalStage === 'review' && (
          <div className="px-6 py-4 border-t border-white/10 bg-white/[0.02] flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-400">
              Ready to save to Supabase or transfer to the manual course editor.
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  onOpenInEditor?.(generatedCourse, generatedModules);
                  onOpenManualEditor?.({ course: generatedCourse, modules: generatedModules });
                  onClose();
                }}
                className="flex-1 sm:flex-initial px-5 py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                <Edit3 size={14} className="inline mr-1.5" />
                Open in Manual Editor
              </button>

              <button
                type="button"
                onClick={handleSaveToSupabase}
                disabled={isPublishing}
                className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                {isPublishing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>{publishingProgress || 'Publishing...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Save & Publish to Supabase</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// Helper icon
function PaletteIcon(props: any) {
  return <SlidersHorizontal {...props} />;
}
