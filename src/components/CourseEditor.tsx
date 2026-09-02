import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { GlowingSpinner } from './GlowingSpinner';
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
  Play,
  Sparkles,
  Star,
  PlayCircle,
  ShieldCheck,
  Layout,
  Layers,
  Monitor,
  Eye,
  Users,
  Award,
  MessageSquare,
  Link,
  Lock,
  AlertTriangle,
  CheckSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Module, Chapter, Checklist } from '../types/lms';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';
import CoursePreviewViewer from './CoursePreviewViewer';
import { AdminChecklistEditor } from './AdminChecklistEditor';
import { AiLessonGeneratorModal } from './AiLessonGeneratorModal';
import { AiCourseGeneratorModal } from './AiCourseGeneratorModal';
import { fetchChecklistByChapterId, saveChecklistToDatabase } from '../services/checklistService';
import ImageCropperModal from './ImageCropperModal';
import { dataCache } from '../lib/cache';

const getNextCategoryOrderIndex = async (isBonus: boolean, isFree: boolean): Promise<number> => {
  try {
    let query = supabase.from('courses').select('order_index');
    if (isBonus) {
      query = query.eq('is_bonus', true);
    } else if (isFree) {
      query = query.eq('is_bonus', false).eq('is_free', true);
    } else {
      query = query.eq('is_bonus', false).eq('is_free', false);
    }
    const { data: existingCourses, error } = await query;
    if (error || !existingCourses || existingCourses.length === 0) return 1;
    const maxOrder = Math.max(...existingCourses.map((c: any) => typeof c.order_index === 'number' ? c.order_index : 0), 0);
    return maxOrder + 1;
  } catch (e) {
    return 9999;
  }
};

const adjustColorBrightness = (hex: string, percent: number) => {
  try {
    let cleanHex = hex;
    if (hex.startsWith('#')) {
      cleanHex = hex.substring(1);
    }
    if (cleanHex.length === 3) {
      cleanHex = cleanHex.split('').map(c => c + c).join('');
    }
    let R = parseInt(cleanHex.substring(0, 2), 16);
    let G = parseInt(cleanHex.substring(2, 4), 16);
    let B = parseInt(cleanHex.substring(4, 6), 16);

    R = Math.min(255, Math.max(0, R + percent));
    G = Math.min(255, Math.max(0, G + percent));
    B = Math.min(255, Math.max(0, B + percent));

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  } catch (e) {
    return hex;
  }
};

const getButtonStyle = (color: string, style: string): React.CSSProperties => {
  const actualColor = color || '#10b981';
  const actualStyle = style || 'filled';
  
  if (actualStyle === 'filled') {
    return {
      backgroundColor: actualColor,
      color: '#ffffff',
      boxShadow: `0 10px 25px -5px ${actualColor}40`
    };
  } else if (actualStyle === 'outline') {
    return {
      backgroundColor: 'transparent',
      border: `2px solid ${actualColor}`,
      color: actualColor,
    };
  } else if (actualStyle === 'glow') {
    return {
      backgroundColor: actualColor,
      color: '#ffffff',
      boxShadow: `0 0 20px ${actualColor}, 0 5px 10px rgba(0,0,0,0.3)`
    };
  } else if (actualStyle === 'gradient') {
    const gradientEnd = adjustColorBrightness(actualColor, -25);
    return {
      backgroundImage: `linear-gradient(135deg, ${actualColor}, ${gradientEnd})`,
      color: '#ffffff',
      boxShadow: `0 10px 25px -5px ${actualColor}40`
    };
  }
  return {};
};

const isAiCreatedLesson = (ch: Chapter | null | undefined): boolean => {
  if (!ch) return false;
  if (ch.content_type === 'interactive' && ch.rich_text) {
    try {
      const parsed = typeof ch.rich_text === 'string' ? JSON.parse(ch.rich_text) : ch.rich_text;
      if (parsed && (parsed.generated_by_ai === true || parsed.is_ai_created === true || (Array.isArray(parsed.blocks) && parsed.blocks.length > 0))) {
        return true;
      }
    } catch (e) {
      // ignore
    }
  }
  return false;
};

interface CourseEditorProps {
  courseId?: string;
  onClose: () => void;
  packages?: any[];
}

export default function CourseEditor({ courseId: initialCourseId, onClose, packages: externalPackages }: CourseEditorProps) {
  const [courseId, setCourseId] = useState<string | undefined>(initialCourseId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedChapters, setExpandedChapters] = useState<string[]>([]);
  const [showLivePreview, setShowLivePreview] = useState(false);
  const [showModuleEditor, setShowModuleEditor] = useState(false);
  const [editingModule, setEditingModule] = useState<Partial<Module>>({ title: '' });
  const [showMissingHotmartModal, setShowMissingHotmartModal] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isAiCourseModalOpen, setIsAiCourseModalOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  const handleApplyAiCourse = async (
    generatedCourse: Partial<Course>,
    suggestedModules?: any[],
    autoGenerateLessons?: boolean
  ) => {
    setCourse(prev => ({
      ...prev,
      ...generatedCourse
    }));
    setIsDirty(true);

    if (autoGenerateLessons && suggestedModules && suggestedModules.length > 0) {
      try {
        setSaving(true);
        toast.info('Criando estrutura de módulos e aulas com IA...');

        let currentCourseId = courseId;

        // Automatically save course if it doesn't exist yet
        if (!currentCourseId) {
          const courseTitle = generatedCourse.title || course.title || 'Novo Curso';
          const nextOrder = await getNextCategoryOrderIndex(!!course.is_bonus, !course.is_bonus && !!course.is_free);

          const { data: newCourse, error: courseError } = await supabase.from('courses').insert([{
            title: courseTitle,
            subtitle: generatedCourse.subtitle || course.subtitle || '',
            description: generatedCourse.description || course.description || '',
            cover_url: course.cover_url || '',
            premium_cover_url: course.premium_cover_url || '',
            is_active: course.is_active !== undefined ? course.is_active : true,
            is_free: course.is_free || false,
            is_bonus: course.is_bonus || false,
            price: generatedCourse.price || course.price || 9700,
            old_price: generatedCourse.old_price || course.old_price || 29700,
            benefits: generatedCourse.benefits || course.benefits || [],
            cta_text: generatedCourse.cta_text || 'UNLOCK ACCESS NOW',
            premium_badge_text: generatedCourse.premium_badge_text || 'EXCLUSIVE METHOD',
            offer_badge_text: generatedCourse.offer_badge_text || 'SPECIAL OFFER • 65% OFF',
            lifetime_badge_text: generatedCourse.lifetime_badge_text || 'LIFETIME ACCESS',
            social_proof: generatedCourse.social_proof || '+3,480 active students transformed',
            show_lifetime_badge: true,
            payment_label_text: generatedCourse.payment_label_text || 'Secure Checkout',
            secure_payment_label: generatedCourse.secure_payment_label || '100% Encrypted & Safe',
            instant_access_label: generatedCourse.instant_access_label || 'Instant Access in Your Email',
            preview_enabled: true,
            preview_type: generatedCourse.preview_type || 'text',
            preview_title: generatedCourse.preview_title || courseTitle,
            preview_subtitle: generatedCourse.preview_subtitle || generatedCourse.subtitle || '',
            preview_rating: generatedCourse.preview_rating || '4.9 ⭐ (980+ reviews)',
            preview_students_label: generatedCourse.preview_students_label || '+2,850 Active Students',
            preview_guarantee_label: generatedCourse.preview_guarantee_label || '7-Day Guarantee',
            preview_support_vip_label: generatedCourse.preview_support_vip_label || 'VIP Support',
            preview_bonus_title: generatedCourse.preview_bonus_title || 'Exclusive Bonuses Included',
            preview_modules_label: generatedCourse.preview_modules_label || 'Curriculum & Modules',
            preview_students_tag: generatedCourse.preview_students_tag || 'Instant & Lifetime Access',
            preview_risk_zero_label: generatedCourse.preview_risk_zero_label || '100% Risk Free',
            preview_guarantee_title: generatedCourse.preview_guarantee_title || '100% Risk-Free 7-Day Guarantee',
            preview_guarantee_subtitle: generatedCourse.preview_guarantee_subtitle || '100% Money-back guarantee.',
            preview_guarantee_description: generatedCourse.preview_guarantee_description || '',
            preview_footer_cta: generatedCourse.preview_footer_cta || 'GET INSTANT ACCESS',
            preview_text: generatedCourse.preview_text || 'PREVIEW COURSE',
            preview_rich_text: generatedCourse.preview_rich_text || '',
            order_index: nextOrder
          }]).select().single();

          if (courseError) throw courseError;
          currentCourseId = newCourse.id;
          setCourseId(newCourse.id);
          setCourse(newCourse);
          dataCache.invalidate();
        }

        let firstCreatedChapter: any = null;
        const currentModuleCount = modules.length || 0;

        for (let mIdx = 0; mIdx < suggestedModules.length; mIdx++) {
          const mod = suggestedModules[mIdx];
          const { data: newMod, error: modError } = await supabase
            .from('modules')
            .insert([{
              course_id: currentCourseId,
              title: mod.title,
              order_index: currentModuleCount + mIdx
            }])
            .select()
            .single();

          if (modError) {
            console.error('Error creating module:', modError);
            continue;
          }

          if (newMod && mod.chapters?.length) {
            for (let cIdx = 0; cIdx < mod.chapters.length; cIdx++) {
              const ch = mod.chapters[cIdx];
              const { data: newChap, error: chapError } = await supabase
                .from('chapters')
                .insert([{
                  module_id: newMod.id,
                  title: ch.title,
                  description: ch.description || '',
                  content_type: ch.content_type || 'interactive',
                  duration_minutes: ch.duration_minutes || 15,
                  order_index: cIdx
                }])
                .select()
                .single();

              if (!chapError && newChap && !firstCreatedChapter) {
                firstCreatedChapter = newChap;
              }
            }
          }
        }

        await fetchCourseData();
        toast.success('Módulos e Aulas criados com sucesso a partir da Copy!');

        // If there's a chapter created, allow direct AI Lesson generation
        if (firstCreatedChapter) {
          setAiEditChapter(firstCreatedChapter);
          setIsAiModalOpen(true);
        }
      } catch (err: any) {
        console.error('Error auto-generating lessons:', err);
        toast.error('Erro ao gerar aulas automaticamente: ' + (err.message || 'Tente novamente.'));
      } finally {
        setSaving(false);
      }
    }
  };

  // Course State
  const [course, setCourse] = useState<Partial<Course>>({
    title: '',
    description: '',
    is_active: true,
    is_free: true,
    is_bonus: false,
    cover_url: '',
    price: 0,
    old_price: 0,
    subtitle: '',
    benefits: [],
    order_index: 0,
    cta_text: 'QUERO COMEÇAR AGORA',
    preview_bonus_title: 'Benefícios Exclusivos Inclusos',
    preview_url: '',
    preview_text: '',
    preview_enabled: false,
    premium_badge_text: '',
    offer_badge_text: '',
    social_proof: '',
    show_lifetime_badge: true,
    lifetime_badge_text: '',
    payment_label_text: '',
    secure_payment_label: '',
    instant_access_label: '',
    premium_cover_url: '',
    checkout_url: '',
    hotmart_product_id: '',
    preview_title: '',
    preview_subtitle: '',
    preview_type: 'video',
    preview_video_url: '',
    preview_pdf_url: '',
    preview_rich_text: '',
    preview_link_text: '',
    preview_link_url: '',
    preview_link_color: '#3b82f6',
    linked_package_id: '',
    is_package_exclusive_bonus: false
  });

  // Lesson State
  const [editingChapter, setEditingChapter] = useState<Partial<Chapter>>({
    title: '',
    content_type: 'video',
    video_url: '',
    pdf_url: '',
    button_link_text: '',
    button_link_url: '',
    button_link_color: '#10b981',
    cover_url: '',
    description: '',
    rich_text: '',
    duration_minutes: 0
  });

  // Image Cropper States
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperType, setCropperType] = useState<'standard' | 'premium' | 'chapter' | 'existing-chapter'>('standard');
  const [cropperAspect, setCropperAspect] = useState(3/4);
  const [cropperChapterId, setCropperChapterId] = useState<string | null>(null);

  const [modules, setModules] = useState<Module[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [packages, setPackages] = useState<any[]>(externalPackages || []);
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);

  const [editingExistingChapter, setEditingExistingChapter] = useState<Chapter | null>(null);

  // Checklist state
  const [newChecklist, setNewChecklist] = useState<Checklist>({
    chapter_id: 'new',
    title: 'Checklist Interativa',
    description: '',
    instructions: 'Marque cada etapa à medida que concluir.',
    items: []
  });

  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);

  // Custom premium dropdown states
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const [isEditModuleDropdownOpen, setIsEditModuleDropdownOpen] = useState(false);
  const [isEditStyleDropdownOpen, setIsEditStyleDropdownOpen] = useState(false);

  // Unsaved changes & AI edit state
  const [isDirty, setIsDirty] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<(() => void) | null>(null);
  const [aiEditChapter, setAiEditChapter] = useState<Chapter | null>(null);

  const requestNavigation = (action: () => void) => {
    if (isDirty) {
      setPendingNavAction(() => action);
      setShowUnsavedModal(true);
    } else {
      action();
    }
  };

  const handleOpenAiEdit = (ch: Chapter) => {
    setAiEditChapter(ch);
    setIsAiModalOpen(true);
  };

  useEffect(() => {
    if (selectedChapterId && selectedChapterId !== 'new') {
      const found = chapters.find(c => c.id === selectedChapterId);
      if (found) {
        setEditingExistingChapter({ ...found });

        if (found.content_type === 'checklist') {
          fetchChecklistByChapterId(found.id).then(cl => {
            if (cl) {
              setEditingChecklist(cl);
            } else {
              setEditingChecklist({
                chapter_id: found.id,
                title: found.title || 'Checklist',
                description: found.description || '',
                items: []
              });
            }
          });
        }
      }
    } else {
      setEditingExistingChapter(null);
      setEditingChecklist(null);
    }
  }, [selectedChapterId, chapters]);

  useEffect(() => {
    if (!externalPackages) {
      fetchPackages();
    } else {
      setPackages(externalPackages);
    }
    
    if (courseId) {
      fetchCourseData();
    } else {
      setLoading(false);
    }
  }, [courseId, externalPackages]);

  const fetchPackages = async () => {
    try {
      const { data: pkgs } = await supabase
        .from('course_packages')
        .select('id, title, price, hotmart_checkout_url, hotmart_product_id');
      setPackages(pkgs || []);
    } catch (err) {
      console.error('Error fetching packages:', err);
    }
  };

  useEffect(() => {
    if (course.linked_package_id && packages.length > 0) {
      const selectedPkg = packages.find(p => p.id === course.linked_package_id);
      if (selectedPkg) {
        setCourse(prev => ({
          ...prev,
          price: selectedPkg.price || 0,
          checkout_url: selectedPkg.hotmart_checkout_url || '',
          hotmart_product_id: selectedPkg.hotmart_product_id || ''
        }));
      }
    }
  }, [course.linked_package_id, packages]);

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

  const handleLessonCreatedByAi = async (chapterData: any) => {
    try {
      let currentCourseId = courseId;
      if (!currentCourseId) {
        if (!course.title) {
          toast.error('Informe o título do curso antes de adicionar aulas.');
          return;
        }
        const nextOrder = await getNextCategoryOrderIndex(!!course.is_bonus, !course.is_bonus && !!course.is_free);
        const { data: newCourse, error } = await supabase.from('courses').insert([{
          title: course.title,
          description: course.description || '',
          is_active: course.is_active !== undefined ? course.is_active : true,
          is_free: course.is_free !== undefined ? course.is_free : true,
          is_bonus: course.is_bonus || false,
          order_index: nextOrder
        }]).select().single();
        if (error) throw error;
        currentCourseId = newCourse.id;
        setCourseId(newCourse.id);
        setCourse(newCourse);
        dataCache.invalidate();
      }

      if (chapterData.id) {
        const { error: updateError } = await supabase.from('chapters').update({
          module_id: chapterData.module_id,
          title: chapterData.title,
          description: chapterData.description || '',
          content_type: chapterData.content_type || 'interactive',
          rich_text: chapterData.rich_text || '',
          duration_minutes: chapterData.duration_minutes || 15
        }).eq('id', chapterData.id);

        if (updateError) throw updateError;
        toast.success('Aula atualizada com IA!');
        setIsDirty(false);
        fetchCourseData();
        return;
      }

      const { data: newChapter, error: chapterError } = await supabase.from('chapters').insert([{
        module_id: chapterData.module_id,
        title: chapterData.title,
        description: chapterData.description || '',
        content_type: chapterData.content_type || 'interactive',
        rich_text: chapterData.rich_text || '',
        duration_minutes: chapterData.duration_minutes || 15,
        order_index: chapters.length,
        is_preview: false
      }]).select().single();

      if (chapterError) throw chapterError;

      toast.success('Aula criada com IA e adicionada!');
      setIsDirty(false);
      fetchCourseData();
    } catch (err: any) {
      console.error('Erro ao salvar aula gerada por IA:', err);
      toast.error('Erro ao salvar aula da IA: ' + err.message);
    }
  };

  const handleSaveCourse = async (confirmed: boolean = false) => {
    if (!course.title) {
      toast.error('O título do curso é obrigatório');
      return;
    }

    // Auto-save active editing chapter draft if user is currently editing a lesson
    if (selectedChapterId === 'new' && editingChapter.title) {
      try {
        await handleSaveChapter();
      } catch (e) {
        console.warn('Auto-save chapter draft failed:', e);
      }
    } else if (editingExistingChapter && editingExistingChapter.title) {
      try {
        await handleSaveExistingChapter();
      } catch (e) {
        console.warn('Auto-save existing chapter failed:', e);
      }
    }

    const isIndividualPaid = !course.is_free && !course.is_bonus && !course.is_package_exclusive_bonus;
    const finalHotmartId = isIndividualPaid ? (course.hotmart_product_id?.trim() || null) : null;
    const finalCheckoutUrl = isIndividualPaid ? (course.checkout_url?.trim() || null) : null;

    if (isIndividualPaid && !finalHotmartId && !confirmed) {
      setShowMissingHotmartModal(true);
      return;
    }

    try {
      setSaving(true);

      let targetOrderIndex = course.order_index ?? 0;
      if (!courseId) {
        targetOrderIndex = await getNextCategoryOrderIndex(!!course.is_bonus, !course.is_bonus && !!course.is_free);
      }

      const courseData = {
        title: course.title,
        description: course.description || '',
        cover_url: course.cover_url,
        is_active: course.is_active,
        is_free: course.is_free,
        is_bonus: course.is_bonus,
        price: (course.is_free || course.is_bonus) ? 0 : course.price,
        old_price: course.old_price || 0,
        subtitle: course.subtitle || '',
        benefits: (course.benefits || []).filter(b => b.trim() !== ''),
        cta_text: course.cta_text || '',
        preview_url: course.preview_url || '',
        preview_text: course.preview_text || '',
        preview_enabled: course.preview_enabled || false,
        premium_cover_url: course.premium_cover_url || '',
        premium_badge_text: course.premium_badge_text || '',
        offer_badge_text: course.offer_badge_text || '',
        social_proof: course.social_proof || '',
        show_lifetime_badge: course.show_lifetime_badge !== undefined ? course.show_lifetime_badge : true,
        lifetime_badge_text: course.lifetime_badge_text || '',
        payment_label_text: course.payment_label_text || '',
        secure_payment_label: course.secure_payment_label || '',
        instant_access_label: course.instant_access_label || '',
        preview_rating: course.preview_rating || '',
        preview_students_label: course.preview_students_label || '',
        preview_students_tag: course.preview_students_tag || '',
        preview_guarantee_label: course.preview_guarantee_label || '',
        preview_risk_zero_label: course.preview_risk_zero_label || '',
        preview_support_vip_label: course.preview_support_vip_label || '',
        preview_support_label: course.preview_support_label || '',
        preview_modules_label: course.preview_modules_label || '',
        preview_guarantee_title: course.preview_guarantee_title || '',
        preview_guarantee_subtitle: course.preview_guarantee_subtitle || '',
        preview_guarantee_description: course.preview_guarantee_description || '',
        preview_footer_cta: course.preview_footer_cta || '',
        order_index: targetOrderIndex,
        preview_bonus_title: course.preview_bonus_title || '',
        preview_title: course.preview_title || '',
        preview_subtitle: course.preview_subtitle || '',
        preview_type: course.preview_type || 'video',
        preview_video_url: course.preview_video_url || '',
        preview_pdf_url: course.preview_pdf_url || '',
        preview_rich_text: course.preview_rich_text || '',
        preview_link_text: course.preview_link_text || '',
        preview_link_url: course.preview_link_url || '',
        preview_link_color: course.preview_link_color || '#3b82f6',
        preview_show_social_proof: course.preview_show_social_proof !== undefined ? course.preview_show_social_proof : true,
        preview_show_bonus: course.preview_show_bonus !== undefined ? course.preview_show_bonus : true,
        preview_show_trust: course.preview_show_trust !== undefined ? course.preview_show_trust : true,
        checkout_url: finalCheckoutUrl,
        hotmart_product_id: finalHotmartId,
        linked_package_id: course.linked_package_id || null,
        is_package_exclusive_bonus: course.is_package_exclusive_bonus || false
      };

      if (courseId) {
        const { error } = await supabase.from('courses').update(courseData).eq('id', courseId);
        if (error) {
          if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate key')) {
            toast.error('Erro ao salvar: O ID do Produto Hotmart informado já está sendo utilizado por outro curso!');
            return;
          }
          throw error;
        }
        dataCache.invalidate();
        toast.success('Informações salvas!');
      } else {
        const { data, error } = await supabase.from('courses').insert([courseData]).select().single();
        if (error) {
          if (error.code === '23505' || error.message?.includes('unique') || error.message?.includes('duplicate key')) {
            toast.error('Erro ao salvar: O ID do Produto Hotmart informado já está sendo utilizado por outro curso!');
            return;
          }
          throw error;
        }
        setCourseId(data.id);
        setCourse(data);
        dataCache.invalidate();
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

        const isIndividualPaid = !course.is_free && !course.is_bonus && !course.is_package_exclusive_bonus;
        const finalHotmartId = isIndividualPaid ? (course.hotmart_product_id?.trim() || null) : null;
        const finalCheckoutUrl = isIndividualPaid ? (course.checkout_url?.trim() || null) : null;

        const nextOrder = await getNextCategoryOrderIndex(!!course.is_bonus, !course.is_bonus && !!course.is_free);

        const courseData = {
          title: course.title,
          description: course.description || '',
          cover_url: course.cover_url,
          is_active: course.is_active,
          is_free: course.is_free,
          is_bonus: course.is_bonus,
          price: (course.is_free || course.is_bonus) ? 0 : course.price,
          old_price: course.old_price || 0,
          subtitle: course.subtitle || '',
          benefits: (course.benefits || []).filter(b => b.trim() !== ''),
          cta_text: course.cta_text || '',
          preview_url: course.preview_url || '',
          preview_text: course.preview_text || '',
          preview_enabled: course.preview_enabled || false,
          premium_cover_url: course.premium_cover_url || '',
          premium_badge_text: course.premium_badge_text || '',
          offer_badge_text: course.offer_badge_text || '',
          social_proof: course.social_proof || '',
          show_lifetime_badge: course.show_lifetime_badge !== undefined ? course.show_lifetime_badge : true,
          lifetime_badge_text: course.lifetime_badge_text || '',
          payment_label_text: course.payment_label_text || '',
          secure_payment_label: course.secure_payment_label || '',
          instant_access_label: course.instant_access_label || '',
          preview_rating: course.preview_rating || '',
          preview_students_label: course.preview_students_label || '',
          preview_students_tag: course.preview_students_tag || '',
          preview_guarantee_label: course.preview_guarantee_label || '',
          preview_risk_zero_label: course.preview_risk_zero_label || '',
          preview_support_vip_label: course.preview_support_vip_label || '',
          preview_support_label: course.preview_support_label || '',
          preview_modules_label: course.preview_modules_label || '',
          preview_guarantee_title: course.preview_guarantee_title || '',
          preview_guarantee_subtitle: course.preview_guarantee_subtitle || '',
          preview_guarantee_description: course.preview_guarantee_description || '',
          preview_footer_cta: course.preview_footer_cta || '',
          order_index: nextOrder,
          preview_bonus_title: course.preview_bonus_title || '',
          preview_title: course.preview_title || '',
          preview_subtitle: course.preview_subtitle || '',
          preview_type: course.preview_type || 'video',
          preview_video_url: course.preview_video_url || '',
          preview_pdf_url: course.preview_pdf_url || '',
          preview_rich_text: course.preview_rich_text || '',
          preview_link_text: course.preview_link_text || '',
          preview_link_url: course.preview_link_url || '',
          preview_link_color: course.preview_link_color || '#3b82f6',
          preview_show_social_proof: course.preview_show_social_proof !== undefined ? course.preview_show_social_proof : true,
          preview_show_bonus: course.preview_show_bonus !== undefined ? course.preview_show_bonus : true,
          preview_show_trust: course.preview_show_trust !== undefined ? course.preview_show_trust : true,
          checkout_url: finalCheckoutUrl,
          hotmart_product_id: finalHotmartId,
          linked_package_id: course.linked_package_id || null,
          is_package_exclusive_bonus: course.is_package_exclusive_bonus || false
        };

        const { data: newCourse, error: courseError } = await supabase.from('courses').insert([courseData]).select().single();
        if (courseError) {
          if (courseError.code === '23505' || courseError.message?.includes('unique') || courseError.message?.includes('duplicate key')) {
            toast.error('Erro ao salvar: O ID do Produto Hotmart informado já está sendo utilizado por outro curso!');
            setSaving(false);
            return;
          }
          throw courseError;
        }
        
        currentCourseId = newCourse.id;
        setCourseId(newCourse.id);
        setCourse(newCourse);
        dataCache.invalidate();
        toast.success('Curso criado automaticamente!');
      }
      
      let targetModuleId = editingChapter.module_id || modules[0]?.id;
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
        button_link_text: editingChapter.button_link_text,
        button_link_url: editingChapter.button_link_url,
        button_link_color: editingChapter.button_link_color,
        cover_url: editingChapter.cover_url,
        rich_text: editingChapter.rich_text,
        duration_minutes: editingChapter.duration_minutes,
        order_index: editingChapter.id ? editingChapter.order_index : chapters.length
      };

      if (editingChapter.id) {
        const { error } = await supabase.from('chapters').update(lessonData).eq('id', editingChapter.id);
        if (error) throw error;
        if (editingChapter.content_type === 'checklist' && newChecklist) {
          await saveChecklistToDatabase(editingChapter.id, newChecklist);
        }
        toast.success('Aula atualizada!');
      } else {
        const { data: newChapter, error } = await supabase.from('chapters').insert([lessonData]).select().single();
        if (error) throw error;
        if (editingChapter.content_type === 'checklist' && newChapter) {
          await saveChecklistToDatabase(newChapter.id, newChecklist);
        }
        setChapters([...chapters, newChapter]);
        toast.success('Aula adicionada!');
      }
      
      setIsDirty(false);
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

  const handleSaveExistingChapter = async () => {
    if (!editingExistingChapter) return;
    if (!editingExistingChapter.title) {
      toast.error('O título da aula é obrigatório');
      return;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from('chapters')
        .update({
          title: editingExistingChapter.title,
          description: editingExistingChapter.description || '',
          content_type: editingExistingChapter.content_type,
          video_url: editingExistingChapter.video_url || '',
          pdf_url: editingExistingChapter.pdf_url || '',
          button_link_text: editingExistingChapter.button_link_text || '',
          button_link_url: editingExistingChapter.button_link_url || '',
          button_link_color: editingExistingChapter.button_link_color || '#10b981',
          cover_url: editingExistingChapter.cover_url || '',
          rich_text: editingExistingChapter.rich_text || '',
          duration_minutes: editingExistingChapter.duration_minutes || 0,
          module_id: editingExistingChapter.module_id || null
        })
        .eq('id', editingExistingChapter.id);

      if (error) throw error;
      if (editingExistingChapter.content_type === 'checklist' && editingChecklist) {
        await saveChecklistToDatabase(editingExistingChapter.id, editingChecklist);
      }
      toast.success('Aula atualizada com sucesso!');
      setIsDirty(false);
      setSelectedChapterId(null);
      fetchCourseData();
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao salvar aula: ' + err.message);
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

  if (loading) return <div className="fixed inset-0 bg-bg-main flex items-center justify-center z-50"><GlowingSpinner size="lg" /></div>;

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

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsAiCourseModalOpen(true)}
            className="bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
          >
            <Sparkles size={16} />
            <span className="hidden sm:inline">CRIAR COPY COM IA (ALTA CONVERSÃO)</span>
            <span className="sm:hidden">COPY IA</span>
          </button>
          <button 
            onClick={() => handleSaveCourse(false)}
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                  <Settings size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Configurações do Curso</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Informações da Home e Card de Vendas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiCourseModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all shadow-md shadow-amber-500/10 active:scale-95 self-start sm:self-auto cursor-pointer"
              >
                <Sparkles size={14} className="text-amber-400" />
                Gerar Textos de Venda com IA
              </button>
            </div>

            {/* AI Banner Callout */}
            <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-transparent border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-400 to-rose-500 flex items-center justify-center text-black shadow-lg shadow-amber-500/20 shrink-0">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    Criador de Copywriting com IA (Acelere sua Evolução & Preview)
                    <span className="text-[9px] uppercase tracking-wider font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      CRO Máximo
                    </span>
                  </h4>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Gere promessas magnéticas, benefícios irresistíveis, badges e a carta de vendas de alta conversão. (Fotos são inseridas manualmente).
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAiCourseModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shrink-0 transition-all shadow-md shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <Sparkles size={15} />
                Gerar com IA
              </button>
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

                  <div className="grid md:grid-cols-1 gap-6">
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
                    
                    {/* Canva Guide Card */}
                    <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-2xl p-4 text-center space-y-1.5 shadow-md">
                      <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                        🎨 Resolução Ideal no Canva
                      </p>
                      <p className="text-xs text-gray-200 font-semibold">
                        Tamanho de <span className="text-blue-300 font-black">1080 x 1440 px</span> (Proporção 3:4)
                      </p>
                    </div>

                    <div 
                      onClick={() => {
                        if (!course.cover_url) {
                          toast.error("Por favor, cole a URL da imagem no campo abaixo primeiro antes de ajustar.");
                          return;
                        }
                        setCropperType('standard');
                        setCropperAspect(3/4);
                        setCropperOpen(true);
                      }}
                      className="aspect-[3/4] rounded-3xl border-2 border-dashed border-white/10 overflow-hidden relative bg-black group/cover cursor-pointer hover:border-blue-500/50 transition-all shadow-xl"
                    >
                      {course.cover_url ? (
                        <img src={course.cover_url} className="w-full h-full object-cover transition-transform duration-700 group-hover/cover:scale-110" alt="Capa" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 p-6 text-center">
                          <ImageIcon className="mb-3 opacity-20" size={44} />
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Capa do Curso</span>
                          <span className="text-[9px] font-medium opacity-30 leading-normal max-w-[200px]">Cole a URL da imagem abaixo para habilitar o ajuste e visualização</span>
                        </div>
                      )}
                      
                      {course.cover_url && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/cover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                          <p className="text-[10px] font-black text-white uppercase tracking-widest bg-blue-600/80 px-4 py-2 rounded-xl">Recortar & Ajustar Capa</p>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (!course.cover_url) {
                            toast.error("Por favor, cole a URL da imagem no campo abaixo primeiro antes de ajustar.");
                            return;
                          }
                          setCropperType('standard');
                          setCropperAspect(3/4);
                          setCropperOpen(true);
                        }}
                        className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                          course.cover_url 
                            ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20' 
                            : 'bg-white/[0.02] text-gray-600 border-white/5 cursor-not-allowed'
                        }`}
                      >
                        <ImageIcon size={14} /> Recortar / Ajustar Capa
                      </button>
                    </div>
                    <div className="relative group/url">
                      <input 
                        type="text" 
                        value={course.cover_url || ''}
                        onChange={e => setCourse({...course, cover_url: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-[10px] text-gray-400 focus:border-blue-500 outline-none transition-all font-mono"
                        placeholder="Cole a URL direta da imagem aqui para visualizar e ajustar..."
                      />
                    </div>
                  </div>

                  <div className="p-6 bg-blue-500/5 rounded-[32px] border border-blue-500/10 space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-500 text-center">Configurações de Venda</h4>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => setCourse({...course, is_free: true, is_bonus: false})}
                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border ${course.is_free && !course.is_bonus ? 'bg-blue-600 border-blue-600 text-white' : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'}`}
                      >
                        PRODUTO PRINCIPAL (LIBERADO)
                      </button>
                      <button 
                        onClick={() => setCourse({...course, is_free: false, is_bonus: true})}
                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border ${course.is_bonus ? 'bg-purple-600 border-purple-600 text-white' : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'}`}
                      >
                        BÔNUS
                      </button>
                      <button 
                        onClick={() => setCourse({...course, is_free: false, is_bonus: false})}
                        className={`w-full py-3 rounded-xl text-[10px] font-black transition-all border ${!course.is_free && !course.is_bonus ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-black/20 border-white/5 text-gray-600 hover:text-gray-400'}`}
                      >
                        PAGO
                      </button>
                    </div>

                    {(course.is_bonus || (!course.is_free && !course.is_bonus)) && (
                      <div className={`mt-4 p-4 rounded-2xl border animate-in fade-in zoom-in-95 duration-300 ${course.is_bonus ? 'bg-purple-500/5 border-purple-500/10' : 'bg-emerald-500/5 border-emerald-500/10'}`}>
                        <label className="flex items-center gap-3 cursor-pointer group">
                          <button 
                            type="button"
                            onClick={() => setCourse({...course, is_package_exclusive_bonus: !course.is_package_exclusive_bonus})}
                            className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${course.is_package_exclusive_bonus ? (course.is_bonus ? 'bg-purple-600' : 'bg-emerald-600') : 'bg-black/40 border border-white/10'}`}
                          >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${course.is_package_exclusive_bonus ? 'left-5' : 'left-1'}`} />
                          </button>
                          <div className="flex flex-col">
                            <span className="text-[9px] font-black text-white uppercase tracking-widest">Bloquear curso, liberação somente por pacote</span>
                            <span className="text-[7px] text-gray-500 uppercase font-black">Será invisível para alunos até que comprem o pacote vinculado</span>
                          </div>
                        </label>
                      </div>
                    )}

                      {!course.is_free && !course.is_bonus && (
                        <div className="mt-4 space-y-4 animate-in fade-in zoom-in-95 duration-300">
                           <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                              <label className="text-[9px] font-black text-emerald-500 uppercase tracking-widest ml-1 mb-2 block">Modalidade de Liberação</label>
                              <div className="flex gap-2">
                                 <button 
                                   type="button"
                                   onClick={() => setCourse({...course, linked_package_id: '', is_package_exclusive_bonus: false})}
                                   className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all border ${!course.is_package_exclusive_bonus ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-black/20 border-white/5 text-gray-500'}`}
                                 >
                                   INDIVIDUAL
                                 </button>
                                 <button 
                                   type="button"
                                   onClick={() => setCourse({...course, linked_package_id: '', is_package_exclusive_bonus: true})}
                                   className={`flex-1 py-2 rounded-lg text-[9px] font-black transition-all border ${course.is_package_exclusive_bonus ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-black/20 border-white/5 text-gray-500'}`}
                                 >
                                   PACOTE
                                 </button>
                              </div>
                           </div>
                        </div>
                      )}
                    {!course.is_bonus && !course.is_package_exclusive_bonus && (
                      <div className="space-y-4 pt-2 animate-in fade-in zoom-in-95 duration-300">
                        {course.is_free ? (
                          <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 space-y-2 text-center">
                            <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest block">🎯 Configuração Global Ativa</span>
                            <p className="text-[8px] text-gray-400 uppercase font-bold tracking-wider leading-relaxed">
                              Este curso se comporta como um Produto Principal. O ID do produto da Hotmart, o preço e o link do checkout são definidos de forma ÚNICA no Painel Administrativo ("Configurar Vendas") e se aplicam a todos os Cursos Principais cadastrados.
                            </p>
                          </div>
                        ) : (
                          <>
                            <div className="space-y-1">
                              <div className="flex justify-between items-center ml-1">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Preço (R$)</label>
                                {course.linked_package_id && course.linked_package_id !== 'locked' && <span className="text-[7px] text-emerald-500 font-black uppercase italic tracking-tighter animate-pulse">Sincronizado com Pacote</span>}
                              </div>
                              <input 
                                type="text" 
                                value={formatPrice(course.price || 0)}
                                onChange={handlePriceChange}
                                readOnly={!!course.linked_package_id && course.linked_package_id !== 'locked'}
                                className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none text-center font-bold transition-all ${(course.linked_package_id && course.linked_package_id !== 'locked') ? 'opacity-50 cursor-not-allowed' : ''}`}
                              />
                            </div>
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">Link de Check-out (Hotmart)</label>
                                <input 
                                  type="text" 
                                  value={course.checkout_url || ''}
                                  onChange={e => setCourse({...course, checkout_url: e.target.value})}
                                  readOnly={!!course.linked_package_id && course.linked_package_id !== 'locked'}
                                  className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-gray-400 focus:border-blue-500 outline-none transition-all ${(course.linked_package_id && course.linked_package_id !== 'locked') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  placeholder="Link de Check-out..."
                                />
                              </div>
                              
                              <div className="space-y-1">
                                <label className="text-[9px] font-black text-gray-600 uppercase tracking-widest ml-1">ID do Produto Hotmart (Webhook)</label>
                                <input 
                                  type="text" 
                                  value={course.hotmart_product_id || ''}
                                  onChange={e => setCourse({...course, hotmart_product_id: e.target.value})}
                                  readOnly={!!course.linked_package_id && course.linked_package_id !== 'locked'}
                                  className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-gray-400 focus:border-blue-500 outline-none transition-all font-mono ${(course.linked_package_id && course.linked_package_id !== 'locked') ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  placeholder="ID Numérico do Produto..."
                                />
                                <p className="text-[8px] text-gray-600 uppercase font-black ml-1 tracking-tighter">Utilizado para validação automática de compra via Webhook.</p>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 2: Configuração Estratégica de Venda */}
          {!course.is_free && !course.is_bonus && (
            <section className="space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-600/10 flex items-center justify-center text-amber-500 border border-amber-500/20">
                  <Sparkles size={22} />
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white leading-none">Configuração do Funil de Vendas</h3>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-1">Configure o modal de compra e a página de preview</p>
                </div>
              </div>

              {/* STEP 1: COMPRA MODAL */}
              <div className="bg-zinc-900/40 rounded-[40px] border border-white/10 p-10 space-y-10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-amber-600/5 blur-[100px] pointer-events-none group-hover:bg-amber-600/10 transition-colors" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500 text-black flex items-center justify-center font-black text-xs">1</div>
                    <div>
                      <h4 className="text-lg font-black uppercase italic tracking-tighter text-white">Configuração do Modal de Venda</h4>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Informações que aparecem ao clicar no curso bloqueado</p>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subtítulo Emocional (Modal)</label>
                      <input 
                        type="text" 
                        value={course.subtitle || ''}
                        onChange={e => setCourse({...course, subtitle: e.target.value})}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all placeholder:text-gray-700"
                        placeholder="Ex: A jornada definitiva para sua autonomia"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Benefícios / Bullets (Um por linha)</label>
                      <textarea 
                        value={course.benefits?.join('\n') || ''}
                        onChange={e => setCourse({...course, benefits: e.target.value.split('\n').filter(b => b.trim() !== '')})}
                        className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all min-h-[120px] resize-none placeholder:text-gray-700"
                        placeholder="Ex: Acesso Vitalício&#10;Suporte 24h&#10;Certificado Incluso"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto do Botão (CTA)</label>
                        <input 
                          type="text" 
                          value={course.cta_text || ''}
                          onChange={e => setCourse({...course, cta_text: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all placeholder:text-gray-700 font-bold"
                          placeholder="LIBERAR ACESSO"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Preço Antigo (Riscado)</label>
                        <input 
                          type="text" 
                          value={formatPrice(course.old_price || 0)}
                          onChange={e => {
                            const val = parseInt(e.target.value.replace(/\D/g, '')) || 0;
                            setCourse({...course, old_price: val});
                          }}
                          className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-amber-500 outline-none transition-all text-center font-bold"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Capa Personalizada para o Modal</label>
                      <div className="grid grid-cols-[120px_1fr] gap-4 bg-black/40 p-3 rounded-2xl border border-white/5">
                        <div 
                          onClick={() => {
                            setCropperType('premium');
                            setCropperAspect(16/9);
                            setCropperOpen(true);
                          }}
                          className="aspect-video rounded-xl bg-zinc-900 overflow-hidden relative border border-white/5 cursor-pointer group/premiumcover flex items-center justify-center"
                        >
                          {(course.premium_cover_url?.trim() || course.cover_url?.trim()) ? (
                            <img 
                              src={course.premium_cover_url?.trim() || course.cover_url?.trim()} 
                              className="w-full h-full object-cover transition-transform group-hover/premiumcover:scale-105" 
                              referrerPolicy="no-referrer"
                              onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/400x225?text=Preview')}
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-gray-600 p-2 text-center">
                              <ImageIcon size={20} className="opacity-30 mb-1" />
                              <span className="text-[8px] font-black uppercase text-gray-500">Sem Capa</span>
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/premiumcover:opacity-100 flex items-center justify-center transition-opacity text-[8px] font-black text-white uppercase tracking-widest text-center px-1">
                            Ajustar
                          </div>
                        </div>
                        <div className="space-y-2 flex flex-col justify-center">
                          <button
                            type="button"
                            onClick={() => {
                              setCropperType('premium');
                              setCropperAspect(16/9);
                              setCropperOpen(true);
                            }}
                            className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 border border-amber-500/20"
                          >
                            <ImageIcon size={12} /> Ajustar Capa (16:9)
                          </button>
                          <input 
                            type="text" 
                            value={course.premium_cover_url || ''}
                            onChange={e => setCourse({...course, premium_cover_url: e.target.value})}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-[10px] text-gray-400 focus:border-amber-500 outline-none font-mono"
                            placeholder="Ou digite a URL direta..."
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center block">Visualização do Modal</label>
                    <div className="bg-zinc-950 rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl relative max-w-[300px] mx-auto scale-95 origin-top">
                      <div className="relative aspect-video w-full bg-zinc-900 overflow-hidden">
                        <img 
                          src={course.premium_cover_url || course.cover_url || 'https://picsum.photos/seed/preview/800/450'} 
                          className="w-full h-full object-cover opacity-80" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-60" />
                      </div>
                      <div className="p-5 flex flex-col items-center text-center space-y-3">
                         <h4 className="text-sm font-black text-white uppercase italic tracking-tighter truncate w-full">{course.title || 'Título do Curso'}</h4>
                         <p className="text-[7px] font-bold text-gray-500 italic line-clamp-1 opacity-70 uppercase tracking-tight">{course.subtitle || 'Subtítulo do curso'}</p>
                         
                         <div className="grid grid-cols-2 gap-2 w-full py-2 border-y border-white/5">
                            {(course.benefits?.length ? course.benefits : ['Acesso Vitalício', 'Certificado']).slice(0, 4).map((b, i) => (
                              <div key={i} className="flex items-center gap-1.5 overflow-hidden text-left">
                                <Check size={6} className="text-green-500" />
                                <span className="text-[6px] font-bold text-gray-400 truncate uppercase tracking-tight">{b}</span>
                              </div>
                            ))}
                         </div>

                         <div className="text-lg font-black text-white italic tracking-tighter leading-none mt-2">{(course.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</div>
                         <div className="w-full py-2 bg-amber-500 rounded-lg text-[8px] font-black text-black uppercase tracking-[0.1em] italic">
                           {course.cta_text || 'LIBERAR ACESSO'}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* STEP 2: PÁGINA DE PREVIEW */}
              <div className="bg-zinc-900/40 rounded-[40px] border border-white/10 p-10 space-y-10 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none group-hover:bg-primary/10 transition-colors" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-black text-xs">2</div>
                    <div>
                      <h4 className="text-lg font-black uppercase italic tracking-tighter text-white">Configuração da Página de Preview</h4>
                      <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Informações detalhadas da página de venda</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsAiCourseModalOpen(true)}
                      className="h-10 px-4 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 transition-all flex items-center gap-2 font-black text-[10px] tracking-widest uppercase cursor-pointer"
                    >
                      <Sparkles size={14} className="text-amber-400" /> OTIMIZAR COPY COM IA
                    </button>
                    <button 
                      onClick={() => setCourse({...course, preview_enabled: !course.preview_enabled})}
                      className={`h-10 px-6 rounded-xl border transition-all flex items-center gap-3 font-black text-[10px] tracking-widest ${course.preview_enabled ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-white/5 border-white/10 text-gray-500'}`}
                    >
                      <PlayCircle size={16} /> {course.preview_enabled ? 'HABILITADO' : 'DESABILITADO'}
                    </button>
                  </div>
                </div>

                {course.preview_enabled && (
                  <div className="grid lg:grid-cols-2 gap-12 animate-in fade-in zoom-in-95 duration-300">
                    <div className="space-y-8">
                       {/* 1. SEÇÃO HERO */}
                       <div className="space-y-4">
                         <div className="flex items-center gap-2 mb-2">
                           <Monitor size={14} className="text-primary" />
                           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">1. Topo da Página (Hero)</span>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Headline Principal</label>
                             <input 
                               type="text" 
                               value={course.preview_title || ''}
                               onChange={e => setCourse({...course, preview_title: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all placeholder:text-gray-700"
                               placeholder="Título principal..."
                             />
                           </div>
                           <div className="space-y-2">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subheadline</label>
                             <input 
                               type="text" 
                               value={course.preview_subtitle || ''}
                               onChange={e => setCourse({...course, preview_subtitle: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all placeholder:text-gray-700"
                               placeholder="Promessa principal..."
                             />
                           </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Texto de Avaliação (Ex: 4.98 Avaliação)</label>
                            <input 
                              type="text" 
                              value={course.preview_rating || ''}
                              onChange={e => setCourse({...course, preview_rating: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                              placeholder="4.98 Avaliação"
                            />
                         </div>
                       </div>

                       {/* 2. SEÇÃO DE CONTEÚDO (MÍDIA) */}
                       <div className="space-y-4 pt-4 border-t border-white/5">
                         <div className="flex items-center gap-2 mb-2">
                           <PlayCircle size={14} className="text-primary" />
                           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">2. Conteúdo em Destaque (Mídia)</span>
                         </div>
                         <div className="flex bg-black/40 p-1 rounded-xl border border-white/5 gap-1 mb-4">
                            {(['video', 'pdf', 'link', 'text'] as const).map(type => (
                              <button
                                key={type}
                                onClick={() => setCourse({...course, preview_type: type})}
                                className={`flex-1 py-1.5 rounded-lg text-root font-black uppercase text-[8px] tracking-widest transition-all ${course.preview_type === type ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
                              >
                                {type === 'video' ? 'VÍDEO' : type === 'pdf' ? 'PDF' : type === 'link' ? 'LINK' : 'TEXTO'}
                              </button>
                            ))}
                         </div>

                         {course.preview_type === 'video' && (
                           <div className="p-6 bg-black/40 border border-white/10 rounded-2xl space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL do Vídeo (YouTube/Vimeo)</label>
                                <input 
                                  type="text" 
                                  value={course.preview_video_url || ''}
                                  onChange={e => setCourse({...course, preview_video_url: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-primary focus:border-primary outline-none transition-all font-mono"
                                  placeholder="https://youtube.com/watch?v=..."
                                />
                              </div>
                           </div>
                         )}

                         {course.preview_type === 'pdf' && (
                           <div className="p-6 bg-black/40 border border-white/10 rounded-2xl space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL do Material PDF</label>
                                <input 
                                  type="text" 
                                  value={course.preview_pdf_url || ''}
                                  onChange={e => setCourse({...course, preview_pdf_url: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-primary focus:border-primary outline-none transition-all font-mono"
                                  placeholder="https://domain.com/material.pdf"
                                />
                              </div>
                           </div>
                         )}

                         {course.preview_type === 'link' && (
                           <div className="p-6 bg-black/40 border border-white/10 rounded-2xl space-y-4">
                             <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto do Botão</label>
                                 <input 
                                   type="text" 
                                   value={course.preview_link_text || ''}
                                   onChange={e => setCourse({...course, preview_link_text: e.target.value})}
                                   className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-primary outline-none transition-all"
                                   placeholder="CLIQUE AQUI"
                                 />
                               </div>
                               <div className="space-y-2">
                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Cor do Botão</label>
                                 <input 
                                   type="color" 
                                   value={course.preview_link_color || '#3b82f6'}
                                   onChange={e => setCourse({...course, preview_link_color: e.target.value})}
                                   className="w-full bg-black/60 border border-white/10 rounded-xl h-[42px] p-1 cursor-pointer"
                                 />
                               </div>
                             </div>
                             <div className="space-y-2">
                               <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Link de Destino</label>
                               <input 
                                 type="text" 
                                 value={course.preview_link_url || ''}
                                 onChange={e => setCourse({...course, preview_link_url: e.target.value})}
                                 className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-primary outline-none transition-all font-mono"
                                 placeholder="https://..."
                                />
                             </div>
                           </div>
                         )}

                         {course.preview_type === 'text' && (
                           <div className="p-6 bg-black/40 border border-white/10 rounded-2xl animate-in fade-in slide-in-from-top-4 duration-500">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                   <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto Descritivo / HTML (Preview)</label>
                                   <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-[8px] font-black uppercase tracking-widest">Modo Texto/HTML</span>
                                </div>
                                <textarea 
                                  value={course.preview_rich_text || ''}
                                  onChange={e => setCourse({...course, preview_rich_text: e.target.value})}
                                  className="w-full bg-black/60 border border-white/10 rounded-2xl px-5 py-4 text-xs text-gray-300 focus:border-primary outline-none transition-all h-64 resize-none font-medium font-mono"
                                  placeholder="Cole aqui o texto, depoimentos ou HTML da sua página de venda..."
                                />
                              </div>
                           </div>
                         )}
                       </div>

                       {/* 3. SEÇÃO DE MÓDULOS */}
                       <div className="space-y-4 pt-4 border-t border-white/5">
                         <div className="flex items-center gap-2 mb-2">
                           <Layers size={14} className="text-primary" />
                           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">3. Seção de Módulos (Conteúdo)</span>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 italic">Título da Seção de Módulos</label>
                            <input 
                              type="text" 
                              value={course.preview_modules_label || ''}
                              onChange={e => setCourse({...course, preview_modules_label: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                              placeholder="O que te espera lá dentro"
                            />
                         </div>
                       </div>
                    </div>

                    <div className="space-y-8">
                       {/* 4. SEÇÃO STATS / PROVA SOCIAL */}
                       <div className="space-y-6">
                          <div className="flex items-center gap-2 mb-2">
                            <Users size={14} className="text-amber-500" />
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">4. Marcadores e Prova Social</span>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-4">
                             <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-3">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Bloco 1 (Total de Alunos)</span>
                                <div className="grid grid-cols-2 gap-3">
                                   <input 
                                     type="text" 
                                     value={course.preview_students_label || ''}
                                     onChange={e => setCourse({...course, preview_students_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Valor: 1.2k+"
                                   />
                                   <input 
                                     type="text" 
                                     value={course.preview_students_tag || ''}
                                     onChange={e => setCourse({...course, preview_students_tag: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Tag: Alunos"
                                   />
                                </div>
                             </div>

                             <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-3">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Bloco 2 (Configuração de Garantia)</span>
                                <div className="grid grid-cols-2 gap-3">
                                   <input 
                                     type="text" 
                                     value={course.preview_guarantee_label || ''}
                                     onChange={e => setCourse({...course, preview_guarantee_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Valor: 7 Dias"
                                   />
                                   <input 
                                     type="text" 
                                     value={course.preview_risk_zero_label || ''}
                                     onChange={e => setCourse({...course, preview_risk_zero_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Tag: Risque Zero"
                                   />
                                </div>
                             </div>

                             <div className="p-5 bg-white/5 rounded-3xl border border-white/5 space-y-3">
                                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-2">Bloco 3 (Configuração de Suporte)</span>
                                <div className="grid grid-cols-2 gap-3">
                                   <input 
                                     type="text" 
                                     value={course.preview_support_vip_label || ''}
                                     onChange={e => setCourse({...course, preview_support_vip_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Valor: 24/7"
                                   />
                                   <input 
                                     type="text" 
                                     value={course.preview_support_label || ''}
                                     onChange={e => setCourse({...course, preview_support_label: e.target.value})}
                                     className="bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-amber-500 outline-none transition-all"
                                     placeholder="Tag: Acompanhamento"
                                   />
                                </div>
                             </div>
                          </div>
                       </div>

                       {/* 5. SEÇÃO GARANTIA DETALHADA */}
                       <div className="space-y-6 pt-4 border-t border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                            <ShieldCheck size={14} className="text-emerald-500" />
                            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">5. Garantia Incondicional</span>
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Título do Selo</label>
                             <input 
                               type="text" 
                               value={course.preview_guarantee_title || ''}
                               onChange={e => setCourse({...course, preview_guarantee_title: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                               placeholder="Garantia Incondicional de 7 Dias"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Subtítulo de Satisfação</label>
                             <input 
                               type="text" 
                               value={course.preview_guarantee_subtitle || ''}
                               onChange={e => setCourse({...course, preview_guarantee_subtitle: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all"
                               placeholder="Sua satisfação ou seu dinheiro de volta"
                             />
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto de Descrição da Garantia</label>
                             <textarea 
                               value={course.preview_guarantee_description || ''}
                               onChange={e => setCourse({...course, preview_guarantee_description: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white focus:border-primary outline-none transition-all h-24 resize-none"
                               placeholder="Eu tiro todo o risco das suas costas..."
                             />
                          </div>
                       </div>

                       {/* 6. SEÇÃO RODAPÉ / CTA FINAL */}
                       <div className="space-y-6 pt-4 border-t border-white/5">
                          <div className="flex items-center gap-2 mb-2">
                             <Sparkles size={14} className="text-primary" />
                             <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">6. Rodapé e Oferta Final</span>
                          </div>
                          <div className="space-y-3">
                             <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Frase de Oferta Final (Acima do Botão)</label>
                             <input 
                               type="text" 
                               value={course.preview_footer_cta || ''}
                               onChange={e => setCourse({...course, preview_footer_cta: e.target.value})}
                               className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white focus:border-primary outline-none transition-all italic font-bold"
                               placeholder="Ex: Aproveite as condições especiais de lançamento"
                             />
                          </div>

                          <div className="grid grid-cols-2 gap-4 mt-6">
                             <button
                               onClick={() => setCourse({...course, preview_show_social_proof: course.preview_show_social_proof === false ? true : false})}
                               className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${course.preview_show_social_proof !== false ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' : 'bg-white/5 border-white/5 text-zinc-600'}`}
                             >
                               <Users size={16} />
                               <span className="text-[8px] font-black uppercase tracking-widest">Prova Social</span>
                             </button>
                             <button
                               onClick={() => setCourse({...course, preview_show_trust: !course.preview_show_trust})}
                               className={`p-4 rounded-2xl border transition-all flex flex-col items-center gap-2 ${course.preview_show_trust !== false ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-white/5 border-white/5 text-zinc-600'}`}
                             >
                               <ShieldCheck size={16} />
                               <span className="text-[8px] font-black uppercase tracking-widest">Selo Confiança</span>
                             </button>
                             <button
                                onClick={() => setShowLivePreview(true)}
                                className="p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-white transition-all flex flex-col items-center gap-2 group md:col-span-2"
                              >
                               <Monitor size={16} className="text-gray-400 group-hover:text-primary transition-colors" />
                               <span className="text-[8px] font-black uppercase tracking-widest text-gray-500 group-hover:text-white">Abrir Visualizador de Preview</span>
                             </button>
                          </div>
                       </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Section 3: Lessons List */}

          {/* Section 3: Lessons List */}
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200">
                <div className="flex lg:flex-row flex-col lg:items-center gap-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600/10 flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                      <Play size={22} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black uppercase tracking-tighter italic text-white">Conteúdo das Aulas</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total de {chapters.length} aulas em {modules.length} módulos</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      type="button"
                      onClick={() => setIsAiModalOpen(true)}
                      className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black px-6 py-3 rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-xl shadow-emerald-500/20 hover:scale-105 active:scale-95 border border-emerald-400/30"
                    >
                      <Sparkles size={18} /> ✨ CRIAR AULA COM IA
                    </button>

                    <button 
                      onClick={() => {
                        setEditingModule({ title: '' });
                        setShowModuleEditor(true);
                      }}
                      className="bg-white/5 hover:bg-white/10 text-white px-6 py-3 rounded-2xl font-black text-[10px] flex items-center gap-2 transition-all border border-white/10 tracking-widest"
                    >
                      <Layers size={16} /> GERENCIAR MÓDULOS
                    </button>
                    
                    <button 
                      onClick={() => {
                        setEditingChapter({ title: '', content_type: 'video', description: '', video_url: '', pdf_url: '', cover_url: '', duration_minutes: 0, module_id: modules[0]?.id });
                        setSelectedChapterId('new');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-2xl font-black text-xs flex items-center gap-2 transition-all shadow-xl shadow-emerald-900/40 hover:scale-105 active:scale-95"
                    >
                      <PlusCircle size={18} /> ADICIONAR NOVA AULA
                    </button>
                  </div>
                </div>

                <div className="bg-white/5 rounded-[40px] border border-white/10 p-10 space-y-12 shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-600/5 blur-[100px] pointer-events-none group-hover:bg-emerald-600/10 transition-colors" />
                  
                  <div className="space-y-12 relative z-10">
              {/* Module Editor Modal */}
              <AnimatePresence>
                {showModuleEditor && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm"
                  >
                    <motion.div 
                      initial={{ scale: 0.9, y: 20 }}
                      animate={{ scale: 1, y: 0 }}
                      exit={{ scale: 0.9, y: 20 }}
                      className="w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[40px] p-10 overflow-hidden relative"
                    >
                      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] pointer-events-none" />
                      
                      <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center text-blue-500 border border-blue-500/20">
                            <Layers size={20} />
                          </div>
                          <h3 className="text-xl font-black uppercase tracking-tighter italic text-white font-serif">Gerenciar Módulos</h3>
                        </div>
                        <button onClick={() => setShowModuleEditor(false)} className="text-gray-500 hover:text-white transition-colors">
                          <X size={24} />
                        </button>
                      </div>

                      <div className="space-y-6 max-h-[60vh] overflow-y-auto px-1 scrollbar-hide">
                        <div className="space-y-6">
                        {modules.map((mod, idx) => (
                          <div key={mod.id} className="flex items-center gap-4 group">
                            <div className="flex-1 space-y-2">
                               <input 
                                 type="text" 
                                 defaultValue={mod.title}
                                 onBlur={async (e) => {
                                   if (e.target.value !== mod.title) {
                                      await supabase.from('modules').update({ title: e.target.value }).eq('id', mod.id);
                                      fetchCourseData();
                                      toast.success('Módulo atualizado');
                                   }
                                 }}
                                 className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm font-bold text-white focus:border-blue-500 outline-none transition-all"
                               />
                            </div>
                            <button 
                              onClick={() => {
                                if (chapters.some(c => c.module_id === mod.id)) {
                                  toast.error('Não é possível excluir um módulo que contém aulas.');
                                  return;
                                }
                                setDeleteModal({
                                  isOpen: true,
                                  title: 'Excluir Módulo',
                                  message: `Tem certeza que deseja excluir o módulo "${mod.title}"? Esta ação não pode ser desfeita.`,
                                  onConfirm: async () => {
                                    await supabase.from('modules').delete().eq('id', mod.id);
                                    fetchCourseData();
                                    toast.success('Módulo excluído');
                                  }
                                });
                              }}
                              className="p-3 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        ))}

                        <div className="pt-4 border-t border-white/5">
                           <div className="flex items-center gap-4">
                             <input 
                               type="text" 
                               value={editingModule.title}
                               onChange={e => setEditingModule({ title: e.target.value })}
                               className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all font-bold"
                               placeholder="Nome do Novo Módulo..."
                               onKeyDown={async (e) => {
                                 if (e.key === 'Enter' && editingModule.title) {
                                   if (!courseId) {
                                      toast.error('Salve o curso antes de criar módulos');
                                      return;
                                   }
                                   await supabase.from('modules').insert([{ course_id: courseId, title: editingModule.title, order_index: modules.length }]);
                                   setEditingModule({ title: '' });
                                   fetchCourseData();
                                   toast.success('Módulo criado');
                                 }
                               }}
                             />
                             <button 
                               onClick={async () => {
                                 if (!editingModule.title) return;
                                 if (!courseId) {
                                    toast.error('Salve o curso antes de criar módulos');
                                    return;
                                 }
                                 await supabase.from('modules').insert([{ course_id: courseId, title: editingModule.title, order_index: modules.length }]);
                                 setEditingModule({ title: '' });
                                 fetchCourseData();
                                 toast.success('Módulo criado');
                               }}
                               className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-all shadow-lg"
                             >
                                <Plus size={20} />
                              </button>
                            </div>
                        </div>

                           <div className="pt-8 border-t border-white/5 space-y-8">
                              <div className="flex items-center gap-2">
                                <Sparkles size={14} className="text-amber-500 font-black" />
                                <h6 className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">Personalização da Página de Preview</h6>
                              </div>

                              <div className="space-y-10">
                                <p className="text-[10px] text-zinc-600 italic uppercase font-bold tracking-widest text-center py-10">Use a seção principal para personalizar sua página de preview.</p>
                              </div>
                           </div>
                        </div>
                      </div>

                      <div className="mt-8 pt-8 border-t border-white/10 flex justify-end gap-4">
                        <button onClick={() => setShowModuleEditor(false)} className="px-8 py-3 bg-white hover:bg-gray-100 text-black font-black rounded-xl text-xs transition-all uppercase tracking-widest">
                          Concluir
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Course Preview Modal */}
              <AnimatePresence>
                {showLivePreview && (
                  <CoursePreviewViewer 
                    course={course as Course} 
                    onClose={() => setShowLivePreview(false)} 
                    onPurchase={() => toast.info('Este é apenas um preview')}
                  />
                )}
              </AnimatePresence>

              <div className="space-y-12">
                {/* Add New Lesson Logic or Existing Lessons list */}
              {selectedChapterId === 'new' && (
                 <div className="bg-emerald-600/5 rounded-[40px] border border-emerald-500/20 p-10 space-y-8 shadow-2xl relative animate-in zoom-in-95 slide-in-from-top-4 duration-300 overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-[60px] pointer-events-none" />
                    <div className="flex items-center justify-between relative z-10">
                      <h4 className="text-xl font-black uppercase tracking-tighter italic text-emerald-500">Configurando Nova Aula</h4>
                      <button onClick={() => setSelectedChapterId(null)} className="text-gray-500 hover:text-white transition-colors"><X size={24} /></button>
                    </div>
                    
                    <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
                      <div className="space-y-6">
                        <div className="grid sm:grid-cols-2 gap-6">
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
                          
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Selecionar Módulo</label>
                            <div className="relative group z-30">
                              <button
                                type="button"
                                onClick={() => setIsModuleDropdownOpen(!isModuleDropdownOpen)}
                                className="w-full h-[68px] bg-black/40 border border-white/10 rounded-2xl pl-6 pr-12 text-xs font-bold text-white flex items-center justify-between outline-none transition-all group-hover:border-white/20 uppercase tracking-widest cursor-pointer text-left"
                              >
                                <span className="truncate">
                                  {editingChapter.module_id 
                                    ? (modules.find(m => m.id === editingChapter.module_id)?.title || 'Sem Módulo (Global)')
                                    : 'Sem Módulo (Global)'}
                                </span>
                                <div className="absolute right-5 pointer-events-none text-gray-400 group-hover:text-gray-200 transition-colors">
                                  <ChevronDown size={18} className={`transform transition-transform duration-200 ${isModuleDropdownOpen ? 'rotate-180' : ''}`} />
                                </div>
                              </button>

                              <AnimatePresence>
                                {isModuleDropdownOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsModuleDropdownOpen(false)} />
                                    <motion.div
                                      initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                      transition={{ duration: 0.15 }}
                                      className="absolute left-0 right-0 mt-2 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 max-h-[250px] overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10 py-1"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingChapter({...editingChapter, module_id: ''});
                                          setIsModuleDropdownOpen(false);
                                        }}
                                        className="w-full px-6 py-4 text-xs font-bold text-left transition-colors cursor-pointer hover:bg-white/5 flex items-center justify-between uppercase tracking-widest text-white"
                                      >
                                        <span className={!editingChapter.module_id ? "text-emerald-500" : "text-gray-300"}>Sem Módulo (Global)</span>
                                        {!editingChapter.module_id && <Check size={14} className="text-emerald-500" />}
                                      </button>
                                      {modules.map(m => (
                                        <button
                                          key={m.id}
                                          type="button"
                                          onClick={() => {
                                            setEditingChapter({...editingChapter, module_id: m.id});
                                            setIsModuleDropdownOpen(false);
                                          }}
                                          className="w-full px-6 py-4 text-xs font-bold text-left transition-colors cursor-pointer hover:bg-white/5 flex items-center justify-between uppercase tracking-widest text-white"
                                        >
                                          <span className={editingChapter.module_id === m.id ? "text-emerald-500" : "text-gray-300"}>{m.title}</span>
                                          {editingChapter.module_id === m.id && <Check size={14} className="text-emerald-500" />}
                                        </button>
                                      ))}
                                    </motion.div>
                                  </>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tipo da Aula</label>
                            <div className="flex p-1 bg-black/60 rounded-xl border border-white/5 overflow-x-auto">
                              {['video', 'pdf', 'link', 'checklist', 'interactive'].map((type) => (
                                <button 
                                  key={type}
                                  type="button"
                                  onClick={() => setEditingChapter({...editingChapter, content_type: type as any})}
                                  className={`flex-1 py-3 px-2 rounded-lg text-[9px] sm:text-[10px] font-black transition-all uppercase whitespace-nowrap ${editingChapter.content_type === type ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}
                                >
                                  {type === 'link' ? 'BOTAO' : type === 'interactive' ? 'IA' : type}
                                </button>
                              ))}
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

                        {editingChapter.content_type === 'checklist' ? (
                          <div className="pt-2 w-full">
                            <AdminChecklistEditor
                              checklist={newChecklist}
                              onChange={setNewChecklist}
                            />
                          </div>
                        ) : editingChapter.content_type !== 'link' ? (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                              {editingChapter.content_type === 'video' ? 'URL do Vídeo' : 'URL do PDF'}
                            </label>
                            <input 
                              type="text" 
                              value={editingChapter.content_type === 'video' ? (editingChapter.video_url || '') : (editingChapter.pdf_url || '')}
                              onChange={e => setEditingChapter({...editingChapter, [editingChapter.content_type === 'video' ? 'video_url' : 'pdf_url']: e.target.value})}
                              className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-gray-800"
                              placeholder={editingChapter.content_type === 'video' ? "https://youtube.com/..." : "https://drive.google.com/..."}
                            />
                          </div>
                        ) : (() => {
                          const [newChapterColor, newChapterStyle] = (editingChapter.button_link_color || '#10b981').split('|');
                          return (
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2 col-span-2 sm:col-span-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto do Botão</label>
                                <input 
                                  type="text" 
                                  value={editingChapter.button_link_text || ''}
                                  onChange={e => setEditingChapter({...editingChapter, button_link_text: e.target.value})}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-gray-600"
                                  placeholder="Ex: Acessar Material Externo"
                                />
                              </div>
                              <div className="space-y-2 col-span-2 sm:col-span-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL do Link</label>
                                <input 
                                  type="text" 
                                  value={editingChapter.button_link_url || ''}
                                  onChange={e => setEditingChapter({...editingChapter, button_link_url: e.target.value})}
                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all placeholder:text-gray-600"
                                  placeholder="https://..."
                                />
                              </div>

                              <div className="col-span-2 border-t border-white/5 my-2 pt-4">
                                <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest ml-1">Aparência do Botão</span>
                              </div>

                              <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Cor do Botão</label>
                                <div className="flex gap-2">
                                  <input 
                                    type="color" 
                                    value={newChapterColor}
                                    onChange={e => setEditingChapter({...editingChapter, button_link_color: `${e.target.value}|${newChapterStyle || 'filled'}`})}
                                    className="w-14 h-[52px] bg-black/40 border border-white/10 rounded-2xl p-1.5 cursor-pointer focus:border-emerald-500 outline-none transition-all shrink-0 hover:border-white/20"
                                  />
                                  <input 
                                    type="text" 
                                    value={newChapterColor}
                                    onChange={e => setEditingChapter({...editingChapter, button_link_color: `${e.target.value}|${newChapterStyle || 'filled'}`})}
                                    className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-white focus:border-emerald-500 outline-none transition-all font-mono"
                                    placeholder="#10b981"
                                  />
                                </div>
                              </div>

                              <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Estilo do Botão</label>
                                <div className="relative group z-20">
                                  <button
                                    type="button"
                                    onClick={() => setIsStyleDropdownOpen(!isStyleDropdownOpen)}
                                    className="w-full h-[52px] bg-black/40 border border-white/10 rounded-2xl pl-6 pr-12 text-sm font-medium text-white flex items-center justify-between outline-none transition-all group-hover:border-white/20 cursor-pointer text-left"
                                  >
                                    <span>
                                      {newChapterStyle === 'outline' && 'Contornado (Outline)'}
                                      {newChapterStyle === 'glow' && 'Brilhante (Neon Glow)'}
                                      {newChapterStyle === 'gradient' && 'Degradê (Gradient)'}
                                      {(newChapterStyle === 'filled' || !newChapterStyle) && 'Preenchido (Solid)'}
                                    </span>
                                    <div className="absolute right-5 pointer-events-none text-gray-400 group-hover:text-gray-200 transition-colors">
                                      <ChevronDown size={18} className={`transform transition-transform duration-200 ${isStyleDropdownOpen ? 'rotate-180' : ''}`} />
                                    </div>
                                  </button>

                                  <AnimatePresence>
                                    {isStyleDropdownOpen && (
                                      <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsStyleDropdownOpen(false)} />
                                        <motion.div
                                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                          animate={{ opacity: 1, y: 0, scale: 1 }}
                                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                          transition={{ duration: 0.15 }}
                                          className="absolute left-0 right-0 mt-2 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 divide-y divide-white/5 py-1"
                                        >
                                          {[
                                            { value: 'filled', label: 'Preenchido (Solid)' },
                                            { value: 'outline', label: 'Contornado (Outline)' },
                                            { value: 'glow', label: 'Brilhante (Neon Glow)' },
                                            { value: 'gradient', label: 'Degradê (Gradient)' }
                                          ].map(item => (
                                            <button
                                              key={item.value}
                                              type="button"
                                              onClick={() => {
                                                setEditingChapter({...editingChapter, button_link_color: `${newChapterColor || '#10b981'}|${item.value}`});
                                                setIsStyleDropdownOpen(false);
                                              }}
                                              className="w-full px-6 py-4 text-xs font-bold text-left transition-colors cursor-pointer hover:bg-white/5 flex items-center justify-between uppercase tracking-widest text-white"
                                            >
                                              <span className={(newChapterStyle === item.value || (!newChapterStyle && item.value === 'filled')) ? "text-emerald-500" : "text-gray-300"}>
                                                {item.label}
                                              </span>
                                              {(newChapterStyle === item.value || (!newChapterStyle && item.value === 'filled')) && (
                                                <Check size={14} className="text-emerald-500" />
                                              )}
                                            </button>
                                          ))}
                                        </motion.div>
                                      </>
                                    )}
                                  </AnimatePresence>
                                </div>
                              </div>

                              <div className="space-y-2 col-span-2">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Visualização em Tempo Real</label>
                                <div className="w-full bg-black/20 border border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[120px] relative overflow-hidden">
                                  <div 
                                    className="absolute w-24 h-24 rounded-full blur-[40px] opacity-10 pointer-events-none transition-colors duration-500"
                                    style={{ backgroundColor: newChapterColor }}
                                  />
                                  <div className="relative z-10 w-full flex justify-center">
                                    <button
                                      type="button"
                                      style={getButtonStyle(newChapterColor, newChapterStyle)}
                                      className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 shadow-xl cursor-default"
                                    >
                                      <span>{editingChapter.button_link_text || 'Acessar Conteúdo'}</span>
                                      <Link size={14} />
                                    </button>
                                  </div>
                                  <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mt-4">
                                    Como o aluno verá na plataforma
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

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

                      {/* Capa da Aula Card - Centered Below */}
                      <div className="bg-black/30 border border-white/10 rounded-3xl p-6 space-y-4 max-w-xl mx-auto w-full">
                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest text-center block">Capa da Aula (Thumb)</label>
                        
                        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20 rounded-2xl p-4 text-center space-y-1.5 shadow-md">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                            🎨 Resolução Ideal no Canva
                          </p>
                          <p className="text-xs text-gray-200 font-semibold">
                            Tamanho de <span className="text-emerald-300 font-black">1080 x 1080 px</span> (Proporção 1:1 Quadrada)
                          </p>
                        </div>

                        <div 
                          onClick={() => {
                            if (!editingChapter.cover_url) {
                              toast.error("Por favor, cole a URL da imagem no campo abaixo primeiro antes de ajustar.");
                              return;
                            }
                            setCropperType('chapter');
                            setCropperAspect(1);
                            setCropperOpen(true);
                          }}
                          className="aspect-square max-w-[240px] mx-auto rounded-2xl border border-white/10 overflow-hidden relative bg-black group/lessonaura cursor-pointer hover:border-emerald-500/50 transition-all shadow-lg"
                        >
                          {editingChapter.cover_url ? (
                            <img src={editingChapter.cover_url} className="w-full h-full object-cover transition-transform group-hover/lessonaura:scale-105" alt="Thumb" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 p-6 text-center">
                              <ImageIcon className="mb-3 opacity-20" size={32} />
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Capa da Aula</span>
                              <span className="text-[9px] font-medium opacity-30 leading-normal max-w-[200px]">Cole a URL da imagem abaixo para habilitar o ajuste</span>
                            </div>
                          )}
                          {editingChapter.cover_url && (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/lessonaura:opacity-100 flex items-center justify-center transition-opacity">
                              <span className="text-[9px] font-black text-white uppercase tracking-widest bg-emerald-600/80 px-3 py-1.5 rounded-lg">Ajustar Capa (1:1)</span>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            if (!editingChapter.cover_url) {
                              toast.error("Por favor, cole a URL da imagem no campo abaixo primeiro antes de ajustar.");
                              return;
                            }
                            setCropperType('chapter');
                            setCropperAspect(1);
                            setCropperOpen(true);
                          }}
                          className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                            editingChapter.cover_url 
                              ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20' 
                              : 'bg-white/[0.02] text-gray-600 border-white/5 cursor-not-allowed'
                          }`}
                        >
                          <ImageIcon size={14} /> Recortar / Ajustar Thumbnail
                        </button>

                        <input 
                          type="text" 
                          value={editingChapter.cover_url || ''}
                          onChange={e => setEditingChapter({...editingChapter, cover_url: e.target.value})}
                          className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-gray-400 focus:border-emerald-500 outline-none transition-all font-mono"
                          placeholder="Cole a URL direta da imagem aqui para visualizar e ajustar..."
                        />
                      </div>

                      <button 
                        onClick={handleSaveChapter}
                        disabled={saving}
                        className="w-full max-w-xl mx-auto bg-emerald-600 hover:bg-emerald-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-emerald-900/20 active:scale-95"
                      >
                        {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                        CRIAR ESTA AULA
                      </button>
                    </div>
                 </div>
              )}

              {/* Modules & Chapters List */}
              <div className="space-y-16">
                {(modules.length > 0 ? modules : [{ id: 'none', title: 'Aulas Globais' }]).map((module, mIdx) => {
                  const moduleChapters = chapters.filter(c => module.id === 'none' ? !c.module_id : c.module_id === module.id);
                  if (moduleChapters.length === 0 && module.id === 'none' && modules.length > 0) return null;

                  return (
                    <div key={module.id} className="space-y-6">
                      <div className="flex items-center gap-4 border-b border-white/5 pb-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-500">
                          <Layers size={14} />
                        </div>
                        <h4 className="text-sm font-black uppercase tracking-widest text-white italic">{module.title === 'Conteúdo' ? 'CONTEÚDO PRINCIPAL' : module.title}</h4>
                        <span className="text-[10px] font-bold text-gray-500 ml-auto">{moduleChapters.length} AULAS</span>
                      </div>

                      <div className="space-y-4">
                        {moduleChapters.map((ch, idx) => {
                          const isExpanded = selectedChapterId === ch.id;
                          
                          return (
                            <div 
                              key={ch.id} 
                              className={`bg-white/5 rounded-[32px] border transition-all duration-500 overflow-hidden ${isExpanded ? 'border-blue-500/40 ring-1 ring-blue-500/20 shadow-2xl bg-zinc-900' : 'border-white/5 hover:border-white/10 shadow-lg'}`}
                            >
                              {/* Header Row */}
                              <div 
                                onClick={() => requestNavigation(() => setSelectedChapterId(isExpanded ? null : ch.id))}
                                className="p-6 flex items-center justify-between cursor-pointer group/item"
                              >
                                <div className="flex items-center gap-6 flex-1 min-w-0">
                                  <div className="relative w-24 h-14 rounded-xl bg-black/60 border border-white/15 overflow-hidden shrink-0 shadow-md">
                                    {(ch.cover_url?.trim() || course.cover_url?.trim()) ? (
                                      <img 
                                        src={ch.cover_url?.trim() || course.cover_url?.trim()} 
                                        className="w-full h-full object-cover opacity-90 group-hover/item:scale-105 group-hover/item:opacity-100 transition-all duration-500" 
                                        referrerPolicy="no-referrer" 
                                        alt={ch.title || 'Aula'}
                                      />
                                    ) : (
                                      <div className="w-full h-full bg-zinc-900 flex items-center justify-center text-gray-600">
                                        <ImageIcon size={18} className="opacity-40" />
                                      </div>
                                    )}
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                                      {ch.content_type === 'video' ? <Video size={16} className="text-white drop-shadow-md" /> : ch.content_type === 'checklist' ? <CheckSquare size={16} className="text-emerald-400 drop-shadow-md" /> : <FileText size={16} className="text-white drop-shadow-md" />}
                                    </div>
                                    <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/75 backdrop-blur-md rounded-md border border-white/10">
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

                                <div className="flex items-center gap-3">
                                  {isAiCreatedLesson(ch) && (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleOpenAiEdit(ch);
                                      }}
                                      className="px-3.5 py-2 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-1.5 shadow-lg shadow-purple-900/30 transition-all hover:scale-105 active:scale-95 cursor-pointer"
                                    >
                                      <Sparkles size={13} className="text-amber-300 animate-pulse" />
                                      <span>Editar com IA</span>
                                    </button>
                                  )}

                                  <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteModal({
                                        isOpen: true,
                                        title: 'Excluir Aula',
                                        message: `Tem certeza que deseja excluir a aula "${ch.title}" permanentemente?`,
                                        onConfirm: () => {
                                          supabase.from('chapters').delete().eq('id', ch.id).then(() => {
                                            toast.success('Aula excluída');
                                            fetchCourseData();
                                          });
                                        }
                                      });
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
                                {isExpanded && (() => {
                                  const draft = (editingExistingChapter && editingExistingChapter.id === ch.id) ? editingExistingChapter : ch;
                                  return (
                                    <motion.div
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
                                      className="border-t border-white/5"
                                    >
                                      <div className="p-10 space-y-8 animate-in fade-in slide-in-from-top-2 duration-500">
                                        {/* AI Edit Banner - ONLY for AI Created Lessons */}
                                        {isAiCreatedLesson(draft) && (
                                          <div className="p-5 bg-gradient-to-r from-purple-950/80 via-zinc-900 to-indigo-950/80 border border-purple-500/30 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl">
                                            <div className="flex items-center gap-3">
                                              <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30">
                                                <Sparkles size={20} />
                                              </div>
                                              <div>
                                                <p className="text-sm font-black text-white uppercase tracking-tight italic">Evoluir ou Ajustar esta Aula com IA</p>
                                                <p className="text-xs text-gray-400">Adicione mini-apps, calculadoras, rastreadores ou aprimore o conteúdo mantendo o progresso.</p>
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={() => handleOpenAiEdit(draft)}
                                              className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black text-xs uppercase tracking-wider rounded-2xl flex items-center gap-2 shadow-lg shadow-purple-900/40 transition-all shrink-0 active:scale-95 cursor-pointer"
                                            >
                                              <Sparkles size={16} className="text-amber-300" /> ✨ Editar com IA
                                            </button>
                                          </div>
                                        )}
                                        <div className="flex flex-col gap-8 w-full max-w-4xl mx-auto">
                                          <div className="space-y-6">
                                            <div className="grid grid-cols-2 gap-6">
                                              <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Título da Aula</label>
                                                <input 
                                                  type="text" 
                                                  value={draft.title || ''}
                                                  onChange={e => setEditingExistingChapter(prev => prev ? ({ ...prev, title: e.target.value }) : null)}
                                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-lg font-bold text-white focus:border-blue-500 outline-none transition-all"
                                                />
                                              </div>
                                              <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Módulo</label>
                                                <div className="relative group z-30">
                                                  <button
                                                    type="button"
                                                    onClick={() => setIsEditModuleDropdownOpen(!isEditModuleDropdownOpen)}
                                                    className="w-full h-[58px] bg-black/40 border border-white/10 rounded-xl pl-6 pr-12 text-xs font-bold text-white flex items-center justify-between outline-none transition-all group-hover:border-white/20 uppercase tracking-widest cursor-pointer text-left"
                                                  >
                                                    <span className="truncate">
                                                      {draft.module_id 
                                                        ? (modules.find(m => m.id === draft.module_id)?.title || 'Sem Módulo')
                                                        : 'Sem Módulo'}
                                                    </span>
                                                    <div className="absolute right-5 pointer-events-none text-gray-400 group-hover:text-gray-200 transition-colors">
                                                      <ChevronDown size={18} className={`transform transition-transform duration-200 ${isEditModuleDropdownOpen ? 'rotate-180' : ''}`} />
                                                    </div>
                                                  </button>

                                                  <AnimatePresence>
                                                    {isEditModuleDropdownOpen && (
                                                      <>
                                                        <div className="fixed inset-0 z-40" onClick={() => setIsEditModuleDropdownOpen(false)} />
                                                        <motion.div
                                                          initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                          animate={{ opacity: 1, y: 0, scale: 1 }}
                                                          exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                          transition={{ duration: 0.15 }}
                                                          className="absolute left-0 right-0 mt-2 bg-zinc-950 border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50 max-h-[200px] overflow-y-auto divide-y divide-white/5 scrollbar-thin scrollbar-thumb-white/10 py-1"
                                                        >
                                                          <button
                                                            type="button"
                                                            onClick={() => {
                                                              setEditingExistingChapter(prev => prev ? ({ ...prev, module_id: null }) : null);
                                                              setIsEditModuleDropdownOpen(false);
                                                            }}
                                                            className="w-full px-6 py-4 text-xs font-bold text-left transition-colors cursor-pointer hover:bg-white/5 flex items-center justify-between uppercase tracking-widest text-white"
                                                          >
                                                            <span className={!draft.module_id ? "text-blue-500" : "text-gray-300"}>Sem Módulo</span>
                                                            {!draft.module_id && <Check size={14} className="text-blue-500" />}
                                                          </button>
                                                          {modules.map(m => (
                                                            <button
                                                              key={m.id}
                                                              type="button"
                                                              onClick={() => {
                                                                setEditingExistingChapter(prev => prev ? ({ ...prev, module_id: m.id }) : null);
                                                                setIsEditModuleDropdownOpen(false);
                                                              }}
                                                              className="w-full px-6 py-4 text-xs font-bold text-left transition-colors cursor-pointer hover:bg-white/5 flex items-center justify-between uppercase tracking-widest text-white"
                                                            >
                                                              <span className={draft.module_id === m.id ? "text-blue-500" : "text-gray-300"}>{m.title}</span>
                                                              {draft.module_id === m.id && <Check size={14} className="text-blue-500" />}
                                                            </button>
                                                          ))}
                                                        </motion.div>
                                                      </>
                                                    )}
                                                  </AnimatePresence>
                                                </div>
                                              </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-6">
                                              <div className="space-y-2">
                                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Duração (Min)</label>
                                                 <input 
                                                  type="number" 
                                                  value={draft.duration_minutes || ''}
                                                  onChange={e => setEditingExistingChapter(prev => prev ? ({ ...prev, duration_minutes: parseInt(e.target.value) || 0 }) : null)}
                                                  className="w-full bg-black/40 border border-white/10 rounded-xl px-6 py-3.5 text-white focus:border-blue-500 outline-none transition-all font-bold"
                                                />
                                              </div>
                                              <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Tipo de Conteúdo</label>
                                                <div className="flex p-1 bg-black/60 rounded-xl border border-white/5">
                                                  {['video', 'pdf', 'link', 'checklist', 'interactive'].map((type) => (
                                                    <button 
                                                      key={type}
                                                      type="button"
                                                      onClick={() => setEditingExistingChapter(prev => prev ? ({ ...prev, content_type: type as any }) : null)}
                                                      className={`flex-1 py-2 text-[8px] font-black rounded-lg transition-all uppercase ${draft.content_type === type ? 'bg-blue-600 text-white' : 'text-gray-600'}`}
                                                    >
                                                      {type === 'link' ? 'BOTAO' : type === 'interactive' ? 'IA' : type}
                                                    </button>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>

                                            {draft.content_type === 'checklist' ? (
                                              <div className="pt-2">
                                                <AdminChecklistEditor
                                                  checklist={editingChecklist || {
                                                    chapter_id: draft.id,
                                                    title: draft.title || 'Checklist',
                                                    description: draft.description || '',
                                                    items: []
                                                  }}
                                                  onChange={setEditingChecklist}
                                                />
                                              </div>
                                            ) : draft.content_type !== 'link' ? (
                                              <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                                                  {draft.content_type === 'video' ? 'URL do Vídeo' : 'URL do PDF'}
                                                </label>
                                                <input 
                                                  type="text" 
                                                  value={draft.content_type === 'video' ? (draft.video_url || '') : (draft.pdf_url || '')}
                                                  onChange={e => setEditingExistingChapter(prev => {
                                                    if (!prev) return null;
                                                    const field = prev.content_type === 'video' ? 'video_url' : 'pdf_url';
                                                    return { ...prev, [field]: e.target.value };
                                                  })}
                                                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-gray-400 font-mono focus:border-blue-500 outline-none transition-all"
                                                />
                                              </div>
                                            ) : (() => {
                                              const [draftColor, draftStyle] = (draft.button_link_color || '#10b981').split('|');
                                              return (
                                                <div className="grid grid-cols-2 gap-4">
                                                  <div className="space-y-2 col-span-2 sm:col-span-1">
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Texto do Botão</label>
                                                    <input 
                                                      type="text" 
                                                      value={draft.button_link_text || ''}
                                                      onChange={e => setEditingExistingChapter(prev => prev ? ({ ...prev, button_link_text: e.target.value }) : null)}
                                                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                                                      placeholder="Ex: Acessar Material Externo"
                                                    />
                                                  </div>
                                                  <div className="space-y-2 col-span-2 sm:col-span-1">
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">URL do Link</label>
                                                    <input 
                                                      type="text" 
                                                      value={draft.button_link_url || ''}
                                                      onChange={e => setEditingExistingChapter(prev => prev ? ({ ...prev, button_link_url: e.target.value }) : null)}
                                                      className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white focus:border-blue-500 outline-none transition-all placeholder:text-gray-600"
                                                      placeholder="https://..."
                                                    />
                                                  </div>

                                                  <div className="col-span-2 border-t border-white/5 my-2 pt-4">
                                                    <span className="text-[11px] font-black text-blue-500 uppercase tracking-widest ml-1">Aparência do Botão</span>
                                                  </div>

                                                  {/* Linha de cima: Cor do Botão */}
                                                  <div className="space-y-2 col-span-2">
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Cor do Botão</label>
                                                    <div className="flex gap-2">
                                                      <input 
                                                        type="color" 
                                                        value={draftColor}
                                                        onChange={e => setEditingExistingChapter(prev => prev ? ({ ...prev, button_link_color: `${e.target.value}|${draftStyle || 'filled'}` }) : null)}
                                                        className="w-14 h-[52px] bg-black/40 border border-white/10 rounded-2xl p-1.5 cursor-pointer focus:border-blue-500 outline-none transition-all shrink-0 hover:border-white/20"
                                                      />
                                                      <input 
                                                        type="text" 
                                                        value={draftColor}
                                                        onChange={e => setEditingExistingChapter(prev => prev ? ({ ...prev, button_link_color: `${e.target.value}|${draftStyle || 'filled'}` }) : null)}
                                                        className="flex-1 bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-xs text-white focus:border-blue-500 outline-none transition-all font-mono"
                                                        placeholder="#10b981"
                                                      />
                                                    </div>
                                                  </div>

                                                  {/* Linha de baixo: Estilo do Botão */}
                                                  <div className="space-y-2 col-span-2">
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Estilo do Botão</label>
                                                    <div className="relative group z-20">
                                                      <button
                                                        type="button"
                                                        onClick={() => setIsEditStyleDropdownOpen(!isEditStyleDropdownOpen)}
                                                        className="w-full h-[52px] bg-black/40 border border-white/10 rounded-2xl pl-6 pr-12 text-xs font-medium text-white flex items-center justify-between outline-none transition-all group-hover:border-white/20 cursor-pointer text-left"
                                                      >
                                                        <span>
                                                          {draftStyle === 'outline' && 'Contornado (Outline)'}
                                                          {draftStyle === 'glow' && 'Brilhante (Neon Glow)'}
                                                          {draftStyle === 'gradient' && 'Degradê (Gradient)'}
                                                          {(draftStyle === 'filled' || !draftStyle) && 'Preenchido (Solid)'}
                                                        </span>
                                                        <div className="absolute right-5 pointer-events-none text-gray-400 group-hover:text-gray-200 transition-colors">
                                                          <ChevronDown size={18} className={`transform transition-transform duration-200 ${isEditStyleDropdownOpen ? 'rotate-180' : ''}`} />
                                                        </div>
                                                      </button>

                                                      <AnimatePresence>
                                                        {isEditStyleDropdownOpen && (
                                                          <>
                                                            <div className="fixed inset-0 z-40" onClick={() => setIsEditStyleDropdownOpen(false)} />
                                                            <motion.div
                                                              initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                                              animate={{ opacity: 1, y: 0, scale: 1 }}
                                                              exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                                              transition={{ duration: 0.15 }}
                                                              className="absolute left-0 right-0 mt-2 bg-zinc-950 border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 divide-y divide-white/5 py-1"
                                                            >
                                                              {[
                                                                { value: 'filled', label: 'Preenchido (Solid)' },
                                                                { value: 'outline', label: 'Contornado (Outline)' },
                                                                { value: 'glow', label: 'Brilhante (Neon Glow)' },
                                                                { value: 'gradient', label: 'Degradê (Gradient)' }
                                                              ].map(item => (
                                                                <button
                                                                  key={item.value}
                                                                  type="button"
                                                                  onClick={() => {
                                                                    setEditingExistingChapter(prev => prev ? ({ ...prev, button_link_color: `${draftColor || '#10b981'}|${item.value}` }) : null);
                                                                    setIsEditStyleDropdownOpen(false);
                                                                  }}
                                                                  className="w-full px-6 py-4 text-xs font-bold text-left transition-colors cursor-pointer hover:bg-white/5 flex items-center justify-between uppercase tracking-widest text-white"
                                                                >
                                                                  <span className={(draftStyle === item.value || (!draftStyle && item.value === 'filled')) ? "text-blue-500" : "text-gray-300"}>
                                                                    {item.label}
                                                                  </span>
                                                                  {(draftStyle === item.value || (!draftStyle && item.value === 'filled')) && (
                                                                    <Check size={14} className="text-blue-500" />
                                                                  )}
                                                                </button>
                                                              ))}
                                                            </motion.div>
                                                          </>
                                                        )}
                                                      </AnimatePresence>
                                                    </div>
                                                  </div>

                                                  {/* Em baixo: Preview do Botão */}
                                                  <div className="space-y-2 col-span-2">
                                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Visualização em Tempo Real</label>
                                                    <div className="w-full bg-black/20 border border-dashed border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center min-h-[120px] relative overflow-hidden">
                                                      <div 
                                                        className="absolute w-24 h-24 rounded-full blur-[40px] opacity-10 pointer-events-none transition-colors duration-500"
                                                        style={{ backgroundColor: draftColor }}
                                                      />
                                                      <div className="relative z-10 w-full flex justify-center">
                                                        <button
                                                          type="button"
                                                          style={getButtonStyle(draftColor, draftStyle)}
                                                          className="px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all duration-300 active:scale-95 shadow-xl cursor-default"
                                                        >
                                                          <span>{draft.button_link_text || 'Acessar Conteúdo'}</span>
                                                          <Link size={14} />
                                                        </button>
                                                      </div>
                                                      <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest mt-4">
                                                        Como o aluno verá na plataforma
                                                      </span>
                                                    </div>
                                                  </div>
                                                </div>
                                              );
                                            })()}

                                            <div className="space-y-2">
                                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Resumo da Aula</label>
                                              <textarea 
                                                value={draft.description || ''}
                                                onChange={e => setEditingExistingChapter(prev => prev ? ({ ...prev, description: e.target.value }) : null)}
                                                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-sm text-gray-300 focus:border-blue-500 outline-none transition-all min-h-[120px] resize-none"
                                              />
                                            </div>
                                          </div>

                                          {/* Capa da Aula Card - Centered Below */}
                                          <div className="bg-black/30 border border-white/10 rounded-3xl p-6 space-y-4 max-w-xl mx-auto w-full">
                                            <div className="space-y-3">
                                              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1 text-center block">Capa desta Aula</label>
                                              
                                              {/* Canva Guide Card */}
                                              <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-2xl p-4 text-center space-y-1.5 shadow-md">
                                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center justify-center gap-1.5">
                                                  🎨 Resolução Ideal no Canva
                                                </p>
                                                <p className="text-xs text-gray-200 font-semibold">
                                                  Tamanho de <span className="text-blue-300 font-black">1080 x 1080 px</span> (Proporção 1:1 Quadrada)
                                                </p>
                                              </div>

                                              <div 
                                                onClick={() => {
                                                  if (!draft.cover_url) {
                                                    toast.error("Por favor, cole a URL da imagem no campo abaixo primeiro antes de ajustar.");
                                                    return;
                                                  }
                                                  setCropperType('existing-chapter');
                                                  setCropperChapterId(ch.id);
                                                  setCropperAspect(1);
                                                  setCropperOpen(true);
                                                }}
                                                className="aspect-square max-w-[280px] mx-auto rounded-3xl overflow-hidden relative bg-black border border-white/10 cursor-pointer group/lessonaura hover:border-blue-500/50 transition-all shadow-lg"
                                              >
                                                {draft.cover_url ? (
                                                  <img src={draft.cover_url} className="w-full h-full object-cover transition-transform group-hover/lessonaura:scale-105" alt="Thumb" referrerPolicy="no-referrer" />
                                                ) : (
                                                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-600 p-6 text-center">
                                                    <ImageIcon className="mb-3 opacity-20" size={32} />
                                                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Capa da Aula</span>
                                                    <span className="text-[9px] font-medium opacity-30 leading-normal max-w-[200px]">Cole a URL da imagem abaixo para habilitar o ajuste e visualização</span>
                                                  </div>
                                                )}
                                                {draft.cover_url && (
                                                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/lessonaura:opacity-100 flex items-center justify-center transition-opacity">
                                                    <span className="text-[9px] font-black text-white uppercase tracking-widest bg-blue-600/80 px-3 py-1.5 rounded-lg">Ajustar Capa (1:1)</span>
                                                  </div>
                                                )}
                                              </div>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  if (!draft.cover_url) {
                                                    toast.error("Por favor, cole a URL da imagem no campo abaixo primeiro antes de ajustar.");
                                                    return;
                                                  }
                                                  setCropperType('existing-chapter');
                                                  setCropperChapterId(ch.id);
                                                  setCropperAspect(1);
                                                  setCropperOpen(true);
                                                }}
                                                className={`w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                                                  draft.cover_url 
                                                    ? 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border-blue-500/20' 
                                                    : 'bg-white/[0.02] text-gray-600 border-white/5 cursor-not-allowed'
                                                }`}
                                              >
                                                <ImageIcon size={14} /> Recortar / Ajustar Thumbnail
                                              </button>
                                              <input 
                                                type="text" 
                                                value={draft.cover_url || ''}
                                                onChange={e => setEditingExistingChapter(prev => prev ? ({ ...prev, cover_url: e.target.value }) : null)}
                                                className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-[10px] text-gray-400 focus:border-blue-500 outline-none font-mono"
                                                placeholder="Cole a URL direta da imagem aqui para visualizar e ajustar..."
                                              />
                                            </div>
                                          </div>

                                          <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto w-full pt-4">
                                            <button 
                                              type="button"
                                              onClick={handleSaveExistingChapter}
                                              disabled={saving}
                                              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-xl shadow-blue-900/20 active:scale-95 text-xs uppercase tracking-widest cursor-pointer"
                                            >
                                              {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                                              SALVAR ALTERAÇÕES
                                            </button>
                                            
                                            <button 
                                              type="button"
                                              onClick={() => setSelectedChapterId(null)}
                                              className="px-8 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-4 rounded-2xl flex items-center justify-center gap-2 transition-all text-xs uppercase tracking-widest cursor-pointer"
                                            >
                                              CANCELAR
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </motion.div>
                                  );
                                })()}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
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
          </div>
        </div>
      </section>
      </div>
    </div>

    {/* Cover Image Cropper & Adjuster */}
    <ImageCropperModal
      isOpen={cropperOpen}
      onClose={() => {
        setCropperOpen(false);
        setCropperChapterId(null);
      }}
      aspectRatio={cropperAspect}
      allowUpload={cropperType !== 'standard'}
      initialImageSrc={
        cropperType === 'standard' 
          ? course.cover_url 
          : cropperType === 'premium' 
            ? course.premium_cover_url 
            : cropperType === 'chapter' 
              ? editingChapter.cover_url 
              : cropperType === 'existing-chapter'
                ? editingExistingChapter?.cover_url
                : undefined
      }
      title={
        cropperType === 'standard' 
          ? 'Ajustar Capa do Curso' 
          : cropperType === 'premium' 
            ? 'Ajustar Capa Premium' 
            : 'Ajustar Capa da Aula'
      }
      onConfirm={async (url) => {
        if (cropperType === 'standard') {
          setCourse(prev => ({ ...prev, cover_url: url }));
        } else if (cropperType === 'premium') {
          setCourse(prev => ({ ...prev, premium_cover_url: url }));
        } else if (cropperType === 'chapter') {
          setEditingChapter(prev => ({ ...prev, cover_url: url }));
        } else if (cropperType === 'existing-chapter') {
          setEditingExistingChapter(prev => prev ? ({ ...prev, cover_url: url }) : null);
          toast.success('Miniatura ajustada! Salve as alterações da aula para persistir.');
        }
      }}
    />

    {/* Modal Warning Popup for Blank Hotmart ID */}
    <AnimatePresence>
      {showMissingHotmartModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 15 }}
            className="bg-zinc-900 border border-amber-500/30 rounded-3xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 blur-[50px] pointer-events-none" />

            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-6 mx-auto">
              <AlertTriangle size={32} />
            </div>

            <h3 className="text-xl font-black text-white text-center uppercase tracking-tight italic mb-3">
              ID Hotmart em Branco
            </h3>

            <p className="text-xs text-gray-300 text-center leading-relaxed mb-8">
              Você está cadastrando um <strong className="text-amber-400 font-bold">Curso Pago Individual</strong>, porém o <strong className="text-white font-bold">ID do Produto Hotmart</strong> está em branco.
              <br /><br />
              O curso será salvo no catálogo, porém <strong className="text-red-400 font-bold">as liberações automáticas pós-compra via Webhook só funcionarão após você cadastrar o ID Hotmart</strong>.
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowMissingHotmartModal(false);
                  handleSaveCourse(true);
                }}
                className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black py-4 rounded-2xl transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
              >
                <Check size={16} /> ENTENDIDO, SALVAR MESMO ASSIM
              </button>

              <button
                type="button"
                onClick={() => setShowMissingHotmartModal(false)}
                className="w-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold py-3 rounded-2xl transition-all text-[11px] uppercase tracking-wider text-center cursor-pointer"
              >
                VOLTAR E PREENCHER ID
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>

    {/* Delete Confirmation Modal */}
    {createPortal(
      <AnimatePresence>
        {deleteModal?.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setDeleteModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
            >
              {/* Background decorative elements */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-red-500" />
              <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] bg-red-500/10" />
              
              <div className="relative z-10 space-y-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-red-500/20 text-red-500">
                  <Trash2 size={28} />
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{deleteModal.title}</h3>
                  <p className="text-sm text-gray-400 font-medium leading-relaxed">{deleteModal.message}</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="button"
                    onClick={() => setDeleteModal(null)}
                    className="flex-1 py-4 px-6 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl transition-all border border-white/5 active:scale-95 text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteModal.onConfirm();
                      setDeleteModal(null);
                    }}
                    className="flex-1 py-4 px-6 bg-red-500 hover:bg-red-600 text-white font-black rounded-2xl transition-all shadow-xl shadow-red-500/20 uppercase tracking-tighter active:scale-95 text-xs cursor-pointer"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}

    {/* Unsaved Changes Guard Modal */}
    {createPortal(
      <AnimatePresence>
        {showUnsavedModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md"
            onClick={() => setShowUnsavedModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-zinc-900 border border-amber-500/30 rounded-3xl p-8 shadow-2xl relative overflow-hidden text-left"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-amber-500" />
              <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] bg-amber-500/10" />

              <div className="relative z-10 space-y-6">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <AlertTriangle size={28} />
                </div>

                <div className="space-y-2">
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                    Alterações Não Salvas
                  </h3>
                  <p className="text-xs text-gray-300 font-medium leading-relaxed">
                    Você possui alterações nesta aula ou módulo que ainda não foram salvas. Se você sair agora, essas modificações serão perdidas.
                  </p>
                </div>

                <div className="flex flex-col gap-3 pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (editingExistingChapter && editingExistingChapter.title) {
                        await handleSaveExistingChapter();
                      } else if (selectedChapterId === 'new' && editingChapter.title) {
                        await handleSaveChapter();
                      }
                      setShowUnsavedModal(false);
                      setIsDirty(false);
                      if (pendingNavAction) {
                        const nav = pendingNavAction;
                        setPendingNavAction(null);
                        nav();
                      }
                    }}
                    className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-2xl transition-all shadow-xl shadow-blue-600/20 uppercase tracking-wider text-xs active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={16} /> Salvar e Continuar
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUnsavedModal(false);
                      setIsDirty(false);
                      if (pendingNavAction) {
                        const nav = pendingNavAction;
                        setPendingNavAction(null);
                        nav();
                      }
                    }}
                    className="w-full py-3.5 px-6 bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold rounded-2xl transition-all border border-red-500/20 text-xs uppercase tracking-wider cursor-pointer"
                  >
                    Descartar Alterações
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowUnsavedModal(false)}
                    className="w-full py-3 px-6 bg-white/5 hover:bg-white/10 text-gray-400 font-medium rounded-2xl transition-all text-xs uppercase tracking-wider cursor-pointer text-center"
                  >
                    Continuar Editando
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body
    )}

    {/* AI Lesson Generator Modal */}
    <AiLessonGeneratorModal
      isOpen={isAiModalOpen}
      onClose={() => {
        setIsAiModalOpen(false);
        setAiEditChapter(null);
      }}
      courses={courseId && course.title ? [{ ...course, id: courseId } as Course] : []}
      initialCourseId={courseId}
      initialModuleId={aiEditChapter?.module_id || modules[0]?.id}
      initialChapterId={aiEditChapter?.id}
      initialLessonTitle={aiEditChapter?.title}
      initialLessonGoal={aiEditChapter?.description}
      initialBlocks={aiEditChapter ? (aiEditChapter.rich_text ? (JSON.parse(aiEditChapter.rich_text).blocks || []) : []) : []}
      modulesMap={courseId ? { [courseId]: modules } : {}}
      onLessonCreated={handleLessonCreatedByAi}
    />

    {/* AI Course Copy & Sales Preview Generator Modal */}
    <AiCourseGeneratorModal
      isOpen={isAiCourseModalOpen}
      onClose={() => setIsAiCourseModalOpen(false)}
      initialCourse={course}
      onApplyCourse={handleApplyAiCourse}
    />
  </div>
);
}
