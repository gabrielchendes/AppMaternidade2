import React, { useState, useEffect } from 'react';
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
  Award,
  Layers,
  ArrowRight,
  Eye,
  CheckCircle2,
  Layout,
  Flame,
  Info,
  ShoppingBag,
  PlayCircle,
  Plus,
  Trash2,
  Edit3,
  Globe,
  Zap
} from 'lucide-react';
import { Course } from '../types/lms';
import { showToast } from '../lib/customToast';

interface SuggestedChapter {
  title: string;
  description: string;
  duration_minutes: number;
  content_type: 'video' | 'interactive' | 'checklist' | 'text';
}

interface SuggestedModule {
  title: string;
  chapters: SuggestedChapter[];
}

export interface GeneratedCourseData {
  title: string;
  subtitle: string;
  description: string;
  price: number;
  old_price: number;
  benefits: string[];
  cta_text: string;
  premium_badge_text: string;
  offer_badge_text: string;
  lifetime_badge_text: string;
  social_proof: string;
  payment_label_text: string;
  secure_payment_label: string;
  instant_access_label: string;
  preview_enabled: boolean;
  preview_type: 'video' | 'pdf' | 'text' | 'link';
  preview_title: string;
  preview_subtitle: string;
  preview_rating: string;
  preview_students_label: string;
  preview_guarantee_label: string;
  preview_support_vip_label: string;
  preview_bonus_title: string;
  preview_modules_label: string;
  preview_students_tag: string;
  preview_risk_zero_label: string;
  preview_guarantee_title: string;
  preview_guarantee_subtitle: string;
  preview_guarantee_description: string;
  preview_footer_cta: string;
  preview_text: string;
  preview_rich_text: string;
  suggestedModules: SuggestedModule[];
}

interface AiCourseGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCourse?: Partial<Course>;
  onApplyCourse: (
    generatedCourse: Partial<Course>,
    suggestedModules?: SuggestedModule[],
    autoGenerateLessons?: boolean
  ) => void;
}

export const AiCourseGeneratorModal: React.FC<AiCourseGeneratorModalProps> = ({
  isOpen,
  onClose,
  initialCourse,
  onApplyCourse
}) => {
  const [topicOrTitle, setTopicOrTitle] = useState(initialCourse?.title || '');
  const [targetAudience, setTargetAudience] = useState(
    'Mothers, families, and individuals seeking practical, high-impact evolution'
  );
  const [mainPainOrDesire, setMainPainOrDesire] = useState('');
  const [priceTier, setPriceTier] = useState<number>(
    initialCourse?.price ? Math.round(initialCourse.price / 100) : 97
  );
  const [includeOldPrice, setIncludeOldPrice] = useState<boolean>(
    initialCourse?.old_price && initialCourse.old_price > 0 ? true : false
  );
  const [oldPriceTier, setOldPriceTier] = useState<number>(
    initialCourse?.old_price ? Math.round(initialCourse.old_price / 100) : 297
  );
  const [tone, setTone] = useState<'empathetic_persuasive' | 'authority_medical' | 'direct_action'>('empathetic_persuasive');

  const [loading, setLoading] = useState(false);
  const [editableData, setEditableData] = useState<GeneratedCourseData | null>(null);
  const [activeTab, setActiveTab] = useState<'card_preview' | 'sales_page' | 'modules' | 'edit_fields'>('card_preview');
  const [newBenefitText, setNewBenefitText] = useState('');

  useEffect(() => {
    if (isOpen && initialCourse) {
      if (initialCourse.title && !topicOrTitle) {
        setTopicOrTitle(initialCourse.title);
      }
      if (initialCourse.price) {
        setPriceTier(Math.round(initialCourse.price / 100));
      }
      if (initialCourse.old_price && initialCourse.old_price > 0) {
        setIncludeOldPrice(true);
        setOldPriceTier(Math.round(initialCourse.old_price / 100));
      }
    }
  }, [isOpen, initialCourse]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!topicOrTitle.trim() && !mainPainOrDesire.trim()) {
      showToast.error('Please enter the course topic or main pain point to generate copy.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/v1/generate-course-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicOrTitle,
          targetAudience,
          mainPainOrDesire,
          priceTier,
          includeOldPrice,
          oldPriceTier: includeOldPrice ? (oldPriceTier || Math.round(priceTier * 2.8)) : 0,
          tone,
          language: 'en',
          existingCourse: initialCourse || null
        })
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to generate course copy with AI');
      }

      const generatedOldPrice = includeOldPrice
        ? (json.data.old_price || Math.round((oldPriceTier || priceTier * 2.8) * 100))
        : 0;

      const generatedOfferBadge = includeOldPrice
        ? (json.data.offer_badge_text || 'SPECIAL OFFER • 65% OFF')
        : '';

      const data: GeneratedCourseData = {
        title: json.data.title || topicOrTitle || 'Premium Mastery Course',
        subtitle: json.data.subtitle || 'Transform your daily routine with proven step-by-step guidance',
        description: json.data.description || 'Comprehensive step-by-step masterclass designed for rapid, lasting transformation.',
        price: json.data.price || priceTier * 100,
        old_price: generatedOldPrice,
        benefits: json.data.benefits?.length ? json.data.benefits : [
          'Immediate lifetime access to all core modules',
          'Interactive progress tracking & action checklists',
          'Exclusive downloadable resources & step-by-step guides',
          'VIP direct support with verified specialists'
        ],
        cta_text: json.data.cta_text || 'UNLOCK ACCESS NOW',
        premium_badge_text: json.data.premium_badge_text || 'EXCLUSIVE METHOD',
        offer_badge_text: generatedOfferBadge,
        lifetime_badge_text: json.data.lifetime_badge_text || 'LIFETIME ACCESS',
        social_proof: json.data.social_proof || '+3,480 active students transformed',
        payment_label_text: json.data.payment_label_text || 'Secure Checkout',
        secure_payment_label: json.data.secure_payment_label || '100% Encrypted & Safe',
        instant_access_label: json.data.instant_access_label || 'Instant Access in Your Email',
        preview_enabled: true,
        preview_type: 'text',
        preview_title: json.data.preview_title || json.data.title,
        preview_subtitle: json.data.preview_subtitle || json.data.subtitle,
        preview_rating: json.data.preview_rating || '4.9 ⭐ (980+ verified reviews)',
        preview_students_label: json.data.preview_students_label || '+2,850 Active Students',
        preview_guarantee_label: json.data.preview_guarantee_label || '7-Day Money-Back Guarantee',
        preview_support_vip_label: json.data.preview_support_vip_label || 'VIP Expert Support',
        preview_bonus_title: json.data.preview_bonus_title || 'Exclusive Bonuses Included Today',
        preview_modules_label: json.data.preview_modules_label || 'Curriculum & Method Modules',
        preview_students_tag: json.data.preview_students_tag || 'Instant & Lifetime Access',
        preview_risk_zero_label: json.data.preview_risk_zero_label || '100% Zero Risk for You',
        preview_guarantee_title: json.data.preview_guarantee_title || '100% Risk-Free 7-Day Guarantee',
        preview_guarantee_subtitle: json.data.preview_guarantee_subtitle || 'Full refund with a single click if you are not satisfied.',
        preview_guarantee_description: json.data.preview_guarantee_description || 'You have a full 7 days to explore the course, watch the lessons, and apply the step-by-step techniques. If for any reason you feel it has not exceeded your expectations, simply request a refund to receive 100% of your money back.',
        preview_footer_cta: json.data.preview_footer_cta || json.data.cta_text || (includeOldPrice ? 'GET INSTANT ACCESS WITH DISCOUNT' : 'GET INSTANT ACCESS NOW'),
        preview_text: json.data.preview_text || 'PREVIEW COURSE',
        preview_rich_text: json.data.preview_rich_text || '',
        suggestedModules: json.data.suggestedModules || [
          {
            title: 'Module 1: Foundations & Core Diagnostic',
            chapters: [
              { title: 'Lesson 1: Uncovering the Hidden Bottlenecks', description: 'Deep dive into root causes and strategic solutions.', duration_minutes: 15, content_type: 'interactive' },
              { title: 'Lesson 2: The 3 Critical Mistakes to Avoid', description: 'Halting the cycle of frustration immediately.', duration_minutes: 20, content_type: 'interactive' }
            ]
          },
          {
            title: 'Module 2: The Step-by-Step Implementation Protocol',
            chapters: [
              { title: 'Lesson 1: The Immediate Daily Action Plan', description: 'Applying the proven framework today.', duration_minutes: 25, content_type: 'interactive' },
              { title: 'Lesson 2: Maintaining Consistency & Confidence', description: 'Overcoming obstacles effortlessly.', duration_minutes: 18, content_type: 'interactive' }
            ]
          }
        ]
      };

      setEditableData(data);
      setActiveTab('card_preview');
      showToast.success('High-Converting Copy Generated in English!', {
        description: 'Review the preview card below or customize any field directly.'
      });
    } catch (err: any) {
      console.error('Error generating course copy:', err);
      showToast.error('AI Generation Failed', {
        description: err.message || 'Please check your connection and API key.'
      });
    } finally {
      setLoading(false);
    }
  };

  const buildCoursePayload = (): Partial<Course> | null => {
    if (!editableData) return null;

    const hasOldPrice = editableData.old_price > 0;

    return {
      title: editableData.title || topicOrTitle,
      subtitle: editableData.subtitle || '',
      description: editableData.description || '',
      price: editableData.price || priceTier * 100,
      old_price: hasOldPrice ? editableData.old_price : 0,
      benefits: editableData.benefits || [],
      cta_text: editableData.cta_text || 'UNLOCK ACCESS NOW',
      premium_badge_text: editableData.premium_badge_text || 'EXCLUSIVE METHOD',
      offer_badge_text: hasOldPrice ? (editableData.offer_badge_text || '') : '',
      lifetime_badge_text: editableData.lifetime_badge_text || 'LIFETIME ACCESS',
      social_proof: editableData.social_proof || '+3,480 active students transformed',
      show_lifetime_badge: true,
      payment_label_text: editableData.payment_label_text || 'Secure Checkout',
      secure_payment_label: editableData.secure_payment_label || '100% Encrypted & Safe',
      instant_access_label: editableData.instant_access_label || 'Instant Access in Your Email',
      preview_enabled: true,
      preview_type: editableData.preview_type || 'text',
      preview_title: editableData.preview_title || editableData.title,
      preview_subtitle: editableData.preview_subtitle || editableData.subtitle,
      preview_rating: editableData.preview_rating || '4.9 ⭐ (980+ reviews)',
      preview_students_label: editableData.preview_students_label || '+2,850 Active Students',
      preview_guarantee_label: editableData.preview_guarantee_label || '7-Day Guarantee',
      preview_support_vip_label: editableData.preview_support_vip_label || 'VIP Support',
      preview_bonus_title: editableData.preview_bonus_title || 'Exclusive Bonuses Included',
      preview_modules_label: editableData.preview_modules_label || 'Curriculum & Modules',
      preview_students_tag: editableData.preview_students_tag || 'Instant & Lifetime Access',
      preview_risk_zero_label: editableData.preview_risk_zero_label || '100% Risk Free',
      preview_guarantee_title: editableData.preview_guarantee_title || '100% Risk-Free 7-Day Guarantee',
      preview_guarantee_subtitle: editableData.preview_guarantee_subtitle || '100% Money-back guarantee.',
      preview_guarantee_description: editableData.preview_guarantee_description || '',
      preview_footer_cta: editableData.preview_footer_cta || editableData.cta_text || 'GET INSTANT ACCESS',
      preview_text: editableData.preview_text || 'PREVIEW COURSE',
      preview_rich_text: editableData.preview_rich_text || '',
      is_free: false,
      is_bonus: false,
      is_active: true
    };
  };

  const handleApplyOnly = () => {
    const payload = buildCoursePayload();
    if (!payload || !editableData) return;

    onApplyCourse(payload, editableData.suggestedModules, false);
    showToast.success('Course Copy Applied Successfully!', {
      description: 'The high-converting English copy is now loaded into your course editor.'
    });
    onClose();
  };

  const handleApplyAndCreateLessons = () => {
    const payload = buildCoursePayload();
    if (!payload || !editableData) return;

    onApplyCourse(payload, editableData.suggestedModules, true);
    showToast.success('Course Applied & Lessons Prepared with AI!', {
      description: 'Modules and lesson outlines were generated based on this copy.'
    });
    onClose();
  };

  // Helper to format currency
  const formatMoney = (cents: number) => {
    return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#10121a] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[94vh] my-auto">
        
        {/* Top Header */}
        <div className="px-6 py-4.5 border-b border-white/10 bg-gradient-to-r from-amber-500/15 via-rose-500/10 to-transparent flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20">
              <Sparkles size={22} className="animate-spin-slow" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                AI High-Converting Course Copywriter
                <span className="text-[9px] uppercase tracking-wider font-black px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <Globe size={11} /> English (en-US)
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Generate high-converting checkout cards, sales preview pages, and curriculum outlines with AI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Informative Top Bar */}
        <div className="px-6 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-200/90 shrink-0">
          <div className="flex items-center gap-2">
            <Info size={15} className="text-amber-400 shrink-0" />
            <span>
              <strong>All generated copy is in English.</strong> Once created, you can edit any field directly before applying to the course.
            </span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-400/20 text-amber-300">
            CRO Optimized
          </span>
        </div>

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Generation Inputs */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white/[0.02] border border-white/5 p-4.5 rounded-2xl">
            <div className="space-y-1.5 md:col-span-8">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText size={13} className="text-amber-400" /> Course Topic / Working Title *
              </label>
              <input
                type="text"
                value={topicOrTitle}
                onChange={(e) => setTopicOrTitle(e.target.value)}
                placeholder="e.g., Infant Sleep Mastery: Complete Peaceful Nights Without Cry-It-Out..."
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition-all placeholder:text-gray-600"
              />
            </div>

            <div className="space-y-1.5 md:col-span-4">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <DollarSign size={13} className="text-emerald-400" /> Target Price ($ USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">$</span>
                <input
                  type="number"
                  value={priceTier}
                  onChange={(e) => setPriceTier(Number(e.target.value))}
                  placeholder="97"
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition-all font-bold"
                />
              </div>
            </div>

            {/* Promotional Old Price Toggle & Custom Input */}
            <div className="md:col-span-12 bg-black/40 border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeOldPrice}
                    onChange={(e) => setIncludeOldPrice(e.target.checked)}
                    className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 bg-zinc-900 border-zinc-700 cursor-pointer accent-amber-500"
                  />
                  <span className="text-xs font-black text-white uppercase tracking-wider">
                    Include Old Price as Promotion (Strikethrough & Discount Badge)
                  </span>
                </label>
                <p className="text-[11px] text-gray-400 pl-6">
                  {includeOldPrice
                    ? 'A strikethrough comparison price and a promotional discount badge (e.g. 65% OFF) will be generated.'
                    : 'No promotional discount will be shown. The course will be presented at its single authoritative regular price.'}
                </p>
              </div>

              {includeOldPrice && (
                <div className="flex items-center gap-2 shrink-0 pl-6 sm:pl-0">
                  <span className="text-xs font-bold text-gray-400">Old Price:</span>
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500">$</span>
                    <input
                      type="number"
                      value={oldPriceTier}
                      onChange={(e) => setOldPriceTier(Number(e.target.value))}
                      placeholder="297"
                      className="w-full bg-black/80 border border-amber-500/40 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white focus:border-amber-400 outline-none font-bold"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5 md:col-span-6">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users size={13} className="text-blue-400" /> Target Audience
              </label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="e.g., Exhausted first-time mothers, working parents with infants..."
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition-all placeholder:text-gray-600"
              />
            </div>

            <div className="space-y-1.5 md:col-span-6">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Zap size={13} className="text-amber-400" /> Main Pain Point / Transformation
              </label>
              <input
                type="text"
                value={mainPainOrDesire}
                onChange={(e) => setMainPainOrDesire(e.target.value)}
                placeholder="e.g., Wakes up 4 to 8 times every night, overwhelmed by conflicting advice..."
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:border-amber-500 outline-none transition-all placeholder:text-gray-600"
              />
            </div>

            <div className="space-y-1.5 md:col-span-12">
              <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                Tone of Voice & Angle
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTone('empathetic_persuasive')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                    tone === 'empathetic_persuasive'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  ❤️ Empathetic & Warm
                  <div className="text-[10px] font-normal text-gray-400 mt-0.5">Zero guilt, deep emotional relief</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTone('authority_medical')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                    tone === 'authority_medical'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  🩺 Scientific Authority
                  <div className="text-[10px] font-normal text-gray-400 mt-0.5">Evidence-based, proven structure</div>
                </button>
                <button
                  type="button"
                  onClick={() => setTone('direct_action')}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                    tone === 'direct_action'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-black/40 border-white/10 text-gray-400 hover:text-white'
                  }`}
                >
                  ⚡ Direct & High-Impact
                  <div className="text-[10px] font-normal text-gray-400 mt-0.5">Fast results, actionable frameworks</div>
                </button>
              </div>
            </div>

            {/* Trigger Button */}
            <div className="md:col-span-12 flex justify-end pt-1">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Generating English Copy with AI...
                  </>
                ) : (
                  <>
                    <Wand2 size={16} />
                    {editableData ? 'Regenerate Course Copy (English)' : 'Generate Course Copy with AI'}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Generated Result & Real Model Showcase */}
          {editableData && (
            <div className="border border-white/15 rounded-3xl bg-black/60 overflow-hidden shadow-2xl">
              
              {/* Navigation Tabs */}
              <div className="flex items-center border-b border-white/10 bg-white/5 px-4 overflow-x-auto scrollbar-hide">
                <button
                  type="button"
                  onClick={() => setActiveTab('card_preview')}
                  className={`px-4 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeTab === 'card_preview'
                      ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Layout size={14} /> Course Card (Unlock Access Modal)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('sales_page')}
                  className={`px-4 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeTab === 'sales_page'
                      ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Eye size={14} /> Full Sales Page Preview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('modules')}
                  className={`px-4 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeTab === 'modules'
                      ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Layers size={14} /> Suggested Modules ({editableData.suggestedModules?.length || 0})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('edit_fields')}
                  className={`px-4 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
                    activeTab === 'edit_fields'
                      ? 'border-amber-400 text-amber-300 bg-amber-500/10'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Edit3 size={14} /> Edit Generated Fields
                </button>
              </div>

              {/* TAB 1: Real Course Card Model (Identical to CoursePurchaseModal with both action buttons) */}
              {activeTab === 'card_preview' && (
                <div className="p-6 sm:p-8 flex flex-col items-center justify-center bg-gradient-to-b from-[#0b0d14] to-[#06070a]">
                  <div className="text-center mb-4">
                    <span className="text-[10px] uppercase tracking-widest font-black text-amber-400/80 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                      Live Modal Simulation (Exact Platform Style)
                    </span>
                  </div>

                  {/* The Authentic Course Purchase Card */}
                  <div className="relative w-full max-w-md bg-zinc-950 rounded-[2.5rem] overflow-hidden shadow-[0_0_70px_rgba(245,158,11,0.18)] border border-white/10 text-white">
                    {/* Image Section */}
                    <div className="relative aspect-video w-full overflow-hidden bg-zinc-900 flex items-center justify-center border-b border-white/5">
                      <img
                        src={initialCourse?.premium_cover_url || initialCourse?.cover_url || 'https://picsum.photos/seed/coursepreview/1000/600'}
                        alt={editableData.title}
                        className="w-full h-full object-cover opacity-85"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent" />
                      
                      {/* Premium Badge */}
                      {editableData.premium_badge_text && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                          <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/20 backdrop-blur-xl border border-amber-500/40 rounded-full shadow-lg">
                            <Sparkles size={11} className="text-amber-400 animate-pulse" />
                            <span className="text-[9px] font-black text-amber-300 uppercase tracking-[0.2em] italic whitespace-nowrap">
                              {editableData.premium_badge_text}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div className="p-6 flex flex-col items-center justify-center bg-zinc-950">
                      <div className="space-y-5 w-full max-w-sm mx-auto">
                        {/* Header */}
                        <div className="space-y-1.5 flex flex-col items-center text-center">
                          {editableData.offer_badge_text && editableData.old_price > 0 && (
                            <div className="flex items-center gap-1.5 text-amber-400 font-black text-[9px] tracking-[0.25em] uppercase italic">
                              <Star size={10} className="fill-amber-400" /> {editableData.offer_badge_text}
                            </div>
                          )}
                          <h2 className="text-xl font-black leading-tight text-white uppercase italic tracking-tighter">
                            {editableData.title}
                          </h2>
                          {editableData.subtitle && (
                            <p className="text-xs font-bold text-gray-400 italic line-clamp-2">
                              {editableData.subtitle}
                            </p>
                          )}
                        </div>

                        {/* Benefits Grid */}
                        <div className="grid grid-cols-2 gap-2.5 py-4 border-y border-white/5">
                          {editableData.benefits?.slice(0, 4).map((benefit, index) => (
                            <div key={index} className="flex items-start gap-1.5">
                              <div className="mt-0.5 p-0.5 bg-amber-500/20 rounded text-amber-400 shrink-0">
                                <Check size={10} />
                              </div>
                              <span className="text-[9px] font-bold text-gray-300 leading-tight line-clamp-2">
                                {benefit}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Pricing & Social Proof */}
                        <div className="flex flex-col items-center gap-3">
                          {/* Social Proof */}
                          {editableData.social_proof && (
                            <div className="flex items-center gap-2 py-1 px-3 bg-amber-500/10 rounded-full border border-amber-500/20 w-fit">
                              <div className="flex -space-x-1.5">
                                {[1, 2, 3].map((i) => (
                                  <div key={i} className="w-4 h-4 rounded-full border-2 border-zinc-950 bg-zinc-800 flex items-center justify-center">
                                    <Star size={6} className="text-amber-400 fill-amber-400" />
                                  </div>
                                ))}
                              </div>
                              <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">
                                {editableData.social_proof}
                              </span>
                            </div>
                          )}

                          {/* Pricing */}
                          <div className="flex flex-col items-center gap-0.5">
                            <div className="flex items-center gap-2.5">
                              {editableData.old_price > 0 && (
                                <span className="text-sm font-black text-gray-600 line-through italic">
                                  {formatMoney(editableData.old_price)}
                                </span>
                              )}
                              <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded flex items-center gap-1">
                                <Check size={8} className="text-emerald-400 font-black" />
                                <span className="text-[7px] font-black text-emerald-400 uppercase tracking-widest">
                                  {editableData.lifetime_badge_text || 'LIFETIME ACCESS'}
                                </span>
                              </div>
                            </div>
                            <div className="text-3xl font-black text-white tracking-tighter flex items-center gap-2">
                              {formatMoney(editableData.price)}
                              <span className="text-[8px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                {editableData.payment_label_text || 'One-Time Payment'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* The Two Authentic Action Buttons */}
                        <div className="flex flex-col gap-2.5 pt-1">
                          {/* 1. Primary Action: Liberar Acesso Agora */}
                          <button
                            type="button"
                            onClick={handleApplyOnly}
                            className="group relative w-full bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black font-black py-3.5 rounded-2xl flex items-center justify-center gap-2.5 shadow-[0_15px_40px_rgba(245,158,11,0.35)] transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <ShoppingBag size={17} className="group-hover:rotate-12 transition-transform" />
                            <span className="text-xs tracking-[0.1em] uppercase italic font-black">
                              {editableData.cta_text || 'UNLOCK ACCESS NOW'}
                            </span>
                            <ArrowRight size={15} className="group-hover:translate-x-1.5 transition-transform" />
                          </button>

                          {/* 2. Secondary Action: Preview do Curso */}
                          <button
                            type="button"
                            onClick={() => setActiveTab('sales_page')}
                            className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-all border border-white/10 text-[10px] tracking-widest uppercase italic cursor-pointer"
                          >
                            <PlayCircle size={15} className="text-amber-400" />
                            {editableData.preview_text || 'PREVIEW COURSE'}
                          </button>
                        </div>

                        {/* Trust Footer */}
                        <div className="flex items-center justify-center gap-5 pt-3">
                          <div className="flex items-center gap-1.5 text-[8px] text-gray-500 font-black uppercase tracking-widest">
                            <ShieldCheck size={11} className="text-emerald-400" /> {editableData.secure_payment_label || 'Secure Checkout'}
                          </div>
                          <div className="flex items-center gap-1.5 text-[8px] text-gray-500 font-black uppercase tracking-widest">
                            <Zap size={11} className="text-amber-400" /> {editableData.instant_access_label || 'Instant Access'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: Full Sales Page Preview */}
              {activeTab === 'sales_page' && (
                <div className="p-6 space-y-6">
                  {/* Hero Box */}
                  <div className="bg-gradient-to-br from-white/5 via-white/[0.02] to-transparent p-6 rounded-2xl border border-white/10 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {editableData.premium_badge_text}
                      </span>
                      {editableData.offer_badge_text && editableData.old_price > 0 && (
                        <span className="px-3 py-1 rounded-full text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/30">
                          {editableData.offer_badge_text}
                        </span>
                      )}
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                      {editableData.preview_title}
                    </h2>
                    <p className="text-sm text-amber-200/90 font-medium">
                      {editableData.preview_subtitle}
                    </p>

                    <div className="flex flex-wrap gap-4 pt-2 text-xs text-gray-300 border-t border-white/10">
                      <span className="flex items-center gap-1 font-bold text-amber-400">
                        <Star size={13} className="fill-amber-400" /> {editableData.preview_rating}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users size={13} className="text-blue-400" /> {editableData.preview_students_label}
                      </span>
                      <span className="flex items-center gap-1">
                        <ShieldCheck size={13} className="text-emerald-400" /> {editableData.preview_guarantee_label}
                      </span>
                      <span className="flex items-center gap-1">
                        <Award size={13} className="text-purple-400" /> {editableData.preview_support_vip_label}
                      </span>
                    </div>
                  </div>

                  {/* Guarantee Box */}
                  <div className="border border-emerald-500/30 bg-emerald-950/20 p-5 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <ShieldCheck size={20} /> {editableData.preview_guarantee_title}
                    </div>
                    <p className="text-xs text-emerald-200 font-semibold">{editableData.preview_guarantee_subtitle}</p>
                    <p className="text-xs text-gray-300 leading-relaxed">{editableData.preview_guarantee_description}</p>
                  </div>

                  {/* Sales Letter Rich Content */}
                  {editableData.preview_rich_text && (
                    <div className="space-y-2">
                      <span className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Sales Letter Copy:</span>
                      <div
                        className="max-h-64 overflow-y-auto p-5 rounded-2xl bg-black/60 border border-white/10 text-xs text-gray-300 leading-relaxed space-y-3"
                        dangerouslySetInnerHTML={{ __html: editableData.preview_rich_text }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: Suggested Modules */}
              {activeTab === 'modules' && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      Generated Curriculum ({editableData.suggestedModules?.length || 0} Modules)
                    </span>
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
                      Ready for AI Interactive Mini-App Generation
                    </span>
                  </div>

                  <div className="space-y-3">
                    {editableData.suggestedModules?.map((mod, mIdx) => (
                      <div key={mIdx} className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                        <div className="text-sm font-black text-amber-300 flex items-center gap-2">
                          <Layers size={16} /> {mod.title}
                        </div>
                        <div className="space-y-2 pl-4 border-l-2 border-amber-500/30">
                          {mod.chapters?.map((ch, cIdx) => (
                            <div key={cIdx} className="text-xs text-gray-200 bg-black/40 p-2.5 rounded-xl border border-white/5 flex items-center justify-between">
                              <div>
                                <span className="font-bold text-white block">{ch.title}</span>
                                <span className="text-[10px] text-gray-400">{ch.description}</span>
                              </div>
                              <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded ml-2 shrink-0">
                                {ch.duration_minutes} min
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: Edit Generated Fields */}
              {activeTab === 'edit_fields' && (
                <div className="p-6 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Course Title</label>
                      <input
                        type="text"
                        value={editableData.title}
                        onChange={(e) => setEditableData({ ...editableData, title: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Course Subtitle</label>
                      <input
                        type="text"
                        value={editableData.subtitle}
                        onChange={(e) => setEditableData({ ...editableData, subtitle: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1 md:col-span-2">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Short Description</label>
                      <textarea
                        rows={2}
                        value={editableData.description}
                        onChange={(e) => setEditableData({ ...editableData, description: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Price (in cents)</label>
                      <input
                        type="number"
                        value={editableData.price}
                        onChange={(e) => setEditableData({ ...editableData, price: Number(e.target.value) })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Old Strikethrough Price (in cents)</label>
                      <input
                        type="number"
                        value={editableData.old_price}
                        onChange={(e) => setEditableData({ ...editableData, old_price: Number(e.target.value) })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">CTA Button Text</label>
                      <input
                        type="text"
                        value={editableData.cta_text}
                        onChange={(e) => setEditableData({ ...editableData, cta_text: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Premium Badge Text</label>
                      <input
                        type="text"
                        value={editableData.premium_badge_text}
                        onChange={(e) => setEditableData({ ...editableData, premium_badge_text: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Offer Badge Text</label>
                      <input
                        type="text"
                        value={editableData.offer_badge_text}
                        onChange={(e) => setEditableData({ ...editableData, offer_badge_text: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-gray-400">Social Proof Text</label>
                      <input
                        type="text"
                        value={editableData.social_proof}
                        onChange={(e) => setEditableData({ ...editableData, social_proof: e.target.value })}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:border-amber-500 outline-none"
                      />
                    </div>
                  </div>

                  {/* Benefits Editor */}
                  <div className="space-y-2 pt-3 border-t border-white/10">
                    <label className="text-[10px] font-bold uppercase text-gray-400 block">
                      Deliverables / Benefits Bullets ({editableData.benefits?.length || 0})
                    </label>
                    <div className="space-y-2">
                      {editableData.benefits?.map((b, bIdx) => (
                        <div key={bIdx} className="flex items-center gap-2">
                          <input
                            type="text"
                            value={b}
                            onChange={(e) => {
                              const updated = [...editableData.benefits];
                              updated[bIdx] = e.target.value;
                              setEditableData({ ...editableData, benefits: updated });
                            }}
                            className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500 outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = editableData.benefits.filter((_, i) => i !== bIdx);
                              setEditableData({ ...editableData, benefits: updated });
                            }}
                            className="p-2 text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        value={newBenefitText}
                        onChange={(e) => setNewBenefitText(e.target.value)}
                        placeholder="Add new benefit..."
                        className="flex-1 bg-black/60 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:border-amber-500 outline-none placeholder:text-gray-600"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newBenefitText.trim()) {
                            e.preventDefault();
                            setEditableData({
                              ...editableData,
                              benefits: [...(editableData.benefits || []), newBenefitText.trim()]
                            });
                            setNewBenefitText('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newBenefitText.trim()) {
                            setEditableData({
                              ...editableData,
                              benefits: [...(editableData.benefits || []), newBenefitText.trim()]
                            });
                            setNewBenefitText('');
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-white/10 bg-black/70 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/10 text-gray-400 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {editableData ? (
            <div className="flex flex-wrap items-center justify-end gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white text-xs font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Regenerate
              </button>

              {/* Standard Apply */}
              <button
                type="button"
                onClick={handleApplyOnly}
                className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={16} className="text-emerald-400" /> Apply Copy to Course
              </button>

              {/* Apply AND Generate Lessons with AI */}
              <button
                type="button"
                onClick={handleApplyAndCreateLessons}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 hover:from-amber-400 hover:to-rose-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Wand2 size={16} /> Create Lessons with AI
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Generate Copy with AI
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiCourseGeneratorModal;
