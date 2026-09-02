import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, Product, CommunityPost } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { CommunityIcon } from './CommunityIcon';
import { GlowingSpinner } from './GlowingSpinner';
import { 
  Users, 
  BookOpen, 
  MessageSquare, 
  Bell, 
  BellOff,
  Phone,
  Mail,
  Plus, 
  Trash2, 
  Save, 
  X, 
  Loader2, 
  Copy,
  Settings,
  Globe,
  Languages,
  Layout,
  Edit3,
  Eye,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Search,
  CheckCircle2,
  Clock,
  Bot,
  AlertCircle,
  AlertTriangle,
  Star,
  Lock as LockIcon,
  ShoppingBag,
  Store,
  RefreshCw,
  Layers,
  Palette,
  Menu,
  ArrowUp,
  Image as ImageIcon,
  Check,
  Video,
  PlusCircle,
  BarChart3,
  Send,
  DollarSign,
  CreditCard,
  TrendingUp,
  XCircle,
  Filter,
  Calendar,
  Tag,
  Zap,
  Database,
  Shield,
  ShieldCheck,
  Smartphone,
  Monitor,
  Apple,
  ImageOff,
  Home,
  User as UserIcon,
  Play,
  ArrowDown,
  ArrowRight,
  ExternalLink,
  Type,
  LogOut,
  HelpCircle,
  Info,
  Sparkles,
  Package,
  MousePointer2,
  PlayCircle,
  RotateCcw,
  EyeOff,
  Lock
} from 'lucide-react';
import WhatsAppIcon from './WhatsAppIcon';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { safeParse, safeFetch } from '../lib/utils';
import CourseEditor from './CourseEditor';
import CourseViewer from './CourseViewer';
import Community from './Community';
import PackageEditor from './PackageEditor';
import { dataCache } from '../lib/cache';

const RotatingBannerPreview = ({ images, interval = 5000 }: { images: string[], interval?: number }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  const validImages = (images || []).filter(img => Boolean(img && img.trim()));

  useEffect(() => {
    if (!validImages || validImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % validImages.length);
    }, interval);
    return () => clearInterval(timer);
  }, [validImages.length, interval]);

  if (!validImages || validImages.length === 0) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-gray-700 bg-black/40">
        <Layout size={48} className="mb-2 opacity-20" />
        <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Sem Imagens</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <AnimatePresence mode="wait">
        <motion.img
          key={currentIndex}
          src={validImages[currentIndex]}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
        {validImages.map((_, i) => (
          <div 
            key={i} 
            className={`h-1 rounded-full transition-all ${i === currentIndex ? 'w-4 bg-blue-500' : 'w-1 bg-white/20'}`} 
          />
        ))}
      </div>
    </div>
  );
};

import { languagePresets } from '../constants/languagePresets';

interface AdminPanelProps {
  user: User;
}

const SidebarItem = ({ icon, label, active, onClick, badge }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: number }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all ${
      active ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-400 hover:text-white hover:bg-white/5'
    }`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span>{label}</span>
    </div>
    {badge !== undefined && badge > 0 && (
      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500 text-white">
        {badge}
      </span>
    )}
  </button>
);

export default function AdminPanel({ user }: AdminPanelProps) {
  const { settings, refreshSettings } = useSettings();
  const { t } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'courses' | 'community' | 'notifications' | 'texts' | 'settings' | 'security' | 'pages' | 'vendas' | 'packages' | 'languages' | 'questions' | 'ai_expert' | 'central_produtos'>('central_produtos');
  const [activePageTab, setActivePageTab] = useState<'home' | 'community' | 'profile' | 'login' | 'nav' | 'course' | 'lesson' | 'push' | 'pwa' | 'support'>('home');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [coursePackages, setCoursePackages] = useState<any[]>([]);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [mappedProducts, setMappedProducts] = useState<any[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [productForm, setProductForm] = useState({
    id: '',
    hotmart_product_id: '',
    name: '',
    product_type: 'main_product',
    internal_target_id: '',
    checkout_url: '',
    is_active: true,
    description: ''
  });
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<{ id: string; name: string } | null>(null);
  const [isSyncingProducts, setIsSyncingProducts] = useState(false);
  const [simulatingWebhook, setSimulatingWebhook] = useState(false);
  const [simTestEmail, setSimTestEmail] = useState('');
  const [simTestEvent, setSimTestEvent] = useState('PURCHASE_APPROVED');
  const [simTestProductId, setSimTestProductId] = useState('');
  const [simResult, setSimResult] = useState<any>(null);
  const [customWebhookInput, setCustomWebhookInput] = useState('');
  const [customWebhookTokenInput, setCustomWebhookTokenInput] = useState('');
  const [showWebhookToken, setShowWebhookToken] = useState(false);
  const [isSavingWebhookUrl, setIsSavingWebhookUrl] = useState(false);
  const [isTestingWebhookUrl, setIsTestingWebhookUrl] = useState(false);
  const [courseStats, setCourseStats] = useState<Record<string, { lessons: number, materials: number }>>({});
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editor states
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [showCourseEditor, setShowCourseEditor] = useState(false);
  const [showPackageEditor, setShowPackageEditor] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState<string | null>(null);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [editingTextKey, setEditingTextKey] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [selectedUserForCourses, setSelectedUserForCourses] = useState<any | null>(null);
  const [userPurchases, setUserPurchases] = useState<string[]>([]);
  const [notificationExclusionCourseId, setNotificationExclusionCourseId] = useState<string | null>(null);
  const [notificationType, setNotificationType] = useState<'in_app' | 'push' | 'both'>('both');
  const [notificationSubTab, setNotificationSubTab] = useState<'send' | 'history'>('send');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState<any[]>([]);
  const [historyCategoryFilter, setHistoryCategoryFilter] = useState<'all' | 'courses' | 'community' | 'general'>('all');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<any | null>(null);
  const [viewingBroadcastDetails, setViewingBroadcastDetails] = useState<any[]>([]);
  const [broadcastDetailsFilter, setBroadcastDetailsFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [broadcastDetailsSearch, setBroadcastDetailsSearch] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [bannerPreviewMode, setBannerPreviewMode] = useState<'desktop' | 'mobile'>('mobile');
  const [activeBannerPlatform, setActiveBannerPlatform] = useState<'desktop' | 'mobile'>('desktop');
  const [editingBannerIndex, setEditingBannerIndex] = useState<number>(0);
  const [firebaseStatus, setFirebaseStatus] = useState<{ initialized: boolean, hasServiceAccount: boolean } | null>(null);
  const [pwaImageInputs, setPwaImageInputs] = useState<Record<string, string>>({});
  const [showAddPwaImageUrl, setShowAddPwaImageUrl] = useState<{ deviceId: string, currentUrls: string[], updateFn: (urls: string[]) => void } | null>(null);
  const [pwaUrlInput, setPwaUrlInput] = useState('');
  const [pendingQuestions, setPendingQuestions] = useState<any[]>([]);
  const [questionsFilter, setQuestionsFilter] = useState<'all' | 'unanswered'>('all');
  const [answeringQuestionId, setAnsweringQuestionId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [sendingAnswer, setSendingAnswer] = useState(false);

  // Main Product Selling Config states
  const [showMainProductModal, setShowMainProductModal] = useState(false);
  const [mainProductIdInput, setMainProductIdInput] = useState('');
  const [mainPriceInput, setMainPriceInput] = useState('');
  const [mainCheckoutUrlInput, setMainCheckoutUrlInput] = useState('');
  const [savingMainProduct, setSavingMainProduct] = useState(false);

  const handleSaveMainProduct = async () => {
    try {
      setSavingMainProduct(true);
      const newCustomTexts = {
        ...settings.custom_texts,
        main_product_id: mainProductIdInput.trim(),
        main_price: mainPriceInput.trim(),
        main_checkout_url: mainCheckoutUrlInput.trim(),
      };
      await updateSettings({ 
        custom_texts: newCustomTexts,
        main_course_hotmart_id: mainProductIdInput.trim()
      });
      setShowMainProductModal(false);
    } catch (err: any) {
      toast.error('Erro ao salvar as configurações: ' + err.message);
    } finally {
      setSavingMainProduct(false);
    }
  };

  // Official Sales Dashboard states
  const [salesList, setSalesList] = useState<any[]>([]);
  const [salesMetrics, setSalesMetrics] = useState<any>({
    totalRevenue: 0,
    totalCount: 0,
    averageTicket: 0,
    refundCount: 0,
    cancelCount: 0,
    statusDistribution: {},
    topProducts: [],
    paymentTypeDistribution: {}
  });
  const [loadingSales, setLoadingSales] = useState<boolean>(false);

  // Sales Filters
  const [salesStartDate, setSalesStartDate] = useState<string>('');
  const [salesEndDate, setSalesEndDate] = useState<string>('');
  const [salesProductId, setSalesProductId] = useState<string>('all');
  const [salesProductType, setSalesProductType] = useState<string>('all');
  const [salesStatus, setSalesStatus] = useState<string>('all');
  const [salesPaymentType, setSalesPaymentType] = useState<string>('all');
  const [salesSearch, setSalesSearch] = useState<string>('');
  const [salesDatePreset, setSalesDatePreset] = useState<string>('all');

  // Payload detail modal state
  const [selectedSaleDetail, setSelectedSaleDetail] = useState<any | null>(null);

  const fetchSalesData = async () => {
    setLoadingSales(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const queryParams = new URLSearchParams({
        action: 'sales-list',
        startDate: salesStartDate,
        endDate: salesEndDate,
        productId: salesProductId,
        productType: salesProductType,
        status: salesStatus,
        paymentType: salesPaymentType,
        search: salesSearch
      });

      const res = await safeFetch(`/api/v1/admin?${queryParams.toString()}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (res && res.sales) {
        setSalesList(res.sales || []);
        setSalesMetrics(res.metrics || {});
      }
    } catch (err) {
      console.error('Error fetching sales:', err);
    } finally {
      setLoadingSales(false);
    }
  };

  const applySalesDatePreset = (preset: string) => {
    setSalesDatePreset(preset);
    const now = new Date();
    if (preset === 'today') {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      setSalesStartDate(start);
      setSalesEndDate(now.toISOString());
    } else if (preset === '7days') {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      setSalesStartDate(start);
      setSalesEndDate(now.toISOString());
    } else if (preset === '30days') {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      setSalesStartDate(start);
      setSalesEndDate(now.toISOString());
    } else if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      setSalesStartDate(start);
      setSalesEndDate(now.toISOString());
    } else {
      setSalesStartDate('');
      setSalesEndDate('');
    }
  };

  const isAdminAuthorized = !settings?.admin_email || user.email?.toLowerCase() === settings?.admin_email?.toLowerCase();

  useEffect(() => {
    if (activeTab === 'notifications') {
      checkFirebaseStatus();
      fetchNotificationHistory();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'vendas') {
      fetchSalesData();
    }
  }, [activeTab, salesStartDate, salesEndDate, salesProductId, salesProductType, salesStatus, salesPaymentType, salesSearch]);

  const fetchNotificationHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await safeFetch('/api/v1/notifications?action=notification-history', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (Array.isArray(data)) {
        setNotificationHistory(data);
      }
    } catch (e) {
      console.error('Error fetching history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchBroadcastDetails = async (broadcast: any) => {
    setSelectedBroadcast(broadcast);
    setBroadcastDetailsFilter('all');
    setBroadcastDetailsSearch('');
    setLoadingDetails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await safeFetch(`/api/v1/notifications?action=notification-details&id=${broadcast.id}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (Array.isArray(data)) {
        setViewingBroadcastDetails(data);
      } else {
        setViewingBroadcastDetails([]);
      }
    } catch (e) {
      console.error('Error fetching details:', e);
      setViewingBroadcastDetails([]);
    } finally {
      setLoadingDetails(false);
    }
  };

  const checkFirebaseStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const status = await safeFetch('/api/v1/admin?action=info', {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (status) setFirebaseStatus(status);
    } catch (e) {
      console.error('Error checking firebase status:', e);
    }
  };

  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [confirmAdminPassword, setConfirmAdminPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // User detail states
  const [userNewPassword, setUserNewPassword] = useState('');
  const [isChangingUserPassword, setIsChangingUserPassword] = useState(false);
  const [isUpdatingUserAi, setIsUpdatingUserAi] = useState(false);

  const handleToggleUserUnlimitedAi = async (targetUser: any) => {
    if (!targetUser?.id) return;
    setIsUpdatingUserAi(true);
    const isUnlocked = Boolean(
      targetUser.has_unlimited_ai || 
      userPurchases.some(p => ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(String(p).toLowerCase()))
    );
    try {
      await toggleCourseAccess(targetUser.id, 'ai_subscription', isUnlocked);
    } finally {
      setIsUpdatingUserAi(false);
    }
  };

  // User management states
  const [showUserCreator, setShowUserCreator] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('123456');
  const [newUserName, setNewUserName] = useState('');
  const [newUserCountryCode, setNewUserCountryCode] = useState('55');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  // View states
  const [view, setView] = useState<'list' | 'user_details'>('list');
  const [confirmationModal, setConfirmationModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    confirmText?: string;
    cancelText?: string;
    type: 'danger' | 'info';
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });

  // Settings local states
  const [localSettings, setLocalSettings] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [draftCustomTexts, setDraftCustomTexts] = useState<Record<string, string>>({});
  const [isSavingPages, setIsSavingPages] = useState(false);

  const handleMoveCourse = async (courseId: string, direction: 'up' | 'down') => {
    // Determine the category of the course to move locally within its filter
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    let categoryCourses: any[] = [];
    if (course.is_bonus) {
      categoryCourses = courses.filter(c => c.is_bonus);
    } else if (course.is_free) {
      categoryCourses = courses.filter(c => !c.is_bonus && c.is_free);
    } else {
      categoryCourses = courses.filter(c => !c.is_bonus && !c.is_free);
    }

    // Sort by order_index primarily
    categoryCourses.sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

    const currentIndex = categoryCourses.findIndex(c => c.id === courseId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= categoryCourses.length) return;

    // Swap locally
    const updatedCategory = [...categoryCourses];
    [updatedCategory[currentIndex], updatedCategory[targetIndex]] = [updatedCategory[targetIndex], updatedCategory[currentIndex]];

    // Re-assign order_indexes for the whole category to be safe
    const updates = updatedCategory.map((c, idx) => ({
      ...c,
      order_index: idx
    }));

    // Update state optimistically
    const newCourses = courses.map(c => {
      const update = updates.find(u => u.id === c.id);
      return update ? { ...c, order_index: update.order_index } : c;
    });
    setCourses(newCourses);

    try {
      // Use a more robust upsert or just update individual rows to be safe
      // but batch upsert with onConflict is definitely more efficient.
      const { error } = await supabase
        .from('courses')
        .upsert(updates, { onConflict: 'id' });
        
      if (error) throw error;
      toast.success('Ordem atualizada!');
    } catch (err: any) {
      toast.error('Erro ao salvar ordem: ' + err.message);
      fetchData(); // Rollback
    }
  };

   const CourseAdminCard = ({ course, courseStats, setViewingCourseId, setEditingCourseId, setShowCourseEditor, onDelete, onMove }: any) => (
    <div className="bg-zinc-900 border border-white/5 rounded-xl overflow-hidden group hover:border-blue-500/50 transition-all flex flex-col w-36 sm:w-44 shrink-0 shadow-2xl">
      <div className="relative aspect-[2/3] overflow-hidden shrink-0">
        {course.cover_url?.trim() ? (
          <img 
            src={course.cover_url.trim()} 
            alt={course.title} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            referrerPolicy="no-referrer" 
          />
        ) : (
          <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
            <BookOpen className="text-zinc-600" size={24} />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent opacity-80" />
        
        <div className="absolute inset-x-0 bottom-0 p-3 space-y-1">
          <h4 className="font-black text-[10px] sm:text-xs text-white leading-tight line-clamp-2 drop-shadow-md uppercase italic">
            {course.title}
          </h4>
          <div className="text-[8px] font-black text-blue-500 uppercase tracking-tighter drop-shadow-md flex items-center gap-1">
            {course.is_bonus ? 'BÔNUS 🎁' : course.is_free ? 'PRODUTO PRINCIPAL 💎' : 'PREMIUM'}
            {course.is_package_exclusive_bonus && (
               <div className={`${course.is_bonus ? 'bg-purple-600' : 'bg-emerald-600'} p-0.5 rounded shadow-sm border ${course.is_bonus ? 'border-purple-400/50' : 'border-emerald-400/50'}`} title="Liberado via Pacote">
                 <LockIcon size={8} className="text-white" />
               </div>
            )}
          </div>
        </div>

        {/* Admin floating controls */}
        <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => setViewingCourseId(course.id)}
            className="p-1.5 bg-white/20 hover:bg-white text-white hover:text-black rounded-lg backdrop-blur-md transition-all shadow-lg"
            title="Visualizar Grade"
          >
            <Eye size={14} />
          </button>
          <button 
            onClick={() => { setEditingCourseId(course.id); setShowCourseEditor(true); }}
            className="p-1.5 bg-white/20 hover:bg-white text-white hover:text-black rounded-lg backdrop-blur-md transition-all shadow-lg"
            title="Editar Curso"
          >
            <Edit3 size={14} />
          </button>
          <button 
            onClick={() => onDelete(course.id, course.title, !course.is_bonus && !course.is_free)}
            className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-md transition-all shadow-lg"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Move arrows */}
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-100 transition-opacity">
          <button 
            onClick={(e) => { e.stopPropagation(); onMove(course.id, 'up'); }}
            className="p-1 sm:p-1.5 bg-black/60 hover:bg-blue-600 text-white rounded-lg backdrop-blur-md transition-all border border-white/20 shadow-xl"
            title="Mover para esquerda"
          >
            <ChevronLeft size={16} strokeWidth={3} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onMove(course.id, 'down'); }}
            className="p-1 sm:p-1.5 bg-black/60 hover:bg-blue-600 text-white rounded-lg backdrop-blur-md transition-all border border-white/20 shadow-xl"
            title="Mover para direita"
          >
            <ChevronRight size={16} strokeWidth={3} />
          </button>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (settings && !localSettings) {
      const initialLocal: any = { ...settings };
      
      // Mapeia os nomes do banco para os nomes usados no estado local da UI
      initialLocal.support_whatsapp_home_floating = settings.support_whatsapp_floating_enabled;
      initialLocal.support_type = settings.custom_texts?.['config.support_type'] || settings.support_type || 'floating';
      initialLocal.support_whatsapp_community_floating = settings.support_whatsapp_floating_community_enabled;
      initialLocal.support_whatsapp_profile_floating = settings.support_whatsapp_floating_profile_enabled;
      initialLocal.support_whatsapp_course_floating = settings.support_whatsapp_floating_course_enabled;

      // Carrega configurações de aula do custom_texts
      initialLocal.support_whatsapp_lesson_enabled = settings.custom_texts?.['config.support_whatsapp_lesson_enabled'] === 'true';
      initialLocal.support_email_lesson_enabled = settings.custom_texts?.['config.support_email_lesson_enabled'] === 'true';
      initialLocal.support_whatsapp_lesson_floating = settings.custom_texts?.['config.support_whatsapp_lesson_floating'] === 'true';

      // Configurações da página de preview (padrão true se não definido)
      initialLocal.support_whatsapp_preview_enabled = settings.custom_texts?.['config.support_whatsapp_preview_enabled'] !== 'false';
      initialLocal.support_email_preview_enabled = settings.custom_texts?.['config.support_email_preview_enabled'] !== 'false';
      initialLocal.support_whatsapp_preview_floating = settings.custom_texts?.['config.support_whatsapp_preview_floating'] !== 'false';

      // Configurações da página de login
      initialLocal.support_whatsapp_login_floating = settings.custom_texts?.['config.support_whatsapp_login_floating'] !== undefined
        ? settings.custom_texts['config.support_whatsapp_login_floating'] === 'true'
        : (settings.support_whatsapp_login_floating ?? true);
      initialLocal.support_whatsapp_login_enabled = settings.support_whatsapp_login_enabled ?? true;
      initialLocal.support_email_login_enabled = settings.support_email_login_enabled ?? true;

      // Fallbacks para valores que podem estar nulos no banco mas que a UI espera como booleanos
      initialLocal.support_whatsapp_home_enabled = settings.support_whatsapp_home_enabled ?? true;
      initialLocal.support_email_home_enabled = settings.support_email_home_enabled ?? true;
      initialLocal.support_whatsapp_community_enabled = settings.support_whatsapp_community_enabled ?? true;
      initialLocal.support_email_community_enabled = settings.support_email_community_enabled ?? true;
      initialLocal.support_whatsapp_profile_enabled = settings.support_whatsapp_profile_enabled ?? true;
      initialLocal.support_email_profile_enabled = settings.support_email_profile_enabled ?? true;
      initialLocal.support_whatsapp_course_enabled = settings.support_whatsapp_course_enabled ?? true;
      initialLocal.support_email_course_enabled = settings.support_email_course_enabled ?? true;
      initialLocal.show_course_titles_home = settings.show_course_titles_home ?? (settings.custom_texts?.['config.show_course_titles_home'] === 'true');

      setLocalSettings(initialLocal);
    }
    
    const defaultEdgeUrl = isSupabaseConfigured && supabase ? (supabase as any).supabaseUrl + '/functions/v1/hotmart-webhook' : '';
    if (settings?.custom_texts?.['hotmart.webhook_url']) {
      setCustomWebhookInput(settings.custom_texts['hotmart.webhook_url']);
    } else if (defaultEdgeUrl && !customWebhookInput) {
      setCustomWebhookInput(defaultEdgeUrl);
    }

    if (settings?.custom_texts?.['hotmart.webhook_token']) {
      setCustomWebhookTokenInput(settings.custom_texts['hotmart.webhook_token']);
    }

    if (settings?.custom_texts && Object.keys(draftCustomTexts).length === 0) {
      setDraftCustomTexts(settings.custom_texts);
    }
  }, [settings, localSettings]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchCourses = async (showToast: boolean = false) => {
    setLoadingCourses(true);
    try {
      let response = await supabase
        .from('courses')
        .select('*')
        .order('order_index', { ascending: true });
      
      if (response.error && (response.error.code === '42703' || response.error.message?.includes('order_index'))) {
        response = await supabase
          .from('courses')
          .select('*')
          .order('created_at', { ascending: true });
      }

      if (!response.error && response.data) {
        const sorted = [...response.data].sort((a, b) => {
          const orderA = a.order_index ?? 9999;
          const orderB = b.order_index ?? 9999;
          if (orderA !== orderB) return orderA - orderB;
          return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
        });
        setCourses(sorted);
      }

      const { data: chaptersData } = await supabase.from('chapters').select('id, content_type, modules!inner(course_id)');
      if (chaptersData) {
        const stats: Record<string, { lessons: number, materials: number }> = {};
        chaptersData.forEach((ch: any) => {
          const courseId = ch.modules.course_id;
          if (!stats[courseId]) stats[courseId] = { lessons: 0, materials: 0 };
          if (ch.content_type === 'video') stats[courseId].lessons++;
          else stats[courseId].materials++;
        });
        setCourseStats(stats);
      }

      dataCache.invalidate();
      if (showToast) {
        toast.success('Lista de cursos atualizada!');
      }
    } catch (err: any) {
      console.error('Error fetching courses:', err);
      if (showToast) toast.error('Erro ao atualizar cursos');
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const tasks: Promise<any>[] = [];

      // Fetch courses (if empty or on courses tab)
      if (courses.length === 0 || activeTab === 'courses') {
        tasks.push(fetchCourses(false));
      }

      // Only fetch packages if not loaded
      if (coursePackages.length === 0) {
        tasks.push((async () => {
          const { data: packagesData, error: packagesError } = await supabase
            .from('course_packages')
            .select('*, package_courses(course_id)')
            .order('created_at', { ascending: false });
          
          if (!packagesError && packagesData) {
            setCoursePackages(packagesData);
          }
        })());
      }

      // Questions
      if (pendingQuestions.length === 0 || activeTab === 'questions') {
        tasks.push((async () => {
          try {
            const { data, error } = await supabase
              .from('chapter_questions')
              .select('*, chapters:chapter_id(title, modules:module_id(courses:course_id(title)))')
              .order('created_at', { ascending: false });
            
            if (!error && data) {
              setPendingQuestions(data);
              if (activeTab === 'questions') {
                const unreadIds = data.filter((q: any) => !q.is_read_by_admin).map((q: any) => q.id);
                if (unreadIds.length > 0) {
                  await supabase.from('chapter_questions').update({ is_read_by_admin: true }).in('id', unreadIds);
                }
              }
            }
          } catch (e) {
            console.error('Error in fetchQuestions:', e);
          }
        })());
      }

      // Run shared background tasks in parallel
      await Promise.all(tasks);

      // Get session once for tab-specific requests
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (activeTab === 'users' && token) {
        try {
          const data = await safeFetch('/api/v1/admin?action=users-list', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (data && !data.error) {
            setAllUsers(Array.isArray(data) ? data : []);
          } else {
            let { data: profiles, error: profErr } = await supabase
              .from('profiles')
              .select('*')
              .order('created_at', { ascending: false });
            if (profErr) {
              const res = await supabase.from('profiles').select('*');
              profiles = res.data;
            }
            setAllUsers(profiles || []);
          }
        } catch (e) {
          try {
            const { data: profiles } = await supabase.from('profiles').select('*');
            setAllUsers(profiles || []);
          } catch {}
        }
      }

      if (activeTab === 'vendas' && token) {
        const data = await safeFetch('/api/v1/admin?action=purchases-list', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (data && !data.error) {
          setAllPurchases(Array.isArray(data) ? data : []);
        } else {
          setAllPurchases([]);
        }
      }

      if (activeTab === 'central_produtos' || mappedProducts.length === 0) {
        await fetchCentralProducts();
      }
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchCentralProducts = async (showToast = false) => {
    try {
      setIsSyncingProducts(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const [productsRes, eventsRes] = await Promise.all([
        safeFetch('/api/v1/admin?action=products-list', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        }),
        safeFetch('/api/v1/admin?action=webhook-events-list', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        })
      ]);

      if (productsRes && !productsRes.error) {
        const rawList: any[] = Array.isArray(productsRes) ? [...productsRes] : [];
        
        // Sanitize duplicates by product_type and hotmart_product_id
        const cleanedList: any[] = [];
        const seenHotmartIds = new Set<string>();

        // 1. Pick single main_product (prioritizing custom ID over HOTMART_PRODUTO_PRINCIPAL)
        const mainProds = rawList.filter(p => p.product_type === 'main_product');
        if (mainProds.length > 0) {
          const chosenMain = mainProds.find(p => p.hotmart_product_id && p.hotmart_product_id.trim() !== 'HOTMART_PRODUTO_PRINCIPAL') || mainProds[0];
          cleanedList.push(chosenMain);
          if (chosenMain.hotmart_product_id) seenHotmartIds.add(chosenMain.hotmart_product_id);
        }

        // 2. Pick single ai_subscription (prioritizing custom ID over HOTMART_IA_VICTORIA)
        const aiProds = rawList.filter(p => p.product_type === 'ai_subscription');
        if (aiProds.length > 0) {
          const chosenAi = aiProds.find(p => p.hotmart_product_id && p.hotmart_product_id.trim() !== 'HOTMART_IA_VICTORIA') || aiProds[0];
          cleanedList.push(chosenAi);
          if (chosenAi.hotmart_product_id) seenHotmartIds.add(chosenAi.hotmart_product_id);
        }

        // 3. Add all remaining products without duplicating hotmart_product_ids or special types
        for (const item of rawList) {
          if (item.product_type === 'main_product' || item.product_type === 'ai_subscription') continue;
          if (item.hotmart_product_id && seenHotmartIds.has(item.hotmart_product_id)) continue;
          cleanedList.push(item);
          if (item.hotmart_product_id) seenHotmartIds.add(item.hotmart_product_id);
        }

        // Sanitize names for ai_subscription products
        for (const p of cleanedList) {
          if (p.product_type === 'ai_subscription' || (p.name && p.name.includes('Victoria'))) {
            p.name = p.name
              ? p.name.replace(/IA Victoria VIP \(Ilimitada\)/gi, 'IA Expert VIP (Ilimitada)')
                     .replace(/IA Victoria VIP/gi, 'IA Expert VIP')
                     .replace(/IA Victoria/gi, 'IA Expert')
              : 'IA Expert VIP (Ilimitada)';
          }
        }

        // Sort so 'main_product' is strictly the first item in the catalog
        cleanedList.sort((a: any, b: any) => {
          if (a.product_type === 'main_product') return -1;
          if (b.product_type === 'main_product') return 1;
          return 0;
        });
        setMappedProducts(cleanedList);
      }

      if (eventsRes && !eventsRes.error) {
        setWebhookLogs(Array.isArray(eventsRes) ? eventsRes : []);
      }

      if (showToast) {
        toast.success('Catálogo de produtos e logs atualizados!');
      }
    } catch (e) {
      console.error('Error loading central products:', e);
      if (showToast) toast.error('Erro ao atualizar lista.');
    } finally {
      setIsSyncingProducts(false);
    }
  };

  const handleSaveProduct = async () => {
    const cleanHotmartId = productForm.hotmart_product_id.trim();
    if (!productForm.name.trim()) {
      toast.error('Informe o Nome do Produto.');
      return;
    }

    // Uniqueness validation
    if (cleanHotmartId) {
      const duplicate = mappedProducts.find(
        p => String(p.hotmart_product_id).trim() === cleanHotmartId && p.id !== productForm.id
      );
      if (duplicate) {
        toast.error(`Este ID Hotmart '${cleanHotmartId}' já está cadastrado no produto "${duplicate.name}".`);
        return;
      }
    }

    const previousMappedProducts = [...mappedProducts];
    const isEditing = Boolean(productForm.id);
    const tempId = productForm.id || ('prod_temp_' + Date.now());

    const optimisticProduct = {
      id: tempId,
      hotmart_product_id: cleanHotmartId,
      name: productForm.name.trim(),
      product_type: productForm.product_type,
      internal_target_id: productForm.internal_target_id || null,
      checkout_url: productForm.checkout_url || null,
      is_active: productForm.is_active !== false,
      description: productForm.description || null,
      updated_at: new Date().toISOString()
    };

    // OPTIMISTIC UPDATE: Update local state immediately!
    if (isEditing) {
      setMappedProducts(prev => prev.map(p => p.id === productForm.id ? optimisticProduct : p));
    } else {
      setMappedProducts(prev => [optimisticProduct, ...prev]);
    }

    // Close modal instantly for seamless UX
    setShowProductModal(false);
    setEditingProduct(null);
    const formToSend = { ...productForm };
    setProductForm({
      id: '',
      hotmart_product_id: '',
      name: '',
      product_type: 'main_product',
      internal_target_id: '',
      checkout_url: '',
      is_active: true,
      description: ''
    });

    toast.success(isEditing ? 'Produto atualizado com sucesso!' : 'Novo produto mapeado com sucesso!');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await safeFetch('/api/v1/admin?action=product-save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify(formToSend)
      });

      if (!res || res.error) throw new Error(res?.error || 'Erro ao salvar produto');
      
      // Reconcile saved product if backend returned real ID
      if (res.product && res.product.id) {
        setMappedProducts(prev => prev.map(p => p.id === tempId ? res.product : p));
      }
    } catch (err: any) {
      // Rollback optimistic update on error
      setMappedProducts(previousMappedProducts);
      toast.error('Erro ao sincronizar produto: ' + err.message);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    const previousMappedProducts = [...mappedProducts];

    // OPTIMISTIC UPDATE: Remove locally immediately
    setMappedProducts(prev => prev.filter(p => p.id !== productId));
    setDeletingProduct(null);
    toast.success('Produto removido com sucesso!');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await safeFetch('/api/v1/admin?action=product-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ id: productId })
      });

      if (!res || res.error) throw new Error(res?.error || 'Erro ao excluir produto');
    } catch (err: any) {
      // Rollback on error
      setMappedProducts(previousMappedProducts);
      toast.error('Erro ao excluir: ' + err.message);
    }
  };

  const handleSyncProductsMigration = async () => {
    setIsSyncingProducts(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await safeFetch('/api/v1/admin?action=product-sync-migration', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });

      if (!res || res.error) throw new Error(res?.error || 'Erro na sincronização');
      if (Array.isArray(res.catalog)) {
        setMappedProducts(res.catalog);
      }
      toast.success(`Sincronização concluída! Catalog atualizado com ${res.catalog?.length || res.migratedCount || 0} produto(s).`);
      fetchCentralProducts();
    } catch (err: any) {
      toast.error('Erro ao sincronizar: ' + err.message);
    } finally {
      setIsSyncingProducts(false);
    }
  };

  const handleSimulateWebhook = async () => {
    if (!simTestEmail.trim()) {
      toast.error('Informe o e-mail para simulação.');
      return;
    }
    setSimulatingWebhook(true);
    setSimResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await safeFetch('/api/v1/admin?action=webhook-simulate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          buyer_email: simTestEmail.trim(),
          hotmart_product_id: simTestProductId.trim(),
          event_type: simTestEvent
        })
      });

      if (!res) throw new Error('Erro na simulação');
      setSimResult(res);

      if (res.http_status === 401) {
        toast.error('Aviso de Autenticação Hottok (HTTP 401): O token configurado na Edge Function difere do enviado.');
      } else if (res.success) {
        toast.success('Simulação de webhook executada com sucesso!');
      } else {
        toast.error('Falha ao conectar na URL: NetworkError when attempting to fetch resource. Por favor, verifique a "URL do Endpoint do Webhook (Hotmart)".');
      }
      fetchCentralProducts();
    } catch (err: any) {
      toast.error('Falha ao conectar na URL: NetworkError when attempting to fetch resource. Por favor, verifique a "URL do Endpoint do Webhook (Hotmart)".');
    } finally {
      setSimulatingWebhook(false);
    }
  };

  const handleSaveWebhookUrl = async () => {
    setIsSavingWebhookUrl(true);
    try {
      const cleanUrl = customWebhookInput.trim();
      const cleanToken = customWebhookTokenInput.trim();
      const newCustomTexts = {
        ...(settings?.custom_texts || {}),
        'hotmart.webhook_url': cleanUrl,
        'hotmart.webhook_token': cleanToken
      };
      await updateSettings({ custom_texts: newCustomTexts });
      toast.success('URL e Token do Webhook atualizados com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao salvar configurações do Webhook: ' + err.message);
    } finally {
      setIsSavingWebhookUrl(false);
    }
  };

  const handleResetWebhookUrl = async () => {
    setIsSavingWebhookUrl(true);
    try {
      const defaultUrl = isSupabaseConfigured && supabase ? (supabase as any).supabaseUrl + '/functions/v1/hotmart-webhook' : '';
      setCustomWebhookInput(defaultUrl);
      setCustomWebhookTokenInput('');
      const newCustomTexts = { ...(settings?.custom_texts || {}) };
      delete newCustomTexts['hotmart.webhook_url'];
      delete newCustomTexts['hotmart.webhook_token'];
      await updateSettings({ custom_texts: newCustomTexts });
      toast.success('Configurações do Webhook restauradas para o padrão!');
    } catch (err: any) {
      toast.error('Erro ao restaurar configurações do Webhook: ' + err.message);
    } finally {
      setIsSavingWebhookUrl(false);
    }
  };

  const handleTestWebhookUrl = async () => {
    const defaultUrl = isSupabaseConfigured && supabase ? (supabase as any).supabaseUrl + '/functions/v1/hotmart-webhook' : '';
    const targetUrl = customWebhookInput.trim() || defaultUrl;
    if (!targetUrl) {
      toast.error('Nenhuma URL do Endpoint do Webhook configurada para testar. Por favor, verifique o campo de URL.');
      return;
    }
    setIsTestingWebhookUrl(true);
    try {
      const res = await fetch(targetUrl, { method: 'GET' });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.success(`Endpoint de Webhook Online (HTTP ${res.status}): ${data.service || 'Conexão GET bem-sucedida'}`);
      } else {
        toast.error(`Falha no Endpoint (HTTP ${res.status}). Por favor, verifique se a "URL do Endpoint do Webhook (Hotmart)" está correta.`);
      }
    } catch (err: any) {
      toast.error(`Falha ao conectar na URL: ${err.message}. Por favor, verifique a "URL do Endpoint do Webhook (Hotmart)".`);
    } finally {
      setIsTestingWebhookUrl(false);
    }
  };

  const [adminPassword, setAdminPassword] = useState('');

  const saveAuthSettings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await safeFetch('/api/v1/admin?action=update-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          settings: {
            admin_email: localSettings?.admin_email,
            auth_method: localSettings?.auth_method,
            app_url: localSettings?.app_url,
            ga4_tag_id: localSettings?.ga4_tag_id
          },
          adminPassword: adminPassword || undefined
        })
      });

      if (response && response.error) throw new Error(response.error);
      
      // Safety: Ensure the current user who is performing this action is also an admin in their profile
      if (user?.id) {
        await supabase.from('profiles').update({ is_admin: true }).eq('id', user.id);
      }

      setAdminPassword(''); // Clear after save
      toast.success('Configurações de autenticação salvas!');
      refreshSettings();
    } catch (err: any) {
      console.error('Error saving auth settings:', err);
      toast.error('Erro ao salvar: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const updateSettings = async (newSettings: Partial<any>) => {
    try {
      const payload = { ...newSettings };
      if ('support_type' in payload) {
        if (!payload.custom_texts) payload.custom_texts = { ...settings?.custom_texts };
        payload.custom_texts['config.support_type'] = payload.support_type;
        delete payload.support_type;
      }

      if ('show_course_titles_home' in payload) {
        if (!payload.custom_texts) payload.custom_texts = { ...(settings?.custom_texts || {}) };
        payload.custom_texts['config.show_course_titles_home'] = String(!!payload.show_course_titles_home);
      }

      const { error } = await supabase
        .from('app_settings')
        .upsert({ id: 1, ...payload });

      if (error) {
        if (error.message?.includes('show_course_titles_home')) {
          const fallbackPayload = { ...payload };
          delete fallbackPayload.show_course_titles_home;
          if (!fallbackPayload.custom_texts) fallbackPayload.custom_texts = { ...(settings?.custom_texts || {}) };
          fallbackPayload.custom_texts['config.show_course_titles_home'] = String(!!newSettings.show_course_titles_home);

          const { error: fallbackErr } = await supabase
            .from('app_settings')
            .upsert({ id: 1, ...fallbackPayload });

          if (fallbackErr) throw fallbackErr;
        } else if (error.message?.includes('banner_config')) {
          throw new Error('A coluna "banner_config" não foi encontrada no banco de dados. Por favor, execute o script SQL de atualização em SUPABASE_SETUP.md no seu painel Supabase.');
        } else if (error.code === '22P02' && error.message?.includes('login_install_button_pulsing')) {
          throw new Error('Erro de tipo na coluna "login_install_button_pulsing". O banco espera um Booleano mas recebeu um Texto. Por favor, execute o script SQL de atualização em SUPABASE_SETUP.md para converter a coluna para TEXT.');
        } else {
          throw error;
        }
      }
      toast.success('Configurações atualizadas!');
      refreshSettings();
    } catch (err: any) {
      console.error('Error updating settings:', err);
      toast.error('Erro ao atualizar configurações: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const fetchUserPurchases = async (userId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await safeFetch(`/api/v1/admin?action=purchases-list&userId=${userId}`, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });
      
      if (response && Array.isArray(response)) {
        setUserPurchases(response.map((p: any) => p.product_id));
      } else {
        // Fallback to client if API fails
        const { data, error } = await supabase
          .from('purchases')
          .select('product_id')
          .eq('user_id', userId);
        if (error) throw error;
        setUserPurchases(data.map(p => p.product_id));
      }
    } catch (err) {
      console.error('Error fetching user purchases:', err);
    }
  };

  const toggleCourseAccess = async (userId: string, courseId: string, isUnlocked: boolean) => {
    const executeToggle = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const userEmail = selectedUserForCourses?.email;
        
        const response = await safeFetch('/api/v1/admin?action=user-access-toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            userId,
            userEmail,
            courseId,
            action: isUnlocked ? 'revoke' : 'grant'
          })
        });

        if (!response || response.error) throw new Error(response?.error || 'Erro ao comunicar com o servidor');

        const isAi = ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(courseId);

        if (isAi) {
          const newAiStatus = !isUnlocked;
          setSelectedUserForCourses((prev: any) => (prev ? { ...prev, has_unlimited_ai: newAiStatus } : null));
          setAllUsers((prev: any[]) =>
            prev.map(u => (
              u.id === userId || (u.email && userEmail && u.email.toLowerCase() === userEmail.toLowerCase())
                ? { ...u, has_unlimited_ai: newAiStatus }
                : u
            ))
          );
          try {
            localStorage.removeItem(`unlimited_ai_user_${userId}`);
            if (userEmail) {
              localStorage.removeItem(`unlimited_ai_user_${userEmail}`);
            }
          } catch (e) {}
        }

        if (isUnlocked) {
          if (isAi) {
            setUserPurchases(prev => prev.filter(id => !['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(id)));
          } else {
            setUserPurchases(prev => prev.filter(id => id !== courseId));
          }
          toast.success(isAi ? 'Acesso Ilimitado VIP revogado' : 'Acesso removido');
        } else {
          if (isAi) {
            setUserPurchases(prev => [...new Set([...prev, courseId, 'ai_subscription'])]);
          } else {
            setUserPurchases(prev => [...new Set([...prev, courseId])]);
          }
          toast.success(isAi ? 'Acesso Ilimitado VIP liberado' : 'Acesso liberado');
        }
        setTimeout(() => fetchUserPurchases(userId), 800);
      } catch (err: any) {
        console.error('Toggle access error:', err);
        toast.error('Erro ao alterar acesso: ' + (err.message || 'Erro desconhecido'));
      }
    };

    const isAi = ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(courseId);

    if (isUnlocked) {
      setConfirmationModal({
        isOpen: true,
        title: isAi ? 'Revogar Acesso Ilimitado VIP' : 'Remover Acesso ao Curso',
        message: isAi 
          ? 'Tem certeza que deseja revogar o Plano Ilimitado VIP deste usuário?' 
          : 'Tem certeza que deseja remover o acesso do usuário a este curso?',
        type: 'danger',
        confirmText: 'Sim, Remover',
        onConfirm: () => {
          executeToggle();
        }
      });
    } else {
      executeToggle();
    }
  };

  const hasPackageAccess = (pkg: any) => {
    if (!pkg) return false;
    // Check if direct package ID or hotmart ID is in purchases
    if (userPurchases.includes(pkg.id) || (pkg.hotmart_product_id && userPurchases.includes(pkg.hotmart_product_id))) {
      return true;
    }
    // Check if ALL courses in the package are in purchases
    if (pkg.package_courses && pkg.package_courses.length > 0) {
      return pkg.package_courses.every((pc: any) => userPurchases.includes(pc.course_id));
    }
    return false;
  };

  const togglePackageAccess = async (userId: string, pkg: any, isUnlocked: boolean) => {
    const executeToggle = async () => {
      // ALWAYS use pkg.id (UUID) for internal API calls to ensure valid expansion in the backend
      const productId = pkg.id; 
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await safeFetch('/api/v1/admin?action=user-access-toggle', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            userId,
            courseId: productId,
            action: isUnlocked ? 'revoke' : 'grant'
          })
        });

        if (!response || response.error) throw new Error(response?.error || 'Erro ao comunicar com o servidor');

        if (isUnlocked) {
          setUserPurchases(prev => prev.filter(id => id !== productId));
          toast.success('Pacote removido');
        } else {
          // When liberating a package locally, also unlock all its courses if we have the info
          const expandedIds = pkg.package_courses?.map((pc: any) => pc.course_id) || [];
          setUserPurchases(prev => [...new Set([...prev, productId, ...expandedIds])]);
          toast.success('Pacote liberado');
        }
        // Refresh from DB after a small delay to be absolutely sure and sync expanded packages
        setTimeout(() => fetchUserPurchases(userId), 1000);
      } catch (err: any) {
        console.error('Toggle package access error:', err);
        toast.error('Erro ao alterar acesso do pacote: ' + (err.message || 'Erro desconhecido'));
      }
    };

    if (isUnlocked) {
      setConfirmationModal({
        isOpen: true,
        title: 'Remover Acesso ao Pacote',
        message: `Tem certeza que deseja remover o acesso do usuário ao pacote "${pkg.title}"?`,
        type: 'danger',
        confirmText: 'Sim, Remover',
        onConfirm: () => {
          executeToggle();
        }
      });
    } else {
      executeToggle();
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) {
      toast.error('Preencha todos os campos');
      return;
    }

    setCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await safeFetch('/api/v1/admin?action=user-create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserName,
          phone: `+${newUserCountryCode}${newUserPhone}`
        })
      });

      if (!data || data.error) throw new Error(data?.error || 'Erro ao criar usuário');

      toast.success('Usuário criado com sucesso!');
      setShowUserCreator(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserCountryCode('55');
      setNewUserPhone('');
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao criar usuário: ' + err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    // confirm() removed
    setDeletingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await safeFetch(`/api/v1/admin?action=user-delete&id=${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      if (!data || data.error) throw new Error(data?.error || 'Erro ao excluir usuário');

      toast.success('Usuário excluído com sucesso!');
      setSelectedUserForCourses(null);
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao excluir usuário: ' + err.message);
    } finally {
      setDeletingUser(false);
    }
  };

  const generateMagicLink = async (targetEmail: string) => {
    const toastId = toast.loading('Gerando link de acesso...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await safeFetch('/api/v1/auth?action=user-magic-link', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ email: targetEmail })
      });

      if (response && response.link) {
        await navigator.clipboard.writeText(response.link);
        toast.success('MagicLink Temporário gerado e copiado!', { id: toastId });
      } else {
        const errorMsg = response?.error || 'Erro ao gerar link de acesso';
        toast.error(errorMsg, { id: toastId });
      }
    } catch (err: any) {
      toast.error('Erro: ' + (err.message || 'Falha ao conectar com servidor'), { id: toastId });
    }
  };

  const handleUpdateUserPassword = async () => {
    if (!selectedUserForCourses || !userNewPassword) return;
    
    setIsChangingUserPassword(true);
    const toastId = toast.loading('Alterando senha do usuário...');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await safeFetch('/api/v1/admin?action=user-password-change', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ 
          userId: selectedUserForCourses.id, 
          newPassword: userNewPassword 
        })
      });

      if (response && response.success) {
        toast.success('Senha do usuário alterada com sucesso!', { id: toastId });
        setUserNewPassword('');
      } else {
        toast.error('Erro ao alterar senha: ' + (response?.error || 'Erro desconhecido'), { id: toastId });
      }
    } catch (err: any) {
      toast.error('Erro: ' + err.message, { id: toastId });
    } finally {
      setIsChangingUserPassword(false);
    }
  };

  const handleDeleteCourse = (courseId: string, courseTitle: string = 'este curso', isPaid: boolean = false) => {
    setConfirmationModal({
      isOpen: true,
      title: isPaid ? 'Excluir Curso Pago' : 'Excluir Curso',
      message: isPaid 
        ? `Você tem certeza que deseja excluir o curso pago "${courseTitle}"? Esta ação é irreversível e removerá o acesso ao conteúdo.`
        : `Você tem certeza que deseja excluir o curso "${courseTitle}"? Esta ação é irreversível e removerá a publicação.`,
      type: 'danger',
      confirmText: 'Sim, Excluir Curso',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        // Remove immediately from UI for instant feedback
        setCourses(prev => prev.filter(c => c.id !== courseId));

        try {
          const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', courseId);

          if (error) throw error;
          
          toast.success('Curso excluído com sucesso!');
        } catch (err: any) {
          toast.error('Erro ao excluir curso: ' + err.message);
          fetchData(); // Rollback if error
        }
      }
    });
  };

  const handleDeletePackage = async (packageId: string) => {
    setCoursePackages(prev => prev.filter(p => p.id !== packageId));
    try {
      const { error } = await supabase
        .from('course_packages')
        .delete()
        .eq('id', packageId);

      if (error) throw error;
      
      toast.success('Pacote excluído com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao excluir pacote: ' + err.message);
      fetchData();
    }
  };

  const handleSendNotification = async () => {
    if (!notificationTitle || !notificationBody) {
      toast.error('Preencha o título e a mensagem');
      return;
    }

    setSendingNotification(true);
    try {
      // 1. Get target users
      let { data: usersToNotify, error: userError } = await supabase.from('profiles').select('id');
      if (userError) throw userError;

      if (!usersToNotify || usersToNotify.length === 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const authUsers = await safeFetch('/api/v1/admin?action=users-list', {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        if (authUsers && Array.isArray(authUsers)) {
          usersToNotify = authUsers.map(u => ({ id: u.id }));
        }
      }

      if (!usersToNotify || usersToNotify.length === 0) {
        toast.error('Nenhum usuário encontrado para notificar');
        return;
      }

      let finalUserIds = usersToNotify.map(u => u.id);

      // 2. Filter by exclusion if needed
      if (notificationExclusionCourseId) {
        const { data: owners } = await supabase
          .from('purchases')
          .select('user_id')
          .eq('product_id', notificationExclusionCourseId);
        
        const ownerIds = new Set(owners?.map(o => o.user_id) || []);
        finalUserIds = finalUserIds.filter(id => !ownerIds.has(id));
      }

      if (finalUserIds.length === 0) {
        toast.error('Nenhum usuário qualificado após aplicar os filtros');
        return;
      }

      // 3. Send through centralized API
      const { data: { session } } = await supabase.auth.getSession();
      const isBroadcast = !selectedUserForCourses && !searchQuery.trim() && !notificationExclusionCourseId;

      const response = await safeFetch('/api/v1/notifications?action=notification-push', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          title: notificationTitle,
          body: notificationBody,
          type: notificationType,
          userIds: finalUserIds,
          exclusionCourseId: notificationExclusionCourseId,
          isBroadcast
        })
      });

      if (!response || response.error) throw new Error(response?.error || 'Erro inesperado ao enviar');

      if (notificationType === 'in_app') {
        toast.success(notificationTitle ? `Notificação interna enviada para ${finalUserIds.length} usuária(s)!` : 'Notificação enviada!');
      } else if (notificationType === 'push') {
        const pushRes = response.pushResult;
        if (pushRes && pushRes.usersCount > 0) {
          toast.success(notificationTitle ? `Notificação Push enviada para ${pushRes.usersCount} usuária(s)!` : 'Notificação enviada!');
        } else if (pushRes && pushRes.tokensFound === 0) {
          toast.info(`Nenhuma das usuárias selecionadas possui notificações Push ativas no navegador.`);
        } else if (pushRes && pushRes.reason) {
          toast.warning(`Aviso Push: ${pushRes.reason}`);
        } else {
          toast.success(notificationTitle ? `Notificação enviada para ${finalUserIds.length} usuária(s)!` : 'Notificação enviada!');
        }
      } else {
        toast.success(notificationTitle ? `Notificação enviada para ${finalUserIds.length} usuária(s)!` : 'Notificação enviada!');
      }

      const newHistoryItem = response?.historyItem || {
        id: response?.broadcastId || crypto.randomUUID(),
        title: notificationTitle || 'Notificação',
        body: notificationBody || '',
        target_count: finalUserIds.length,
        read_count: 0,
        status: 'sent',
        type: notificationType,
        created_at: new Date().toISOString()
      };
      setNotificationHistory(prev => [newHistoryItem, ...prev.filter(item => item.id !== newHistoryItem.id)]);
      setNotificationTitle('');
      setNotificationBody('');
      setNotificationExclusionCourseId(null);
      setHistoryCategoryFilter('all');
      setHistorySearchQuery('');
      setNotificationSubTab('history');
      await fetchNotificationHistory();
    } catch (err: any) {
      console.error('Error sending notification:', err);
      toast.error('Erro ao enviar notificação: ' + err.message);
    } finally {
      setSendingNotification(false);
    }
  };

  const handleClearHistory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await safeFetch('/api/v1/notifications?action=notification-clear', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      
      if (!response || response.error) throw new Error(response?.error || 'Erro ao apagar histórico');
      
      toast.success('Histórico apagado com sucesso!');
      setNotificationHistory([]);
      setSelectedBroadcast(null);
      setShowClearHistoryConfirm(false);
    } catch (err: any) {
      console.error('Error clearing history:', err);
      toast.error('Ocorreu um erro: ' + err.message);
    }
  };

  const handleUpdateAdminPassword = async () => {
    if (!newAdminPassword || newAdminPassword.length < 4) {
      toast.error(settings.custom_texts?.['admin.security.error_length'] || 'A senha deve ter pelo menos 4 caracteres');
      return;
    }

    if (newAdminPassword !== confirmAdminPassword) {
      toast.error(settings.custom_texts?.['admin.security.error_mismatch'] || 'As senhas não coincidem');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await safeFetch('/api/v1/auth?action=user-password-set', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ newPassword: newAdminPassword })
      });

      if (!data || data.error) throw new Error(data?.error || 'Erro ao atualizar senha');

      toast.success(settings.custom_texts?.['admin.security.success'] || 'Senha do administrador atualizada com sucesso!');
      setNewAdminPassword('');
      setConfirmAdminPassword('');
    } catch (error: any) {
      toast.error('Erro ao atualizar senha: ' + error.message);
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleSaveText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTextKey) return;

    try {
      const newCustomTexts = { 
        ...(settings.custom_texts || {}), 
        [editingTextKey]: editingTextValue 
      };
      
      await updateSettings({ custom_texts: newCustomTexts });
      setEditingTextKey(null);
    } catch (err: any) {
      toast.error('Erro ao salvar texto');
    }
  };

  return (
    <div className="min-h-screen flex overflow-hidden" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 flex flex-col bg-black transition-transform duration-300 ease-in-out
        md:translate-x-0 md:bg-black/40 md:backdrop-blur-xl md:relative
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <h1 className="text-xl font-black text-blue-500 italic uppercase tracking-tighter">
            ADMIN<span className="text-white not-italic">PANEL</span>
          </h1>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-2 text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <SidebarItem 
            icon={<ShoppingBag size={20} />} 
            label="Pacotes" 
            active={activeTab === 'packages'} 
            onClick={() => { setActiveTab('packages'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<BookOpen size={20} />} 
            label="Cursos" 
            active={activeTab === 'courses'} 
            onClick={() => { setActiveTab('courses'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Usuários" 
            active={activeTab === 'users'} 
            onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<BarChart3 size={20} />} 
            label="Vendas" 
            active={activeTab === 'vendas'} 
            onClick={() => { setActiveTab('vendas'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Store size={20} className="text-amber-400" />} 
            label="Central de Produtos" 
            active={activeTab === 'central_produtos'} 
            onClick={() => { setActiveTab('central_produtos'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Globe size={20} />} 
            label="Páginas" 
            active={activeTab === 'pages'} 
            onClick={() => { setActiveTab('pages'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<HelpCircle size={20} />} 
            label="Dúvidas" 
            active={activeTab === 'questions'} 
            onClick={() => { setActiveTab('questions'); setIsMobileMenuOpen(false); }} 
            badge={pendingQuestions.filter(q => !q.is_read_by_admin).length || undefined}
          />
          <SidebarItem 
            icon={<MessageSquare size={20} />} 
            label="Comunidade" 
            active={activeTab === 'community'} 
            onClick={() => { setActiveTab('community'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Bell size={20} />} 
            label="Notificações" 
            active={activeTab === 'notifications'} 
            onClick={() => { setActiveTab('notifications'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Languages size={20} />} 
            label="Idiomas / Textos" 
            active={activeTab === 'languages'} 
            onClick={() => { setActiveTab('languages'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Sparkles size={20} className="text-pink-400" />} 
            label="IA Expert" 
            active={activeTab === 'ai_expert'} 
            onClick={() => { setActiveTab('ai_expert'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Configurações" 
            active={activeTab === 'settings'} 
            onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<LockIcon size={20} />} 
            label="Segurança" 
            active={activeTab === 'security'} 
            onClick={() => { setActiveTab('security'); setIsMobileMenuOpen(false); }} 
          />
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 font-bold">
              {user.email?.[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate">{user.email}</p>
              <p className="text-[10px] text-gray-500 uppercase font-black">Super Admin</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-4 md:px-8 bg-black/20 shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 -ml-2 text-gray-500 hover:text-white transition-colors"
            >
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-bold text-white capitalize truncate">
              {activeTab === 'texts' ? 'Personalização de Texto' : 
               activeTab === 'packages' ? 'Pacotes' :
               activeTab === 'courses' ? 'Cursos' :
               activeTab === 'users' ? 'Usuários' :
               activeTab === 'vendas' ? 'Vendas' :
               activeTab === 'central_produtos' ? 'Central de Produtos' :
               activeTab === 'pages' ? 'Páginas' :
               activeTab === 'community' ? 'Comunidade' :
               activeTab === 'notifications' ? 'Notificações' :
               activeTab === 'languages' ? 'Idiomas / Textos' :
               activeTab === 'ai_expert' ? 'IA Expert' :
               activeTab === 'settings' ? 'Configurações' :
               activeTab === 'security' ? 'Segurança' :
               activeTab === 'questions' ? 'Dúvidas' :
               activeTab}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-xs text-gray-500 font-bold uppercase tracking-widest">
              Painel Administrativo
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <GlowingSpinner size="lg" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="h-full"
              >
                {activeTab === 'questions' && (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-white/5 p-6 rounded-3xl">
                      <div>
                        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">
                          {t('admin.questions_tab') || 'Gestão de Dúvidas'}
                        </h3>
                        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-2">
                          {pendingQuestions.filter(q => !q.answer).length} perguntas aguardando resposta
                        </p>
                      </div>
                      <div className="flex gap-2">
                         <div className="flex bg-black/40 rounded-xl p-1 border border-white/5 gap-1">
                            <button 
                              onClick={() => setQuestionsFilter('all')}
                              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                questionsFilter === 'all' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Todas
                            </button>
                            <button 
                              onClick={() => setQuestionsFilter('unanswered')}
                              className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${
                                questionsFilter === 'unanswered' 
                                  ? 'bg-blue-600 text-white' 
                                  : 'text-gray-400 hover:text-white'
                              }`}
                            >
                              Aguardando Resposta
                            </button>
                         </div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {pendingQuestions.filter(q => questionsFilter === 'all' || !q.answer).length === 0 ? (
                        <div className="text-center py-20 bg-zinc-900/50 rounded-3xl border border-dashed border-white/10">
                          <HelpCircle size={48} className="mx-auto text-gray-700 mb-4 opacity-20" />
                          <p className="text-gray-500 font-bold italic uppercase tracking-widest text-xs">
                            {questionsFilter === 'unanswered' ? 'Nenhuma dúvida pendente encontrada' : 'Nenhuma dúvida encontrada'}
                          </p>
                        </div>
                      ) : (
                        pendingQuestions.filter(q => questionsFilter === 'all' || !q.answer).map((q) => (
                          <motion.div
                            key={q.id}
                            layout
                            className={`bg-zinc-900 border ${q.answer ? 'border-white/5' : 'border-blue-500/30'} rounded-3xl p-6 space-y-4 hover:border-blue-500/50 transition-all`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-600 border border-white/5 overflow-hidden">
                                  {q.user_avatar_url ? <img src={q.user_avatar_url} className="w-full h-full object-cover" /> : <UserIcon size={20} />}
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-sm">{q.user_name}</h4>
                                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                    {q.chapters?.modules?.courses?.title} • {q.chapters?.title}
                                  </p>
                                </div>
                              </div>
                              <div className="text-[10px] font-black text-gray-600 uppercase tracking-widest text-right">
                                {new Date(q.created_at).toLocaleDateString()} {new Date(q.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>

                            <div className="bg-black/30 rounded-2xl p-4 border border-white/5">
                              <p className="text-gray-300 text-sm italic">"{q.question}"</p>
                            </div>

                            {answeringQuestionId === q.id ? (
                              <div className="pt-2 space-y-3">
                                <textarea
                                  autoFocus
                                  value={answerText}
                                  onChange={(e) => setAnswerText(e.target.value)}
                                  placeholder={t('admin.reply_placeholder') || "Digite sua resposta aqui..."}
                                  className="w-full bg-black/60 border border-blue-500/50 rounded-2xl p-4 text-white text-sm outline-none focus:border-blue-500 min-h-[120px] shadow-inner"
                                />
                                <div className="flex justify-end gap-3">
                                  <button 
                                    onClick={() => { setAnsweringQuestionId(null); setAnswerText(''); }}
                                    className="px-6 py-2 bg-white/5 hover:bg-white/10 text-gray-400 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
                                  >
                                    Cancelar
                                  </button>
                                  <button 
                                    disabled={!answerText.trim() || sendingAnswer}
                                    onClick={async () => {
                                      setSendingAnswer(true);
                                      try {
                                        const { error } = await supabase
                                          .from('chapter_questions')
                                          .update({ 
                                            answer: answerText.trim(),
                                            answered_at: new Date().toISOString(),
                                            answered_by: user.id
                                          })
                                          .eq('id', q.id);
                                        
                                        if (error) throw error;
                                        
                                        // Notify the student
                                        try {
                                          const { data: { session } } = await supabase.auth.getSession();
                                          if (session && q.user_id) {
                                            console.log('🔔 Notificando aluno sobre resposta...', q.user_id);
                                            const notifyRes = await fetch('/api/v1/notifications?action=notification-push', {
                                              method: 'POST',
                                              headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${session.access_token}`
                                              },
                                              body: JSON.stringify({
                                                title: t('notifications.user_answer') || 'Sua dúvida foi respondida!',
                                                body: answerText.trim().substring(0, 100) + (answerText.length > 100 ? '...' : ''),
                                                userIds: [q.user_id],
                                                skipPush: false
                                              })
                                            });
                                            
                                            if (!notifyRes.ok) {
                                              const errData = await notifyRes.json().catch(() => ({}));
                                              console.error('Failed to notify user:', notifyRes.status, errData);
                                            } else {
                                              console.log('✅ Aluno notificado com sucesso');
                                            }
                                          }
                                        } catch (notifyErr) {
                                          console.error('Error notifying user:', notifyErr);
                                        }

                                        toast.success('Resposta salva!');
                                        setAnsweringQuestionId(null);
                                        setAnswerText('');
                                        // Use fetchData to refresh list
                                        if (typeof fetchData === 'function') fetchData();
                                      } catch (e) {
                                        toast.error('Erro ao salvar resposta');
                                      } finally {
                                        setSendingAnswer(false);
                                      }
                                    }}
                                    className="px-8 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                                  >
                                    {sendingAnswer ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                    Enviar Resposta
                                  </button>
                                </div>
                              </div>
                            ) : q.answer ? (
                              <div className="space-y-2 pt-2">
                                <div className="flex items-center gap-2 text-green-500 text-[10px] font-black uppercase tracking-widest italic">
                                  <Check size={12} /> Sua Resposta
                                </div>
                                <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-4 group/answer relative">
                                  <p className="text-white text-sm whitespace-pre-wrap">{q.answer}</p>
                                  <div className="mt-2 flex justify-end">
                                     <button 
                                      onClick={() => { setAnsweringQuestionId(q.id); setAnswerText(q.answer); }}
                                      className="text-[9px] font-black text-blue-500 hover:text-white uppercase tracking-widest italic opacity-60 hover:opacity-100 transition-opacity"
                                     >
                                      Editar Resposta
                                     </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="pt-2">
                                <button 
                                  onClick={() => { setAnsweringQuestionId(q.id); setAnswerText(''); }}
                                  className="w-full py-3 bg-blue-600/10 hover:bg-blue-600 text-blue-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border border-blue-500/20 flex items-center justify-center gap-2"
                                >
                                  <MessageSquare size={14} />
                                  Responder Aluno
                                </button>
                              </div>
                            )}

                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'users' && (
                  <div className="space-y-6">
                    {view === 'list' ? (
                      <>
                        <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                          <div className="relative w-full sm:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input 
                              type="text" 
                              placeholder="Buscar usuários..." 
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-blue-500 outline-none transition-all"
                            />
                          </div>
                          <button 
                            onClick={() => setShowUserCreator(true)}
                            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                          >
                            <Plus size={20} /> Novo Usuário
                          </button>
                        </div>

                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left min-w-[600px]">
                            <thead className="bg-white/5 text-gray-500 text-[10px] font-black uppercase tracking-widest">
                              <tr>
                                <th className="px-6 py-5">Usuário</th>
                                <th className="px-6 py-5">Telefone / Email</th>
                                <th className="px-6 py-5">Push status</th>
                                <th className="px-6 py-5">Último Acesso</th>
                                <th className="px-6 py-5 pr-8 text-right font-black">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {allUsers.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500 font-medium">
                                    Nenhum aluno encontrado ou ainda não houveram logins.
                                  </td>
                                </tr>
                              ) : allUsers.filter(u => 
                                u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                u.user_metadata?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                u.user_metadata?.phone?.toLowerCase().includes(searchQuery.toLowerCase())
                              ).length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="px-6 py-12 text-center text-gray-500 font-medium tracking-widest italic uppercase text-[10px]">
                                    Nenhum usuário corresponde à sua busca.
                                  </td>
                                </tr>
                              ) : allUsers.filter(u => 
                                u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                u.user_metadata?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                u.user_metadata?.phone?.toLowerCase().includes(searchQuery.toLowerCase())
                              ).map((u, i) => (
                                <tr key={i} className="hover:bg-white/[0.02] transition-colors group">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-500 flex items-center justify-center text-[10px] font-black italic">
                                        {u.email?.[0].toUpperCase()}
                                      </div>
                                      <div className="flex flex-col">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-sm text-white">{u.user_metadata?.full_name || 'Sem nome'}</span>
                                          {u.has_unlimited_ai && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-amber-300 border border-amber-500/30">
                                              <Sparkles size={10} className="text-amber-400" /> VIP
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                      <span className="text-sm font-bold text-gray-300 font-mono tracking-tighter">
                                        {u.user_metadata?.phone || <span className="text-gray-700 italic opacity-50 text-[10px]">Não informado</span>}
                                      </span>
                                      <span className="text-[10px] text-gray-500 font-medium truncate max-w-[200px]">{u.email}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {u.push_enabled ? (
                                      <div className="flex items-center gap-1.5 text-emerald-500 text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg w-fit">
                                         <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" />
                                         Ativo
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1.5 text-red-500 text-[9px] font-black uppercase tracking-widest bg-red-500/10 px-2 py-1 rounded-lg w-fit">
                                         <div className="w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                                         Inativo
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 text-xs text-gray-500 font-medium">
                                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}
                                  </td>
                                  <td className="px-6 py-4 text-right pr-8">
                                    <div className="flex justify-end gap-2 text-right">
                                      <button 
                                         onClick={() => {
                                           setSelectedUserForCourses(u);
                                           fetchUserPurchases(u.id);
                                          setView('user_details');
                                        }}
                                        className="p-2.5 bg-blue-600/10 hover:bg-blue-600 rounded-xl text-blue-500 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-600/5 hover:shadow-blue-600/20 active:scale-95"
                                      >
                                        <Eye size={14} /> Detalhes
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                    ) : (
                      <div className="space-y-8">
                        <div className="flex items-center justify-between">
                          <button 
                            onClick={() => setView('list')}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-all text-sm font-bold"
                          >
                            <X size={20} /> Voltar para Lista
                          </button>
                          <div className="flex items-center gap-3">
                            <div className="flex bg-zinc-900 border border-white/10 rounded-xl overflow-hidden p-1 gap-1">
                              <button 
                                onClick={() => generateMagicLink(selectedUserForCourses.email)}
                                className="flex items-center gap-2 hover:bg-blue-600/20 text-blue-400 px-4 py-2 rounded-lg font-bold transition-all text-[10px] uppercase tracking-widest whitespace-nowrap"
                                title="Válido por 24 horas"
                              >
                                <ExternalLink size={14} /> MagicLink Temporário
                              </button>
                            </div>
                            <button 
                              onClick={() => setConfirmationModal({
                              isOpen: true,
                              title: 'Excluir Usuário',
                              message: 'Tem certeza que deseja excluir permanentemente este usuário e todos os seus dados? Esta ação não pode ser desfeita.',
                              type: 'danger',
                              confirmText: 'Sim, Excluir Usuário',
                              onConfirm: () => {
                                handleDeleteUser(selectedUserForCourses.id);
                                setView('list');
                              }
                            })}
                            disabled={deletingUser}
                            className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white px-6 py-2.5 rounded-xl font-bold transition-all"
                          >
                            {deletingUser ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                            Excluir Usuário
                          </button>
                        </div>
                      </div>

                      <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-12">
                          <div className="flex items-center gap-6">
                            <div className="w-20 h-20 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 font-bold text-3xl">
                              {selectedUserForCourses?.email?.[0].toUpperCase()}
                            </div>
                            <div>
                              <h3 className="text-2xl font-black text-white uppercase tracking-tighter italic">{selectedUserForCourses?.user_metadata?.full_name || 'Sem nome'}</h3>
                              <div className="flex flex-col gap-1 mt-1">
                                <p className="text-gray-500 font-medium flex items-center gap-2 text-sm"><Mail size={14} className="text-gray-600" /> {selectedUserForCourses?.email}</p>
                                {selectedUserForCourses?.user_metadata?.phone && (
                                  <p className="text-blue-400 font-mono text-sm flex items-center gap-2"><Phone size={14} className="text-blue-600" /> {selectedUserForCourses.user_metadata.phone}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-3">
                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-600 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">
                                  <Clock size={12} /> Último Acesso: {selectedUserForCourses?.last_sign_in_at ? new Date(selectedUserForCourses.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-600 uppercase tracking-widest bg-white/5 px-2 py-1 rounded-lg">
                                  <BookOpen size={12} /> {userPurchases.length} Cursos Liberados
                                </div>
                                <div className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${selectedUserForCourses?.push_enabled ? 'text-emerald-500 bg-emerald-500/10' : 'text-red-500 bg-red-500/10'}`}>
                                  {selectedUserForCourses?.push_enabled ? (
                                    <><Bell size={12} className="animate-pulse" /> Notificações: Ativas</>
                                  ) : (
                                    <><BellOff size={12} /> Notificações: Inativas</>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-12">
                            {/* Password Management */}
                            <div className="bg-black/40 rounded-3xl border border-white/10 p-6 space-y-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-600/20 rounded-lg text-amber-500">
                                  <LockIcon size={20} />
                                </div>
                                <div>
                                  <h4 className="font-bold text-white text-sm">Gestão de Acesso</h4>
                                  <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Alterar senha do usuário</p>
                                </div>
                              </div>
                              
                              <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1">
                                  <input 
                                    type="text" 
                                    placeholder="Mínimo 6 caracteres"
                                    value={userNewPassword}
                                    onChange={(e) => setUserNewPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none transition-all"
                                  />
                                </div>
                                <button 
                                  onClick={handleUpdateUserPassword}
                                  disabled={!userNewPassword || isChangingUserPassword}
                                  className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-amber-600/10"
                                >
                                  {isChangingUserPassword ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                  Alterar Senha do Usuário
                                </button>
                              </div>
                              <p className="text-[9px] text-gray-600 font-bold uppercase italic">
                                * Nota: Recomendamos informar ao usuário sua nova senha após a alteração.
                              </p>
                            </div>

                            {/* IA Expert VIP Management */}
                            <div className="bg-black/40 rounded-3xl border border-white/10 p-6 space-y-4">
                              <div className="flex items-center justify-between flex-wrap gap-4">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 bg-pink-600/20 rounded-xl text-pink-400 border border-pink-500/20">
                                    <Sparkles size={20} />
                                  </div>
                                  <div>
                                    {(() => {
                                      const isVipUnlocked = Boolean(
                                        selectedUserForCourses?.has_unlimited_ai || 
                                        userPurchases.some(p => ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(String(p).toLowerCase()))
                                      );
                                      return (
                                        <div className="flex items-center gap-2">
                                          <h4 className="font-bold text-white text-sm">IA Expert VIP (Ilimitada)</h4>
                                          {isVipUnlocked ? (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500/20 to-pink-500/20 text-amber-300 border border-amber-500/30">
                                              VIP ILIMITADO ATIVO ✨
                                            </span>
                                          ) : (
                                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-zinc-800 text-gray-400 border border-white/10">
                                              Plano Padrão (Com Limite)
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    <p className="text-[10px] text-gray-400 font-medium mt-0.5">Conceda ou revogue acesso ilimitado ao chat da especialista para este usuário.</p>
                                  </div>
                                </div>

                                {(() => {
                                  const isVipUnlocked = Boolean(
                                    selectedUserForCourses?.has_unlimited_ai || 
                                    userPurchases.some(p => ['ai_subscription', 'prod_ai_default', 'hotmart_ia_victoria', 'ia_vip', 'unlimited_ai', 'ai_unlimited'].includes(String(p).toLowerCase()))
                                  );
                                  return (
                                    <button
                                      onClick={() => handleToggleUserUnlimitedAi(selectedUserForCourses)}
                                      disabled={isUpdatingUserAi}
                                      className={`px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-lg ${
                                        isVipUnlocked
                                          ? 'bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white border border-rose-500/20'
                                          : 'bg-gradient-to-r from-amber-500 to-pink-600 hover:from-amber-600 hover:to-pink-700 text-white shadow-pink-500/20'
                                      }`}
                                    >
                                      {isUpdatingUserAi ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                      {isVipUnlocked ? 'Revogar Acesso Ilimitado VIP' : 'Liberar Acesso Ilimitado VIP'}
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>

                            {/* Pacotes / Produtos */}
                            <div className="space-y-4">
                              <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                Pacotes Adquiridos 📦💎
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {coursePackages.filter(pkg => hasPackageAccess(pkg)).map(pkg => {
                                  const isUnlocked = true;
                                  return (
                                    <div key={pkg.id} className="bg-black/40 rounded-2xl border border-white/10 p-4 flex items-center justify-between group hover:border-blue-500/30 transition-all border-blue-500/20">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center text-blue-500">
                                          <ShoppingBag size={20} />
                                        </div>
                                        <div className="min-w-0">
                                          <h5 className="text-xs font-bold text-white truncate max-w-[150px]">{pkg.title}</h5>
                                          <p className="text-[10px] text-gray-600 font-black uppercase">Pacote Completo</p>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={() => togglePackageAccess(selectedUserForCourses.id, pkg, isUnlocked)}
                                        className="px-4 py-2 rounded-xl text-[10px] font-black transition-all bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-lg shadow-red-500/20"
                                      >
                                        REMOVER
                                      </button>
                                    </div>
                                  );
                                })}
                                {coursePackages.filter(pkg => !hasPackageAccess(pkg)).map(pkg => {
                                  const isUnlocked = false;
                                  return (
                                    <div key={pkg.id} className="bg-black/40 rounded-2xl border border-white/5 p-4 flex items-center justify-between group hover:border-white/10 transition-all">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-500">
                                          <ShoppingBag size={20} />
                                        </div>
                                        <div className="min-w-0">
                                          <h5 className="text-xs font-bold text-white truncate max-w-[150px]">{pkg.title}</h5>
                                          <p className="text-[10px] text-gray-600 font-black uppercase">Disponível</p>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={() => togglePackageAccess(selectedUserForCourses.id, pkg, isUnlocked)}
                                        className="px-4 py-2 rounded-xl text-[10px] font-black transition-all bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-lg shadow-blue-600/20"
                                      >
                                        LIBERAR
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Curso Pago Adquiridos */}
                            <div className="space-y-4">
                              <h4 className="text-xs font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                Cursos Pagos Adquiridos 🤑💰
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {courses.filter(c => !c.is_bonus && !c.is_free && userPurchases.includes(c.id)).map(course => {
                                  const isUnlocked = true;
                                  
                                  return (
                                    <div key={course.id} className="bg-black/40 rounded-2xl border border-white/5 p-4 flex items-center justify-between group hover:border-white/10 transition-all">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                                          {course.cover_url?.trim() ? (
                                            <img src={course.cover_url.trim()} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" alt={course.title} />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                              <BookOpen size={14} />
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <h5 className="text-xs font-bold text-white truncate max-w-[150px]">{course.title}</h5>
                                          <p className="text-[10px] text-gray-600 font-black uppercase">R$ {(course.price / 100).toFixed(2)}</p>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-2">
                                        <button 
                                          onClick={() => setConfirmationModal({
                                            isOpen: true,
                                            title: 'Confirmar Bloqueio',
                                            message: 'Tem certeza que deseja bloquear este curso pago?',
                                            type: 'danger',
                                            confirmText: 'Sim, Bloquear',
                                            onConfirm: () => toggleCourseAccess(selectedUserForCourses.id, course.id, isUnlocked)
                                          })}
                                          className="px-4 py-2 rounded-xl text-[10px] font-black transition-all bg-red-500 text-white hover:bg-red-600 active:scale-95 shadow-lg shadow-red-500/20"
                                        >
                                          BLOQUEAR
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                                {courses.filter(c => !c.is_bonus && !c.is_free && userPurchases.includes(c.id)).length === 0 && (
                                  <div className="col-span-full py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-gray-500 text-xs font-bold">
                                    Nenhum curso pago liberado
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Cursos Pagos Ainda Não Adquiridos */}
                            <div className="space-y-4">
                              <h4 className="text-xs font-black text-red-800 uppercase tracking-widest flex items-center gap-2">
                                Cursos Pagos Ainda Não Adquiridos ⏳
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {courses.filter(c => !c.is_bonus && !c.is_free && !userPurchases.includes(c.id)).map(course => {
                                  const isUnlocked = false;
                                  return (
                                    <div key={course.id} className="bg-black/40 rounded-2xl border border-white/5 p-4 flex items-center justify-between group hover:border-white/10 transition-all">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                                          {course.cover_url?.trim() ? (
                                            <img src={course.cover_url.trim()} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" alt={course.title} />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                              <BookOpen size={14} />
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <h5 className="text-xs font-bold text-white truncate max-w-[150px]">{course.title}</h5>
                                          <p className="text-[10px] text-gray-600 font-black uppercase">R$ {(course.price / 100).toFixed(2)}</p>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={() => toggleCourseAccess(selectedUserForCourses.id, course.id, isUnlocked)}
                                        className="px-4 py-2 rounded-xl text-[10px] font-black transition-all bg-green-500 text-white hover:bg-green-600 active:scale-95 shadow-lg shadow-green-500/20"
                                      >
                                        LIBERAR
                                      </button>
                                    </div>
                                  );
                                })}
                                {courses.filter(c => !c.is_bonus && !c.is_free && !userPurchases.includes(c.id)).length === 0 && (
                                  <div className="col-span-full py-8 text-center bg-white/5 rounded-2xl border border-dashed border-white/10 text-gray-500 text-xs font-bold">
                                    Todos os cursos pagos já estão liberados
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Demais Cursos */}
                            <div className="space-y-4">
                              <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                Produtos (Gerais)
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {courses.filter(c => c.is_bonus || c.is_free).sort((a,b) => (a.is_free === b.is_free ? 0 : a.is_free ? -1 : 1)).map(course => {
                                  const isUnlocked = userPurchases.includes(course.id);
                                  return (
                                    <div key={course.id} className="bg-black/40 rounded-2xl border border-white/5 p-4 flex items-center justify-between group hover:border-white/10 transition-all">
                                      <div className="flex items-center gap-3">
                                        <div className="w-10 h-14 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                                          {course.cover_url?.trim() ? (
                                            <img src={course.cover_url.trim()} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" alt={course.title} />
                                          ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                                              <BookOpen size={14} />
                                            </div>
                                          )}
                                        </div>
                                        <div className="min-w-0">
                                          <h5 className="text-xs font-bold text-white truncate max-w-[150px]">{course.title}</h5>
                                          <p className="text-[10px] text-gray-600 font-black uppercase">{course.is_bonus ? 'BÔNUS 🎁' : 'PRODUTO PRINCIPAL ✅'}</p>
                                        </div>
                                      </div>
                                      {isUnlocked && (
                                        <div className="px-4 py-2 rounded-xl text-[10px] font-black bg-white/5 text-gray-500">
                                          LIBERADO
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'courses' && (
                  <div className="space-y-6">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Gerenciar Cursos</h3>
                            <p className="text-xs text-gray-400">Organize os produtos principais, bônus e cursos pagos.</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => fetchCourses(true)}
                              disabled={loadingCourses}
                              className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-white/10 active:scale-95 disabled:opacity-50"
                              title="Atualizar Lista de Cursos"
                            >
                              <RefreshCw size={15} className={loadingCourses ? 'animate-spin text-blue-500' : ''} />
                              <span>{loadingCourses ? 'Atualizando...' : 'Atualizar'}</span>
                            </button>
                            <button
                              onClick={() => { setEditingCourseId(null); setShowCourseEditor(true); }}
                              className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-400 hover:to-rose-400 text-black px-4 sm:px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-amber-500/20 active:scale-95 cursor-pointer"
                            >
                              <Sparkles size={16} />
                              <span>Criar com IA</span>
                            </button>
                            <button 
                              onClick={() => { setEditingCourseId(null); setShowCourseEditor(true); }}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-600/20 active:scale-95 cursor-pointer"
                            >
                              <Plus size={18} /> Criar Curso
                            </button>
                          </div>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center gap-3">
                          <Info size={16} className="text-blue-500 shrink-0" />
                          <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
                            A ordem definida abaixo através das setas será a mesma exibida na tela de início do usuário. Novos cursos cadastrados são posicionados automaticamente no final da categoria.
                          </p>
                        </div>
                      </div>

                    <div className="space-y-12">
                      {/* Produtos Principais (Free) */}
                      <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/5 border border-white/5 p-4 rounded-2xl">
                          <h4 className="text-[10px] sm:text-xs font-black text-emerald-800 uppercase tracking-[0.2em] flex items-center gap-2 shrink-0">
                            <Star size={12} className="text-emerald-500" />
                            Produtos Principais 💎
                          </h4>
                          <span className="text-[10px] font-bold text-gray-400">
                            Configuração do Produto Principal gerenciada via Central de Produtos
                          </span>
                        </div>
                        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-none">
                          {courses
                            .filter(c => !c.is_bonus && c.is_free)
                            .sort((a, b) => {
                              const orderA = a.order_index ?? 9999;
                              const orderB = b.order_index ?? 9999;
                              if (orderA !== orderB) return orderA - orderB;
                              return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                            })
                            .map((course) => (
                              <CourseAdminCard key={course.id} course={course} courseStats={courseStats} setViewingCourseId={setViewingCourseId} setEditingCourseId={setEditingCourseId} setShowCourseEditor={setShowCourseEditor} onDelete={handleDeleteCourse} onMove={handleMoveCourse} />
                            ))}
                        </div>
                      </div>

                      {/* Cursos Bônus (Bonus) */}
                      <div className="space-y-6">
                        <h4 className="text-[10px] sm:text-xs font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2">
                          <Sparkles size={12} className="text-blue-500" />
                          Cursos Bônus 🎁
                        </h4>
                        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-none">
                          {courses
                            .filter(c => c.is_bonus)
                            .sort((a, b) => {
                              const orderA = a.order_index ?? 9999;
                              const orderB = b.order_index ?? 9999;
                              if (orderA !== orderB) return orderA - orderB;
                              return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                            })
                            .map((course) => (
                              <CourseAdminCard key={course.id} course={course} courseStats={courseStats} setViewingCourseId={setViewingCourseId} setEditingCourseId={setEditingCourseId} setShowCourseEditor={setShowCourseEditor} onDelete={handleDeleteCourse} onMove={handleMoveCourse} />
                            ))}
                        </div>
                      </div>

                      {/* Cursos Pagos (Paid) */}
                      <div className="space-y-6">
                        <h4 className="text-[10px] sm:text-xs font-black text-red-900 uppercase tracking-[0.2em] flex items-center gap-2">
                          <ShoppingBag size={12} className="text-red-500" />
                          Cursos Pagos 💳
                        </h4>
                        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-none">
                          {courses
                            .filter(c => !c.is_bonus && !c.is_free)
                            .sort((a, b) => {
                              const orderA = a.order_index ?? 9999;
                              const orderB = b.order_index ?? 9999;
                              if (orderA !== orderB) return orderA - orderB;
                              return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
                            })
                            .map((course) => (
                              <CourseAdminCard key={course.id} course={course} courseStats={courseStats} setViewingCourseId={setViewingCourseId} setEditingCourseId={setEditingCourseId} setShowCourseEditor={setShowCourseEditor} onDelete={handleDeleteCourse} onMove={handleMoveCourse} />
                            ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'packages' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Gerenciar Pacotes</h3>
                      <button 
                        onClick={() => { setEditingPackageId(null); setShowPackageEditor(true); }}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                      >
                        <Plus size={20} /> Criar Pacote
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {coursePackages.map((pkg) => (
                        <div key={pkg.id} className="bg-zinc-900/40 rounded-3xl border border-white/5 p-6 space-y-4 hover:border-white/10 transition-all group">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-lg font-black text-white uppercase italic tracking-tighter truncate max-w-[200px]">{pkg.title}</h4>
                              <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">ID Hotmart: {pkg.hotmart_product_id || 'Não definido'}</p>
                            </div>
                            <div className="bg-white/5 px-2 py-1 rounded-lg border border-white/5">
                              <span className="text-[10px] font-black text-gray-500 uppercase">{pkg.package_courses?.length || 0} CURSOS</span>
                            </div>
                          </div>
                          
                          <div className="flex gap-2 pt-4">
                            <button 
                              onClick={() => { setEditingPackageId(pkg.id); setShowPackageEditor(true); }}
                              className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                              <Edit3 size={14} /> Editar
                            </button>
                            <button 
                              onClick={() => {
                                setConfirmationModal({
                                  isOpen: true,
                                  title: 'Excluir Pacote',
                                  message: 'Tem certeza que deseja excluir este pacote? Isso NÃO excluirá os cursos contidos nele.',
                                  type: 'danger',
                                  confirmText: 'Excluir',
                                  onConfirm: () => handleDeletePackage(pkg.id)
                                });
                              }}
                              className="w-10 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl flex items-center justify-center transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                      {coursePackages.length === 0 && (
                        <div className="col-span-full py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10">
                          <ShoppingBag size={48} className="mx-auto mb-4 text-gray-700 opacity-20" />
                          <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Nenhum pacote criado ainda</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === 'community' && (
                  <div className="h-full">
                    <div className="mb-6">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Gestão da Comunidade</h3>
                      <p className="text-sm text-gray-500">Visualize, comente e importe conversas para a comunidade.</p>
                    </div>
                    <div className="bg-zinc-900/30 rounded-3xl border border-white/5 p-1 h-[calc(100vh-250px)] overflow-y-auto custom-scrollbar">
                      <Community user={user} isImportMode={true} />
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="max-w-4xl space-y-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Central de Notificações</h3>
                        <p className="text-sm text-gray-500">Envie avisos e gerencie o histórico de mensagens.</p>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="flex p-1 bg-black rounded-xl border border-white/10 w-fit">
                          <button 
                            onClick={() => setNotificationSubTab('send')}
                            className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${notificationSubTab === 'send' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Enviar Nova
                          </button>
                          <button 
                            onClick={() => {
                              setNotificationSubTab('history');
                              fetchNotificationHistory();
                            }}
                            className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${notificationSubTab === 'history' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Histórico
                          </button>
                        </div>

                        {notificationSubTab === 'history' && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={fetchNotificationHistory}
                              disabled={loadingHistory}
                              className="flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10"
                              title="Atualizar Histórico"
                            >
                              <RefreshCw size={14} className={loadingHistory ? 'animate-spin text-blue-500' : ''} />
                              <span>Atualizar</span>
                            </button>

                            {notificationHistory.length > 0 && (
                              <button 
                                onClick={() => setShowClearHistoryConfirm(true)}
                                className="flex items-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20"
                              >
                                <Trash2 size={14} /> Apagar Tudo
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {notificationSubTab === 'send' ? (
                      <div className="max-w-2xl space-y-6">
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-6">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Título da Notificação</label>
                            <input 
                              type="text" 
                              value={notificationTitle}
                              onChange={e => setNotificationTitle(e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                              placeholder="Ex: Nova aula liberada! 🚀"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Mensagem</label>
                            <textarea 
                              value={notificationBody}
                              onChange={e => setNotificationBody(e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none min-h-[100px]"
                              placeholder="Digite o conteúdo da notificação..."
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Tipo de Envio</label>
                            <div className="flex p-1 bg-black rounded-xl border border-white/10">
                              <button 
                                onClick={() => setNotificationType('in_app')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${notificationType === 'in_app' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                              >
                                INTERNA
                              </button>
                              <button 
                                onClick={() => setNotificationType('push')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${notificationType === 'push' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                              >
                                PUSH
                              </button>
                              <button 
                                onClick={() => setNotificationType('both')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${notificationType === 'both' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                              >
                                AMBAS
                              </button>
                            </div>
                          </div>

                          <div className="pt-4 border-t border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-bold text-white">Filtro de Exclusão (Promoção)</h4>
                                <p className="text-[10px] text-gray-500">Não enviar para quem já possui o curso selecionado.</p>
                              </div>
                            </div>

                            <select 
                              value={notificationExclusionCourseId || ''}
                              onChange={e => setNotificationExclusionCourseId(e.target.value || null)}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none text-sm"
                            >
                              <option value="">Enviar para todos (Sem exclusão)</option>
                              {courses.map(c => (
                                <option key={c.id} value={c.id}>Exceto quem tem: {c.title}</option>
                              ))}
                            </select>
                          </div>

                          <button 
                            onClick={handleSendNotification}
                            disabled={sendingNotification}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3"
                          >
                            {sendingNotification ? <Loader2 className="animate-spin" size={20} /> : (
                              <>
                                <Bell size={20} /> Enviar Agora
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Filters & Search Header */}
                        {notificationHistory.length > 0 && (
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                              {[
                                { id: 'all', label: 'Todas', count: notificationHistory.length },
                                { 
                                  id: 'courses', 
                                  label: '🎓 Aulas & Dúvidas', 
                                  count: notificationHistory.filter(i => {
                                    const text = ((i.title || '') + ' ' + (i.body || '')).toLowerCase();
                                    return text.includes('dúvida') || text.includes('duvida') || text.includes('aula') || text.includes('curso') || text.includes('pergunta') || text.includes('resposta');
                                  }).length 
                                },
                                { 
                                  id: 'community', 
                                  label: '💬 Comunidade', 
                                  count: notificationHistory.filter(i => {
                                    const text = ((i.title || '') + ' ' + (i.body || '')).toLowerCase();
                                    return text.includes('comunidade') || text.includes('post') || text.includes('comentário') || text.includes('comentario');
                                  }).length 
                                },
                                { 
                                  id: 'general', 
                                  label: '📢 Avisos Gerais', 
                                  count: notificationHistory.filter(i => {
                                    const text = ((i.title || '') + ' ' + (i.body || '')).toLowerCase();
                                    const isCourse = text.includes('dúvida') || text.includes('duvida') || text.includes('aula') || text.includes('curso') || text.includes('pergunta') || text.includes('resposta');
                                    const isComm = text.includes('comunidade') || text.includes('post') || text.includes('comentário') || text.includes('comentario');
                                    return !isCourse && !isComm;
                                  }).length 
                                }
                              ].map(tab => (
                                <button
                                  key={tab.id}
                                  onClick={() => setHistoryCategoryFilter(tab.id as any)}
                                  className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all flex items-center gap-1.5 ${
                                    historyCategoryFilter === tab.id
                                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                                      : 'bg-black/40 text-gray-400 hover:text-white border border-white/5'
                                  }`}
                                >
                                  <span>{tab.label}</span>
                                  <span className={`px-1.5 py-0.2 rounded-full text-[9px] ${historyCategoryFilter === tab.id ? 'bg-white/20 text-white' : 'bg-white/5 text-gray-500'}`}>
                                    {tab.count}
                                  </span>
                                </button>
                              ))}
                            </div>

                            <div className="relative min-w-[200px] sm:max-w-xs">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                              <input
                                type="text"
                                value={historySearchQuery}
                                onChange={e => setHistorySearchQuery(e.target.value)}
                                placeholder="Buscar no histórico..."
                                className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:border-blue-500 outline-none transition-all"
                              />
                            </div>
                          </div>
                        )}

                        {loadingHistory ? (
                          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-2xl border border-white/10">
                            <GlowingSpinner size="md" color="blue" className="mb-4" />
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Carregando Histórico...</p>
                          </div>
                        ) : notificationHistory.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-2xl border border-white/10 text-center px-6">
                            <Bell size={48} className="text-gray-700 mb-4" />
                            <p className="text-white font-black uppercase text-sm tracking-tight mb-1">Nenhuma notificação enviada ainda</p>
                            <p className="text-gray-500 text-xs max-w-sm mb-6">Quando você enviar avisos aos alunos, o histórico e o relatório de leitura aparecerão aqui em tempo real.</p>
                            <button 
                              onClick={() => setNotificationSubTab('send')}
                              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-600/20"
                            >
                              Enviar Primeira Notificação
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                              {notificationHistory
                                .filter(item => {
                                  // Category filter
                                  const text = ((item.title || '') + ' ' + (item.body || '')).toLowerCase();
                                  const isCourse = text.includes('dúvida') || text.includes('duvida') || text.includes('aula') || text.includes('curso') || text.includes('pergunta') || text.includes('resposta');
                                  const isComm = text.includes('comunidade') || text.includes('post') || text.includes('comentário') || text.includes('comentario');

                                  if (historyCategoryFilter === 'courses' && !isCourse) return false;
                                  if (historyCategoryFilter === 'community' && !isComm) return false;
                                  if (historyCategoryFilter === 'general' && (isCourse || isComm)) return false;

                                  // Search query filter
                                  if (historySearchQuery.trim()) {
                                    const q = historySearchQuery.toLowerCase().trim();
                                    return (item.title || '').toLowerCase().includes(q) || (item.body || '').toLowerCase().includes(q);
                                  }

                                  return true;
                                })
                                .map(item => {
                                const totalTargets = item.target_count || 0;
                                const totalReads = item.read_count || 0;
                                const readPercent = totalTargets > 0 ? Math.round((totalReads / totalTargets) * 100) : 0;

                                const text = ((item.title || '') + ' ' + (item.body || '')).toLowerCase();
                                const isCourse = text.includes('dúvida') || text.includes('duvida') || text.includes('aula') || text.includes('curso') || text.includes('pergunta') || text.includes('resposta');
                                const isComm = text.includes('comunidade') || text.includes('post') || text.includes('comentário') || text.includes('comentario');

                                return (
                                  <div key={item.id} className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all group">
                                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                      <div className="space-y-2 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                          {/* Type badge */}
                                          <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${
                                            item.type === 'push' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                            item.type === 'in_app' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                            'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                          }`}>
                                            {item.type === 'both' ? 'PUSH + INTERNA' : (item.type === 'in_app' ? 'INTERNA' : 'PUSH')}
                                          </span>

                                          {/* Category badge */}
                                          {isCourse ? (
                                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                              🎓 AULA / DÚVIDA
                                            </span>
                                          ) : isComm ? (
                                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/30">
                                              💬 COMUNIDADE
                                            </span>
                                          ) : (
                                            <span className="text-[8px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-zinc-700/40 text-zinc-300 border border-zinc-600/30">
                                              📢 GERAL
                                            </span>
                                          )}

                                          <span className="text-[10px] font-bold text-gray-500 flex items-center gap-1">
                                            <Calendar size={12} className="opacity-60" />
                                            {new Date(item.created_at || item.sent_at).toLocaleString('pt-BR')}
                                          </span>
                                        </div>
                                        <h4 className="font-black text-white uppercase tracking-tight text-base">{item.title}</h4>
                                        <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{item.body}</p>
                                      </div>
                                      
                                      <div className="flex items-center md:flex-col md:items-end justify-between gap-3 shrink-0 pt-3 md:pt-0 border-t md:border-t-0 border-white/5">
                                        <div className="flex items-center gap-3">
                                          <div className="text-center px-3 py-1.5 bg-black/40 rounded-xl border border-white/5 min-w-[70px]">
                                            <p className="text-xs font-black text-white">{totalTargets}</p>
                                            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Enviados</p>
                                          </div>
                                          <div className="text-center px-3 py-1.5 bg-black/40 rounded-xl border border-white/5 min-w-[70px]">
                                            <p className="text-xs font-black text-emerald-400">{totalReads} <span className="text-[9px] font-normal text-emerald-500/70">({readPercent}%)</span></p>
                                            <p className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Lidos</p>
                                          </div>
                                        </div>

                                        <button 
                                          onClick={() => fetchBroadcastDetails(item)}
                                          className="px-4 py-2 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all border border-blue-500/20 shadow-sm"
                                        >
                                          <span>Ver Leituras</span>
                                          <ChevronRight size={13} />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Broadcast Details Modal */}
                    <AnimatePresence>
                      {showClearHistoryConfirm && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setShowClearHistoryConfirm(false)}
                            className="absolute inset-0 bg-black/90 backdrop-blur-xl"
                          />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-md bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden p-8 text-center"
                          >
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                              <Trash2 size={40} className="text-red-500" />
                            </div>
                            
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-2">Apagar Todo Histórico?</h3>
                            <p className="text-sm text-gray-400 mb-8 leading-relaxed">
                              Esta ação apagará permanentemente todos os registros de notificações enviadas e os dados de leitura. <span className="text-red-500 font-bold">Esta ação não pode ser desfeita.</span>
                            </p>

                            <div className="grid grid-cols-2 gap-3">
                              <button 
                                onClick={() => setShowClearHistoryConfirm(false)}
                                className="py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black rounded-2xl transition-all uppercase text-[10px] tracking-widest"
                              >
                                Cancelar
                              </button>
                              <button 
                                onClick={handleClearHistory}
                                className="py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all uppercase text-[10px] tracking-widest shadow-lg shadow-red-600/20"
                              >
                                Sim, Apagar
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}

                      {selectedBroadcast && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedBroadcast(null)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                          />
                          <motion.div 
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            className="relative w-full max-w-3xl bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
                          >
                            {/* Modal Header */}
                            <div className="p-6 md:p-8 border-b border-white/5 bg-white/5 flex items-start justify-between gap-4">
                              <div className="space-y-1 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                                    selectedBroadcast.type === 'push' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                                    selectedBroadcast.type === 'in_app' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                    'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  }`}>
                                    {selectedBroadcast.type === 'both' ? 'PUSH + INTERNA' : (selectedBroadcast.type === 'in_app' ? 'INTERNA' : 'PUSH')}
                                  </span>
                                  <span className="text-[10px] font-bold text-gray-500">
                                    {new Date(selectedBroadcast.created_at || selectedBroadcast.sent_at).toLocaleString('pt-BR')}
                                  </span>
                                </div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">{selectedBroadcast.title}</h3>
                                <p className="text-xs text-gray-400 line-clamp-2">{selectedBroadcast.body}</p>
                              </div>
                              <button 
                                onClick={() => setSelectedBroadcast(null)}
                                className="p-2 hover:bg-white/10 text-gray-400 hover:text-white rounded-full transition-all shrink-0"
                              >
                                <X size={22} />
                              </button>
                            </div>

                            {/* Modal Metrics Banner */}
                            {(() => {
                              const totalCount = viewingBroadcastDetails.length || selectedBroadcast.target_count || 0;
                              const readCount = viewingBroadcastDetails.filter(d => d.is_read).length;
                              const unreadCount = Math.max(0, totalCount - readCount);
                              const rate = totalCount > 0 ? Math.round((readCount / totalCount) * 100) : 0;

                              const filteredDetails = viewingBroadcastDetails.filter(item => {
                                const matchesFilter = 
                                  broadcastDetailsFilter === 'all' ? true :
                                  broadcastDetailsFilter === 'read' ? item.is_read :
                                  !item.is_read;

                                const query = broadcastDetailsSearch.toLowerCase().trim();
                                const matchesSearch = !query || 
                                  (item.profiles?.full_name || '').toLowerCase().includes(query) ||
                                  (item.profiles?.email || '').toLowerCase().includes(query);

                                return matchesFilter && matchesSearch;
                              });

                              return (
                                <>
                                  <div className="px-6 md:px-8 py-4 bg-black/40 border-b border-white/5 space-y-4">
                                    {/* Stats Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                      <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Destinatários</p>
                                        <p className="text-lg font-black text-white">{totalCount}</p>
                                      </div>
                                      <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
                                        <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Lidos</p>
                                        <p className="text-lg font-black text-emerald-400">{readCount}</p>
                                      </div>
                                      <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
                                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Não Lidos</p>
                                        <p className="text-lg font-black text-gray-300">{unreadCount}</p>
                                      </div>
                                      <div className="bg-zinc-800/60 rounded-xl p-3 border border-white/5">
                                        <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest">Taxa de Leitura</p>
                                        <p className="text-lg font-black text-blue-400">{rate}%</p>
                                      </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="w-full bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                      <div 
                                        className="bg-emerald-500 h-full rounded-full transition-all duration-500" 
                                        style={{ width: `${rate}%` }} 
                                      />
                                    </div>

                                    {/* Controls: Search + Filter Tabs */}
                                    {viewingBroadcastDetails.length > 0 && (
                                      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                                        <div className="relative w-full sm:w-64">
                                          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                          <input 
                                            type="text"
                                            value={broadcastDetailsSearch}
                                            onChange={e => setBroadcastDetailsSearch(e.target.value)}
                                            placeholder="Buscar aluno..."
                                            className="w-full pl-9 pr-3 py-2 bg-black border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:border-blue-500 outline-none"
                                          />
                                        </div>

                                        <div className="flex p-1 bg-black rounded-xl border border-white/10 w-full sm:w-auto">
                                          <button 
                                            onClick={() => setBroadcastDetailsFilter('all')}
                                            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${broadcastDetailsFilter === 'all' ? 'bg-zinc-800 text-white' : 'text-gray-500 hover:text-white'}`}
                                          >
                                            Todos ({viewingBroadcastDetails.length})
                                          </button>
                                          <button 
                                            onClick={() => setBroadcastDetailsFilter('read')}
                                            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${broadcastDetailsFilter === 'read' ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                          >
                                            Lidos ({readCount})
                                          </button>
                                          <button 
                                            onClick={() => setBroadcastDetailsFilter('unread')}
                                            className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${broadcastDetailsFilter === 'unread' ? 'bg-zinc-800 text-white' : 'text-gray-500 hover:text-white'}`}
                                          >
                                            Não Lidos ({unreadCount})
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* User List Content */}
                                  <div className="p-6 md:p-8 overflow-y-auto flex-1 custom-scrollbar">
                                    {loadingDetails ? (
                                      <div className="flex flex-col items-center justify-center py-16">
                                        <GlowingSpinner size="md" color="blue" className="mb-4" />
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Buscando status de leitura...</p>
                                      </div>
                                    ) : selectedBroadcast.type === 'push' && viewingBroadcastDetails.length === 0 ? (
                                      <div className="text-center py-12 px-6 bg-zinc-800/30 rounded-2xl border border-white/5">
                                        <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                          <Bell size={32} className="text-orange-500 opacity-60" />
                                        </div>
                                        <p className="text-sm text-white font-bold mb-2">Notificação Exclusiva por Push</p>
                                        <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
                                          Esta mensagem foi disparada exclusivamente para os navegadores e celulares cadastrados. Leituras detalhadas ficam disponíveis quando o aviso é enviado no formato <strong>INTERNA</strong> ou <strong>AMBAS</strong>.
                                        </p>
                                      </div>
                                    ) : viewingBroadcastDetails.length === 0 ? (
                                      <div className="text-center py-16">
                                        <p className="text-sm text-gray-400">Nenhum registro de leitura encontrado para este aviso.</p>
                                      </div>
                                    ) : filteredDetails.length === 0 ? (
                                      <div className="text-center py-12">
                                        <p className="text-sm text-gray-400">Nenhum aluno encontrado com este filtro.</p>
                                      </div>
                                    ) : (
                                      <div className="space-y-2">
                                        {filteredDetails.map((detail, idx) => (
                                          <div key={idx} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5 hover:border-white/10 transition-all">
                                            <div className="flex items-center gap-3">
                                              <div className="w-9 h-9 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-xs font-black text-white shrink-0 overflow-hidden">
                                                {detail.profiles?.avatar_url ? (
                                                  <img 
                                                    src={detail.profiles.avatar_url} 
                                                    alt={detail.profiles?.full_name || ''} 
                                                    className="w-full h-full object-cover" 
                                                    referrerPolicy="no-referrer"
                                                  />
                                                ) : (
                                                  (detail.profiles?.full_name || 'U').charAt(0).toUpperCase()
                                                )}
                                              </div>
                                              <div className="flex flex-col">
                                                <span className="text-sm font-black text-white tracking-tight">
                                                  {detail.profiles?.full_name || 'Aluno'}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-500">
                                                  {detail.profiles?.email || 'Sem e-mail'}
                                                </span>
                                              </div>
                                            </div>

                                            <div>
                                              {detail.is_read ? (
                                                <div className="flex flex-col items-end">
                                                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                                    <CheckCircle2 size={12} className="text-emerald-400" /> Lido
                                                  </span>
                                                  {detail.read_at && (
                                                    <span className="text-[8px] font-bold text-gray-500 mt-1">
                                                      {new Date(detail.read_at).toLocaleString('pt-BR')}
                                                    </span>
                                                  )}
                                                </div>
                                              ) : (
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1.5 bg-zinc-800/80 px-2.5 py-1 rounded-full border border-white/5">
                                                  <Clock size={12} className="text-gray-500" /> Não Lido
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </>
                              );
                            })()}

                            {/* Modal Footer */}
                            <div className="p-6 bg-black/60 border-t border-white/5">
                              <button 
                                onClick={() => setSelectedBroadcast(null)}
                                className="w-full py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-black rounded-xl transition-all uppercase text-xs tracking-widest"
                              >
                                Fechar
                              </button>
                            </div>
                          </motion.div>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {activeTab === 'languages' && (
                  <div className="space-y-8 pb-20">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Idiomas e Textos</h3>
                        <p className="text-sm text-gray-500">Configure os padrões de linguagem ou edite textos individualmente.</p>
                      </div>
                    </div>

                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                          <Languages size={20} />
                        </div>
                        <h4 className="font-bold text-white">Padrões de Linguagem</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {[
                          { id: 'pt', name: 'Português', icon: '🇧🇷' },
                          { id: 'en', name: 'English', icon: '🇺🇸' },
                          { id: 'es', name: 'Español', icon: '🇪🇸' }
                        ].map((lang) => (
                          <button
                            key={lang.id}
                            onClick={async () => {
                              setConfirmationModal({
                                isOpen: true,
                                title: `Mudar para ${lang.name}`,
                                message: `Tem certeza que deseja mudar todos os textos para o padrão em ${lang.name}? Isso substituirá suas edições atuais em textos.`,
                                type: 'info',
                                confirmText: 'Confirmar',
                                onConfirm: async () => {
                                  const newTexts = { 
                                    ...(settings.custom_texts || {}), 
                                    ...languagePresets[lang.id],
                                    'app.language': lang.id 
                                  };
                                  await updateSettings({ custom_texts: newTexts });
                                  setDraftCustomTexts(newTexts);
                                  toast.success(`Textos alterados para ${lang.name}!`);
                                }
                              });
                            }}
                            className="p-6 bg-black/40 border border-white/10 rounded-2xl flex flex-col items-center gap-3 hover:border-blue-500 hover:bg-blue-500/5 transition-all group"
                          >
                            <span className="text-4xl">{lang.icon}</span>
                            <span className="text-sm font-black text-white uppercase tracking-widest">{lang.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-purple-600/20 rounded-lg text-purple-500">
                            <Type size={20} />
                          </div>
                          <h4 className="font-bold text-white">Editor de Textos</h4>
                        </div>
                        <button 
                          onClick={async () => {
                            setIsSavingPages(true);
                            await updateSettings({ custom_texts: draftCustomTexts });
                            setIsSavingPages(false);
                            toast.success('Todos os textos salvos!');
                          }}
                          disabled={isSavingPages}
                          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-xl font-bold transition-all"
                        >
                          {isSavingPages ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                          Salvar Tudo
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.keys(languagePresets.pt).map((key) => (
                           <div key={key} className="space-y-2 bg-black/20 p-4 rounded-xl border border-white/5">
                               <div className="flex flex-col space-y-1 mb-1">
                                 <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{key}</label>
                                 <span className="text-[9px] font-medium text-blue-500/80 leading-tight">Padrão: {languagePresets.pt[key]}</span>
                               </div>
                             <textarea 
                               value={draftCustomTexts[key] || settings.custom_texts?.[key] || ''}
                               onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [key]: e.target.value })}
                               className="w-full bg-black border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:border-blue-500 outline-none min-h-[60px] custom-scrollbar"
                               placeholder={languagePresets.pt[key]}
                             />
                           </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'central_produtos' && (
                  <div className="max-w-6xl space-y-8 pb-20">
                    {/* Header Banner */}
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-zinc-900/80 border border-amber-500/20 p-8 rounded-3xl backdrop-blur-xl relative overflow-hidden">
                      <div className="space-y-2 z-10 max-w-2xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-black uppercase tracking-widest">
                          <Store size={14} /> Arquitetura Centralizada de Vendas
                        </div>
                        <h3 className="text-3xl font-black text-white uppercase tracking-tighter">Central de Produtos & Webhook</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">
                          Cadastre e gerencie todos os IDs de produtos da Hotmart em um único local. A automação via Webhook Edge Function consulta exclusivamente este catálogo para criar/liberar/pausar acessos de forma dinâmica.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 z-10">
                        <button
                          onClick={handleSyncProductsMigration}
                          disabled={isSyncingProducts}
                          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 px-5 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg"
                        >
                          {isSyncingProducts ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                          Sincronizar Existentes
                        </button>
                        <button
                          onClick={() => {
                            setEditingProduct(null);
                            setProductForm({
                              id: '',
                              hotmart_product_id: '',
                              name: '',
                              product_type: 'main_product',
                              internal_target_id: '',
                              checkout_url: '',
                              is_active: true,
                              description: ''
                            });
                            setShowProductModal(true);
                          }}
                          className="flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-black px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-xl hover:scale-105"
                        >
                          <Plus size={18} /> Novo Produto Mapeado
                        </button>
                      </div>
                    </div>

                    {/* Mapped Products Grid */}
                    <div className="bg-zinc-900/50 rounded-3xl border border-white/10 p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-white text-lg uppercase tracking-tight">Catálogo de Produtos Mapeados ({mappedProducts.length})</h4>
                          <p className="text-xs text-gray-400">Produtos que a Hotmart pode enviar via webhook para liberação.</p>
                        </div>
                        <button
                          onClick={() => fetchCentralProducts(true)}
                          disabled={isSyncingProducts}
                          className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-amber-400 rounded-xl transition-all border border-white/10 flex items-center gap-2 text-xs font-bold"
                          title="Atualizar lista"
                        >
                          <RefreshCw size={16} className={isSyncingProducts ? "animate-spin text-amber-400" : ""} />
                          <span>Atualizar</span>
                        </button>
                      </div>

                      {mappedProducts.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl bg-black/20 space-y-4">
                          <Store size={40} className="mx-auto text-amber-400/50" />
                          <div className="space-y-1">
                            <p className="text-white font-bold text-sm">Nenhum produto cadastrado na Central</p>
                            <p className="text-xs text-gray-500 max-w-md mx-auto">
                              Clique em "Sincronizar Existentes" para migrar automaticamente os IDs de cursos e pacotes ou cadastre manualmente.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {mappedProducts.map((prod) => {
                            const isMissingId = !prod.hotmart_product_id || 
                                                prod.hotmart_product_id.trim() === '' || 
                                                prod.hotmart_product_id.trim() === 'HOTMART_PRODUTO_PRINCIPAL';
                            return (
                              <div
                                key={prod.id}
                                className={`rounded-2xl p-6 space-y-4 transition-all flex flex-col justify-between ${
                                  isMissingId
                                    ? 'bg-red-950/20 border-2 border-red-500/80 shadow-lg shadow-red-500/25 hover:border-red-400'
                                    : 'bg-black/60 border border-white/10 hover:border-amber-500/40'
                                }`}
                              >
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${
                                      prod.product_type === 'main_product' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                      prod.product_type === 'ai_subscription' ? 'bg-pink-500/10 text-pink-400 border-pink-500/30' :
                                      prod.product_type === 'package' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                      'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                    }`}>
                                      {prod.product_type === 'main_product' ? 'PRODUTO PRINCIPAL' :
                                       prod.product_type === 'ai_subscription' ? 'ASSINATURA IA EXPERT' :
                                       prod.product_type === 'package' ? 'PACOTE' : 'CURSO'}
                                    </span>
                                  </div>
                                </div>

                                <div>
                                  <h5 className="font-black text-white text-base leading-snug">{prod.name}</h5>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    {prod.hotmart_product_id && prod.hotmart_product_id.trim() !== '' && prod.hotmart_product_id.trim() !== 'HOTMART_PRODUTO_PRINCIPAL' ? (
                                      <span className="text-xs font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                        ID Hotmart: {prod.hotmart_product_id}
                                      </span>
                                    ) : (
                                      <span className="text-xs font-bold text-red-300 bg-red-500/20 px-2.5 py-1 rounded-lg border border-red-500/50 flex items-center gap-1.5 animate-pulse shadow-sm shadow-red-500/20">
                                        <AlertTriangle size={13} className="text-red-400" />
                                        Cadastrar ID Hotmart (Pendente)
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {prod.description && (
                                  <p className="text-xs text-gray-400 line-clamp-2">{prod.description}</p>
                                )}

                              <div className="pt-4 border-t border-white/5 flex items-center justify-between gap-3">
                                <button
                                  onClick={() => {
                                    setEditingProduct(prod);
                                    setProductForm({
                                      id: prod.id,
                                      hotmart_product_id: prod.hotmart_product_id || '',
                                      name: prod.name || '',
                                      product_type: prod.product_type || 'main_product',
                                      internal_target_id: prod.internal_target_id || '',
                                      checkout_url: prod.checkout_url || '',
                                      is_active: prod.is_active !== false,
                                      description: prod.description || ''
                                    });
                                    setShowProductModal(true);
                                  }}
                                  className="flex-1 py-2 bg-white/5 hover:bg-white/10 text-white font-bold text-xs rounded-xl transition-all border border-white/10 flex items-center justify-center gap-1.5"
                                >
                                  <Edit3 size={14} /> Editar
                                </button>
                                {prod.product_type !== 'main_product' && (
                                  <button
                                    onClick={() => setDeletingProduct({ id: prod.id, name: prod.name })}
                                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all border border-red-500/20"
                                    title="Remover produto"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        </div>
                      )}
                    </div>

                    {/* Quick Webhook Info & Custom URL Box (Abaixo do Catálogo de Produtos) */}
                    <div className="bg-black/40 border border-white/10 rounded-3xl p-6 md:p-8 space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-amber-500/10 rounded-2xl text-amber-400 border border-amber-500/20">
                            <Zap size={22} />
                          </div>
                          <div>
                            <h4 className="font-black text-white text-base uppercase tracking-wider">URL do Webhook da Hotmart (Supabase Edge Function)</h4>
                            <p className="text-xs text-gray-400">Configure e edite a URL do endpoint que recebe as notificações de vendas e cancelamentos da Hotmart.</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full self-start sm:self-center">
                          {settings?.custom_texts?.['hotmart.webhook_url'] ? 'URL Personalizada' : 'URL Padrão'}
                        </span>
                      </div>

                      <div className="space-y-5">
                        {/* URL Campo */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-300">
                              URL do Endpoint do Webhook (Hotmart)
                            </label>
                            {settings?.custom_texts?.['hotmart.webhook_url'] && (
                              <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                                URL Personalizada
                              </span>
                            )}
                          </div>
                          
                          <div className="relative">
                            <input
                              type="text"
                              value={customWebhookInput}
                              onChange={(e) => setCustomWebhookInput(e.target.value)}
                              placeholder="Ex: https://fhnmpltilhongdofnzbj.supabase.co/functions/v1/hotmart-webhook"
                              className="w-full bg-black/90 border border-white/15 rounded-2xl px-4 py-3.5 text-xs text-amber-300 font-mono focus:border-amber-500 outline-none pr-10 shadow-inner"
                            />
                            {customWebhookInput && (
                              <button
                                onClick={() => setCustomWebhookInput('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white p-1"
                                title="Limpar campo"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Token Hottok Campo */}
                        <div className="space-y-2 pt-3 border-t border-white/10">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-gray-300 flex items-center gap-2">
                              <Lock size={14} className="text-amber-400" />
                              <span>Token Hottok de Segurança da Hotmart</span>
                              <span className="text-[10px] text-gray-400 font-normal hidden sm:inline">(Hotmart -&gt; Ferramentas -&gt; Webhook)</span>
                            </label>
                            {settings?.custom_texts?.['hotmart.webhook_token'] && (
                              <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                <ShieldCheck size={12} /> Token Salvo
                              </span>
                            )}
                          </div>
                          
                          <div className="relative">
                            <input
                              type={showWebhookToken ? 'text' : 'password'}
                              value={customWebhookTokenInput}
                              onChange={(e) => setCustomWebhookTokenInput(e.target.value)}
                              placeholder="Ex: QH9u3LRfb0nqliIJmAtPfHiNB0ftku560d3b84-5836-4f25-bf1c-acf98f6d1b8a"
                              className="w-full bg-black/90 border border-white/15 rounded-2xl px-4 py-3 text-xs text-amber-300 font-mono focus:border-amber-500 outline-none pr-12 shadow-inner"
                            />
                            <button
                              type="button"
                              onClick={() => setShowWebhookToken(!showWebhookToken)}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-400 transition-colors p-1"
                              title={showWebhookToken ? "Ocultar Token" : "Mostrar Token"}
                            >
                              {showWebhookToken ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>

                          <div className="bg-black/50 border border-amber-500/20 rounded-xl p-3 text-[11px] text-gray-300 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-400">
                              <ShieldCheck size={14} />
                              <span>Segurança & Melhores Práticas (Zero Trust):</span>
                            </div>
                            <p className="text-gray-400 leading-relaxed">
                              • Este token é o segredo compartilhado que impede requisições não autorizadas à sua Edge Function.<br />
                              • Em produção, mantenha a chave no Supabase em <b>Edge Functions -&gt; Secrets -&gt; HOTMART_WEBHOOK_TOKEN</b>.<br />
                              • Ao simular aqui no painel, a requisição é autenticada com segurança via servidor Node.js backend.
                            </p>
                          </div>
                        </div>

                        {/* Botões de Ação posicionados ABAIXO da linha do Token */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                          <button
                            onClick={handleSaveWebhookUrl}
                            disabled={isSavingWebhookUrl}
                            className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider px-6 py-3.5 rounded-2xl transition-all shadow-lg disabled:opacity-50"
                            title="Salvar URL e Token no banco de dados"
                          >
                            {isSavingWebhookUrl ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            <span>Salvar URL e Token</span>
                          </button>

                          <button
                            onClick={handleTestWebhookUrl}
                            disabled={isTestingWebhookUrl}
                            className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 font-bold text-xs uppercase tracking-wider px-5 py-3.5 rounded-2xl transition-all shadow-md disabled:opacity-50"
                            title="Testar requisição GET nesta URL"
                          >
                            {isTestingWebhookUrl ? <Loader2 className="animate-spin text-amber-400" size={16} /> : <Globe size={16} />}
                            <span>Testar Conexão</span>
                          </button>
                        </div>

                        {/* Rodapé Informativo: Exemplos */}
                        <div className="space-y-3 border-t border-white/10 pt-4 text-[11px] text-gray-400">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-emerald-400/90 font-medium">
                              ✓ Compatível com Sandbox e Produção v2.0.0 da Hotmart
                            </span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                            <div className="bg-black/50 p-3 rounded-xl border border-white/10 text-gray-400 space-y-1">
                              <span className="text-amber-400 font-bold block text-xs">Exemplo do Formato da URL:</span>
                              <code className="text-gray-300 font-mono text-[10px] break-all block bg-black/60 p-1.5 rounded border border-white/5">
                                https://fhnmpltilhongdofnzbj.supabase.co/functions/v1/hotmart-webhook
                              </code>
                            </div>
                            <div className="bg-black/50 p-3 rounded-xl border border-white/10 text-gray-400 space-y-1">
                              <span className="text-amber-400 font-bold block text-xs">Exemplo do Token Hottok:</span>
                              <code className="text-gray-300 font-mono text-[10px] break-all block bg-black/60 p-1.5 rounded border border-white/5">
                                QH9u3LRfb0nqliIJmAtPfHiNB0ftku560d3b84-5836-4f25-bf1c-acf98f6d1b8a
                              </code>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Live Webhook Tester Section */}
                    <div className="bg-zinc-900/50 rounded-3xl border border-white/10 p-8 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-400 border border-emerald-500/20">
                          <Bot size={20} />
                        </div>
                        <div>
                          <h4 className="font-black text-white text-lg uppercase tracking-tight">Simulador de Webhook Live</h4>
                          <p className="text-xs text-gray-400">Teste o envio de compras ou cancelamentos em tempo real sem afetar a Hotmart.</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400">E-mail do Aluno / Comprador</label>
                          <input
                            type="email"
                            value={simTestEmail}
                            onChange={(e) => setSimTestEmail(e.target.value)}
                            placeholder="aluno.teste@email.com"
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400">Produto a Simular</label>
                          <select
                            value={simTestProductId}
                            onChange={(e) => setSimTestProductId(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                          >
                            <option value="">-- Produto Principal --</option>
                            {mappedProducts.map(p => (
                              <option key={p.id} value={p.hotmart_product_id}>
                                {p.name} (ID: {p.hotmart_product_id})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400">Tipo de Evento</label>
                          <select
                            value={simTestEvent}
                            onChange={(e) => setSimTestEvent(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                          >
                            <option value="PURCHASE_APPROVED">Compra completa</option>
                            <option value="PURCHASE_REFUNDED">Reembolso/Cancelamento</option>
                            <option value="SUBSCRIPTION_INACTIVE">Assinatura inativa</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={handleSimulateWebhook}
                          disabled={simulatingWebhook}
                          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
                        >
                          {simulatingWebhook ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                          Executar Simulação
                        </button>
                      </div>

                      {simResult && (
                        <div className="bg-black/90 border border-white/10 rounded-2xl p-5 space-y-4 font-mono text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold uppercase tracking-widest text-xs">Resultado do Disparo HTTP:</span>
                              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${
                                simResult.success || simResult.http_status === 200
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                  : simResult.http_status === 401
                                  ? 'bg-red-500/20 text-red-400 border-red-500/30'
                                  : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                              }`}>
                                HTTP {simResult.http_status || (simResult.success ? 200 : 500)} {simResult.success ? 'OK' : 'ERRO'}
                              </span>
                            </div>

                            {simResult.simulated_via && (
                              <span className="text-[10px] bg-zinc-800 text-gray-300 px-2.5 py-1 rounded-lg border border-white/10 font-bold">
                                Endpoint: {simResult.simulated_via === 'edge_function_url' ? simResult.target_url : 'Handler Interno de Fallback'}
                              </span>
                            )}
                          </div>

                          {simResult.http_status === 401 && (
                            <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-4 space-y-2 text-xs text-red-200">
                              <div className="flex items-center gap-2 font-bold text-red-400">
                                <AlertTriangle size={16} />
                                <span>Aviso de Autenticação Hottok (HTTP 401)</span>
                              </div>
                              <p className="text-[11px] leading-relaxed text-red-300">
                                A Edge Function do Supabase recusou a requisição porque o token <code className="bg-black/60 px-1 py-0.5 rounded text-amber-300">hottok</code> enviado na simulação ({simResult.sent_hottok || 'SIMULATION_TOKEN'}) não confere com o segredo <code className="bg-black/60 px-1 py-0.5 rounded text-amber-300">HOTMART_WEBHOOK_TOKEN</code> configurado na Edge Function do Supabase.
                              </p>
                              <div className="text-[11px] font-sans bg-black/40 p-2.5 rounded-lg border border-red-500/20 space-y-1">
                                <span className="font-bold text-white">Como resolver em 1 passo:</span>
                                <p>1. Copie o token Hottok exato da Hotmart e cole no campo <b>"Token Hottok de Segurança da Hotmart"</b> acima e clique em <b>"Salvar URL e Token"</b>.</p>
                                <p>2. No painel do Supabase -&gt; Edge Functions -&gt; Secrets, adicione a variável <code className="text-amber-300 font-mono">HOTMART_WEBHOOK_TOKEN</code> com esse mesmo valor.</p>
                              </div>
                            </div>
                          )}

                          {(!simResult.success || (simResult.http_status && simResult.http_status >= 400)) && simResult.http_status !== 401 && (
                            <div className="bg-red-950/50 border border-red-500/40 rounded-xl p-4 space-y-2 text-xs text-red-200">
                              <div className="flex items-center gap-2 font-bold text-red-400">
                                <AlertTriangle size={16} />
                                <span>Falha ao conectar na URL: NetworkError when attempting to fetch resource. Por favor, verifique a "URL do Endpoint do Webhook (Hotmart)".</span>
                              </div>
                              <p className="text-[11px] leading-relaxed text-red-300 font-mono">
                                Falha ao conectar na URL: NetworkError when attempting to fetch resource. Por favor, verifique a "URL do Endpoint do Webhook (Hotmart)".
                              </p>
                              <div className="text-[11px] font-sans bg-black/40 p-2.5 rounded-lg border border-red-500/20 space-y-1">
                                <span className="font-bold text-amber-300">Ação Recomendada:</span>
                                <p>• <b>Por favor, verifique a "URL do Endpoint do Webhook (Hotmart)"</b> configurada no painel abaixo do Catálogo de Produtos Mapeados.</p>
                                <p>• Certifique-se de que a URL esteja correta e funcional.</p>
                              </div>
                            </div>
                          )}

                          {simResult.sent_payload && (
                            <div className="space-y-1">
                              <span className="text-amber-400 font-bold text-[10px] uppercase tracking-wider">Payload POST Enviado (Formato Hotmart v2.0.0):</span>
                              <pre className="text-gray-300 bg-black/60 p-3 rounded-xl border border-white/5 overflow-x-auto whitespace-pre-wrap max-h-48 custom-scrollbar">
                                {JSON.stringify(simResult.sent_payload, null, 2)}
                              </pre>
                            </div>
                          )}

                          <div className="space-y-1">
                            <span className="text-emerald-400 font-bold text-[10px] uppercase tracking-wider">Resposta do Servidor (Body):</span>
                            <pre className="text-gray-300 bg-black/60 p-3 rounded-xl border border-white/5 overflow-x-auto whitespace-pre-wrap max-h-48 custom-scrollbar">
                              {JSON.stringify(simResult.result || simResult, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Webhook Events Audit Log */}
                    <div className="bg-zinc-900/50 rounded-3xl border border-white/10 p-8 space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-white text-lg uppercase tracking-tight">Logs de Eventos Recebidos ({webhookLogs.length})</h4>
                          <p className="text-xs text-gray-400">Histórico detalhado para auditoria e controle de idempotência.</p>
                        </div>
                        <button
                          onClick={() => fetchCentralProducts(true)}
                          disabled={isSyncingProducts}
                          className="p-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-amber-400 rounded-xl transition-all border border-white/10 flex items-center gap-2 text-xs font-bold"
                          title="Atualizar logs"
                        >
                          <RefreshCw size={16} className={isSyncingProducts ? "animate-spin text-amber-400" : ""} />
                          <span>Atualizar</span>
                        </button>
                      </div>

                      {webhookLogs.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-8 border border-white/5 rounded-2xl">
                          Nenhum log de webhook registrado até o momento.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs text-gray-300">
                            <thead className="bg-black/60 text-gray-500 uppercase font-black text-[10px] tracking-widest">
                              <tr>
                                <th className="p-4">Data/Hora</th>
                                <th className="p-4">Comprador</th>
                                <th className="p-4">Evento</th>
                                <th className="p-4">ID Produto</th>
                                <th className="p-4">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {webhookLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                  <td className="p-4 font-mono text-gray-400">
                                    {new Date(log.processed_at || log.created_at).toLocaleString('pt-BR')}
                                  </td>
                                  <td className="p-4 font-bold text-white">{log.buyer_email}</td>
                                  <td className="p-4">
                                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                      log.event.includes('APPROVED') || log.event.includes('COMPLETE') ? 'bg-emerald-500/20 text-emerald-300' :
                                      log.event.includes('REFUND') || log.event.includes('CANCEL') ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
                                    }`}>
                                      {log.event}
                                    </span>
                                  </td>
                                  <td className="p-4 font-mono text-amber-300">{log.hotmart_product_id || 'N/A'}</td>
                                  <td className="p-4">
                                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                      {log.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'ai_expert' && (
                  <div className="max-w-5xl space-y-8 pb-20">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                          <Sparkles className="text-pink-500" size={28} /> IA Expert & Prompt
                        </h3>
                        <p className="text-sm text-gray-400 mt-1">
                          Configure a base de conhecimento, o contexto do sistema, a foto da especialista e todas as variáveis exibidas no chat da IA.
                        </p>
                      </div>

                      <button
                        onClick={async () => {
                          setIsSavingPages(true);
                          await updateSettings({ custom_texts: draftCustomTexts });
                          await refreshSettings();
                          setIsSavingPages(false);
                          toast.success('Configurações da IA salvas com sucesso!');
                        }}
                        disabled={isSavingPages}
                        className="flex items-center gap-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-pink-600/20 shrink-0"
                      >
                        {isSavingPages ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        Salvar Alterações
                      </button>
                    </div>

                    {/* Section 0: Status Global da Função IA Expert */}
                    <div className="bg-zinc-900/60 rounded-3xl border border-white/10 p-6 md:p-8 space-y-6">
                      <div className="flex items-center justify-between gap-4 pb-4 border-b border-white/10">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-500/20 rounded-xl text-emerald-400 border border-emerald-500/30">
                            <Bot size={22} />
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-base">Status da Função IA Expert</h4>
                            <p className="text-xs text-gray-500">Ative ou desative a função de IA Expert (Ask Victoria) para todas as alunas no app.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={(draftCustomTexts['ai_expert.enabled'] ?? settings.custom_texts?.['ai_expert.enabled']) !== 'false'}
                            onChange={(e) => setDraftCustomTexts({
                              ...draftCustomTexts,
                              'ai_expert.enabled': e.target.checked ? 'true' : 'false'
                            })}
                            className="sr-only peer"
                          />
                          <div className="w-12 h-6.5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[3px] after:left-[3px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>
                      <p className="text-xs text-gray-400">
                        {(draftCustomTexts['ai_expert.enabled'] ?? settings.custom_texts?.['ai_expert.enabled']) !== 'false' 
                          ? '✅ A aba e o botão "Ask Victoria" estão visíveis para as alunas.' 
                          : '🚫 A função está desativada e oculta em todo o aplicativo.'}
                      </p>
                    </div>

                    {/* Section 1: Perfil da Expert */}
                    <div className="bg-zinc-900/60 rounded-3xl border border-white/10 p-6 md:p-8 space-y-6">
                      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                        <div className="p-2.5 bg-pink-500/20 rounded-xl text-pink-400 border border-pink-500/30">
                          <UserIcon size={22} />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base">Perfil e Identidade da Expert</h4>
                          <p className="text-xs text-gray-500">Altere o nome, cargo e foto de perfil exibidos para as alunas.</p>
                        </div>
                      </div>

                      <div className="space-y-2 pb-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Nome da Aba no Menu (Botão Clicável da Aluna)</label>
                        <input
                          type="text"
                          value={draftCustomTexts['ai_expert.tab_name'] ?? settings.custom_texts?.['ai_expert.tab_name'] ?? 'Ask Victoria'}
                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.tab_name': e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-pink-500 outline-none"
                          placeholder="Ex: Ask Victoria"
                        />
                        <p className="text-[11px] text-gray-500">Nome exibido no botão da barra de navegação inferior e cabeçalho para a aluna clicar (Padrão: Ask Victoria).</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Nome da Expert</label>
                          <input
                            type="text"
                            value={draftCustomTexts['ai_expert.name'] ?? settings.custom_texts?.['ai_expert.name'] ?? 'Victoria'}
                            onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.name': e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-pink-500 outline-none"
                            placeholder="Ex: Victoria"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Cargo / Subtítulo</label>
                          <input
                            type="text"
                            value={draftCustomTexts['ai_expert.subtitle'] ?? settings.custom_texts?.['ai_expert.subtitle'] ?? 'Psychologist & Relationship Expert'}
                            onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.subtitle': e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-pink-500 outline-none"
                            placeholder="Ex: Psychologist & Relationship Expert"
                          />
                        </div>
                      </div>

                      <div className="space-y-3 pt-2">
                        <label className="text-xs font-black text-gray-400 uppercase tracking-widest">URL da Foto da Expert</label>
                        <div className="flex flex-col md:flex-row items-center gap-4">
                          <div className="relative w-20 h-20 rounded-2xl overflow-hidden bg-black border-2 border-pink-500/40 shrink-0 shadow-lg">
                            <img
                              src={draftCustomTexts['ai_expert.avatar_url']?.trim() || settings.custom_texts?.['ai_expert.avatar_url']?.trim() || 'https://fhnmpltilhongdofnzbj.supabase.co/storage/v1/object/public/contents/Victoria.png'}
                              alt="Preview da Expert"
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://fhnmpltilhongdofnzbj.supabase.co/storage/v1/object/public/contents/Victoria.png';
                              }}
                            />
                          </div>
                          <div className="flex-1 w-full space-y-1">
                            <input
                              type="text"
                              value={draftCustomTexts['ai_expert.avatar_url'] ?? settings.custom_texts?.['ai_expert.avatar_url'] ?? 'https://fhnmpltilhongdofnzbj.supabase.co/storage/v1/object/public/contents/Victoria.png'}
                              onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.avatar_url': e.target.value })}
                              className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-pink-500 outline-none"
                              placeholder="https://sua-imagem.com/foto-expert.png"
                            />
                            <p className="text-[11px] text-gray-500">Cole aqui o link direto da imagem JPG ou PNG que aparecerá na foto de perfil do chat.</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 2: Contexto & Base de Conhecimento Grande */}
                    <div className="bg-zinc-900/60 rounded-3xl border border-white/10 p-6 md:p-8 space-y-6">
                      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                        <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400 border border-blue-500/30">
                          <Sparkles size={22} />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base">Contexto Grande & Base de Conhecimento da IA (System Prompt)</h4>
                          <p className="text-xs text-gray-500">
                            Insira o contexto detalhado, diretrizes de atendimento psicológico, tom de voz, regras e metodologia. A IA seguirá este guia estritamente durante os atendimentos.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <textarea
                          rows={16}
                          value={draftCustomTexts['ai_expert.system_prompt'] ?? settings.custom_texts?.['ai_expert.system_prompt'] ?? ''}
                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.system_prompt': e.target.value })}
                          className="w-full bg-black border border-white/10 rounded-2xl p-5 text-white text-xs md:text-sm font-mono leading-relaxed focus:border-pink-500 outline-none custom-scrollbar"
                          placeholder={`Você é a Victoria, uma psicóloga e mentora de relacionamentos altamente empática e técnica...\n\nDIRETRIZES DE ATENDIMENTO:\n1. Mantenha um tom acolhedor e seguro.\n2. Faça perguntas reflexivas para ajudar a aluna...\n3. Metodologia: Foco em comunicação não violenta e inteligência emocional.`}
                        />
                        <p className="text-[11px] text-gray-500 italic">
                          💡 Dica: Se deixado em branco, a IA usará as diretrizes padrão de mentora de relacionamento e comunicação.
                        </p>
                      </div>
                    </div>

                    {/* Section 3: Mensagens & Digitando */}
                    <div className="bg-zinc-900/60 rounded-3xl border border-white/10 p-6 md:p-8 space-y-6">
                      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                        <div className="p-2.5 bg-purple-500/20 rounded-xl text-purple-400 border border-purple-500/30">
                          <MessageSquare size={22} />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base">Mensagem de Boas-Vindas e Digitando</h4>
                          <p className="text-xs text-gray-500">Edite os textos do indicador de digitação e mensagens de boas-vindas exibidas no chat.</p>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Texto de Digitando</label>
                          <input
                            type="text"
                            value={draftCustomTexts['ai_expert.typing_indicator'] ?? settings.custom_texts?.['ai_expert.typing_indicator'] ?? `${draftCustomTexts['ai_expert.name'] ?? settings.custom_texts?.['ai_expert.name'] ?? 'Victoria'} is typing...`}
                            onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.typing_indicator': e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-pink-500 outline-none"
                            placeholder="Ex: Victoria is typing..."
                          />
                          <p className="text-[11px] text-gray-500">Aparece enquanto a IA está gerando a resposta.</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Texto do Campo de Digitar (Placeholder)</label>
                          <input
                            type="text"
                            value={draftCustomTexts['ai_expert.input_placeholder'] ?? settings.custom_texts?.['ai_expert.input_placeholder'] ?? `Ask ${draftCustomTexts['ai_expert.name'] ?? settings.custom_texts?.['ai_expert.name'] ?? 'Victoria'}...`}
                            onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.input_placeholder': e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-pink-500 outline-none"
                            placeholder="Ex: Ask Victoria..."
                          />
                          <p className="text-[11px] text-gray-500">Texto exibido na caixa de digitação antes de digitar a pergunta.</p>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Mensagem Inicial de Boas-Vindas</label>
                          <textarea
                            rows={5}
                            value={draftCustomTexts['ai_expert.welcome_message'] ?? settings.custom_texts?.['ai_expert.welcome_message'] ?? ''}
                            onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.welcome_message': e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-pink-500 outline-none"
                            placeholder={`Hello, {name}! ❤️ I’m Victoria Hayes, your Relationship Expert.\n\nWhatever is happening between you and him, you don’t have to figure it out alone.\n\nTell me what’s going on — what he said, what he did, how things have changed, or what you’re hoping will happen.\n\nI’m here to help with whatever you need, and together, we’ll figure out what’s happening and what to do next. 💕`}
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Mensagem de Boas-Vindas ao Resetar Chat</label>
                          <textarea
                            rows={3}
                            value={draftCustomTexts['ai_expert.reset_chat_welcome'] ?? settings.custom_texts?.['ai_expert.reset_chat_welcome'] ?? ''}
                            onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.reset_chat_welcome': e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-pink-500 outline-none"
                            placeholder={`Chat reset! ❤️ I'm ${draftCustomTexts['ai_expert.name'] ?? settings.custom_texts?.['ai_expert.name'] ?? 'Victoria'}, how can I help you now?`}
                          />
                          <p className="text-[11px] text-gray-500">Mensagem exibida quando a usuária clica no botão de reiniciar a conversa no chat da IA.</p>
                        </div>

                        {/* Quick Prompts Section with Toggle */}
                        <div className="space-y-3 pt-4 border-t border-white/10">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-xs font-black text-gray-400 uppercase tracking-widest block">Sugestões de Perguntas Rápidas</label>
                              <p className="text-xs text-gray-500">Por padrão vem desabilitado. Se ativado, exibe botões com sugestões para a aluna no início do chat.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(draftCustomTexts['ai_expert.enable_quick_prompts'] ?? settings.custom_texts?.['ai_expert.enable_quick_prompts']) === 'true'}
                                onChange={(e) => setDraftCustomTexts({
                                  ...draftCustomTexts,
                                  'ai_expert.enable_quick_prompts': e.target.checked ? 'true' : 'false'
                                })}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                            </label>
                          </div>

                          {(draftCustomTexts['ai_expert.enable_quick_prompts'] ?? settings.custom_texts?.['ai_expert.enable_quick_prompts']) === 'true' && (
                            <div className="space-y-2 pt-2">
                              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Lista de Perguntas Rápidas (Uma por linha)</label>
                              <textarea
                                rows={4}
                                value={draftCustomTexts['ai_expert.quick_prompts'] ?? settings.custom_texts?.['ai_expert.quick_prompts'] ?? ''}
                                onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.quick_prompts': e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-pink-500 outline-none"
                                placeholder={`Como melhorar a comunicação com meu parceiro?\nFormas de reconstruir a confiança no relacionamento\nComo impor limites emocionais saudáveis`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Section 4: Limite de Mensagens */}
                    <div className="bg-zinc-900/60 rounded-3xl border border-white/10 p-6 md:p-8 space-y-6">
                      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
                        <div className="p-2.5 bg-rose-500/20 rounded-xl text-rose-400 border border-rose-500/30">
                          <Clock size={22} />
                        </div>
                        <div>
                          <h4 className="font-bold text-white text-base">Limite de Mensagens do Chat</h4>
                          <p className="text-xs text-gray-500">Configure se a aluna terá um número restrito de mensagens que pode enviar para a IA Expert.</p>
                        </div>
                      </div>

                      <div className="space-y-5">
                        <div className="flex items-center justify-between gap-4 p-4 bg-black/40 rounded-2xl border border-white/5">
                          <div>
                            <label className="text-sm font-bold text-white block">Ativar Limite de Mensagens</label>
                            <p className="text-xs text-gray-500">Quando ativado, bloqueia novas perguntas assim que a aluna atingir o limite configurado.</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer shrink-0">
                            <input
                              type="checkbox"
                              checked={(draftCustomTexts['ai_expert.enable_message_limit'] ?? settings.custom_texts?.['ai_expert.enable_message_limit']) === 'true'}
                              onChange={(e) => setDraftCustomTexts({
                                ...draftCustomTexts,
                                'ai_expert.enable_message_limit': e.target.checked ? 'true' : 'false'
                              })}
                              className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                          </label>
                        </div>

                        {(draftCustomTexts['ai_expert.enable_message_limit'] ?? settings.custom_texts?.['ai_expert.enable_message_limit']) === 'true' && (
                          <div className="space-y-5 pt-2 animate-fadeIn">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Quantidade de Mensagens Permitidas</label>
                                <input
                                  type="number"
                                  min={1}
                                  value={draftCustomTexts['ai_expert.max_messages_count'] ?? settings.custom_texts?.['ai_expert.max_messages_count'] ?? '3'}
                                  onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.max_messages_count': e.target.value })}
                                  className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-rose-500 outline-none"
                                  placeholder="Ex: 3"
                                />
                                <p className="text-[11px] text-gray-500">Número de perguntas que a aluna pode fazer no período.</p>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Frequência de Renovação do Limite</label>
                                <select
                                  value={draftCustomTexts['ai_expert.limit_frequency'] ?? settings.custom_texts?.['ai_expert.limit_frequency'] ?? 'daily'}
                                  onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.limit_frequency': e.target.value })}
                                  className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-rose-500 outline-none appearance-none"
                                >
                                  <option value="daily">Por Dia (Diário - Reseta a cada 24 horas)</option>
                                  <option value="weekly">Por Semana (Semanal - Reseta a cada 7 dias)</option>
                                  <option value="monthly">Por Mês (Mensal - Reseta a cada 30 dias)</option>
                                  <option value="lifetime">Única Vez (Total absoluto acumulado)</option>
                                </select>
                                <p className="text-[11px] text-gray-500">Determina com que frequência a contagem é reiniciada.</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Título do Alerta de Limite</label>
                                <input
                                  type="text"
                                  value={draftCustomTexts['ai_expert.limit_reached_title'] ?? settings.custom_texts?.['ai_expert.limit_reached_title'] ?? 'Message Limit Reached'}
                                  onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.limit_reached_title': e.target.value })}
                                  className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-rose-500 outline-none"
                                  placeholder="Ex: Message Limit Reached"
                                />
                                <p className="text-[11px] text-gray-500">Título exibido no quadro de limite atingido.</p>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Texto do Botão de Compra de Cotas</label>
                                <input
                                  type="text"
                                  value={draftCustomTexts['ai_expert.buy_more_button_text'] ?? settings.custom_texts?.['ai_expert.buy_more_button_text'] ?? 'Upgrade to Unlimited Monthly'}
                                  onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.buy_more_button_text': e.target.value })}
                                  className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-rose-500 outline-none"
                                  placeholder="Ex: Upgrade to Unlimited Monthly"
                                />
                                <p className="text-[11px] text-gray-500">Rótulo do botão para adquirir mais mensagens.</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Link do Checkout do Plano Ilimitado VIP (URL)</label>
                              <input
                                type="url"
                                value={draftCustomTexts['ai_expert.buy_more_url'] ?? settings.custom_texts?.['ai_expert.buy_more_url'] ?? ''}
                                onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.buy_more_url': e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-rose-500 outline-none"
                                placeholder="Ex: https://checkout.seu-gateway.com/mensalidade-victoria-ilimitada"
                              />
                              <p className="text-[11px] text-gray-500">Cole aqui o link do checkout (Hotmart, Kiwify, Stripe, etc.) para venda da mensalidade ilimitada da IA.</p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Benefício 1 do Card VIP (Texto)</label>
                                <input
                                  type="text"
                                  value={draftCustomTexts['ai_expert.benefit_1'] ?? settings.custom_texts?.['ai_expert.benefit_1'] ?? 'Unlimited messages 24 hours a day, 7 days a week'}
                                  onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.benefit_1': e.target.value })}
                                  className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-rose-500 outline-none"
                                  placeholder="Ex: Unlimited messages 24 hours a day, 7 days a week"
                                />
                                <p className="text-[11px] text-gray-500">Primeiro item de benefício exibido no modal de upgrade.</p>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Benefício 2 do Card VIP (Texto)</label>
                                <input
                                  type="text"
                                  value={draftCustomTexts['ai_expert.benefit_2'] ?? settings.custom_texts?.['ai_expert.benefit_2'] ?? 'Instant access with zero commitments'}
                                  onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.benefit_2': e.target.value })}
                                  className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-rose-500 outline-none"
                                  placeholder="Ex: Instant access with zero commitments"
                                />
                                <p className="text-[11px] text-gray-500">Segundo item de benefício exibido no modal de upgrade.</p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Texto no Campo de Digitação (Quando Bloqueado)</label>
                              <input
                                type="text"
                                value={draftCustomTexts['ai_expert.input_disabled_placeholder'] ?? settings.custom_texts?.['ai_expert.input_disabled_placeholder'] ?? 'Message limit reached for this period.'}
                                onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.input_disabled_placeholder': e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-2xl px-4 py-3.5 text-white text-sm focus:border-rose-500 outline-none"
                                placeholder="Ex: Message limit reached for this period."
                              />
                              <p className="text-[11px] text-gray-500">Texto de marca d'água exibido dentro da caixa de digitação quando o limite for atingido.</p>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Mensagem Exibida ao Atingir o Limite</label>
                              <textarea
                                rows={3}
                                value={draftCustomTexts['ai_expert.limit_reached_message'] ?? settings.custom_texts?.['ai_expert.limit_reached_message'] ?? 'You have reached your message limit for this period. Upgrade your plan or try again later.'}
                                onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.limit_reached_message': e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-rose-500 outline-none"
                                placeholder="Ex: You have reached your message limit for this period. Upgrade your plan or try again later."
                              />
                              <p className="text-[11px] text-gray-500">Alerta e instrução exibidos no chat quando a aluna atinge o limite máximo.</p>
                            </div>

                            <div className="space-y-2">
                              <label className="text-xs font-black text-gray-400 uppercase tracking-widest">Mensagem Padrão de Erro no Chat</label>
                              <textarea
                                rows={2}
                                value={draftCustomTexts['ai_expert.error_message'] ?? settings.custom_texts?.['ai_expert.error_message'] ?? 'Sorry, I am unable to respond right now. Please try again shortly.'}
                                onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'ai_expert.error_message': e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-2xl p-4 text-white text-sm focus:border-rose-500 outline-none"
                                placeholder="Ex: Sorry, I am unable to respond right now. Please try again shortly."
                              />
                              <p className="text-[11px] text-gray-500">Mensagem amigável exibida caso ocorra alguma falha na conexão com a IA (substitui avisos técnicos).</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'settings' && (
                  <div className="max-w-4xl space-y-8 pb-20">
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Configurações Gerais</h3>
                      <p className="text-sm text-gray-500">Controle o comportamento global da sua plataforma.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* URL Settings */}
                      <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                            <Globe size={20} />
                          </div>
                          <h4 className="font-bold text-white">Domínio e Fluxo</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-2 pt-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest text-blue-500 italic">URL do Aplicativo</label>
                            <div className="relative group">
                              <input 
                                type="text" 
                                value={localSettings?.app_url || ''}
                                onChange={(e) => setLocalSettings({ ...localSettings, app_url: e.target.value })}
                                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none pr-10"
                                placeholder="https://app-maternidade2.vercel.app"
                              />
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                                <Globe size={14} />
                              </div>
                            </div>
                            <p className="text-[10px] text-gray-600">Usada para gerar links de acesso mágicos e redirecionamentos. Certifique-se de incluir o https://</p>
                          </div>

                          <div className="space-y-4 pt-4 border-t border-white/5">
                            <h5 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Rastreamento e Analytics</h5>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-70">Google Analytics GA4 ID</label>
                                <div className="relative group">
                                  <input 
                                    type="text" 
                                    value={localSettings?.ga4_tag_id || ''}
                                    onChange={(e) => setLocalSettings({ ...localSettings, ga4_tag_id: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-10 py-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all font-mono"
                                    placeholder="G-XXXXXXXXXX"
                                  />
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
                                    <Globe size={14} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4 pt-4 border-t border-white/5">
                            <h5 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Informações de Suporte</h5>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-70">Número WhatsApp (Ex: 5511999999999)</label>
                                <div className="relative group">
                                  <input 
                                    type="text" 
                                    value={localSettings?.support_whatsapp || ''}
                                    onChange={(e) => setLocalSettings({ ...localSettings, support_whatsapp: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-10 py-2.5 text-sm text-white focus:border-green-500 outline-none transition-all"
                                    placeholder="5511999999999"
                                  />
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-green-500 transition-colors">
                                    <WhatsAppIcon size={14} />
                                  </div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest opacity-70">E-mail de Suporte</label>
                                <div className="relative group">
                                  <input 
                                    type="text" 
                                    value={localSettings?.support_email || ''}
                                    onChange={(e) => setLocalSettings({ ...localSettings, support_email: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-10 py-2.5 text-sm text-white focus:border-blue-500 outline-none transition-all"
                                    placeholder="suporte@exemplo.com"
                                  />
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-blue-500 transition-colors">
                                    <Mail size={14} />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={saveAuthSettings}
                            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                          >
                            <Save size={16} />
                            Salvar Configurações
                          </button>
                        </div>
                      </div>

                      {/* Global Branding Settings */}
                      <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                            <Palette size={20} />
                          </div>
                          <h4 className="font-bold text-white">Identidade Visual Global</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Favicon (URL)</label>
                            <input 
                              type="text" 
                              value={localSettings?.favicon_url || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, favicon_url: e.target.value })}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                              placeholder="https://exemplo.com/favicon.png"
                            />
                            <p className="text-[10px] text-gray-600 mt-1">Este ícone aparecerá na aba do navegador e como ícone do app instalado.</p>
                          </div>

                          <div className="space-y-4 pt-2 border-t border-white/5">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Cores da Plataforma</label>
                            <div className="flex flex-wrap gap-3 items-center">
                              {[
                                { name: 'Vermelho', primary: '#ef4444', secondary: '#b91c1c' },
                                { name: 'Azul', primary: '#3b82f6', secondary: '#1d4ed8' },
                                { name: 'Verde', primary: '#10b981', secondary: '#047857' },
                                { name: 'Roxo', primary: '#8b5cf6', secondary: '#6d28d9' },
                                { name: 'Laranja', primary: '#f97316', secondary: '#c2410c' },
                              ].map((color) => (
                                <button
                                  key={color.primary}
                                  onClick={() => setLocalSettings({ 
                                    ...localSettings, 
                                    primary_color: color.primary,
                                    secondary_color: color.secondary
                                  })}
                                  className={`w-8 h-8 rounded-lg border-2 transition-all ${localSettings?.primary_color === color.primary ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                  style={{ backgroundColor: color.primary }}
                                />
                              ))}
                              <div className="flex items-center gap-2 ml-2 p-1.5 bg-black/40 rounded-lg border border-white/10">
                                <Palette size={14} className="text-gray-500" />
                                <input 
                                  type="color" 
                                  value={localSettings?.primary_color || '#3b82f6'}
                                  onChange={(e) => setLocalSettings({ ...localSettings, primary_color: e.target.value, secondary_color: e.target.value })}
                                  className="w-6 h-6 rounded bg-transparent border-0 cursor-pointer"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2">
                             <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Cor de Fundo</label>
                             <div className="flex flex-wrap gap-2 items-center">
                               {[
                                 { name: 'Original', color: '#0f0f0f' },
                                 { name: 'Black', color: '#000000' },
                                 { name: 'Dark', color: '#1a1a1a' },
                                 { name: 'Night', color: '#020617' },
                                 { name: 'Deep', color: '#0f172a' },
                               ].map((bg) => (
                                 <button
                                   key={bg.color}
                                   onClick={() => setLocalSettings({ ...localSettings, background_color: bg.color })}
                                   className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${localSettings?.background_color === bg.color ? 'bg-white text-black border-white' : 'bg-white/5 text-gray-400 border-white/10'}`}
                                   style={{ backgroundColor: localSettings?.background_color === bg.color ? '#fff' : bg.color }}
                                 >
                                   {bg.name}
                                 </button>
                               ))}
                             </div>
                          </div>
                      
                          <button 
                            onClick={async () => {
                              setIsSavingSettings(true);
                              await updateSettings({ 
                                favicon_url: localSettings.favicon_url,
                                pwa_icon_url: localSettings.favicon_url,
                                primary_color: localSettings.primary_color,
                                secondary_color: localSettings.secondary_color,
                                background_color: localSettings.background_color,
                                support_whatsapp: localSettings.support_whatsapp,
                                support_email: localSettings.support_email,
                                ga4_tag_id: localSettings.ga4_tag_id
                              });
                              setIsSavingSettings(false);
                            }}
                            disabled={isSavingSettings}
                            className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                          >
                            {isSavingSettings ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Salvar Identidade Global
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                )}

                {activeTab === 'pages' && (
                  <div className="space-y-8 pb-20">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Edição de Páginas</h3>
                        <p className="text-sm text-gray-500">Personalize o conteúdo e visual de cada página.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
                        <div className="flex p-1 bg-black rounded-xl border border-white/10 overflow-x-auto w-full sm:w-auto scrollbar-none">
                          <button 
                            onClick={() => setActivePageTab('login')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'login' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            LOGIN
                          </button>
                          <button 
                            onClick={() => setActivePageTab('home')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'home' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Início
                          </button>
                          <button 
                            onClick={() => setActivePageTab('course')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'course' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Cursos
                          </button>
                          <button 
                            onClick={() => setActivePageTab('lesson')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'lesson' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Aulas
                          </button>
                          <button 
                            onClick={() => setActivePageTab('community')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'community' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Comunidade
                          </button>
                          <button 
                            onClick={() => setActivePageTab('profile')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'profile' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Perfil
                          </button>
                          <button 
                            onClick={() => setActivePageTab('nav')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'nav' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Navegação
                          </button>
                          <button 
                            onClick={() => setActivePageTab('support')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'support' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Suporte
                          </button>
                          <button 
                            onClick={() => setActivePageTab('push')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'push' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            NOTIFICAÇÕES
                          </button>
                          <button 
                            onClick={() => setActivePageTab('pwa')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'pwa' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            PWA
                          </button>
                        </div>
                        <button 
                          onClick={async () => {
                            setIsSavingPages(true);
                            
                            // Coleta todas as alterações
                            const updates: any = { 
                              custom_texts: {
                                ...settings.custom_texts,
                                ...draftCustomTexts
                              }
                            };

                            // Se estiver na aba login, inclui configurações específicas
                            if (activePageTab === 'login') {
                              updates.app_name = localSettings.app_name;
                              updates.login_display_type = localSettings.login_display_type;
                              updates.login_install_button_pulsing = localSettings.login_install_button_pulsing;
                              updates.logo_url = localSettings.logo_url;
                              updates.logo_height = localSettings.logo_height;
                            }

                            if (activePageTab === 'support') {
                              updates.custom_texts['config.support_type'] = localSettings.support_type || 'floating';
                              updates.support_whatsapp_home_enabled = localSettings.support_whatsapp_home_enabled;
                              updates.support_email_home_enabled = localSettings.support_email_home_enabled;
                              updates.support_whatsapp_floating_enabled = localSettings.support_whatsapp_home_floating;
                              
                              updates.support_whatsapp_community_enabled = localSettings.support_whatsapp_community_enabled;
                              updates.support_email_community_enabled = localSettings.support_email_community_enabled;
                              updates.support_whatsapp_floating_community_enabled = localSettings.support_whatsapp_community_floating;
                              
                              updates.support_whatsapp_profile_enabled = localSettings.support_whatsapp_profile_enabled;
                              updates.support_email_profile_enabled = localSettings.support_email_profile_enabled;
                              updates.support_whatsapp_floating_profile_enabled = localSettings.support_whatsapp_profile_floating;

                              updates.support_whatsapp_course_enabled = localSettings.support_whatsapp_course_enabled;
                              updates.support_email_course_enabled = localSettings.support_email_course_enabled;
                              updates.support_whatsapp_floating_course_enabled = localSettings.support_whatsapp_course_floating;

                              // As configurações de 'aula' (lesson) não existem na tabela app_settings,
                              // vamos salvá-las no custom_texts para evitar erro de schema.
                              updates.custom_texts['config.support_whatsapp_lesson_enabled'] = localSettings.support_whatsapp_lesson_enabled ? 'true' : 'false';
                              updates.custom_texts['config.support_email_lesson_enabled'] = localSettings.support_email_lesson_enabled ? 'true' : 'false';
                              updates.custom_texts['config.support_whatsapp_lesson_floating'] = localSettings.support_whatsapp_lesson_floating ? 'true' : 'false';

                              updates.custom_texts['config.support_whatsapp_preview_enabled'] = localSettings.support_whatsapp_preview_enabled ? 'true' : 'false';
                              updates.custom_texts['config.support_email_preview_enabled'] = localSettings.support_email_preview_enabled ? 'true' : 'false';
                              updates.custom_texts['config.support_whatsapp_preview_floating'] = localSettings.support_whatsapp_preview_floating ? 'true' : 'false';

                              // Configurações da página de Login
                              updates.support_whatsapp_login_enabled = !!localSettings.support_whatsapp_login_enabled;
                              updates.support_email_login_enabled = !!localSettings.support_email_login_enabled;
                              updates.show_support_login = !!(localSettings.support_whatsapp_login_enabled || localSettings.support_email_login_enabled);
                              updates.custom_texts['config.support_whatsapp_login_floating'] = localSettings.support_whatsapp_login_floating ? 'true' : 'false';
                            }

                            await updateSettings(updates);
                            setIsSavingPages(false);
                            toast.success('Alterações salvas com sucesso!');
                          }}
                          disabled={isSavingPages}
                          className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-600/20"
                        >
                          {isSavingPages ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                          SALVAR ALTERAÇÕES
                        </button>
                      </div>
                    </div>
                        {activePageTab === 'login' && (
                          <div className="space-y-8">
                            {/* Customização da Página de Login */}
                            <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                                    <LockIcon size={20} />
                                  </div>
                                  <div className="">
                                    <h4 className="font-bold text-white">Customização da Página de Login</h4>
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-0.5">Aparência, Textos e Mensagens de Erro</p>
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                  {/* 1. Estilo Botão Instalar */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Estilo Botão Instalar</label>
                                    <div className="flex p-1 bg-black rounded-xl border border-white/10 font-sans">
                                      <button 
                                        onClick={() => setLocalSettings({ ...localSettings, login_install_button_pulsing: 'pulsing' })}
                                        className={`flex-1 py-1.5 rounded-lg text-bold text-[10px] transition-all ${localSettings?.login_install_button_pulsing === 'pulsing' || localSettings?.login_install_button_pulsing === true ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                      >
                                        PULSANTE
                                      </button>
                                      <button 
                                        onClick={() => setLocalSettings({ ...localSettings, login_install_button_pulsing: 'static' })}
                                        className={`flex-1 py-1.5 rounded-lg text-bold text-[10px] transition-all ${localSettings?.login_install_button_pulsing === 'static' || localSettings?.login_install_button_pulsing === false ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                      >
                                        ESTÁTICO
                                      </button>
                                      <button 
                                        onClick={() => setLocalSettings({ ...localSettings, login_install_button_pulsing: 'hidden' })}
                                        className={`flex-1 py-1.5 rounded-lg text-bold text-[10px] transition-all ${localSettings?.login_install_button_pulsing === 'hidden' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                      >
                                        NÃO APARECER
                                      </button>
                                    </div>
                                  </div>

                                  {/* 2. Exibição no Login */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Exibição no Login</label>
                                    <div className="flex p-1 bg-black rounded-xl border border-white/10 font-sans">
                                      <button 
                                        onClick={() => setLocalSettings({ ...localSettings, login_display_type: 'title' })}
                                        className={`flex-1 py-1.5 rounded-lg text-bold text-[10px] transition-all ${localSettings?.login_display_type === 'title' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                      >
                                        SÓ TÍTULO
                                      </button>
                                      <button 
                                        onClick={() => setLocalSettings({ ...localSettings, login_display_type: 'logo' })}
                                        className={`flex-1 py-1.5 rounded-lg text-bold text-[10px] transition-all ${localSettings?.login_display_type === 'logo' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                      >
                                        SÓ LOGO
                                      </button>
                                      <button 
                                        onClick={() => setLocalSettings({ ...localSettings, login_display_type: 'both' })}
                                        className={`flex-1 py-1.5 rounded-lg text-bold text-[10px] transition-all ${localSettings?.login_display_type === 'both' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                      >
                                        AMBOS
                                      </button>
                                    </div>
                                  </div>

                                  {/* 3. Logo (URL) */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Logo (URL)</label>
                                    <input 
                                      type="text" 
                                      value={localSettings?.logo_url || ''}
                                      onChange={(e) => setLocalSettings({ ...localSettings, logo_url: e.target.value })}
                                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                    />
                                  </div>

                                  {/* 4. Tamanho do Logo */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Tamanho do Logo (Altura em px)</label>
                                    <div className="flex items-center gap-4 p-4 bg-black/40 rounded-xl border border-white/5">
                                      <input 
                                        type="range" 
                                        min="20" 
                                        max="300"
                                        value={localSettings?.logo_height || 64}
                                        onChange={(e) => setLocalSettings({ ...localSettings, logo_height: parseInt(e.target.value) })}
                                        className="flex-1 accent-blue-500"
                                      />
                                      <span className="text-sm font-black text-white w-16 text-center tabular-nums">{localSettings?.logo_height || 64}px</span>
                                    </div>
                                  </div>

                                  {/* 5. Nome da Plataforma */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nome da Plataforma</label>
                                    <input 
                                      type="text" 
                                      value={localSettings?.app_name || ''}
                                      onChange={(e) => setLocalSettings({ ...localSettings, app_name: e.target.value })}
                                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                    />
                                  </div>

                                  {/* 6. Cor da Letra do Nome da Plataforma */}
                                  <div className="space-y-2">
                                    <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Cor da Letra do Nome da Plataforma</label>
                                    <div className="flex flex-wrap items-center gap-3 p-3 bg-black/60 rounded-xl border border-white/10">
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="color" 
                                          value={draftCustomTexts['auth.title_color'] || settings.custom_texts?.['auth.title_color'] || '#ffffff'}
                                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'auth.title_color': e.target.value })}
                                          className="w-9 h-9 rounded-lg bg-transparent border border-white/20 cursor-pointer p-0.5"
                                        />
                                        <input 
                                          type="text" 
                                          value={draftCustomTexts['auth.title_color'] !== undefined ? draftCustomTexts['auth.title_color'] : (settings.custom_texts?.['auth.title_color'] || '#ffffff')}
                                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'auth.title_color': e.target.value })}
                                          placeholder="#ffffff"
                                          className="w-24 bg-black border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-mono focus:border-blue-500 outline-none"
                                        />
                                      </div>

                                      <div className="flex flex-wrap gap-1.5 items-center ml-auto">
                                        {[
                                          { name: 'Branco', color: '#ffffff' },
                                          { name: 'Dourado', color: '#f59e0b' },
                                          { name: 'Rosa / Rose', color: '#f43f5e' },
                                          { name: 'Primária', color: localSettings?.primary_color || settings.primary_color || '#ef4444' },
                                          { name: 'Esmeralda', color: '#10b981' },
                                          { name: 'Azul Céu', color: '#38bdf8' },
                                          { name: 'Púrpura', color: '#a855f7' },
                                        ].map((preset) => {
                                          const currentColor = (draftCustomTexts['auth.title_color'] || settings.custom_texts?.['auth.title_color'] || '#ffffff').toLowerCase();
                                          const isSelected = currentColor === preset.color.toLowerCase();
                                          return (
                                            <button
                                              key={preset.name + preset.color}
                                              type="button"
                                              title={preset.name}
                                              onClick={() => setDraftCustomTexts({ ...draftCustomTexts, 'auth.title_color': preset.color })}
                                              className={`w-6 h-6 rounded-md border transition-all cursor-pointer ${isSelected ? 'border-white scale-110 shadow-md ring-2 ring-white/30' : 'border-white/20 hover:scale-105 opacity-80 hover:opacity-100'}`}
                                              style={{ backgroundColor: preset.color }}
                                            />
                                          );
                                        })}
                                        <button
                                          type="button"
                                          onClick={() => setDraftCustomTexts({ ...draftCustomTexts, 'auth.title_color': '#ffffff' })}
                                          className="px-2 py-1 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-[10px] text-gray-400 hover:text-white transition-colors cursor-pointer"
                                          title="Redefinir para Branco Padrão"
                                        >
                                          Padrão
                                        </button>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Reordered custom_texts fields */}
                                  {[
                                    { key: 'auth.subtitle', label: 'Subtítulo do Login' },
                                    { key: 'auth.email', label: 'Label do E-mail' },
                                    { key: 'auth.password', label: 'Label da Senha' },
                                    { key: 'auth.login', label: 'Texto do Botão' },
                                    { key: 'auth.support_box', label: 'Título da Caixa de Suporte' },
                                    { key: 'auth.support_description', label: 'Descrição do Suporte', type: 'textarea' },
                                    { key: 'auth.whatsapp_label', label: 'Label do WhatsApp' },
                                    { key: 'auth.email_label', label: 'Label do E-mail Suporte' },
                                    { key: 'auth.disclaimer', label: 'Disclaimer (Rodapé)', type: 'textarea' },
                                    { key: 'auth.fill_this_field', label: 'Mensagem: Preencha este campo' },
                                    { key: 'auth.invalid_email', label: 'Mensagem: E-mail inválido' },
                                    { key: 'auth.restricted_access', label: 'Título: Acesso Restrito' },
                                    { key: 'auth.restricted_access_msg', label: 'Mensagem de Acesso Restrito' },
                                    { key: 'auth.admin_identified', label: 'Mensagem: Acesso Administrativo', type: 'textarea' },
                                    { key: 'auth.verify_access', label: 'Botão: Verificar Acesso Adm' },
                                    { key: 'auth.user_not_found', label: 'Erro: Usuário não encontrado' },
                                    { key: 'auth.invalid_response', label: 'Erro: Falha no Servidor' },
                                    { key: 'auth.credentials_error', label: 'Erro: Credenciais Inválidas' },
                                    { key: 'auth.generic_error', label: 'Erro: Genérico' },
                                  ].map(field => (
                                    <div key={field.key} className="space-y-2">
                                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                      {field.type === 'textarea' ? (
                                        <textarea 
                                          value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                          placeholder={field.label}
                                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none min-h-[80px]"
                                        />
                                      ) : (
                                        <input 
                                          type="text" 
                                          value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                          placeholder={field.label}
                                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Preview Area */}
                                <div className="space-y-6">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest text-center block">Preview Completo da Página de Login</label>
                                  <div className="rounded-[3rem] border-8 border-zinc-800 p-4 min-h-[750px] relative overflow-hidden shadow-2xl mx-auto max-w-[320px] pointer-events-none select-none" 
                                       style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                    
                                    {/* Background blur element like in the real login */}
                                    <div className="absolute inset-0 blur-3xl rounded-full opacity-20" style={{ backgroundColor: `${localSettings?.primary_color || settings.primary_color}` }} />

                                    <div className="relative z-10 flex flex-col items-center gap-6 h-full pt-10">
                                       {/* PWA Install Button Preview */}
                                       {(localSettings.login_install_button_pulsing !== 'hidden') && (
                                         <div className={`flex items-center gap-2 px-3 py-1.5 border border-primary/20 rounded-full text-[8px] font-black text-black uppercase tracking-widest italic shadow-lg shadow-primary/20 scale-90 ${localSettings.login_install_button_pulsing === 'pulsing' || localSettings.login_install_button_pulsing === true ? 'animate-bounce' : ''}`}
                                              style={{ backgroundColor: localSettings.primary_color || settings.primary_color }}>
                                           <Smartphone size={10} />
                                           {draftCustomTexts['pwa.install_app'] || settings.custom_texts?.['pwa.install_app'] || languagePresets.pt['pwa.install_app'] || 'Instalar App'}
                                         </div>
                                       )}

                                       <div className="w-full bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-6">
                                         <div className="text-center">
                                           {(localSettings?.login_display_type === 'logo' || localSettings?.login_display_type === 'both') && localSettings?.logo_url ? (
                                             <img 
                                               src={localSettings.logo_url} 
                                               style={{ height: `${(localSettings?.logo_height || 64) / 2}px` }}
                                               className="mx-auto mb-4 object-contain" 
                                               referrerPolicy="no-referrer" 
                                             />
                                           ) : null}
                                           {(localSettings?.login_display_type === 'title' || localSettings?.login_display_type === 'both') && (
                                             <h2 
                                               className="text-lg font-black italic uppercase tracking-tighter transition-colors" 
                                               style={{ 
                                                 color: draftCustomTexts['auth.title_color'] || settings.custom_texts?.['auth.title_color'] || '#ffffff' 
                                               }}
                                             >
                                               {localSettings?.app_name || 'App Name'}
                                             </h2>
                                           )}
                                           <p className="text-[9px] text-gray-500 mt-1 font-medium">
                                             {draftCustomTexts['auth.subtitle'] || settings.custom_texts?.['auth.subtitle'] || languagePresets.pt['auth.subtitle']}
                                           </p>
                                         </div>

                                         <div className="space-y-3">
                                           <div className="w-full h-10 bg-white/5 border border-white/10 rounded-xl flex items-center px-4 text-[10px] text-gray-600 text-left">
                                             {draftCustomTexts['auth.email'] || settings.custom_texts?.['auth.email'] || languagePresets.pt['auth.email'] || 'E-mail'}
                                           </div>
                                           <div className="w-full h-10 bg-white/5 border border-white/10 rounded-xl flex items-center px-4 text-[10px] text-gray-600 text-left">
                                             {draftCustomTexts['auth.password'] || settings.custom_texts?.['auth.password'] || languagePresets.pt['auth.password'] || 'Senha'}
                                           </div>
                                           <div className="w-full h-10 rounded-xl flex items-center justify-center text-[10px] font-black text-white uppercase tracking-widest shadow-xl" style={{ backgroundColor: localSettings?.primary_color || settings.primary_color }}>
                                             {draftCustomTexts['auth.login'] || settings.custom_texts?.['auth.login'] || languagePresets.pt['auth.login'] || 'Entrar'}
                                             <ArrowRight size={14} className="ml-2" />
                                           </div>
                                         </div>

                                         <div className="pt-4 border-t border-white/5">
                                           <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mb-3 text-center">
                                             {draftCustomTexts['auth.support_box'] || settings.custom_texts?.['auth.support_box'] || languagePresets.pt['auth.support_box'] || 'Suporte'}
                                           </p>
                                           <div className="grid grid-cols-2 gap-2">
                                             <div className="flex items-center justify-center gap-1.5 py-2 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-[8px] font-black uppercase">
                                               <WhatsAppIcon size={10} /> {draftCustomTexts['auth.whatsapp_label'] || settings.custom_texts?.['auth.whatsapp_label'] || languagePresets.pt['auth.whatsapp_label'] || 'Whats'}
                                             </div>
                                             <div className="flex items-center justify-center gap-1.5 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-500 text-[8px] font-black uppercase">
                                               <Mail size={10} /> {draftCustomTexts['auth.email_label'] || settings.custom_texts?.['auth.email_label'] || languagePresets.pt['auth.email_label'] || 'Email'}
                                             </div>
                                           </div>
                                         </div>
                                       </div>

                                       <div className="mt-auto px-4 pb-4">
                                         <p className="text-[8px] text-gray-600 text-center leading-tight">
                                           {draftCustomTexts['auth.disclaimer'] || settings.custom_texts?.['auth.disclaimer'] || languagePresets.pt['auth.disclaimer'] || '© 2026 Maternidade Premium'}
                                         </p>
                                       </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                    {activePageTab === 'nav' && (
                      <div className="space-y-8">
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                              <Languages size={20} />
                            </div>
                            <h4 className="font-bold text-white">Textos Gerais e Navegação</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-4">Navegação</h5>
                              {[
                                { key: 'nav.home', label: 'Menu Início' },
                                { key: 'nav.community', label: 'Menu Comunidade' },
                                { key: 'nav.profile', label: 'Menu Perfil' },
                                { key: 'nav.admin', label: 'Botão Admin' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  <input 
                                    type="text" 
                                    value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                    placeholder={field.label}
                                    onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                  />
                                </div>
                              ))}

                              <h5 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-8 mb-4">Botões Globais</h5>
                              {[
                                { key: 'global.save', label: 'Botão Salvar' },
                                { key: 'global.cancel', label: 'Botão Cancelar' },
                                { key: 'global.delete', label: 'Botão Excluir' },
                                { key: 'global.back', label: 'Botão Voltar' },
                                { key: 'global.logout', label: 'Botão Sair' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  <input 
                                    type="text" 
                                    value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                    placeholder={field.label}
                                    onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview da Barra de App</label>
                              <div className="p-8 rounded-3xl border border-white/10 flex items-center justify-center" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="w-full max-w-[300px] bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl h-16 flex items-center justify-around px-4">
                                  <div className="flex flex-col items-center gap-1 text-blue-500">
                                    <Home size={18} />
                                    <span className="text-[8px] font-bold uppercase">{draftCustomTexts['nav.home'] || 'Início'}</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 text-gray-500">
                                    <CommunityIcon size={18} />
                                    <span className="text-[8px] font-bold uppercase">{draftCustomTexts['nav.community'] || 'Comunidade'}</span>
                                  </div>
                                  <div className="flex flex-col items-center gap-1 text-gray-500">
                                    <UserIcon size={18} />
                                    <span className="text-[8px] font-bold uppercase">{draftCustomTexts['nav.profile'] || 'Perfil'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'home' && (
                      <div className="space-y-8">
                        {/* 1. Opção Exibir Nome dos Cursos no Início */}
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                                <Type size={20} />
                              </div>
                              <div>
                                <h4 className="font-bold text-white">Exibir Nome dos Cursos no Início</h4>
                                <p className="text-xs text-gray-400">
                                  Escolha se o nome dos cursos deve aparecer nos cards da tela inicial.
                                </p>
                              </div>
                            </div>
                            <button 
                              type="button"
                              onClick={async () => {
                                setIsSavingSettings(true);
                                await updateSettings({ 
                                  show_course_titles_home: localSettings?.show_course_titles_home === true
                                });
                                setIsSavingSettings(false);
                              }}
                              disabled={isSavingSettings}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all shadow-lg shadow-blue-600/20 cursor-pointer"
                            >
                              {isSavingSettings ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                              Salvar Configuração
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-6 bg-zinc-900/30 border border-white/5 rounded-2xl flex-wrap gap-4">
                            <div className="space-y-1">
                              <h6 className="text-sm font-bold text-white uppercase italic tracking-tighter">
                                Exibir Nome do Curso
                              </h6>
                              <p className="text-[10px] text-gray-500 font-bold uppercase italic tracking-widest leading-relaxed">
                                {localSettings?.show_course_titles_home 
                                  ? 'Os nomes dos cursos estão VISÍVEIS na tela início.' 
                                  : 'Os nomes dos cursos estão OCULTOS na tela início (Padrão).'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setLocalSettings({ 
                                  ...localSettings, 
                                  show_course_titles_home: !localSettings?.show_course_titles_home
                                });
                              }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
                                localSettings?.show_course_titles_home ? 'bg-blue-600' : 'bg-zinc-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  localSettings?.show_course_titles_home ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* 2. Banner Rotativo Premium */}
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                                <Layout size={20} />
                              </div>
                              <h4 className="font-bold text-white">Banner Rotativo Premium</h4>
                            </div>
                            <button 
                              onClick={async () => {
                                setIsSavingSettings(true);
                                await updateSettings({ 
                                  banner_images: localSettings.banner_images,
                                  banner_images_mobile: localSettings.banner_images_mobile || [],
                                  banner_interval: localSettings.banner_interval,
                                  banner_config: localSettings.banner_config,
                                  banner_config_mobile: localSettings.banner_config_mobile,
                                  banner_sync: localSettings.banner_sync !== false
                                });
                                setIsSavingSettings(false);
                              }}
                              disabled={isSavingSettings}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                            >
                              {isSavingSettings ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                              Salvar Configurações
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-6 bg-zinc-900/30 border border-white/5 rounded-2xl flex-wrap gap-4">
                            <div className="space-y-1">
                              <h6 className="text-sm font-bold text-white uppercase italic tracking-tighter">Vincular Dispositivos</h6>
                              <p className="text-[10px] text-gray-500 font-bold uppercase italic tracking-widest leading-relaxed">
                                Quando ativado, as mesmas imagens serão usadas para Desktop e Celular.
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                const newSync = !(localSettings.banner_sync !== false);
                                setLocalSettings({ 
                                  ...localSettings, 
                                  banner_sync: newSync
                                });
                                if (newSync) {
                                  setActiveBannerPlatform('desktop');
                                  setBannerPreviewMode('desktop');
                                }
                              }}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                (localSettings.banner_sync !== false) ? 'bg-blue-600' : 'bg-zinc-700'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  (localSettings.banner_sync !== false) ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              <div className="space-y-4">
                                <div className="flex justify-between items-center bg-black/20 p-2 rounded-xl border border-white/5">
                                  <div className="flex gap-2">
                                    <button 
                                      onClick={() => {
                                        setActiveBannerPlatform('desktop');
                                        setBannerPreviewMode('desktop');
                                      }}
                                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeBannerPlatform === 'desktop' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
                                    >
                                      Desktop
                                    </button>
                                    <button 
                                      onClick={() => {
                                        setActiveBannerPlatform('mobile');
                                        setBannerPreviewMode('mobile');
                                      }}
                                      className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeBannerPlatform === 'mobile' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'} ${localSettings.banner_sync !== false ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      disabled={localSettings.banner_sync !== false}
                                      title={localSettings.banner_sync !== false ? 'Desative "Vincular Dispositivos" para editar o celular separadamente' : ''}
                                    >
                                      Celular
                                    </button>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const isMobile = activeBannerPlatform === 'mobile' && localSettings.banner_sync === false;
                                      const imagesKey = isMobile ? 'banner_images_mobile' : 'banner_images';
                                      const configKey = isMobile ? 'banner_config_mobile' : 'banner_config';
                                      
                                      const newImages = [...(localSettings?.[imagesKey] || []), ''];
                                      const newConfig = [...(localSettings?.[configKey] || [])];
                                      newConfig.push({ scale: 100, x: 50, y: 50, stretch: true });
                                      setLocalSettings({ ...localSettings, [imagesKey]: newImages, [configKey]: newConfig });
                                    }}
                                    className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                  >
                                    <Plus size={14} /> Adicionar
                                  </button>
                                </div>
                                
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                  {(() => {
                                    const isMobile = activeBannerPlatform === 'mobile' && localSettings.banner_sync === false;
                                    const images = isMobile ? (localSettings?.banner_images_mobile || []) : (localSettings?.banner_images || []);
                                    const configs = isMobile ? (localSettings?.banner_config_mobile || []) : (localSettings?.banner_config || []);

                                    return images.map((url: string, index: number) => (
                                    <div key={index} className="space-y-3 p-4 bg-black/40 rounded-2xl border border-white/5 relative group">
                                      <div className="flex gap-2">
                                        <div className="flex flex-col gap-1 pr-2 border-r border-white/5">
                                          <button 
                                            onClick={() => {
                                              if (index === 0) return;
                                              const newImages = [...images];
                                              const newConfig = [...configs];
                                              [newImages[index], newImages[index-1]] = [newImages[index-1], newImages[index]];
                                              [newConfig[index], newConfig[index-1]] = [newConfig[index-1], newConfig[index]];
                                              if (isMobile) {
                                                setLocalSettings({ ...localSettings, banner_images_mobile: newImages, banner_config_mobile: newConfig });
                                              } else {
                                                setLocalSettings({ ...localSettings, banner_images: newImages, banner_config: newConfig });
                                              }
                                            }}
                                            className={`p-1 hover:bg-white/10 rounded-lg transition-all ${index === 0 ? 'opacity-20 cursor-not-allowed' : 'text-blue-500'}`}
                                            title="Subir"
                                          >
                                            <ArrowUp size={14} />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              if (index === images.length - 1) return;
                                              const newImages = [...images];
                                              const newConfig = [...configs];
                                              [newImages[index], newImages[index+1]] = [newImages[index+1], newImages[index]];
                                              [newConfig[index], newConfig[index+1]] = [newConfig[index+1], newConfig[index]];
                                              if (isMobile) {
                                                setLocalSettings({ ...localSettings, banner_images_mobile: newImages, banner_config_mobile: newConfig });
                                              } else {
                                                setLocalSettings({ ...localSettings, banner_images: newImages, banner_config: newConfig });
                                              }
                                            }}
                                            className={`p-1 hover:bg-white/10 rounded-lg transition-all ${index === localSettings.banner_images.length - 1 ? 'opacity-20 cursor-not-allowed' : 'text-blue-500'}`}
                                            title="Descer"
                                          >
                                            <ArrowDown size={14} />
                                          </button>
                                        </div>

                                        <div className="flex-1 space-y-2">
                                          <div className="relative group/input">
                                            <input 
                                              type="text" 
                                              value={url}
                                              onFocus={() => setEditingBannerIndex(index)}
                                              onChange={(e) => {
                                                const newImages = [...images];
                                                newImages[index] = e.target.value;
                                                if (isMobile) {
                                                  setLocalSettings({ ...localSettings, banner_images_mobile: newImages });
                                                } else {
                                                  setLocalSettings({ ...localSettings, banner_images: newImages });
                                                }
                                              }}
                                              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none transition-all pr-12"
                                              placeholder="URL da imagem..."
                                            />
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-20 pointer-events-none group-focus-within/input:opacity-100 transition-opacity">
                                              <ArrowRight size={14} className="text-blue-500" />
                                            </div>
                                          </div>
                                          <div className="relative group/link">
                                            <input 
                                              type="text" 
                                              value={configs?.[index]?.link || ''}
                                              onFocus={() => setEditingBannerIndex(index)}
                                              onChange={(e) => {
                                                const newConfig = [...configs];
                                                if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50, stretch: true };
                                                newConfig[index].link = e.target.value;
                                                if (isMobile) {
                                                  setLocalSettings({ ...localSettings, banner_config_mobile: newConfig });
                                                } else {
                                                  setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                }
                                              }}
                                              className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:border-blue-500 outline-none transition-all pl-10"
                                              placeholder="Link de redirecionamento (Ex: https://...)"
                                            />
                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 opacity-20">
                                              <ExternalLink size={14} className="text-gray-400 group-focus-within/link:text-blue-500 transition-colors" />
                                            </div>
                                          </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          <button 
                                            onClick={() => {
                                              const newImages = images.filter((_: any, i: number) => i !== index);
                                              const newConfig = configs.filter((_: any, i: number) => i !== index);
                                              if (isMobile) {
                                                setLocalSettings({ ...localSettings, banner_images_mobile: newImages, banner_config_mobile: newConfig });
                                              } else {
                                                setLocalSettings({ ...localSettings, banner_images: newImages, banner_config: newConfig });
                                              }
                                            }}
                                            className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                                            title="Excluir Lâmina"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="flex flex-col gap-2">
                                        <button 
                                          onClick={() => setEditingBannerIndex(index)}
                                          className={`w-full p-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${editingBannerIndex === index ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-black/20 text-gray-500 hover:text-white border border-white/5 font-semibold transition-all'}`}
                                          title="Editar no Preview"
                                        >
                                          <Eye size={14} />
                                          <span className="text-[10px] font-black uppercase whitespace-nowrap tracking-widest leading-none">VER IMAGEM NO PREVIEW</span>
                                        </button>
                                      </div>

                                      {url && (
                                          <div className={`space-y-3 pt-2 border-t border-white/5 ${configs?.[index]?.stretch ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                                            {configs?.[index]?.stretch && (
                                              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-2xl">
                                                <div className="flex flex-col items-center gap-2">
                                                  <Layout size={20} className="text-blue-500" />
                                                  <span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">Modo Foto 100% Ativo</span>
                                                  <button 
                                                    onClick={() => {
                                                      const newConfig = [...configs];
                                                      if (newConfig[index]) newConfig[index].stretch = false;
                                                      if (isMobile) {
                                                        setLocalSettings({ ...localSettings, banner_config_mobile: newConfig });
                                                      } else {
                                                        setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                      }
                                                    }}
                                                    className="px-4 py-1.5 bg-blue-600 rounded-full text-[8px] font-black uppercase text-white hover:bg-blue-500 transition-all pointer-events-auto"
                                                  >
                                                    Habilitar Ajustes Profissionais
                                                  </button>
                                                </div>
                                              </div>
                                            )}
                                            <div className="grid grid-cols-3 gap-2">
                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[8px] font-black uppercase text-gray-500 tracking-widest">
                                                <span>Zoom</span>
                                                <span>{(configs?.[index]?.scale || 100)}%</span>
                                              </div>
                                              <input 
                                                type="range" min="100" max="250" step="1"
                                                value={configs?.[index]?.scale || 100}
                                                onChange={(e) => {
                                                  const newConfig = [...configs];
                                                  if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50 };
                                                  newConfig[index].scale = parseInt(e.target.value);
                                                  if (isMobile) {
                                                    setLocalSettings({ ...localSettings, banner_config_mobile: newConfig });
                                                  } else {
                                                    setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                  }
                                                }}
                                                className="w-full accent-blue-500 h-1 bg-black rounded-lg appearance-none cursor-pointer"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[8px] font-black uppercase text-gray-500 tracking-widest">
                                                <span>Posição X</span>
                                                <span>{(configs?.[index]?.x || 50)}%</span>
                                              </div>
                                              <input 
                                                type="range" min="0" max="100" step="1"
                                                value={configs?.[index]?.x || 50}
                                                onChange={(e) => {
                                                  const newConfig = [...configs];
                                                  if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50 };
                                                  newConfig[index].x = parseInt(e.target.value);
                                                  if (isMobile) {
                                                    setLocalSettings({ ...localSettings, banner_config_mobile: newConfig });
                                                  } else {
                                                    setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                  }
                                                }}
                                                className="w-full accent-blue-500 h-1 bg-black rounded-lg appearance-none cursor-pointer"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[8px] font-black uppercase text-gray-500 tracking-widest">
                                                <span>Posição Y</span>
                                                <span>{(configs?.[index]?.y || 50)}%</span>
                                              </div>
                                              <input 
                                                type="range" min="0" max="100" step="1"
                                                value={configs?.[index]?.y || 50}
                                                onChange={(e) => {
                                                  const newConfig = [...configs];
                                                  if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50 };
                                                  newConfig[index].y = parseInt(e.target.value);
                                                  if (isMobile) {
                                                    setLocalSettings({ ...localSettings, banner_config_mobile: newConfig });
                                                  } else {
                                                    setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                  }
                                                }}
                                                className="w-full accent-blue-500 h-1 bg-black rounded-lg appearance-none cursor-pointer"
                                              />
                                            </div>
                                          </div>
                                          
                                          <button 
                                            onClick={() => {
                                              const isMobile = activeBannerPlatform === 'mobile' && localSettings.banner_sync === false;
                                              const configs = isMobile ? (localSettings.banner_config_mobile || []) : (localSettings.banner_config || []);
                                              const newConfig = [...configs];
                                              if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50, stretch: true };
                                              newConfig[index].stretch = !newConfig[index].stretch;
                                              // If stretching, reset zoom and position
                                              if (newConfig[index].stretch) {
                                                newConfig[index].scale = 100;
                                                newConfig[index].x = 50;
                                                newConfig[index].y = 50;
                                              }
                                              if (isMobile) {
                                                setLocalSettings({ ...localSettings, banner_config_mobile: newConfig });
                                              } else {
                                                setLocalSettings({ ...localSettings, banner_config: newConfig });
                                              }
                                            }}
                                            className={`w-full p-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all mt-2 ${configs?.[index]?.stretch ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/40' : 'bg-white/5 text-gray-500 border-white/10 hover:bg-white/10 hover:border-blue-500/30'}`}
                                          >
                                            <Layout size={14} />
                                            <span className="text-[10px] font-black uppercase whitespace-nowrap tracking-widest leading-none">Imagem tamanho original, clique para editar</span>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  ));
                                })()}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Tempo de Rotação (Segundos)</label>
                                <div className="flex items-center gap-4">
                                  <input 
                                    type="number" 
                                    step="0.1"
                                    min="0.1"
                                    value={+(localSettings?.banner_interval / 1000).toFixed(1) || 5.0}
                                    onChange={(e) => setLocalSettings({ ...localSettings, banner_interval: Math.round(parseFloat(e.target.value) * 1000) || 5000 })}
                                    className="w-32 bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none font-mono"
                                    placeholder="5.0"
                                  />
                                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] italic">Segundos</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-6">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview em Tempo Real</label>
                                <div className="flex bg-black p-1 rounded-lg border border-white/5">
                                  <button 
                                    onClick={() => setBannerPreviewMode('desktop')}
                                    className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase flex items-center gap-1.5 transition-all ${bannerPreviewMode === 'desktop' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                  >
                                    <Monitor size={12} /> Desktop
                                  </button>
                                  <button 
                                    onClick={() => setBannerPreviewMode('mobile')}
                                    className={`px-3 py-1.5 rounded-md text-[8px] font-black uppercase flex items-center gap-1.5 transition-all ${bannerPreviewMode === 'mobile' ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
                                  >
                                    <Smartphone size={12} /> Mobile
                                  </button>
                                </div>
                              </div>

                              <div className="flex items-center justify-center p-4 bg-black/40 rounded-3xl border border-white/5 min-h-[500px]">
                                {bannerPreviewMode === 'mobile' ? (
                                  /* Mobile Frame (iPhone-like) */
                                  <div className="relative w-[280px] h-[580px] bg-zinc-900 rounded-[3rem] border-[8px] border-zinc-800 shadow-2xl overflow-hidden ring-1 ring-white/10 shrink-0">
                                    {/* Speaker/Notch */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-800 rounded-b-2xl z-30" />
                                    
                                    {/* App Layout Simulation */}
                                    <div className="absolute inset-0 bg-bg-main overflow-hidden pb-20">
                                      {/* Banner Container */}
                                      <div className="relative w-full h-[65%] bg-zinc-800 overflow-hidden group">
                                        
                                        {/* Overlay Header (Sino, Nome, Sair) - Injected inside the banner container per user request */}
                                        <div className="absolute top-0 left-0 right-0 h-16 flex items-center px-4 justify-between z-30 pointer-events-none">
                                          <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-zinc-900/40 backdrop-blur-md border border-white/10 flex items-center justify-center overflow-hidden">
                                              <UserIcon size={16} className="text-white/40" />
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="text-[10px] font-black italic tracking-tighter text-white uppercase italic drop-shadow-lg leading-none">{user.email?.split('@')[0] || 'Usuária'}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-8 h-8 flex items-center justify-center text-white bg-black/20 backdrop-blur-md rounded-full border border-white/5"><Bell size={14} /></div>
                                            <div className="w-8 h-8 flex items-center justify-center text-white bg-red-500/20 backdrop-blur-md rounded-full border border-red-500/20"><X size={14} /></div>
                                          </div>
                                        </div>

                                        {(() => {
                                          const isMobilePreview = bannerPreviewMode === 'mobile' && localSettings.banner_sync === false;
                                          const previewImages = isMobilePreview ? (localSettings.banner_images_mobile || []) : (localSettings.banner_images || []);
                                          const previewConfigs = isMobilePreview ? (localSettings.banner_config_mobile || []) : (localSettings.banner_config || []);
                                          const currentConfig = previewConfigs[editingBannerIndex ?? 0];

                                          return previewImages.length > 0 ? (
                                          <>
                                            {/* Translucent Drag Overlay */}
                                            {!currentConfig?.stretch && (
                                              <div 
                                                className="absolute inset-0 z-10 cursor-move"
                                                onPointerDown={(e) => {
                                                  const target = e.currentTarget as HTMLDivElement;
                                                  target.setPointerCapture(e.pointerId);
                                                  (target as any)._panStart = { 
                                                    x: e.clientX, 
                                                    y: e.clientY,
                                                    startX: currentConfig?.x || 50,
                                                    startY: currentConfig?.y || 50
                                                  };
                                                }}
                                                onPointerMove={(e) => {
                                                  if (!(e.currentTarget as any)._panStart) return;
                                                  const start = (e.currentTarget as any)._panStart;
                                                  const dx = e.clientX - start.x;
                                                  const dy = e.clientY - start.y;
                                                  
                                                  const idx = editingBannerIndex ?? 0;
                                                  const newConfigs = [...previewConfigs];
                                                  if (!newConfigs[idx]) newConfigs[idx] = { scale: 100, x: 50, y: 50 };
                                                  
                                                  const scale = (newConfigs[idx].scale || 100) / 100;
                                                  // Sensitivity updated for 65% height
                                                  newConfigs[idx].x = Math.max(0, Math.min(100, start.startX - (dx / (1.5 * 280 / scale)) * 100));
                                                  newConfigs[idx].y = Math.max(0, Math.min(100, start.startY - (dy / (1.5 * (580 * 0.65) / scale)) * 100));
                                                  
                                                  if (isMobilePreview) {
                                                    setLocalSettings({ ...localSettings, banner_config_mobile: newConfigs });
                                                  } else {
                                                    setLocalSettings({ ...localSettings, banner_config: newConfigs });
                                                  }
                                                }}
                                                onPointerUp={(e) => {
                                                  (e.currentTarget as any)._panStart = null;
                                                  e.currentTarget.releasePointerCapture(e.pointerId);
                                                }}
                                              />
                                            )}
                                            <motion.img 
                                              src={previewImages[editingBannerIndex ?? 0] || 'https://images.unsplash.com/photo-1555252333-9f8e92e65ee9'} 
                                              style={{ 
                                                objectFit: currentConfig?.stretch ? 'fill' : 'cover',
                                                width: '100%',
                                                height: '100%',
                                                scale: currentConfig?.stretch ? 1 : (currentConfig?.scale || 100) / 100,
                                                objectPosition: currentConfig?.stretch ? 'center' : `${currentConfig?.x || 50}% ${currentConfig?.y || 50}%`,
                                                transformOrigin: 'center center'
                                              }}
                                              className="transition-all duration-75 select-none"
                                              referrerPolicy="no-referrer"
                                            />
                                            {/* Drag hint overlay */}
                                            {!currentConfig?.stretch && (
                                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                                                  <Zap size={10} className="text-yellow-400" />
                                                  <span className="text-[8px] font-black uppercase text-white tracking-widest leading-none italic">Arraste para Enquadrar</span>
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        ) : (
                                          <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-20">
                                            <ImageOff size={32} />
                                            <p className="text-[8px] font-black uppercase">Sem Imagem</p>
                                          </div>
                                        );
                                      })()}
                                        <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-transparent to-transparent opacity-90 pointer-events-none" />
                                        <div className="absolute inset-0 bg-gradient-to-b from-bg-main/60 via-transparent to-transparent pointer-events-none" />
                                      </div>

                                      {/* Content simulation (Fixed, no scroll) */}
                                      <div className="p-6 space-y-6">
                                        <div className="flex gap-4 overflow-hidden">
                                          {[1,2,3].map(i => (
                                            <div key={i} className="w-32 h-44 rounded-xl bg-zinc-800/50 shrink-0 border border-white/5" />
                                          ))}
                                        </div>
                                        <div className="space-y-3">
                                          <div className="w-2/3 h-3 bg-zinc-800/50 rounded-full" />
                                          <div className="w-full h-1.5 bg-zinc-800/20 rounded-full" />
                                          <div className="w-5/6 h-1.5 bg-zinc-800/20 rounded-full" />
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Bottom Indicator */}
                                    <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-1/3 h-1 bg-white/20 rounded-full" />
                                  </div>
                                ) : (
                                  /* Desktop Frame (Laptop-like) */
                                  <div className="w-full max-w-[850px] space-y-2 shrink-0">
                                    <div className="relative aspect-video bg-zinc-900 rounded-2xl border-[12px] border-zinc-800 shadow-2xl overflow-hidden ring-1 ring-white/10">
                                      {/* Web Browser UI */}
                                      <div className="h-8 bg-zinc-800 flex items-center px-4 gap-2 z-30 relative">
                                        <div className="flex gap-1.5">
                                          <div className="w-2 h-2 rounded-full bg-red-500/40" />
                                          <div className="w-2 h-2 rounded-full bg-amber-500/40" />
                                          <div className="w-2 h-2 rounded-full bg-green-500/40" />
                                        </div>
                                        <div className="flex-1 h-5 bg-black/20 rounded-md mx-4" />
                                      </div>

                                      <div className="absolute inset-0 mt-8 bg-bg-main overflow-hidden flex flex-col">
                                        {/* Site Navigation Overlay */}
                                        <div className="h-16 flex items-center px-12 justify-between z-30 absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent">
                                          <div className="flex items-center gap-8">
                                            <div className="flex gap-8 items-center">
                                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Início</div>
                                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Comunidade</div>
                                              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Perfil</div>
                                            </div>
                                          </div>
                                          <div className="flex gap-6 items-center">
                                            <Bell size={18} className="text-white/40" />
                                            <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-md">
                                              <div className="w-6 h-6 rounded-full bg-blue-500 overflow-hidden flex items-center justify-center border border-primary/30">
                                                <UserIcon size={12} className="text-white" />
                                              </div>
                                              <span className="text-[10px] font-bold tracking-tight text-white uppercase italic truncate max-w-[100px] leading-none">NOME USUÁRIO</span>
                                            </div>
                                            <div className="flex items-center gap-2 bg-white/5 hover:bg-red-500/10 px-3 py-1.5 rounded-full border border-white/5 transition-all">
                                              <LogOut size={14} className="text-red-500/60" />
                                              <span className="text-[10px] font-black text-white/40 uppercase leading-none">Sair</span>
                                            </div>
                                          </div>
                                        </div>

                                        {/* The Banner (exactly 75% height of frame) */}
                                        <div className="relative w-full h-[75%] bg-zinc-800 overflow-hidden group">
                                          {(() => {
                                            const isDesktopPreview = bannerPreviewMode === 'desktop' || localSettings.banner_sync !== false;
                                            const previewImages = isDesktopPreview ? (localSettings.banner_images || []) : (localSettings.banner_images_mobile || []);
                                            const previewConfigs = isDesktopPreview ? (localSettings.banner_config || []) : (localSettings.banner_config_mobile || []);
                                            const currentConfig = previewConfigs[editingBannerIndex ?? 0];

                                            return previewImages.length > 0 ? (
                                              <>
                                                {/* Drag Overlay */}
                                                {!currentConfig?.stretch && (
                                                  <div 
                                                    className="absolute inset-0 z-10 cursor-move"
                                                    onPointerDown={(e) => {
                                                      const target = e.currentTarget as HTMLDivElement;
                                                      target.setPointerCapture(e.pointerId);
                                                      (target as any)._panStart = { 
                                                        x: e.clientX, 
                                                        y: e.clientY,
                                                        startX: currentConfig?.x || 50,
                                                        startY: currentConfig?.y || 50
                                                      };
                                                    }}
                                                    onPointerMove={(e) => {
                                                      if (!(e.currentTarget as any)._panStart) return;
                                                      const start = (e.currentTarget as any)._panStart;
                                                      const dx = e.clientX - start.x;
                                                      const dy = e.clientY - start.y;
                                                      
                                                      const idx = editingBannerIndex ?? 0;
                                                      const newConfigs = [...previewConfigs];
                                                      if (!newConfigs[idx]) newConfigs[idx] = { scale: 100, x: 50, y: 50 };
                                                      
                                                      const scale = (newConfigs[idx].scale || 100) / 100;
                                                      newConfigs[idx].x = Math.max(0, Math.min(100, start.startX - (dx / (1.5 * 850 / scale)) * 100));
                                                      newConfigs[idx].y = Math.max(0, Math.min(100, start.startY - (dy / (1.5 * 450 * 0.75 / scale)) * 100));
                                                      
                                                      if (bannerPreviewMode === 'desktop' || localSettings.banner_sync !== false) {
                                                        setLocalSettings({ ...localSettings, banner_config: newConfigs });
                                                      } else {
                                                        setLocalSettings({ ...localSettings, banner_config_mobile: newConfigs });
                                                      }
                                                    }}
                                                    onPointerUp={(e) => {
                                                      (e.currentTarget as any)._panStart = null;
                                                      e.currentTarget.releasePointerCapture(e.pointerId);
                                                    }}
                                                  />
                                                )}
                                                <motion.img 
                                                  src={previewImages[editingBannerIndex ?? 0] || 'https://images.unsplash.com/photo-1555252333-9f8e92e65ee9'} 
                                                  style={{ 
                                                    objectFit: currentConfig?.stretch ? 'fill' : 'cover',
                                                    width: '100%',
                                                    height: '100%',
                                                    scale: currentConfig?.stretch ? 1 : (currentConfig?.scale || 100) / 100,
                                                    objectPosition: currentConfig?.stretch ? 'center' : `${currentConfig?.x || 50}% ${currentConfig?.y || 50}%`,
                                                    transformOrigin: 'center center'
                                                  }}
                                                  className="transition-all duration-75 select-none"
                                                  referrerPolicy="no-referrer"
                                                />
                                                {!currentConfig?.stretch && (
                                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                    <div className="bg-black/60 backdrop-blur-sm px-4 py-2 rounded-full border border-white/10 flex items-center gap-2">
                                                      <Zap size={12} className="text-yellow-400" />
                                                      <span className="text-[10px] font-black uppercase text-white tracking-widest leading-none italic">Arraste para Enquadrar</span>
                                                    </div>
                                                  </div>
                                                )}
                                              </>
                                            ) : (
                                              <div className="w-full h-full flex flex-col items-center justify-center gap-2 opacity-20">
                                                <ImageOff size={32} />
                                                <p className="text-xs font-black uppercase">Sem Imagem</p>
                                              </div>
                                            );
                                          })()}
                                          <div className="absolute inset-0 bg-gradient-to-t from-bg-main via-transparent to-transparent opacity-90" />
                                          <div className="absolute inset-0 bg-gradient-to-b from-bg-main/40 via-transparent to-transparent" />
                                        </div>

                                        {/* Content Area (Fixed) */}
                                        <div className="px-12 py-12 grid grid-cols-4 gap-8 overflow-hidden">
                                          {[1,2,3,4].map(i => (
                                            <div key={i} className="aspect-[3/4] rounded-2xl bg-zinc-800/50 border border-white/5" />
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="w-1/3 h-2 bg-zinc-800 mx-auto rounded-b-xl" />
                                    <div className="w-1/2 h-1 bg-zinc-800/40 mx-auto rounded-full" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* 3. Textos do Início */}
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-lg text-primary">
                              <ShoppingBag size={20} />
                            </div>
                            <h4 className="font-bold text-white">Textos do Início</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              {[
                                { key: 'dashboard.courses_paid', label: 'Título Cursos Pagos' },
                                { key: 'dashboard.courses_free', label: 'Título Produto Principal' },
                                { key: 'dashboard.courses_bonus', label: 'Título Cursos Bônus' },
                                { key: 'badge.locked', label: 'Badge Curso Bloqueado' },
                                { key: 'cta.unlock', label: 'Botão Curso Bloqueado' },
                                { key: 'badge.new', label: 'Badge Começar (Não Iniciado)' },
                                { key: 'cta.new', label: 'Botão Começar (Não Iniciado)' },
                                { key: 'badge.in_progress', label: 'Badge Em Andamento' },
                                { key: 'cta.in_progress', label: 'Botão Retomar Aula' },
                                { key: 'badge.completed', label: 'Badge Concluído' },
                                { key: 'cta.completed', label: 'Botão Assistir Novamente' },
                                { key: 'course.progresso', label: 'Label de Progresso' },
                                { key: 'course.exclusive_content', label: 'Texto Conteúdo Exclusivo' },
                                { key: 'dashboard.resume_label', label: 'Texto Retomar Aula (Topo)' },
                                { key: 'gamification.ranking_label', label: 'Texto Botão Ranking' },
                                { key: 'gamification.level_up', label: 'Texto Level Up' },
                                { key: 'gamification.level_short', label: 'Prefixo de Nível (Ex: Lvl, Nível)' },
                                { key: 'gamification.modal_title', label: 'Título Modal Nível (variável {level})' },
                                { key: 'gamification.progress_label', label: 'Texto Subtítulo Modal (variável {progress})' },
                                { key: 'gamification.next_achievement', label: 'Texto Próxima Conquista' },
                                { key: 'gamification.continue_journey', label: 'Texto Botão Continuar' },
                                { key: 'gamification.level_0_label', label: 'Label Nível 0' },
                                { key: 'gamification.level_1_label', label: 'Label Nível 1' },
                                { key: 'gamification.level_2_label', label: 'Label Nível 2' },
                                { key: 'gamification.level_3_label', label: 'Label Nível 3' },
                                { key: 'gamification.level_4_label', label: 'Label Nível 4' },
                                { key: 'gamification.level_5_label', label: 'Label Nível 5' },
                                { key: 'gamification.level_0_req', label: 'Objetivo Nível 0' },
                                { key: 'gamification.level_1_req', label: 'Objetivo Nível 1' },
                                { key: 'gamification.level_2_req', label: 'Objetivo Nível 2' },
                                { key: 'gamification.level_3_req', label: 'Objetivo Nível 3' },
                                { key: 'gamification.level_4_req', label: 'Objetivo Nível 4' },
                                { key: 'gamification.level_5_req', label: 'Objetivo Nível 5' },
                                { key: 'dashboard.empty_locked', label: 'Mensagem Sem Cursos' },
                                { key: 'dashboard.empty_all_unlocked', label: 'Mensagem Todos Liberados' },
                                { key: 'dashboard.loading_error', label: 'Erro: Carregar Conteúdos' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  <input 
                                    type="text" 
                                    value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                    placeholder={languagePresets.pt[field.key] || field.label}
                                    onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview das Vitrines</label>
                              <div className="p-6 rounded-3xl border border-white/10 space-y-8 h-full overflow-hidden min-h-[400px]" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="space-y-3">
                                  <h5 className="text-xs font-black text-white uppercase italic tracking-tighter">
                                    {draftCustomTexts['dashboard.courses_paid'] || 'Meus Cursos'}
                                  </h5>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="aspect-[2/3] bg-white/5 rounded-lg" />
                                    <div className="aspect-[2/3] bg-white/5 rounded-lg" />
                                    <div className="aspect-[2/3] bg-white/5 rounded-lg" />
                                  </div>
                                </div>
                                <div className="space-y-3 opacity-40">
                                  <h5 className="text-[10px] font-black text-white uppercase italic tracking-tighter">
                                    {draftCustomTexts['dashboard.courses_free'] || 'Produtos Principais'}
                                  </h5>
                                  <div className="grid grid-cols-3 gap-2">
                                    <div className="aspect-[2/3] bg-white/5 rounded-lg border border-white/5" />
                                    <div className="aspect-[2/3] bg-white/5 rounded-lg border border-white/5" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'support' && (
                      <div className="space-y-8">
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-500/20 rounded-lg text-green-500">
                                <MessageSquare size={20} />
                              </div>
                              <h4 className="font-bold text-white tracking-tight italic uppercase">Configurações de Suporte</h4>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 text-zinc-100">
                            <div className="space-y-8">
                              <div className="space-y-4">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest leading-none">Informações de Contato</label>
                                <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-start gap-4">
                                  <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500 shrink-0">
                                    <Info size={16} />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-bold text-white leading-tight">Gestão Centralizada</p>
                                    <p className="text-xs text-blue-500/80 leading-relaxed font-medium">As informações de contato (WhatsApp e E-mail) agora são alteradas na aba <strong>Configurações Gerais</strong> para maior segurança e praticidade.</p>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="space-y-1">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest leading-none">Páginas de Exibição</label>
                                  <p className="text-[10px] font-bold text-zinc-500 italic">Selecione o que deve aparecer em cada página</p>
                                </div>
                                
                                <div className="grid grid-cols-1 gap-3">
                                  {[
                                    { id: 'login', label: 'Página de Login' },
                                    { id: 'home', label: 'Página de Início' },
                                    { id: 'course', label: 'Página de Cursos' },
                                    { id: 'lesson', label: 'Página de Aula' },
                                    { id: 'community', label: 'Página Comunidade' },
                                    { id: 'profile', label: 'Página Perfil' },
                                    { id: 'preview', label: 'Página Preview de Compra' }
                                  ].map(page => (
                                    <div key={page.id} className="p-4 bg-black/30 rounded-2xl border border-white/5 flex flex-col gap-4 group">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                          <span className="text-xs font-bold text-zinc-300 uppercase tracking-tight group-hover:text-white transition-colors">{page.label}</span>
                                        </div>
                                      </div>
                                      
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          onClick={() => setLocalSettings({ ...localSettings, [`support_whatsapp_${page.id}_floating`]: !localSettings[`support_whatsapp_${page.id}_floating`] })}
                                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${localSettings?.[`support_whatsapp_${page.id}_floating`] ? 'bg-green-500 text-white border-green-600 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-white/5 border-white/5 text-zinc-600 hover:text-zinc-400'}`}
                                        >
                                          <MousePointer2 size={12} /> WHATS FLUTUANTE
                                        </button>
                                        <button
                                          onClick={() => setLocalSettings({ ...localSettings, [`support_whatsapp_${page.id}_enabled`]: !localSettings[`support_whatsapp_${page.id}_enabled`] })}
                                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${localSettings?.[`support_whatsapp_${page.id}_enabled`] ? 'bg-green-500/10 border-green-500/30 text-green-500' : 'bg-white/5 border-white/5 text-zinc-600 hover:text-zinc-400'}`}
                                        >
                                          <MessageSquare size={12} /> WHATS
                                        </button>
                                        <button
                                          onClick={() => setLocalSettings({ ...localSettings, [`support_email_${page.id}_enabled`]: !localSettings[`support_email_${page.id}_enabled`] })}
                                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all border ${localSettings?.[`support_email_${page.id}_enabled`] ? 'bg-blue-500/10 border-blue-500/30 text-blue-500' : 'bg-white/5 border-white/5 text-zinc-600 hover:text-zinc-400'}`}
                                        >
                                          <Mail size={12} /> EMAIL
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-8">
                               <div className="space-y-4">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest leading-none">Textos e Rótulos</label>
                                  <div className="space-y-4">
                                    {[
                                      { key: 'auth.support_box', label: 'Título da Caixa' },
                                      { key: 'auth.support_description', label: 'Texto Descritivo', type: 'textarea' },
                                      { key: 'auth.whatsapp_label', label: 'Rótulo WhatsApp' },
                                      { key: 'auth.email_label', label: 'Rótulo Email' }
                                    ].map(field => (
                                      <div key={field.key} className="space-y-2">
                                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none">{field.label}</label>
                                        {field.type === 'textarea' ? (
                                          <textarea 
                                            value={draftCustomTexts[field.key] || settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || ''}
                                            onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:border-blue-500 outline-none h-24 resize-none transition-all"
                                            placeholder={field.label}
                                          />
                                        ) : (
                                          <input 
                                            type="text" 
                                            value={draftCustomTexts[field.key] || settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || ''}
                                            onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-zinc-300 focus:border-blue-500 outline-none transition-all"
                                            placeholder={field.label}
                                          />
                                        )}
                                      </div>
                                    ))}
                                  </div>
                               </div>

                               <div className="space-y-4">
                                 <label className="text-xs font-black text-gray-500 uppercase tracking-widest leading-none">Preview em Tempo Real</label>
                                 <div className="p-8 rounded-[3rem] border border-white/10 flex flex-col items-center justify-center space-y-6 relative overflow-hidden h-[340px] shadow-2xl" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                   <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16" />
                                   <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -ml-16 -mb-16" />
                                   
                                   <div className="relative space-y-2 text-center">
                                      <h6 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                                        {draftCustomTexts['auth.support_box'] || settings.custom_texts?.['auth.support_box'] || 'Precisa de Suporte?'}
                                      </h6>
                                      <p className="text-[10px] text-zinc-500 font-bold max-w-[220px] mx-auto leading-relaxed">
                                        {draftCustomTexts['auth.support_description'] || settings.custom_texts?.['auth.support_description'] || 'Equipe pronta para te ajudar com qualquer dúvida ou problema.'}
                                      </p>
                                   </div>

                                   <div className="relative flex flex-col gap-2 w-full max-w-[160px]">
                                      <div className="w-full py-3 bg-green-500/10 border border-green-500/20 rounded-2xl text-[8px] font-black text-green-500 text-center uppercase tracking-[0.2em] shadow-lg shadow-green-500/5 transition-all">
                                        {draftCustomTexts['auth.whatsapp_label'] || settings.custom_texts?.['auth.whatsapp_label'] || 'WHATSAPP'}
                                      </div>
                                      <div className="w-full py-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-[8px] font-black text-blue-500 text-center uppercase tracking-[0.2em] shadow-lg shadow-blue-500/5 opacity-50 transition-all">
                                        {draftCustomTexts['auth.email_label'] || settings.custom_texts?.['auth.email_label'] || 'EMAIL'}
                                      </div>
                                   </div>

                                   <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 opacity-20">
                                      <div className="w-1 h-1 rounded-full bg-white" />
                                      <div className="w-8 h-1 rounded-full bg-white/20" />
                                      <div className="w-1 h-1 rounded-full bg-white" />
                                   </div>
                                 </div>
                               </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'course' && (
                      <div className="space-y-8">
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-500">
                              <BookOpen size={20} />
                            </div>
                            <h4 className="font-bold text-white">Visualizador de Cursos</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              {[
                                { key: 'course.progress', label: 'Label de Progresso' },
                                { key: 'course.your_progress', label: 'Label Mini Progresso' },
                                { key: 'course.lessons', label: 'Label Aulas' },
                                { key: 'course.content', label: 'Label Conteúdo' },
                                { key: 'course.no_media', label: 'Texto Sem Mídia' },
                                { key: 'course.lesson_completed', label: 'Alerta de Aula Concluída' },
                                { key: 'course.lesson_unmarked', label: 'Alerta de Aula Não Concluída' },
                                { key: 'course.prev_lesson', label: 'Botão Aula Anterior' },
                                { key: 'course.next_lesson', label: 'Botão Próxima Aula' },
                                { key: 'course.complete_lesson_btn', label: 'Botão de Concluir' },
                                { key: 'course.lesson_completed_btn', label: 'Botão Concluído' },
                                { key: 'course.end_label', label: 'Texto Fim (Navegação)' },
                                { key: 'course.materials', label: 'Título Materiais' },
                                { key: 'course.schedule_title', label: 'Título Cronograma' },
                                { key: 'course.module', label: 'Texto do Módulo' },
                                { key: 'course.completed', label: 'Status: Concluído' },
                                { key: 'course.continue', label: 'Status: Continuar' },
                                { key: 'course.start', label: 'Status: Começar' },
                                { key: 'course.support_description', label: 'Texto de Suporte (Box)' },
                                { key: 'course.not_found', label: 'Erro: Não Encontrado' },
                                { key: 'course.loading_error', label: 'Erro: Carregar Aula' },
                                { key: 'course.progress_error', label: 'Erro: Atualizar Progresso' },
                                { key: 'course.video_lesson', label: 'Tag: Videoaula' },
                                { key: 'course.pdf_material', label: 'Tag: Material PDF' },
                                { key: 'course.reading', label: 'Tag: Leitura' },
                                { key: 'course.view_fullscreen', label: 'Botão Fullscreen (Aula PDF)' },
                                { key: 'course.questions_title', label: 'Título Dúvidas' },
                                { key: 'course.question_placeholder', label: 'Placeholder Dúvida' },
                                { key: 'course.send_question', label: 'Botão Enviar Dúvida' },
                                { key: 'course.no_questions', label: 'Texto Sem Dúvidas' },
                                { key: 'course.waiting_answer', label: 'Status: Aguardando Resposta' },
                                { key: 'course.answered_at', label: 'Status: Respondido em' },
                                { key: 'course.admin_answer', label: 'Label: Resposta do Expert' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  <input 
                                    type="text" 
                                    value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                    placeholder={field.label}
                                    onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview de Navegação de Aula</label>
                              <div className="p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center gap-6" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="w-full h-32 bg-white/5 rounded-xl flex items-center justify-center">
                                  <Play className="text-white/20" size={32} />
                                </div>
                                <div className="w-full border-t border-white/10 pt-6 flex justify-between">
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase">
                                    <ChevronLeft size={16} /> {draftCustomTexts['course.prev_lesson'] || settings.custom_texts?.['course.prev_lesson'] || languagePresets.pt['course.prev_lesson']}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase">
                                    {draftCustomTexts['course.next_lesson'] || settings.custom_texts?.['course.next_lesson'] || languagePresets.pt['course.next_lesson']} <ChevronRight size={16} />
                                  </div>
                                </div>
                                <div className="w-full space-y-2">
                                   <p className="text-[10px] font-black text-white italic uppercase">{draftCustomTexts['course.materials'] || settings.custom_texts?.['course.materials'] || languagePresets.pt['course.materials']}</p>
                                   <div className="h-10 bg-white/5 rounded-lg border border-dashed border-white/10" />
                                </div>
                              </div>

                              <div className="mt-8 pt-8 border-t border-white/10">
                                <div className="flex items-center justify-between p-4 bg-black/40 rounded-xl border border-white/5">
                                  <div className="space-y-1">
                                    <p className="text-xs font-black text-white uppercase italic">Auto-concluir Aula ao Abrir PDF</p>
                                    <p className="text-[10px] text-gray-500">Marca a aula como completa automaticamente ao abrir o fullscreen no PDF.</p>
                                  </div>
                                  <button 
                                    onClick={() => updateSettings({ course_pdf_auto_complete_fullscreen: !settings.course_pdf_auto_complete_fullscreen })}
                                    className={`w-12 h-6 rounded-full transition-all relative ${settings.course_pdf_auto_complete_fullscreen ? 'bg-blue-600' : 'bg-zinc-700'}`}
                                  >
                                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.course_pdf_auto_complete_fullscreen ? 'right-1' : 'left-1'}`} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-yellow-500/20 rounded-lg text-yellow-500">
                              <Star size={20} />
                            </div>
                            <h4 className="font-bold text-white">Modal de Venda (Checkout)</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              {[
                                { key: 'course.premium_content', label: 'Badge Premium' },
                                { key: 'course.lifetime_access', label: 'Texto Acesso' },
                                { key: 'course.unlock_button', label: 'Botão Comprar' },
                                { key: 'course.secure_payment', label: 'Texto Rodapé Seguro' },
                                { key: 'course.purchase_unavailable', label: 'Erro: Compra Indisponível' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  <input 
                                    type="text" 
                                    value={draftCustomTexts[field.key] || settings.custom_texts?.[field.key] || ''}
                                    placeholder={field.label}
                                    onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="space-y-4">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview do Modal</label>
                              <div className="p-6 rounded-3xl border border-white/10 space-y-4 shadow-2xl" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="aspect-video bg-white/5 rounded-xl border border-white/5" />
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2 text-[8px] font-black text-primary uppercase tracking-widest italic">
                                    <Star size={10} className="fill-current" /> {draftCustomTexts['course.premium_content'] || 'CONTEÚDO PREMIUM'}
                                  </div>
                                  <div className="h-6 w-3/4 bg-white/10 rounded-lg" />
                                  <div className="flex gap-2">
                                     <div className="h-4 w-12 bg-white/10 rounded-full" />
                                     <div className="h-4 w-20 bg-white/5 border border-white/5 rounded-full" />
                                  </div>
                                </div>
                                <div className="h-12 bg-blue-600 rounded-xl flex items-center justify-center text-[10px] font-black text-white uppercase tracking-widest">
                                  {draftCustomTexts['course.unlock_button'] || 'LIBERAR ACESSO AGORA'}
                                </div>
                                <p className="text-[8px] text-gray-600 font-bold uppercase text-center tracking-widest">
                                  {draftCustomTexts['course.secure_payment'] || 'Pagamento 100% Seguro • Acesso Imediato'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'lesson' && (
                      <div className="space-y-8">
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-500">
                              <PlayCircle size={20} />
                            </div>
                            <h4 className="font-bold text-white">Configuração da Página de Aula</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                               <div className="p-6 bg-blue-500/5 border border-blue-500/20 rounded-2xl flex items-start gap-4">
                                  <div className="p-2 bg-blue-500/20 rounded-lg text-blue-500 shrink-0">
                                    <Info size={16} />
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-bold text-white leading-tight">Configurações de Aula</p>
                                    <p className="text-xs text-blue-500/80 leading-relaxed font-medium">As principais customizações da página de aula (textos de progresso, botões de navegação, etc) são compartilhadas com a aba <strong>Cursos</strong>.</p>
                                  </div>
                               </div>

                               <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">Opções da Aula</h5>
                               {[
                                 { key: 'course.questions_title', label: 'Título da Seção de Dúvidas' },
                                 { key: 'course.question_placeholder', label: 'Placeholder de Nova Dúvida' },
                                 { key: 'course.send_question', label: 'Texto do Botão Enviar' },
                                 { key: 'course.admin_answer', label: 'Texto Resposta do Expert' }
                               ].map(field => (
                                 <div key={field.key} className="space-y-2">
                                   <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                   <input 
                                     type="text" 
                                     value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                     placeholder={field.label}
                                     onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                     className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                   />
                                 </div>
                               ))}
                            </div>

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview Area</label>
                              <div className="rounded-[2.5rem] border border-white/10 p-8 flex flex-col shadow-2xl space-y-6 min-h-[400px] relative overflow-hidden" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                 <div className="w-full h-40 bg-zinc-800 rounded-2xl flex items-center justify-center border border-white/5">
                                    <Play size={32} className="text-white/10" />
                                 </div>
                                 <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                       <div className="h-4 w-32 bg-white/10 rounded-full" />
                                       <div className="h-8 w-24 bg-blue-600 rounded-xl" />
                                    </div>
                                    <div className="space-y-2">
                                       <div className="h-2 w-full bg-white/5 rounded-full" />
                                       <div className="h-2 w-3/4 bg-white/5 rounded-full" />
                                    </div>
                                 </div>
                                 <div className="pt-6 border-t border-white/5 space-y-4">
                                    <h6 className="text-[10px] font-black text-white uppercase italic">{draftCustomTexts['course.questions_title'] || 'Dúvidas sobre a Aula'}</h6>
                                    <div className="h-10 bg-black/40 rounded-xl border border-white/10 px-4 flex items-center text-[10px] text-gray-600">
                                       {draftCustomTexts['course.question_placeholder'] || 'Qual é a sua dúvida?'}
                                    </div>
                                 </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'community' && (
                      <div className="space-y-8">
                        {/* Community Text Editor */}
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                              <MessageSquare size={20} />
                            </div>
                            <h4 className="font-bold text-white">Customização da Comunidade</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              {[
                                { key: 'community.input_placeholder', label: 'Placeholder de Nova Postagem' },
                                { key: 'community.like', label: 'Texto Curtir' },
                                { key: 'community.comment_placeholder', label: 'Placeholder Comentar' },
                                { key: 'community.add_photo', label: 'Botão Adicionar Foto' },
                                { key: 'community.send_reply', label: 'Botão Enviar Resposta' },
                                { key: 'community.post_sent', label: 'Toast: Post Enviado' },
                                { key: 'community.post_updated', label: 'Toast: Post Atualizado' },
                                { key: 'community.edit_post', label: 'Título Modal Editar' },
                                { key: 'community.delete_post', label: 'Texto Excluir Post' },
                                { key: 'community.delete_post_confirm', label: 'Confirmação Excluir Post' },
                                { key: 'community.delete_success', label: 'Toast: Post Excluído' },
                                { key: 'community.delete_error', label: 'Toast: Erro Excluir Post' },
                                { key: 'community.load_more', label: 'Botão Carregar mais' },
                                { key: 'community.loading_posts', label: 'Texto Carregando (Comunidade)' },
                                { key: 'community.comment_delete_success', label: 'Toast: Comentário Excluído' },
                                { key: 'community.comment_delete_error', label: 'Toast: Erro Excluir Comentário' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  <input 
                                    type="text" 
                                    value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                    placeholder={field.label}
                                    onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                  />
                                </div>
                              ))}

                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest text-primary italic">Formato da Data</label>
                                <div className="relative group">
                                  <select 
                                    value={draftCustomTexts['community.date_format'] !== undefined ? draftCustomTexts['community.date_format'] : (settings.custom_texts?.['community.date_format'] || 'd MMM, HH:mm')}
                                    onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'community.date_format': e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none appearance-none cursor-pointer transition-all hover:border-white/20"
                                  >
                                    <option value="d MMM, HH:mm">d MMM, HH:mm (Português - Ex: 6 Mai, 14:30)</option>
                                    <option value="d 'de' MMMM, HH:mm">d de MMMM, HH:mm (Português - Ex: 6 de Maio, 14:30)</option>
                                    <option value="MMM d, h:mm a">MMM d, h:mm a (Inglês - Ex: May 6, 2:30 PM)</option>
                                    <option value="MMMM d, h:mm a">MMMM d, h:mm a (Inglês - Ex: May 6, 2:30 PM)</option>
                                    <option value="d 'de' MMM, HH:mm">d de MMM, HH:mm (Espanhol - Ex: 6 de May, 14:30)</option>
                                    <option value="dd/MM/yyyy HH:mm">dd/MM/yyyy HH:mm (Universal - Ex: 06/05/2026 14:30)</option>
                                    <option value="MM/dd/yyyy h:mm a">MM/dd/yyyy h:mm a (EUA - Ex: 05/06/2026 2:30 PM)</option>
                                    <option value="HH:mm, d MMM">HH:mm, d MMM (Alternativo - Ex: 14:30, 6 Mai)</option>
                                  </select>
                                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 group-hover:text-blue-500 transition-colors">
                                    <ChevronDown size={16} />
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview da Comunidade</label>
                              <div className="rounded-3xl border border-white/10 p-8 space-y-6 text-center shadow-2xl" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="space-y-1">
                                  <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">
                                    {draftCustomTexts['community.title'] || settings.custom_texts?.['community.title'] || languagePresets.pt['community.title']}
                                  </h3>
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                    {draftCustomTexts['community.subtitle'] || settings.custom_texts?.['community.subtitle'] || languagePresets.pt['community.subtitle']}
                                  </p>
                                </div>
                                <div className="p-5 bg-white/5 border border-white/10 rounded-2xl space-y-4 shadow-xl">
                                  <div className="flex gap-3">
                                    <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 shrink-0" />
                                    <div className="flex-1 p-3 bg-black/40 rounded-xl text-gray-500 text-[10px] font-bold uppercase tracking-wider text-left border border-white/5">
                                      {draftCustomTexts['community.input_placeholder'] || settings.custom_texts?.['community.input_placeholder'] || languagePresets.pt['community.input_placeholder']}
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between pt-2 border-t border-white/5">
                                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5">
                                      <ImageIcon size={12} className="text-blue-500" />
                                      <span className="text-[8px] font-black uppercase text-white tracking-widest">
                                        {draftCustomTexts['community.add_photo'] || settings.custom_texts?.['community.add_photo'] || languagePresets.pt['community.add_photo']}
                                      </span>
                                    </div>
                                    <div className="px-5 py-1.5 bg-blue-600 rounded-full text-[8px] font-black uppercase text-white tracking-widest shadow-lg shadow-blue-500/20">
                                      {draftCustomTexts['community.post'] || settings.custom_texts?.['community.post'] || languagePresets.pt['community.post']}
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-3 opacity-40">
                                  <div className="h-24 bg-zinc-900 border border-white/5 rounded-2xl p-4 space-y-2">
                                     <div className="flex gap-2">
                                       <div className="w-8 h-8 rounded-full bg-white/5" />
                                       <div className="w-20 h-2 bg-white/10 rounded-full" />
                                     </div>
                                     <div className="w-full h-1 bg-white/5 rounded-full" />
                                     <div className="w-3/4 h-1 bg-white/5 rounded-full" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'profile' && (
                      <div className="space-y-8">
                        {/* Profile Text Editor */}
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                              <UserIcon size={20} />
                            </div>
                            <h4 className="font-bold text-white">Customização do Perfil</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              {[
                                { key: 'profile.title', label: 'Título da Página' },
                                { key: 'profile.subtitle', label: 'Subtítulo' },
                                { key: 'profile.save_changes', label: 'Botão Salvar Alterações' },
                                { key: 'profile.change_password', label: 'Botão Alterar Senha' },
                                { key: 'profile.info_title', label: 'Título Info Usuário' },
                                { key: 'profile.avatar_success', label: 'Toast Foto Sucesso' },
                                { key: 'profile.push_title', label: 'Título Push (Perfil)' },
                                { key: 'profile.push_description', label: 'Descrição Push (Perfil)', type: 'textarea' },
                                { key: 'profile.status_permission', label: 'Label Permissão Push' },
                                { key: 'profile.permission_granted', label: 'Status: CONCEDIDA' },
                                { key: 'profile.permission_denied', label: 'Status: NEGADA' },
                                { key: 'profile.permission_default', label: 'Status: PENDENTE' },
                                { key: 'profile.install_pwa_title', label: 'Título Erro (Instalação)' },
                                { key: 'profile.install_pwa_description', label: 'Descrição Erro (Instalação)', type: 'textarea' },
                                { key: 'profile.install_pwa_button', label: 'Botão Instalar (Perfil)' },
                                { key: 'profile.update_error', label: 'Erro: Atualizar Perfil' },
                                { key: 'profile.avatar_error', label: 'Erro: Upload Avatar' },
                                { key: 'profile.password_error', label: 'Erro: Atualizar Senha' },
                                { key: 'global.logging_out', label: 'Aviso: Saindo da Conta' },
                                { key: 'global.logout_error', label: 'Erro: Sair da Conta' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  {field.type === 'textarea' ? (
                                    <textarea 
                                      value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                      placeholder={field.label}
                                      onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none min-h-[100px]"
                                    />
                                  ) : (
                                    <input 
                                      type="text" 
                                      value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                      placeholder={field.label}
                                      onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                  )}
                                </div>
                              ))}
                            </div>

                            <div className="space-y-4">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview do Perfil</label>
                              <div className="rounded-[2.5rem] border border-white/10 p-8 flex flex-col items-center shadow-2xl space-y-8 min-h-[400px] relative overflow-hidden" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-blue-500/10 to-transparent" />
                                
                                <div className="relative mt-4">
                                  <div className="w-24 h-24 rounded-full border-4 border-blue-500/30 bg-zinc-900 flex items-center justify-center overflow-hidden shadow-2xl">
                                    <UserIcon className="text-white/20" size={40} />
                                  </div>
                                  <div className="absolute bottom-1 right-1 p-2 bg-blue-600 rounded-full border-2 border-zinc-950 shadow-lg">
                                    <ImageIcon size={12} className="text-white" />
                                  </div>
                                </div>

                                <div className="text-center space-y-2">
                                  <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                                    {draftCustomTexts['profile.title'] || settings.custom_texts?.['profile.title'] || languagePresets.pt['profile.title']}
                                  </h3>
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                    {draftCustomTexts['profile.subtitle'] || settings.custom_texts?.['profile.subtitle'] || languagePresets.pt['profile.subtitle']}
                                  </p>
                                </div>

                                <div className="w-full h-px bg-white/5" />

                                <div className="w-full space-y-4">
                                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-3">
                                    <div className="flex items-center gap-3 text-blue-500 font-black text-[10px] tracking-widest uppercase italic">
                                      <div className="p-1.5 bg-blue-500/20 rounded-lg">
                                        <UserIcon size={14} />
                                      </div>
                                      {draftCustomTexts['profile.info_title'] || settings.custom_texts?.['profile.info_title'] || languagePresets.pt['profile.info_title']}
                                    </div>
                                    <div className="space-y-2 mt-1">
                                      <div className="h-6 bg-black/40 rounded-lg border border-white/5" />
                                      <div className="h-6 bg-black/40 rounded-lg border border-white/5" />
                                    </div>
                                  </div>

                                  <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between">
                                    <div className="flex items-center gap-3 text-white/40 font-black text-[10px] tracking-widest uppercase italic">
                                      <div className="p-1.5 bg-white/5 rounded-lg">
                                        <Bell size={14} />
                                      </div>
                                      {draftCustomTexts['profile.push_title'] || settings.custom_texts?.['profile.push_title'] || languagePresets.pt['profile.push_title']}
                                    </div>
                                    <div className="w-10 h-5 bg-blue-600/20 rounded-full relative">
                                      <div className="absolute right-1 top-1 w-3 h-3 bg-blue-500 rounded-full" />
                                    </div>
                                  </div>
                                </div>

                                <div className="w-full pt-4">
                                   <div className="w-full py-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center justify-center gap-2">
                                      <LogOut size={12} className="text-red-500" />
                                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Sair da Conta</span>
                                   </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'push' && (
                       <div className="space-y-8">
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                              <Bell size={20} />
                            </div>
                            <h4 className="font-bold text-white">Configuração de Notificações</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2">Modal Push (Primeiro Login)</h5>
                              {[
                                { key: 'push.title', label: 'Título do Modal' },
                                { key: 'push.description', label: 'Descrição do Modal', type: 'textarea' },
                                { key: 'push.allow', label: 'Botão Ativar' },
                                { key: 'push.deny', label: 'Botão Agora Não' },
                                { key: 'push.success', label: 'Toast Sucesso' },
                                { key: 'push.new_notification', label: 'Título Notificação Local' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  {field.type === 'textarea' ? (
                                    <textarea 
                                      value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                      placeholder={field.label}
                                      onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none min-h-[100px]"
                                    />
                                  ) : (
                                    <input 
                                      type="text" 
                                      value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                      placeholder={field.label}
                                      onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                    />
                                  )}
                                </div>
                              ))}

                              <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mt-8">Painel Lateral (Sininho)</h5>
                              {[
                                { key: 'notifications.title', label: 'Título do Painel' },
                                { key: 'notifications.clear_all', label: 'Botão Limpar Tudo' },
                                { key: 'notifications.close', label: 'Botão Fechar Painel' },
                                { key: 'notifications.mark_as_read', label: 'Texto Marcar como Lida' },
                                { key: 'notifications.empty', label: 'Título Quando Vazio' },
                                { key: 'notifications.empty_desc', label: 'Descrição Quando Vazio' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  <input 
                                    type="text" 
                                    value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                    placeholder={field.label}
                                    onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none"
                                  />
                                </div>
                              ))}
                            </div>

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview do Modal</label>
                              <div className="rounded-[2.5rem] border border-white/10 p-8 flex flex-col items-center justify-center text-center space-y-6 min-h-[400px] relative overflow-hidden shadow-2xl" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="absolute top-0 left-0 w-full h-1 bg-blue-600" />
                                <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-blue-600/20 rotate-3">
                                  <Bell className="text-blue-500" size={28} />
                                </div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">
                                  {draftCustomTexts['push.title'] || settings.custom_texts?.['push.title'] || languagePresets.pt['push.title']}
                                </h3>
                                <p className="text-[10px] text-gray-500 font-medium">
                                  {draftCustomTexts['push.description'] || settings.custom_texts?.['push.description'] || languagePresets.pt['push.description']}
                                </p>
                                <div className="w-full space-y-2">
                                  <div className="w-full py-4 bg-blue-600 rounded-xl text-[10px] font-black text-white uppercase tracking-widest italic">
                                    {draftCustomTexts['push.allow'] || settings.custom_texts?.['push.allow'] || languagePresets.pt['push.allow']}
                                  </div>
                                  <div className="w-full py-2 text-[8px] text-gray-600 font-bold uppercase tracking-widest">
                                    {draftCustomTexts['push.deny'] || settings.custom_texts?.['push.deny'] || languagePresets.pt['push.deny']}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {activePageTab === 'pwa' && (
                      <div className="space-y-8">
                        <div className="bg-zinc-900/50 rounded-[40px] border border-white/10 p-10 space-y-16">
                          <div className="space-y-12">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 space-y-4">
                                <div className="space-y-1">
                                  <h4 className="text-xl font-black text-white uppercase italic tracking-tighter">PWA (Instalação)</h4>
                                </div>
                                <div className="space-y-4 pt-4 border-t border-white/5">
                                  <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                      <h5 className="text-sm font-bold text-white">Botão de Instalação na Login</h5>
                                      <p className="text-xs text-gray-500">Exibir o botão de instalar no topo da tela de autenticação.</p>
                                    </div>
                                    <button
                                      onClick={() => setDraftCustomTexts({ ...draftCustomTexts, 'pwa.enable_button': draftCustomTexts['pwa.enable_button'] === 'false' ? 'true' : 'false' })}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                                        (draftCustomTexts['pwa.enable_button'] !== 'false') ? 'bg-primary' : 'bg-zinc-700'
                                      }`}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                          (draftCustomTexts['pwa.enable_button'] !== 'false') ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                      />
                                    </button>
                                  </div>
                                </div>

                                <div className="space-y-6">
                                  <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mt-4">Textos Globais do Modal</h5>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {[
                                      { key: 'pwa.install_app', label: 'Texto do Botão Flutuante (Login)' },
                                      { key: 'pwa.install_title', label: 'Título do Modal' },
                                      { key: 'pwa.mobile_header', label: 'Título Auxiliar (Versão Celular)' },
                                      { key: 'pwa.install_desc', label: 'Descrição Principal' },
                                      { key: 'pwa.install_button', label: 'Botão Instalar Agora' },
                                      { key: 'pwa.already_installed', label: 'Botão Já Instalei' }
                                    ].map(field => (
                                      <div key={field.key} className="space-y-2">
                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                        <input 
                                          type="text" 
                                          value={draftCustomTexts[field.key] !== undefined ? draftCustomTexts[field.key] : (settings.custom_texts?.[field.key] || languagePresets.pt[field.key] || '')}
                                          placeholder={field.label}
                                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                          className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none"
                                        />
                                      </div>
                                    ))}
                                    <div className="space-y-2">
                                      <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Tempo de Auto-Slide (Segundos)</label>
                                      <div className="flex items-center gap-4">
                                        <input 
                                          type="number" 
                                          min="1"
                                          max="60"
                                          value={draftCustomTexts['pwa.auto_slide_interval'] !== undefined ? draftCustomTexts['pwa.auto_slide_interval'] : (settings.custom_texts?.['pwa.auto_slide_interval'] || '3')}
                                          onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, 'pwa.auto_slide_interval': e.target.value })}
                                          className="w-full bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none placeholder:text-zinc-700"
                                        />
                                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest shrink-0">segundos</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-6">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview do Botão</label>
                                <div className="p-8 rounded-[2.5rem] bg-zinc-950 border border-white/5 flex flex-col items-center justify-center space-y-8 relative overflow-hidden shadow-2xl h-full">
                                  <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-center border-b border-white/5 bg-zinc-900/50 backdrop-blur-md">
                                    { (draftCustomTexts['pwa.enable_button'] !== 'false') && (
                                        <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase tracking-widest italic animate-pulse">
                                          <Smartphone size={12} />
                                          {draftCustomTexts['pwa.install_app'] || settings.custom_texts?.['pwa.install_app'] || languagePresets.pt['pwa.install_app']}
                                        </button>
                                    )}
                                  </div>
                                  <div className="text-center space-y-4 opacity-20 w-full">
                                     <div className="w-3/4 h-8 bg-white/10 rounded-xl mx-auto" />
                                     <div className="w-1/2 h-3 bg-white/5 rounded-full mx-auto" />
                                  </div>
                                </div>
                              </div>
                            </div>

                          <div className="space-y-12">
                                <div className="space-y-16">
                                 
                                 {[
                                   { 
                                     id: 'ios', 
                                    label: 'Apple iOS (Safari)', 
                                    icon: (
                                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.1 2.48-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.31-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.89 1.22-2.11 1.09-3.33-1.04.04-2.3.7-3.05 1.57-.67.77-1.26 2.02-1.11 3.21 1.15.09 2.33-.56 3.07-1.45z"/>
                                      </svg>
                                    ),
                                    titleKey: 'pwa.ios_label',
                                    stepsKey: 'pwa.steps.ios',
                                    imageKey: 'pwa.carousel.ios'
                                  },
                                  { 
                                    id: 'android', 
                                    label: 'Android (Chrome)', 
                                    icon: (
                                      <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 11c-2.4 0-4.6.4-6.3 1.2L4.4 10c-.1-.2-.4-.3-.6-.2-.2.1-.3.4-.2.6l1.3 2.3c-.1.1-.1.2-.1.3C2.4 14.5.5 17.3.5 20.5h23c0-3.2-1.9-6-4.4-7.5l1.3-2.3c.1-.2 0-.5-.2-.6-.2-.1-.5 0-.6.2l-1.3 2.2C16.6 11.4 14.4 11 12 11zm-5 7c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm10 0c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z" />
                                      </svg>
                                    ),
                                    titleKey: 'pwa.android_label',
                                    stepsKey: 'pwa.steps.android',
                                    imageKey: 'pwa.carousel.android'
                                  },
                                  { 
                                    id: 'desktop', 
                                    label: 'Desktop (Computador)', 
                                    icon: <Monitor size={16} />,
                                    titleKey: 'pwa.desktop_label',
                                    stepsKey: 'pwa.steps.desktop',
                                    imageKey: 'pwa.carousel.desktop'
                                  }
                                ].map(device => {
                                  const isSynced = (draftCustomTexts['pwa.sync_images'] !== 'false');
                                  const currentUrls = (draftCustomTexts[device.imageKey] || '').split(',').filter(Boolean);
                                  const updateUrls = (urls: string[]) => {
                                    const newUrlsStr = urls.join(',');
                                    if (isSynced) {
                                      setDraftCustomTexts({ 
                                        ...draftCustomTexts, 
                                        'pwa.carousel.ios': newUrlsStr,
                                        'pwa.carousel.android': newUrlsStr,
                                        'pwa.carousel.desktop': newUrlsStr
                                      });
                                    } else {
                                      setDraftCustomTexts({ ...draftCustomTexts, [device.imageKey]: newUrlsStr });
                                    }
                                  };

                                  const currentSteps = (() => {
                                    let raw = draftCustomTexts[device.stepsKey] !== undefined ? draftCustomTexts[device.stepsKey] : (settings.custom_texts?.[device.stepsKey] || languagePresets.pt[device.stepsKey] || '[]');
                                    
                                    const oldDefault = '["Toque no ícone de compartilhar", "Selecione \\"Adicionar à Tela de Início\\""]';
                                    if (device.id === 'ios' && (raw === oldDefault || raw === oldDefault.replace(/\\\\"/g, '"'))) {
                                      raw = languagePresets.pt[device.stepsKey];
                                    }

                                    try { return JSON.parse(raw); } catch { return []; }
                                  })();

                                  const updateSteps = (steps: string[]) => {
                                    setDraftCustomTexts({ ...draftCustomTexts, [device.stepsKey]: JSON.stringify(steps) });
                                  };

                                  const displayMode = draftCustomTexts['pwa.display_mode'] || 'mobile';

                                  return (
                                    <div key={device.id} className="space-y-8 p-8 bg-zinc-900 border border-white/5 rounded-3xl relative overflow-hidden group/device">
                                      <div className="flex items-center justify-between gap-6 flex-wrap">
                                        <div className="flex items-center gap-3">
                                          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                            {device.icon}
                                          </div>
                                          <div>
                                            <h6 className="font-bold text-white text-lg uppercase tracking-tight italic underline decoration-primary decoration-4 underline-offset-8 decoration-dotted leading-none">{device.label}</h6>
                                          </div>
                                        </div>

                                        {device.id === 'desktop' && (
                                          <div className="flex items-center gap-4">
                                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Modo de Exibição</span>
                                            <div className="flex bg-black p-1 rounded-xl border border-white/5 shadow-inner">
                                              <button
                                                onClick={() => setDraftCustomTexts({ ...draftCustomTexts, 'pwa.display_mode': 'mobile' })}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                  displayMode === 'mobile' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'
                                                }`}
                                              >
                                                Celular
                                              </button>
                                              <button
                                                onClick={() => setDraftCustomTexts({ ...draftCustomTexts, 'pwa.display_mode': 'desktop' })}
                                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                                  displayMode === 'desktop' ? 'bg-primary text-black shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white'
                                                }`}
                                              >
                                                Desktop
                                              </button>
                                            </div>
                                          </div>
                                        )}
                                      </div>

                                      {device.id === 'desktop' && displayMode === 'mobile' && (
                                        <div className="p-6 bg-primary/5 rounded-2xl border border-primary/10 animate-in fade-in slide-in-from-top-4 duration-500">
                                          <p className="text-xs text-primary/80 font-bold uppercase italic tracking-tighter leading-relaxed">
                                            Neste modo, usuários em computadores verão as instruções de instalação para iOS e Android simultaneamente, incentivando a instalação no celular. As configurações abaixo (Desktop) estão desativadas.
                                          </p>
                                        </div>
                                      )}

                                      {(device.id !== 'desktop' || displayMode === 'desktop') && (
                                        <div className="grid grid-cols-1 gap-12 animate-in fade-in slide-in-from-top-4 duration-500 pt-8 border-t border-white/5">
                                          <div className="space-y-12">
                                            {/* Header and Steps */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 bg-zinc-900/50 p-6 rounded-2xl border border-white/5">
                                              <div className="space-y-4">
                                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Cabeçalho do Modal</label>
                                                <input 
                                                  type="text" 
                                                  value={draftCustomTexts[device.titleKey] !== undefined ? draftCustomTexts[device.titleKey] : (settings.custom_texts?.[device.titleKey] || languagePresets.pt[device.titleKey] || '')}
                                                  onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [device.titleKey]: e.target.value })}
                                                  className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none focus:ring-1 focus:ring-primary/50"
                                                />
                                              </div>

                                              <div className="space-y-4">
                                                <div className="flex items-center justify-between">
                                                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Instruções de Instalação</label>
                                                  <button 
                                                    onClick={() => updateSteps([...currentSteps, ''])}
                                                    className="p-1 px-2.5 bg-primary/10 border border-primary/20 rounded-md text-[10px] font-black text-primary uppercase tracking-widest italic"
                                                  >
                                                    + ADD PASSO
                                                  </button>
                                                </div>
                                                <div className="space-y-3">
                                                  {currentSteps.map((step: string, index: number) => (
                                                    <div key={index} className="flex gap-2 group/step">
                                                      <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center text-xs font-black text-white shrink-0 border border-white/5 italic">
                                                        {index + 1}º
                                                      </div>
                                                      <input 
                                                        type="text" 
                                                        value={step}
                                                        onChange={(e) => {
                                                          const newSteps = [...currentSteps];
                                                          newSteps[index] = e.target.value;
                                                          updateSteps(newSteps);
                                                        }}
                                                        className="flex-1 bg-zinc-800 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none"
                                                      />
                                                      <button 
                                                        onClick={() => {
                                                          const newSteps = currentSteps.filter((_: any, i: number) => i !== index);
                                                          updateSteps(newSteps);
                                                        }}
                                                        className="p-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-xl transition-colors shrink-0"
                                                      >
                                                        <Trash2 size={16} />
                                                      </button>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            </div>

                                            {/* Carousel Images Section - Larger and stretched */}
                                            <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                                              <div className="flex items-center justify-between flex-wrap gap-6">
                                                <div className="space-y-2">
                                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest block">Imagens do Carrossel (9:16)</label>
                                                  <p className="text-[10px] text-gray-600 font-bold uppercase italic tracking-tighter">Use links diretos de imagens (.jpg, .png)</p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                  <button 
                                                    onClick={() => {
                                                      setPwaUrlInput('');
                                                      setShowAddPwaImageUrl({ 
                                                        deviceId: device.id, 
                                                        currentUrls: currentUrls,
                                                        updateFn: updateUrls
                                                      });
                                                    }}
                                                    className="h-12 px-8 bg-primary rounded-xl text-xs font-black text-white uppercase tracking-widest italic shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all flex items-center gap-3 shrink-0"
                                                  >
                                                    <Plus size={20} /> ADICIONAR IMAGEM
                                                  </button>
                                                </div>
                                              </div>
                                              
                                              <div className="flex gap-8 overflow-x-auto pb-8 scrollbar-thin scrollbar-thumb-white/10 snap-x snap-mandatory min-h-[720px] px-2">
                                                {currentUrls.map((url: string, index: number) => (
                                                  <div key={index} className="relative group shrink-0 w-96 h-[680px] bg-black rounded-[2.5rem] border border-white/10 overflow-hidden snap-center shadow-2xl transition-transform hover:scale-[1.02]">
                                                    <img src={url} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt="" />
                                                    <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-6 p-6">
                                                      <div className="flex gap-3">
                                                        <button 
                                                          onClick={() => {
                                                            if (index === 0) return;
                                                            const newUrls = [...currentUrls];
                                                            [newUrls[index-1], newUrls[index]] = [newUrls[index], newUrls[index-1]];
                                                            updateUrls(newUrls);
                                                          }}
                                                          className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white disabled:opacity-20 transition-all"
                                                          disabled={index === 0}
                                                        >
                                                          <ChevronLeft size={24} />
                                                        </button>
                                                        <button 
                                                          onClick={() => {
                                                            if (index === currentUrls.length - 1) return;
                                                            const newUrls = [...currentUrls];
                                                            [newUrls[index], newUrls[index+1]] = [newUrls[index+1], newUrls[index]];
                                                            updateUrls(newUrls);
                                                          }}
                                                          className="p-4 bg-white/5 hover:bg-white/10 rounded-2xl text-white disabled:opacity-20 transition-all"
                                                          disabled={index === currentUrls.length - 1}
                                                        >
                                                          <ChevronRight size={24} />
                                                        </button>
                                                      </div>
                                                      <button 
                                                        onClick={() => {
                                                          const newUrls = currentUrls.filter((_: any, i: number) => i !== index);
                                                          updateUrls(newUrls);
                                                        }}
                                                        className="w-full py-4 bg-red-500/80 hover:bg-red-500 rounded-2xl text-white shadow-lg shadow-red-500/20 font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3"
                                                      >
                                                        <Trash2 size={20} /> REMOVER
                                                      </button>
                                                    </div>
                                                    <div className="absolute top-4 left-4 bg-primary px-4 py-1.5 rounded-xl text-[11px] font-black text-black italic tracking-tighter uppercase shadow-lg shadow-primary/20">{index + 1}º</div>
                                                  </div>
                                                ))}
                                                {currentUrls.length === 0 && (
                                                  <div className="flex-1 min-h-[400px] rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center justify-center gap-6 opacity-30">
                                                    <div className="p-6 bg-white/5 rounded-full">
                                                      <Plus size={48} />
                                                    </div>
                                                    <span className="italic font-bold uppercase text-sm tracking-widest">Nenhuma captura adicionada</span>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                )}

                {activeTab === 'vendas' && (
                  <div className="space-y-8 pb-20">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-900/60 border border-white/10 p-6 rounded-3xl">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl">
                            <DollarSign size={24} />
                          </div>
                          <div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight">Gestão Oficial de Vendas</h3>
                            <p className="text-xs text-gray-400">Fonte oficial de todas as vendas e transações em tempo real via Webhook da Hotmart.</p>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={fetchSalesData}
                        disabled={loadingSales}
                        className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-600/20"
                      >
                        <RefreshCw size={16} className={loadingSales ? 'animate-spin' : ''} />
                        Atualizar Vendas
                      </button>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Metric 1 */}
                      <div className="bg-zinc-900/50 border border-emerald-500/20 rounded-2xl p-5 space-y-3 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Total Vendido</span>
                          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                            <TrendingUp size={18} />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-emerald-400">
                          R$ {(salesMetrics.totalRevenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-[10px] text-gray-500 font-semibold">Receita líquida total aprovada</p>
                      </div>

                      {/* Metric 2 */}
                      <div className="bg-zinc-900/50 border border-blue-500/20 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Qtd. de Vendas</span>
                          <div className="p-2 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
                            <ShoppingBag size={18} />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-blue-400">
                          {salesMetrics.totalCount || 0}
                        </div>
                        <p className="text-[10px] text-gray-500 font-semibold">Transações aprovadas registradas</p>
                      </div>

                      {/* Metric 3 */}
                      <div className="bg-zinc-900/50 border border-purple-500/20 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Ticket Médio</span>
                          <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                            <CreditCard size={18} />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-purple-400">
                          R$ {(salesMetrics.averageTicket || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <p className="text-[10px] text-gray-500 font-semibold">Média por compra aprovada</p>
                      </div>

                      {/* Metric 4 */}
                      <div className="bg-zinc-900/50 border border-red-500/20 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-gray-400">Estornos / Canc.</span>
                          <div className="p-2 bg-red-500/10 text-red-400 rounded-xl border border-red-500/20">
                            <XCircle size={18} />
                          </div>
                        </div>
                        <div className="text-2xl font-black text-red-400">
                          {(salesMetrics.refundCount || 0) + (salesMetrics.cancelCount || 0)}
                        </div>
                        <p className="text-[10px] text-gray-500 font-semibold">
                          {salesMetrics.refundCount || 0} reembolsadas / {salesMetrics.cancelCount || 0} canceladas
                        </p>
                      </div>
                    </div>

                    {/* Filter Bar */}
                    <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-wider">
                          <Filter size={16} className="text-amber-500" />
                          <span>Filtros Avançados de Vendas</span>
                        </div>

                        {/* Date Presets */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[
                            { id: 'all', label: 'Todo o Período' },
                            { id: 'today', label: 'Hoje' },
                            { id: '7days', label: 'Últimos 7 Dias' },
                            { id: '30days', label: 'Últimos 30 Dias' },
                            { id: 'month', label: 'Este Mês' },
                          ].map(p => (
                            <button
                              key={p.id}
                              onClick={() => applySalesDatePreset(p.id)}
                              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${
                                salesDatePreset === p.id
                                  ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-black'
                                  : 'bg-zinc-800 text-gray-400 hover:text-white border border-white/5'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {/* Start Date */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <Calendar size={12} /> Data Início
                          </label>
                          <input
                            type="date"
                            value={salesStartDate ? salesStartDate.split('T')[0] : ''}
                            onChange={(e) => {
                              setSalesDatePreset('custom');
                              setSalesStartDate(e.target.value ? new Date(e.target.value).toISOString() : '');
                            }}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                          />
                        </div>

                        {/* End Date */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <Calendar size={12} /> Data Fim
                          </label>
                          <input
                            type="date"
                            value={salesEndDate ? salesEndDate.split('T')[0] : ''}
                            onChange={(e) => {
                              setSalesDatePreset('custom');
                              setSalesEndDate(e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : '');
                            }}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                          />
                        </div>

                        {/* Product Filter */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                            <Tag size={12} /> Produto
                          </label>
                          <select
                            value={salesProductId}
                            onChange={(e) => setSalesProductId(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                          >
                            <option value="all">Todos os Produtos</option>
                            {mappedProducts.map(p => (
                              <option key={p.id} value={p.hotmart_product_id}>
                                {p.name} ({p.hotmart_product_id})
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Product Type */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo de Produto</label>
                          <select
                            value={salesProductType}
                            onChange={(e) => setSalesProductType(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                          >
                            <option value="all">Todos os Tipos</option>
                            <option value="main_product">Produto Principal</option>
                            <option value="ai_subscription">Assinatura IA</option>
                            <option value="course">Curso Individual</option>
                            <option value="package">Pacote de Cursos</option>
                          </select>
                        </div>

                        {/* Status */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</label>
                          <select
                            value={salesStatus}
                            onChange={(e) => setSalesStatus(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                          >
                            <option value="all">Todos os Status</option>
                            <option value="approved">Aprovada</option>
                            <option value="refunded">Reembolsada</option>
                            <option value="canceled">Cancelada</option>
                            <option value="chargeback">Chargeback</option>
                          </select>
                        </div>

                        {/* Payment Type */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pagamento</label>
                          <select
                            value={salesPaymentType}
                            onChange={(e) => setSalesPaymentType(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:border-amber-500 outline-none"
                          >
                            <option value="all">Todos os Métodos</option>
                            <option value="PIX">PIX</option>
                            <option value="CREDIT_CARD">Cartão de Crédito</option>
                            <option value="BANK_SLIP">Boleto Bancário</option>
                          </select>
                        </div>
                      </div>

                      {/* Search Bar & Clear Button */}
                      <div className="flex flex-col sm:flex-row gap-3 pt-2">
                        <div className="flex-1 relative">
                          <Search size={16} className="absolute left-3 top-3 text-gray-500" />
                          <input
                            type="text"
                            value={salesSearch}
                            onChange={(e) => setSalesSearch(e.target.value)}
                            placeholder="Buscar por nome do aluno, e-mail ou código HP..."
                            className="w-full bg-black border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:border-amber-500 outline-none"
                          />
                        </div>

                        {(salesStartDate || salesEndDate || salesProductId !== 'all' || salesProductType !== 'all' || salesStatus !== 'all' || salesPaymentType !== 'all' || salesSearch || salesDatePreset !== 'all') && (
                          <button
                            onClick={() => {
                              setSalesStartDate('');
                              setSalesEndDate('');
                              setSalesProductId('all');
                              setSalesProductType('all');
                              setSalesStatus('all');
                              setSalesPaymentType('all');
                              setSalesSearch('');
                              setSalesDatePreset('all');
                            }}
                            className="bg-zinc-800 hover:bg-zinc-700 text-gray-300 border border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
                          >
                            Limpar Filtros
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Analytics Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Top Products */}
                      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                          <BarChart3 size={18} className="text-emerald-400" />
                          <h4 className="font-bold text-white text-sm uppercase tracking-wider">Produtos Mais Vendidos (Faturamento)</h4>
                        </div>

                        {salesMetrics.topProducts && salesMetrics.topProducts.length > 0 ? (
                          <div className="space-y-3">
                            {salesMetrics.topProducts.map((p: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between bg-black/40 p-3 rounded-xl border border-white/5">
                                <div className="flex items-center gap-3">
                                  <span className={`w-6 h-6 flex items-center justify-center rounded-lg font-black text-xs ${
                                    idx === 0 ? 'bg-amber-500 text-black' : idx === 1 ? 'bg-gray-300 text-black' : idx === 2 ? 'bg-amber-700 text-white' : 'bg-zinc-800 text-gray-400'
                                  }`}>
                                    #{idx + 1}
                                  </span>
                                  <div>
                                    <span className="text-xs font-bold text-white block">{p.name}</span>
                                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{p.count} venda(s) realizada(s)</span>
                                  </div>
                                </div>
                                <span className="text-sm font-black text-emerald-400">
                                  R$ {p.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 py-4 text-center">Nenhum dado de vendas aprovadas no período.</p>
                        )}
                      </div>

                      {/* Payment Method Distribution */}
                      <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-6 space-y-4">
                        <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                          <CreditCard size={18} className="text-purple-400" />
                          <h4 className="font-bold text-white text-sm uppercase tracking-wider">Métodos de Pagamento Utilizados</h4>
                        </div>

                        {salesMetrics.paymentTypeDistribution && Object.keys(salesMetrics.paymentTypeDistribution).length > 0 ? (
                          <div className="space-y-4">
                            {Object.entries(salesMetrics.paymentTypeDistribution).map(([method, data]: [string, any]) => {
                              const pct = salesMetrics.totalCount ? Math.round((data.count / salesMetrics.totalCount) * 100) : 0;
                              return (
                                <div key={method} className="space-y-1.5">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-white uppercase">{method === 'CREDIT_CARD' ? 'Cartão de Crédito' : method === 'BANK_SLIP' ? 'Boleto Bancário' : method}</span>
                                    <span className="text-gray-400 font-mono">{data.count} vendas ({pct}%) - R$ {data.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                                  </div>
                                  <div className="w-full bg-black rounded-full h-2 overflow-hidden border border-white/5">
                                    <div
                                      className="bg-purple-500 h-full rounded-full transition-all duration-500"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 py-4 text-center">Nenhum método registrado no período.</p>
                        )}
                      </div>
                    </div>

                    {/* Sales Table */}
                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 overflow-hidden space-y-2">
                      <div className="p-4 border-b border-white/10 flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                          Listagem de Transações ({salesList.length})
                        </span>
                        {loadingSales && <Loader2 className="animate-spin text-emerald-400" size={16} />}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[900px]">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                              <th className="px-5 py-3.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Data / Hora</th>
                              <th className="px-5 py-3.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Transação (HP)</th>
                              <th className="px-5 py-3.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Aluno / Comprador</th>
                              <th className="px-5 py-3.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Produto</th>
                              <th className="px-5 py-3.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Método</th>
                              <th className="px-5 py-3.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Valor</th>
                              <th className="px-5 py-3.5 text-[11px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                              <th className="px-5 py-3.5 text-[11px] font-black text-gray-400 uppercase tracking-widest text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {salesList.length === 0 ? (
                              <tr>
                                <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                  Nenhuma venda encontrada com os filtros selecionados.
                                </td>
                              </tr>
                            ) : (
                              salesList.map((sale) => {
                                const isAppr = sale.status === 'approved';
                                const isRef = sale.status === 'refunded';
                                const isCanc = sale.status === 'canceled';

                                return (
                                  <tr key={sale.id || sale.transaction_id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-5 py-4 whitespace-nowrap text-xs text-gray-300 font-medium">
                                      {new Date(sale.purchase_date || sale.created_at).toLocaleDateString('pt-BR', {
                                        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                      })}
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                      <span className="font-mono text-[11px] bg-black/60 px-2.5 py-1 rounded-lg border border-white/10 text-amber-300 font-bold">
                                        {sale.transaction_id || 'N/A'}
                                      </span>
                                    </td>
                                    <td className="px-5 py-4">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white">{sale.buyer_name || 'Aluno'}</span>
                                        <span className="text-[10px] text-gray-400 font-mono">{sale.buyer_email}</span>
                                      </div>
                                    </td>
                                    <td className="px-5 py-4">
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-gray-200">{sale.product_name}</span>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                          <span className="text-[10px] bg-zinc-800 text-gray-400 px-2 py-0.5 rounded border border-white/5 font-semibold">
                                            ID: {sale.product_id}
                                          </span>
                                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${
                                            sale.product_type === 'main_product' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                            sale.product_type === 'ai_subscription' ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' :
                                            'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                          }`}>
                                            {sale.product_type === 'main_product' ? 'Principal' : sale.product_type === 'ai_subscription' ? 'IA VIP' : 'Curso'}
                                          </span>
                                        </div>
                                      </div>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                      <span className="text-[11px] font-bold text-gray-300 uppercase bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
                                        {sale.payment_type === 'CREDIT_CARD' ? 'Cartão' : sale.payment_type === 'BANK_SLIP' ? 'Boleto' : sale.payment_type || 'PIX'}
                                      </span>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                      <span className={`text-sm font-black ${isAppr ? 'text-emerald-400' : 'text-gray-500 line-through'}`}>
                                        R$ {Number(sale.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                      </span>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap">
                                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${
                                        isAppr ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                                        isRef ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                        isCanc ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                                        'bg-amber-500/20 text-amber-400 border-amber-500/30'
                                      }`}>
                                        {isAppr ? 'Aprovada' : isRef ? 'Reembolsada' : isCanc ? 'Cancelada' : sale.status}
                                      </span>
                                    </td>
                                    <td className="px-5 py-4 whitespace-nowrap text-center">
                                      <button
                                        onClick={() => setSelectedSaleDetail(sale)}
                                        className="p-2 bg-zinc-800 hover:bg-zinc-700 text-gray-300 hover:text-white rounded-xl border border-white/10 transition-all"
                                        title="Ver Payload e Detalhes do Webhook"
                                      >
                                        <Eye size={16} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Payload Audit Modal */}
                    {selectedSaleDetail && (
                      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
                        <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
                          <div className="p-6 border-b border-white/10 flex items-center justify-between bg-black/40">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                                <DollarSign size={20} />
                              </div>
                              <div>
                                <h4 className="font-bold text-white text-base">Detalhes da Venda & Webhook Payload</h4>
                                <p className="text-xs text-gray-400 font-mono">Transação: {selectedSaleDetail.transaction_id}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => setSelectedSaleDetail(null)}
                              className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-white/10"
                            >
                              <X size={20} />
                            </button>
                          </div>

                          <div className="p-6 overflow-y-auto space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                              <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                                <span className="text-gray-500 text-[10px] block font-bold uppercase">Aluno</span>
                                <span className="text-white font-bold block">{selectedSaleDetail.buyer_name}</span>
                                <span className="text-gray-400 text-[11px] font-mono">{selectedSaleDetail.buyer_email}</span>
                              </div>
                              <div className="bg-black/50 p-3 rounded-xl border border-white/5">
                                <span className="text-gray-500 text-[10px] block font-bold uppercase">Produto</span>
                                <span className="text-white font-bold block">{selectedSaleDetail.product_name}</span>
                                <span className="text-amber-400 text-[11px] font-mono">ID Hotmart: {selectedSaleDetail.product_id}</span>
                              </div>
                              <div className="bg-black/50 p-3 rounded-xl border border-white/5 col-span-2 sm:col-span-1">
                                <span className="text-gray-500 text-[10px] block font-bold uppercase">Valor & Status</span>
                                <span className="text-emerald-400 font-black text-sm block">R$ {Number(selectedSaleDetail.amount || 0).toFixed(2)}</span>
                                <span className="text-gray-400 text-[10px] uppercase font-bold">{selectedSaleDetail.status} ({selectedSaleDetail.payment_type})</span>
                              </div>
                            </div>

                            {/* Raw Payload JSON */}
                            <div className="space-y-2">
                              <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                                Payload Original do Webhook Hotmart (JSON Audit)
                              </span>
                              <pre className="bg-black p-4 rounded-2xl border border-white/10 font-mono text-[11px] text-amber-200/90 overflow-x-auto max-h-72">
                                {JSON.stringify(selectedSaleDetail.raw_payload || selectedSaleDetail, null, 2)}
                              </pre>
                            </div>
                          </div>

                          <div className="p-4 border-t border-white/10 bg-black/40 flex justify-end">
                            <button
                              onClick={() => setSelectedSaleDetail(null)}
                              className="bg-zinc-800 hover:bg-zinc-700 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
                            >
                              Fechar
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'security' && (
                    <div className="max-w-2xl space-y-8 pb-20">
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Segurança</h3>
                      <p className="text-sm text-gray-500">Gerencie suas configurações de segurança.</p>
                    </div>

                    {/* Default Login Method */}
                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                          <LockIcon size={20} />
                        </div>
                        <h4 className="font-bold text-white tracking-tight">Método de Login Padrão</h4>
                      </div>

                      <div className="space-y-4">
                        <p className="text-xs text-gray-500 font-medium">Defina se o acesso padrão será com ou sem senha.</p>
                        <div className="flex p-1 bg-black rounded-xl border border-white/10">
                          <button 
                            onClick={() => setLocalSettings({ ...localSettings, auth_method: 'passwordless' })}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${localSettings?.auth_method === 'passwordless' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
                          >
                            SEM SENHA
                          </button>
                          <button 
                            onClick={() => setLocalSettings({ ...localSettings, auth_method: 'password' })}
                            className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all ${localSettings?.auth_method === 'password' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white'}`}
                          >
                            COM SENHA
                          </button>
                        </div>
                        
                        <button
                          onClick={saveAuthSettings}
                          className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 border border-white/5 mt-2"
                        >
                          <Save size={16} />
                          SALVAR MÉTODO DE LOGIN
                        </button>
                      </div>
                    </div>

                    {/* Change My Password (Current Admin) */}
                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-purple-600/20 rounded-lg text-purple-500">
                          <UserIcon size={20} />
                        </div>
                        <h4 className="font-bold text-white tracking-tight">Alterar Minha Senha</h4>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nova Senha Pessoal</label>
                          <div className="relative">
                            <input 
                              type="password" 
                              value={newAdminPassword}
                              onChange={e => setNewAdminPassword(e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none pr-10"
                              placeholder="Digite a nova senha..."
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600">
                              <LockIcon size={14} />
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Confirmar Nova Senha</label>
                          <div className="relative">
                            <input 
                              type="password" 
                              value={confirmAdminPassword}
                              onChange={e => setConfirmAdminPassword(e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none pr-10"
                              placeholder="Confirme a nova senha..."
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600">
                              <CheckCircle2 size={14} />
                            </div>
                          </div>
                        </div>
                      </div>

                      <button 
                        onClick={async () => {
                          if (newAdminPassword.length < 6) {
                            toast.error('A senha deve ter pelo menos 6 caracteres');
                            return;
                          }
                          if (newAdminPassword !== confirmAdminPassword) {
                            toast.error('As senhas não coincidem');
                            return;
                          }
                          
                          setUpdatingPassword(true);
                          try {
                            const { error } = await supabase.auth.updateUser({ password: newAdminPassword });
                            if (error) throw error;
                            
                            toast.success('Sua senha foi atualizada com sucesso!');
                            setNewAdminPassword('');
                            setConfirmAdminPassword('');
                          } catch (error: any) {
                            console.error('Password update error:', error);
                            toast.error('Erro ao atualizar senha: ' + (error.message || 'Erro desconhecido'));
                          } finally {
                            setUpdatingPassword(false);
                          }
                        }}
                        disabled={updatingPassword}
                        className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-95 border border-white/5"
                      >
                        {updatingPassword ? <Loader2 className="animate-spin" size={20} /> : (
                          <>
                            <Save size={20} /> ATUALIZAR MINHA SENHA
                          </>
                        )}
                      </button>
                    </div>

                    {/* Master Admin Settings */}
                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-600/20 rounded-lg text-amber-500">
                          <Shield size={20} />
                        </div>
                        <h4 className="font-bold text-white tracking-tight">E-mail e Senha Master</h4>
                      </div>

                      <div className="space-y-6">
                        {/* Master Email */}
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">E-mail Super Admin (Mestre)</label>
                          <div className="relative group">
                            <input 
                              type="email" 
                              value={localSettings?.admin_email || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, admin_email: e.target.value })}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none pr-10"
                              placeholder="admin@seudominio.com"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                              <Mail size={14} />
                            </div>
                          </div>
                        </div>

                        {/* Master Password */}
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Senha Super Admin (Mestre)</label>
                          <div className="relative group">
                            <input 
                              type="password" 
                              value={adminPassword}
                              onChange={(e) => setAdminPassword(e.target.value)}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none pr-10"
                              placeholder="Digite para alterar a senha master"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">
                              <LockIcon size={14} />
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={saveAuthSettings}
                          className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                        >
                          <Save size={16} />
                          SALVAR ACESSO MESTRE
                        </button>
                      </div>
                    </div>
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* Course Editor Modal */}
      {showCourseEditor && (
        <CourseEditor 
          courseId={editingCourseId || undefined} 
          packages={coursePackages}
          onClose={() => {
            setShowCourseEditor(false);
            setEditingCourseId(null);
            fetchCourses(false);
            fetchData();
          }} 
        />
      )}

      {/* Main Product Global Selling Options Modal */}
      {showMainProductModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-[#16161a] border border-white/10 rounded-[32px] p-8 shadow-2xl space-y-6">
            <div className="space-y-2 text-center">
              <h3 className="text-sm font-black text-white uppercase tracking-widest">Configuração do Produto Principal</h3>
              <p className="text-[9px] text-gray-500 uppercase font-bold tracking-wider leading-relaxed">
                Configure os dados de venda para os produtos principais. Esta configuração é única para todos os cursos marcados como "Produto Principal".
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Preço do Produto Principal (R$)</label>
                <input
                  type="text"
                  value={(() => {
                    const numericValue = parseInt(mainPriceInput.replace(/\D/g, '')) || 0;
                    return (numericValue / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                  })()}
                  onChange={e => {
                    const rawDigits = e.target.value.replace(/\D/g, '');
                    setMainPriceInput(rawDigits);
                  }}
                  placeholder="Ex: 197,00"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white focus:border-emerald-500 outline-none font-bold text-center transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">ID do Produto Hotmart (Webhook)</label>
                <input
                  type="text"
                  value={mainProductIdInput}
                  onChange={e => setMainProductIdInput(e.target.value)}
                  placeholder="Ex: 2381203"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white focus:border-emerald-500 outline-none font-mono text-center transition-all"
                />
                <p className="text-[8px] text-gray-600 uppercase font-black ml-1">
                  ID usado no webhook da Hotmart para liberar todos os produtos principais para a aluna.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Link de Check-out (Hotmart)</label>
                <input
                  type="text"
                  value={mainCheckoutUrlInput}
                  onChange={e => setMainCheckoutUrlInput(e.target.value)}
                  placeholder="https://pay.hotmart.com/..."
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-[10px] text-gray-300 focus:border-emerald-500 outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowMainProductModal(false)}
                className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={savingMainProduct}
                onClick={handleSaveMainProduct}
                className="flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-all cursor-pointer"
              >
                {savingMainProduct ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPackageEditor && (
        <PackageEditor
          packageId={editingPackageId}
          courses={courses}
          onClose={() => {
            setShowPackageEditor(false);
            setEditingPackageId(null);
            fetchData();
          }}
          onSave={() => {
            setShowPackageEditor(false);
            setEditingPackageId(null);
            fetchData();
          }}
        />
      )}

      {/* Course Viewer Modal (Professor Mode) */}
      {viewingCourseId && (
        <CourseViewer 
          courseId={viewingCourseId}
          userId={user.id}
          isProfessor={true}
          onClose={() => setViewingCourseId(null)}
        />
      )}

      {/* Text Editor Modal */}
      {editingTextKey && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-white">Personalizar Texto</h3>
              <button onClick={() => setEditingTextKey(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSaveText} className="p-6 space-y-4">
              <div className="space-y-2 opacity-50">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Chave (Key)</label>
                <input 
                  type="text" 
                  value={editingTextKey}
                  readOnly
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white outline-none cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Valor (Texto)</label>
                <textarea 
                  value={editingTextValue}
                  onChange={e => setEditingTextValue(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none min-h-[120px]"
                  placeholder="Digite o texto personalizado..."
                  required
                />
                <p className="text-[10px] text-gray-500">Dica: Use variáveis como {'{nome_aluno}'} para textos dinâmicos.</p>
              </div>
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20"
              >
                Salvar Texto
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* User Creator Modal */}
      {showUserCreator && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold text-white">Cadastrar Novo Usuário</h3>
              <button onClick={() => setShowUserCreator(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nome Completo</label>
                <input 
                  type="text" 
                  value={newUserName}
                  onChange={e => setNewUserName(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                  placeholder="Nome do aluno"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">E-mail</label>
                <input 
                  type="email" 
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                  placeholder="email@exemplo.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Telefone</label>
                <div className="flex gap-2">
                  <div className="w-20 space-y-1">
                    <div className="relative">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 text-xs font-bold">+</span>
                      <input 
                        type="text" 
                        value={newUserCountryCode}
                        onChange={e => setNewUserCountryCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="w-full bg-black border border-white/10 rounded-xl pl-5 pr-2 py-3 text-white focus:border-blue-500 outline-none text-center text-sm font-bold"
                        placeholder="00"
                      />
                    </div>
                    <p className="text-[8px] text-gray-600 font-black uppercase text-center">Cód. País</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <input 
                      type="text" 
                      value={newUserPhone}
                      onChange={e => setNewUserPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none text-sm font-bold"
                      placeholder="Telefone com código de área"
                    />
                    <p className="text-[8px] text-gray-600 font-black uppercase font-bold">Telefone com código de área</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Senha Inicial</label>
                <input 
                  type="password" 
                  value={newUserPassword}
                  onChange={e => setNewUserPassword(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={creatingUser}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
              >
                {creatingUser ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                Cadastrar Usuário
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {createPortal(
        <AnimatePresence>
          {confirmationModal.isOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
              onClick={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md bg-zinc-900 border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden"
              >
                {/* Background decorative elements */}
                <div className={`absolute top-0 left-0 w-full h-1.5 ${confirmationModal.type === 'danger' ? 'bg-red-500' : 'bg-blue-500'}`} />
                <div className={`absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] ${confirmationModal.type === 'danger' ? 'bg-red-500/10' : 'bg-blue-500/10'}`} />
                
                <div className="relative z-10 space-y-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${confirmationModal.type === 'danger' ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-500'}`}>
                    {confirmationModal.type === 'danger' ? <Trash2 size={28} /> : <AlertCircle size={28} />}
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{confirmationModal.title}</h3>
                    <p className="text-sm text-gray-400 font-medium leading-relaxed">{confirmationModal.message}</p>
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button
                      onClick={() => setConfirmationModal(prev => ({ ...prev, isOpen: false }))}
                      className="flex-1 py-4 px-6 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl transition-all border border-white/5 active:scale-95 text-xs uppercase tracking-wider"
                    >
                      {confirmationModal.cancelText || 'Cancelar'}
                    </button>
                    <button
                      onClick={() => {
                        confirmationModal.onConfirm();
                        setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                      }}
                      className={`flex-1 py-4 px-6 text-white font-black rounded-2xl transition-all shadow-xl uppercase tracking-tighter active:scale-95 text-xs ${
                        confirmationModal.type === 'danger' 
                          ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                          : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                      }`}
                    >
                      {confirmationModal.confirmText || 'Confirmar'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Custom PWA URL Modal */}
      <AnimatePresence>
        {showAddPwaImageUrl && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddPwaImageUrl(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-zinc-900 border border-white/10 rounded-[32px] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent" />
              
              <div className="p-8 pb-4">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase italic tracking-tighter">Adicionar Captura</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Insira o link da imagem para o carrossel</p>
                  </div>
                  <button 
                    onClick={() => setShowAddPwaImageUrl(null)}
                    className="p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-[9px] font-black text-primary uppercase tracking-[0.2em] ml-1">Link Direto da Imagem</label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-500 group-focus-within:text-primary transition-colors">
                        <ImageIcon size={18} />
                      </div>
                      <input 
                        autoFocus
                        type="text"
                        placeholder="https://exemplo.com/imagem.jpg"
                        value={pwaUrlInput}
                        onChange={(e) => setPwaUrlInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && pwaUrlInput.trim()) {
                            const val = pwaUrlInput.trim();
                            showAddPwaImageUrl.updateFn([...showAddPwaImageUrl.currentUrls, val]);
                            setPwaUrlInput('');
                            setShowAddPwaImageUrl(null);
                          }
                        }}
                        className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:border-primary outline-none transition-all placeholder:text-gray-700 shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={() => setShowAddPwaImageUrl(null)}
                      className="flex-1 px-6 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      disabled={!pwaUrlInput.trim()}
                      onClick={() => {
                        const val = pwaUrlInput.trim();
                        showAddPwaImageUrl.updateFn([...showAddPwaImageUrl.currentUrls, val]);
                        setPwaUrlInput('');
                        setShowAddPwaImageUrl(null);
                      }}
                      className="flex-1 px-6 py-4 bg-primary text-black rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-20 disabled:grayscale disabled:scale-100"
                    >
                      Adicionar Captura
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Mapping Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-zinc-900 border border-white/10 rounded-3xl max-w-xl w-full p-8 space-y-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Store className="text-amber-400" size={24} />
                <h3 className="text-xl font-black text-white uppercase tracking-tight">
                  {editingProduct ? 'Editar Produto Hotmart' : 'Mapear Novo Produto Hotmart'}
                </h3>
              </div>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-2 text-gray-500 hover:text-white rounded-xl bg-white/5 hover:bg-white/10 transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">ID do Produto Hotmart</label>
                <input
                  type="text"
                  value={productForm.hotmart_product_id}
                  onChange={(e) => setProductForm({ ...productForm, hotmart_product_id: e.target.value })}
                  placeholder="Ex: 3892019 (Deixe em branco se for cadastrar depois)"
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none font-mono"
                />
                <p className="text-[10px] text-gray-500">ID numérico da Hotmart. Se deixado em branco, o produto será marcado com o aviso &quot;Cadastrar ID Hotmart (Pendente)&quot;.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Nome Comercial do Produto *</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                  placeholder="Ex: Acesso Geral Plataforma ou Curso Completo"
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Tipo do Produto *</label>
                  <select
                    value={productForm.product_type}
                    onChange={(e) => setProductForm({ ...productForm, product_type: e.target.value as any, internal_target_id: '' })}
                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                  >
                    <option value="main_product">PRODUTO PRINCIPAL (Acesso Geral à Plataforma)</option>
                    <option value="course">CURSO INDIVIDUAL PAGO</option>
                    <option value="package">PACOTE DE CURSOS / OFERTA ESPECIAL</option>
                    <option value="ai_subscription">ASSINATURA IA (Uso Ilimitado)</option>
                  </select>
                </div>

                {(productForm.product_type === 'course' || productForm.product_type === 'package') && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">
                      {productForm.product_type === 'course' ? 'Curso Correspondente *' : 'Pacote de Cursos *'}
                    </label>
                    <select
                      value={productForm.internal_target_id}
                      onChange={(e) => setProductForm({ ...productForm, internal_target_id: e.target.value })}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                    >
                      <option value="">Selecione um curso...</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Link de Checkout da Hotmart (Opcional)</label>
                <input
                  type="text"
                  value={productForm.checkout_url}
                  onChange={(e) => setProductForm({ ...productForm, checkout_url: e.target.value })}
                  placeholder="https://pay.hotmart.com/..."
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-300 uppercase tracking-wider">Descrição / Observações Internas</label>
                <input
                  type="text"
                  value={productForm.description}
                  onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                  placeholder="Ex: Oferta de Black Friday"
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-amber-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="prod_is_active"
                  checked={productForm.is_active}
                  onChange={(e) => setProductForm({ ...productForm, is_active: e.target.checked })}
                  className="w-4 h-4 rounded bg-black border-white/20 text-amber-500 focus:ring-amber-500"
                />
                <label htmlFor="prod_is_active" className="text-xs text-gray-300 font-medium cursor-pointer">
                  Mapeamento Ativo (processar eventos deste produto via Webhook)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowProductModal(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-gray-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={savingProduct}
                onClick={handleSaveProduct}
                className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-black bg-amber-400 hover:bg-amber-300 disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg shadow-amber-400/20"
              >
                {savingProduct ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                {editingProduct ? 'Salvar Alterações' : 'Cadastrar Produto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
