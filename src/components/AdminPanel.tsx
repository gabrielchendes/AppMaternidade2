import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Product, CommunityPost } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
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
  Settings,
  Globe,
  Languages,
  Layout,
  Edit3,
  Eye,
  ShieldAlert,
  ChevronRight,
  ChevronLeft,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Star,
  Lock as LockIcon,
  ShoppingBag,
  Palette,
  Menu,
  ArrowUp,
  Image as ImageIcon,
  Check,
  Video,
  PlusCircle,
  BarChart3,
  Send,
  Zap,
  Shield,
  Smartphone,
  Monitor,
  ImageOff,
  Home,
  User as UserIcon,
  Play,
  ArrowDown,
  ArrowRight,
  ExternalLink,
  Type,
  LogOut
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import { safeParse, safeFetch } from '../lib/utils';
import CourseEditor from './CourseEditor';
import CourseViewer from './CourseViewer';
import Community from './Community';
import PackageEditor from './PackageEditor';

const RotatingBannerPreview = ({ images, interval = 5000 }: { images: string[], interval?: number }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!images || images.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length);
    }, interval);
    return () => clearInterval(timer);
  }, [images, interval]);

  if (!images || images.length === 0) {
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
          src={images[currentIndex]}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.5 }}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </AnimatePresence>
      <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
        {images.map((_, i) => (
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

export default function AdminPanel({ user }: AdminPanelProps) {
  const { settings, refreshSettings } = useSettings();
  const { t } = useI18n();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'courses' | 'community' | 'notifications' | 'texts' | 'settings' | 'security' | 'pages' | 'vendas' | 'packages' | 'languages'>('packages');
  const [activePageTab, setActivePageTab] = useState<'home' | 'community' | 'profile' | 'login' | 'nav' | 'course' | 'push' | 'pwa'>('home');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [coursePackages, setCoursePackages] = useState<any[]>([]);
  const [allPurchases, setAllPurchases] = useState<any[]>([]);
  const [courseStats, setCourseStats] = useState<Record<string, { lessons: number, materials: number }>>({});
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
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [selectedBroadcast, setSelectedBroadcast] = useState<any | null>(null);
  const [viewingBroadcastDetails, setViewingBroadcastDetails] = useState<any[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [bannerPreviewMode, setBannerPreviewMode] = useState<'desktop' | 'mobile'>('mobile');
  const [editingBannerIndex, setEditingBannerIndex] = useState<number>(0);
  const [firebaseStatus, setFirebaseStatus] = useState<{ initialized: boolean, hasServiceAccount: boolean } | null>(null);

  const isAdminAuthorized = user.email?.toLowerCase() === (settings?.admin_email || 'gabrielchendes@gmail.com').toLowerCase();

  useEffect(() => {
    if (!isAdminAuthorized) {
      toast.error('Aviso: Seu e-mail não coincide com o e-mail administrativo configurado. Algumas funções podem não carregar dados.', {
        duration: 10000
      });
    }
  }, [isAdminAuthorized]);

  useEffect(() => {
    if (activeTab === 'notifications') {
      checkFirebaseStatus();
      fetchNotificationHistory();
    }
  }, [activeTab]);

  const fetchNotificationHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await safeFetch('/api/v1/notification-history', {
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
    setLoadingDetails(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const data = await safeFetch(`/api/v1/notification-details/${broadcast.id}`, {
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (Array.isArray(data)) {
        setViewingBroadcastDetails(data);
      }
    } catch (e) {
      console.error('Error fetching details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const checkFirebaseStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const status = await safeFetch('/api/v1/info', {
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

  // User management states
  const [showUserCreator, setShowUserCreator] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
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

   const CourseAdminCard = ({ course, courseStats, setViewingCourseId, setEditingCourseId, setShowCourseEditor, onDelete }: any) => (
    <div className="bg-zinc-900 border border-white/5 rounded-xl overflow-hidden group hover:border-blue-500/50 transition-all flex flex-col w-36 sm:w-44 shrink-0 shadow-2xl">
      <div className="relative aspect-[2/3] overflow-hidden shrink-0">
        {course.cover_url ? (
          <img 
            src={course.cover_url} 
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
          <p className="text-[8px] font-black text-blue-500 uppercase tracking-tighter drop-shadow-md">
            {course.is_bonus ? 'BÔNUS 🎁' : course.is_free ? 'PRODUTO PRINCIPAL 💎' : 'PREMIUM'}
          </p>
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
            onClick={() => onDelete(course.id)}
            className="p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-lg backdrop-blur-md transition-all shadow-lg"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings);
    }
    if (settings?.custom_texts && Object.keys(draftCustomTexts).length === 0) {
      setDraftCustomTexts(settings.custom_texts);
    }
  }, [settings]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users' || activeTab === 'courses' || activeTab === 'vendas' || activeTab === 'packages') {
        const fetchCourses = async () => {
          console.log('🔎 Query Supabase: courses');
          const { data: coursesData, error: coursesError } = await supabase
            .from('courses')
            .select('*')
            .order('created_at', { ascending: false });
          
          if (coursesError) throw coursesError;

          setCourses(coursesData || []);

          // Fetch stats
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
        };

        const fetchPackages = async () => {
          console.log('🔎 Query Supabase: course_packages');
          const { data: packagesData, error: packagesError } = await supabase
            .from('course_packages')
            .select('*, package_courses(course_id)')
            .order('created_at', { ascending: false });
          
          if (packagesError) throw packagesError;
          setCoursePackages(packagesData || []);
        };

        await Promise.all([fetchCourses(), fetchPackages()]);

        if (activeTab === 'users') {
          const { data: { session } } = await supabase.auth.getSession();
          console.log('🔎 Chamando API Admin Users');
          const data = await safeFetch('/api/v1/users-list', {
            headers: { 'Authorization': `Bearer ${session?.access_token}` }
          });
          
          if (data && data.error) {
            console.error('API returned error for users:', data.error);
            toast.error('Erro ao carregar usuários: ' + data.error);
            setAllUsers([]);
          } else {
            setAllUsers(Array.isArray(data) ? data : []);
          }
        }

        if (activeTab === 'vendas') {
          const { data: { session } } = await supabase.auth.getSession();
          console.log('🔎 Chamando API Admin Purchases');
          const data = await safeFetch('/api/v1/purchases-list', {
            headers: { 'Authorization': `Bearer ${session?.access_token}` }
          });
          
          if (data && data.error) {
            console.error('API returned error for purchases:', data.error);
            toast.error('Erro ao carregar vendas: ' + data.error);
            setAllPurchases([]);
          } else {
            setAllPurchases(Array.isArray(data) ? data : []);
          }
        }
      }
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<any>) => {
    try {
      console.log('🔎 Query Supabase: app_settings (upsert)');
      const { error } = await supabase
        .from('app_settings')
        .upsert({ id: 1, ...newSettings });

      if (error) {
        if (error.message?.includes('banner_config')) {
          throw new Error('A coluna "banner_config" não foi encontrada no banco de dados. Por favor, execute o script SQL de atualização em SUPABASE_SETUP.md no seu painel Supabase.');
        }
        throw error;
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
      console.log('🔎 Query Supabase: purchases (select)');
      const { data, error } = await supabase
        .from('purchases')
        .select('product_id')
        .eq('user_id', userId);
      
      if (error) throw error;
      setUserPurchases(data.map(p => p.product_id));
    } catch (err) {
      console.error('Error fetching user purchases:', err);
    }
  };

  const toggleCourseAccess = async (userId: string, courseId: string, isUnlocked: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await safeFetch('/api/v1/user-access-toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          userId,
          courseId,
          action: isUnlocked ? 'revoke' : 'grant'
        })
      });

      if (!response || response.error) throw new Error(response?.error || 'Erro ao comunicar com o servidor');

      if (isUnlocked) {
        setUserPurchases(prev => prev.filter(id => id !== courseId));
        toast.success('Acesso removido');
      } else {
        setUserPurchases(prev => [...prev, courseId]);
        toast.success('Acesso liberado');
      }
    } catch (err: any) {
      console.error('Toggle access error:', err);
      toast.error('Erro ao alterar acesso: ' + (err.message || 'Erro desconhecido'));
    }
  };

  const togglePackageAccess = async (userId: string, pkg: any, isUnlocked: boolean) => {
    const productId = pkg.hotmart_product_id || pkg.id;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await safeFetch('/api/v1/user-access-toggle', {
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
        setUserPurchases(prev => [...prev, productId]);
        toast.success('Pacote liberado');
      }
    } catch (err: any) {
      console.error('Toggle package access error:', err);
      toast.error('Erro ao alterar acesso do pacote: ' + (err.message || 'Erro desconhecido'));
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
      console.log('🔎 Chamando API Admin Create User');
      const data = await safeFetch('/api/v1/user-create', {
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
      console.log('🔎 Chamando API Admin Delete User');
      const data = await safeFetch(`/api/v1/user-delete/${userId}`, {
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

  const handleDeleteCourse = async (courseId: string) => {
    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', courseId);

      if (error) throw error;
      
      toast.success('Curso excluído com sucesso!');
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao excluir curso: ' + err.message);
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    try {
      const { error } = await supabase
        .from('course_packages')
        .delete()
        .eq('id', packageId);

      if (error) throw error;
      
      toast.success('Pacote excluído com sucesso!');
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao excluir pacote: ' + err.message);
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
      console.log('🔎 Query Supabase: profiles (select) for target count');
      let { data: usersToNotify, error: userError } = await supabase.from('profiles').select('id');
      if (userError) throw userError;

      if (!usersToNotify || usersToNotify.length === 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const authUsers = await safeFetch('/api/v1/users-list', {
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

      const response = await safeFetch('/api/v1/notification-push', {
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

      toast.success(notificationTitle ? `Notificação enviada para ${finalUserIds.length} usuários!` : 'Notificação enviada!');
      setNotificationTitle('');
      setNotificationBody('');
      setNotificationExclusionCourseId(null);
      fetchNotificationHistory(); // Refresh history
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
      const response = await safeFetch('/api/v1/notification-clear', {
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
      console.log('🔎 Chamando API Admin Update Password');
      const data = await safeFetch('/api/v1/user-password-set', {
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
            icon={<Globe size={20} />} 
            label="Páginas" 
            active={activeTab === 'pages'} 
            onClick={() => { setActiveTab('pages'); setIsMobileMenuOpen(false); }} 
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
               activeTab === 'pages' ? 'Páginas' :
               activeTab === 'community' ? 'Comunidade' :
               activeTab === 'notifications' ? 'Notificações' :
               activeTab === 'languages' ? 'Idiomas / Textos' :
               activeTab === 'settings' ? 'Configurações' :
               activeTab === 'security' ? 'Segurança' :
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
              <Loader2 className="animate-spin text-blue-500" size={48} />
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
                                      <span className="font-bold text-sm text-white">{u.user_metadata?.full_name || 'Sem nome'}</span>
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
                            {/* Pacotes / Produtos */}
                            <div className="space-y-4">
                              <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                Pacotes Adquiridos 📦💎
                              </h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {coursePackages.filter(pkg => userPurchases.includes(pkg.hotmart_product_id || pkg.id)).map(pkg => {
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
                                {coursePackages.filter(pkg => !userPurchases.includes(pkg.hotmart_product_id || pkg.id)).map(pkg => {
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
                                          <img src={course.cover_url} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
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
                                          <img src={course.cover_url} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
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
                                          <img src={course.cover_url} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
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
                      <div className="flex justify-between items-center">
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Gerenciar Cursos</h3>
                        <button 
                          onClick={() => { setEditingCourseId(null); setShowCourseEditor(true); }}
                          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                        >
                          <Plus size={20} /> Criar Curso
                        </button>
                      </div>

                    <div className="space-y-12">
                      {/* Produtos Principais (Free) */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-emerald-800 uppercase tracking-widest flex items-center gap-2">
                          Produtos Principais 💎
                        </h4>
                        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-none">
                          {courses.filter(c => !c.is_bonus && c.is_free).map((course) => (
                            <CourseAdminCard key={course.id} course={course} courseStats={courseStats} setViewingCourseId={setViewingCourseId} setEditingCourseId={setEditingCourseId} setShowCourseEditor={setShowCourseEditor} onDelete={handleDeleteCourse} />
                          ))}
                        </div>
                      </div>

                      {/* Cursos Pagos (Paid) */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-red-900 uppercase tracking-widest flex items-center gap-2">
                          Cursos Pagos 💳
                        </h4>
                        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-none">
                          {courses.filter(c => !c.is_bonus && !c.is_free).map((course) => (
                            <CourseAdminCard key={course.id} course={course} courseStats={courseStats} setViewingCourseId={setViewingCourseId} setEditingCourseId={setEditingCourseId} setShowCourseEditor={setShowCourseEditor} onDelete={handleDeleteCourse} />
                          ))}
                        </div>
                      </div>

                      {/* Cursos Bônus (Bonus) */}
                      <div className="space-y-6">
                        <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                          Cursos Bônus 🎁
                        </h4>
                        <div className="flex gap-4 overflow-x-auto pb-6 -mx-2 px-2 scrollbar-none">
                          {courses.filter(c => c.is_bonus).map((course) => (
                            <CourseAdminCard key={course.id} course={course} courseStats={courseStats} setViewingCourseId={setViewingCourseId} setEditingCourseId={setEditingCourseId} setShowCourseEditor={setShowCourseEditor} onDelete={handleDeleteCourse} />
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
                            onClick={() => setNotificationSubTab('history')}
                            className={`px-6 py-2 rounded-lg text-[10px] font-black transition-all uppercase tracking-widest ${notificationSubTab === 'history' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Histórico
                          </button>
                        </div>

                        {notificationSubTab === 'history' && notificationHistory.length > 0 && (
                          <button 
                            onClick={() => setShowClearHistoryConfirm(true)}
                            className="flex items-center gap-2 px-4 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20"
                          >
                            <Trash2 size={14} /> Apagar Tudo
                          </button>
                        )}
                      </div>
                    </div>

                    {notificationSubTab === 'send' ? (
                      <div className="max-w-2xl">
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
                        {loadingHistory ? (
                          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-2xl border border-white/10">
                            <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Carregando Histórico...</p>
                          </div>
                        ) : notificationHistory.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 bg-zinc-900/50 rounded-2xl border border-white/10 text-center px-6">
                            <Bell size={48} className="text-gray-700 mb-4" />
                            <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Nenhuma notificação enviada ainda</p>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                              {notificationHistory.map(item => (
                              <div key={item.id} className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all group">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                        item.type === 'push' ? 'bg-orange-500/20 text-orange-500' :
                                        item.type === 'in_app' ? 'bg-blue-500/20 text-blue-500' :
                                        'bg-green-500/20 text-green-500'
                                      }`}>
                                        {item.type === 'both' ? 'Push + Interna' : (item.type === 'in_app' ? 'INTERNA' : item.type)}
                                      </span>
                                      <span className="text-[10px] font-bold text-gray-600">
                                        {new Date(item.created_at || item.sent_at).toLocaleString('pt-BR')}
                                      </span>
                                    </div>
                                    <h4 className="font-black text-white uppercase tracking-tight">{item.title}</h4>
                                    <p className="text-xs text-gray-500 line-clamp-2">{item.body}</p>
                                  </div>
                                  
                                  <div className="text-right shrink-0">
                                    <div className="flex items-center gap-4 mb-4">
                                      <div className="text-center">
                                        <p className="text-xs font-black text-white">{item.target_count || 0}</p>
                                        <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Enviados</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-xs font-black text-green-500">{item.read_count || 0}</p>
                                        <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Lidos</p>
                                      </div>
                                    </div>
                                    <button 
                                      onClick={() => fetchBroadcastDetails(item)}
                                      className="text-[10px] font-black text-blue-500 hover:text-blue-400 uppercase tracking-widest flex items-center gap-2 ml-auto"
                                    >
                                      Ver Detalhes <ChevronRight size={14} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
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
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="relative w-full max-w-2xl bg-zinc-900 border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                          >
                            <div className="p-8 border-b border-white/5 bg-white/5 flex items-center justify-between">
                              <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Detalhes do Envio</h3>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">{selectedBroadcast.title}</p>
                              </div>
                              <button 
                                onClick={() => setSelectedBroadcast(null)}
                                className="p-2 hover:bg-white/10 rounded-full transition-all"
                              >
                                <X size={24} className="text-gray-500" />
                              </button>
                            </div>

                            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
                              {loadingDetails ? (
                                <div className="flex flex-col items-center justify-center py-12">
                                  <Loader2 className="animate-spin text-blue-500 mb-4" size={32} />
                                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Buscando leituras...</p>
                                </div>
                              ) : selectedBroadcast.type === 'push' ? (
                                <div className="text-center py-12 px-6">
                                  <div className="w-16 h-16 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Bell size={32} className="text-orange-500 opacity-50" />
                                  </div>
                                  <p className="text-sm text-white font-bold mb-2">Monitoramento Indisponível</p>
                                  <p className="text-xs text-gray-500 leading-relaxed">
                                    Não é possível monitorar a leitura de notificações puramente PUSH, pois elas dependem de permissões externas do sistema operacional do aluno.
                                  </p>
                                </div>
                              ) : viewingBroadcastDetails.length === 0 ? (
                                <div className="text-center py-12">
                                  <p className="text-sm text-gray-500">Nenhum dado de leitura encontrado.</p>
                                </div>
                              ) : (
                                <div className="space-y-4">
                                  <div className="flex items-center justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest px-4">
                                    <span>Usuário</span>
                                    <span>Status</span>
                                  </div>
                                  <div className="space-y-2">
                                    {viewingBroadcastDetails.map((detail, idx) => (
                                      <div key={idx} className="flex items-center justify-between p-4 bg-black/40 rounded-2xl border border-white/5">
                                        <div className="flex flex-col">
                                          <span className="text-sm font-black text-white tracking-tight">
                                            {detail.profiles?.full_name || 'Usuário sem nome'}
                                          </span>
                                          <span className="text-[10px] font-bold text-gray-500 lowercase">
                                            {detail.profiles?.email || 'N/A'}
                                          </span>
                                        </div>
                                        <div>
                                          {detail.is_read ? (
                                            <div className="flex flex-col items-end">
                                              <span className="text-[10px] font-black text-green-500 uppercase tracking-widest flex items-center gap-1">
                                                <Check size={12} /> Lido
                                              </span>
                                              {detail.read_at && (
                                                <span className="text-[8px] font-bold text-gray-600">
                                                  {new Date(detail.read_at).toLocaleString('pt-BR')}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                              Não Lido
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="p-6 bg-black/40 border-t border-white/5">
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
                          <h4 className="font-bold text-white">Editor de Textos Brutalista</h4>
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
                             <div className="flex justify-between items-center">
                               <label className="text-[10px] font-black text-gray-600 uppercase tracking-widest">{key}</label>
                               <span className="text-[8px] font-bold text-blue-500 uppercase">Padrão: {languagePresets.pt[key].substring(0, 15)}...</span>
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
                {activeTab === 'settings' && (
                  <div className="max-w-4xl space-y-8 pb-20">
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Configurações Gerais</h3>
                      <p className="text-sm text-gray-500">Controle o comportamento global da sua plataforma.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Auth Settings */}
                      <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                            <LockIcon size={20} />
                          </div>
                          <h4 className="font-bold text-white">Autenticação</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Método de Login Padrão</label>
                            <div className="flex p-1 bg-black rounded-xl border border-white/10">
                              <button 
                                onClick={() => updateSettings({ auth_method: 'passwordless' })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settings.auth_method === 'passwordless' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                              >
                                SEM SENHA
                              </button>
                              <button 
                                onClick={() => updateSettings({ auth_method: 'password' })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settings.auth_method === 'password' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                              >
                                COM SENHA
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Global Support Settings */}
                      <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-green-500/20 rounded-lg text-green-500">
                            <Phone size={20} />
                          </div>
                          <h4 className="font-bold text-white">Dados de Suporte</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">WhatsApp de Suporte (DDI + DDD + Número)</label>
                            <div className="grid grid-cols-[100px_1fr] gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 px-4 py-3 bg-black border border-white/10 rounded-xl focus-within:border-blue-500 transition-all">
                                  <span className="text-gray-400 font-bold text-sm">+</span>
                                  <input 
                                    type="text" 
                                    value={localSettings?.support_whatsapp?.startsWith('+') ? localSettings.support_whatsapp.split(' ')[0].substring(1) : ''}
                                    onChange={(e) => {
                                      const code = e.target.value.replace(/\D/g, '').substring(0, 4);
                                      const full = localSettings?.support_whatsapp || '';
                                      const body = full.includes(' ') ? full.split(' ')[1] : full.startsWith('+') ? '' : full;
                                      setLocalSettings({ ...localSettings, support_whatsapp: `+${code} ${body}` });
                                    }}
                                    className="bg-transparent border-none outline-none w-full text-white placeholder:text-gray-600 text-sm"
                                    placeholder="00"
                                    maxLength={4}
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter block px-1 truncate">
                                  {t('profile.phone_country_code') || 'Código do país'}
                                </span>
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-3 px-4 py-3 bg-black border border-white/10 rounded-xl focus-within:border-blue-500 transition-all">
                                  <input 
                                    type="text" 
                                    value={localSettings?.support_whatsapp?.includes(' ') ? localSettings.support_whatsapp.split(' ')[1] : (localSettings?.support_whatsapp?.startsWith('+') ? '' : (localSettings?.support_whatsapp || ''))}
                                    onChange={(e) => {
                                      const phoneNumbers = e.target.value.replace(/\D/g, '');
                                      const full = localSettings?.support_whatsapp || '';
                                      const code = full.startsWith('+') ? full.split(' ')[0].substring(1) : '';
                                      setLocalSettings({ ...localSettings, support_whatsapp: `+${code} ${phoneNumbers}` });
                                    }}
                                    className="bg-transparent border-none outline-none flex-1 text-white placeholder:text-gray-600 text-sm"
                                    placeholder="31997433488"
                                  />
                                </div>
                                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter block px-1">
                                  {t('profile.phone_number_label') || 'Telefone com código de área'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">E-mail de Suporte</label>
                            <input 
                              type="email" 
                              value={localSettings?.support_email || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, support_email: e.target.value })}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                              placeholder="suporte@exemplo.com"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Mensagem Padrão WhatsApp (Opcional)</label>
                            <textarea 
                              value={localSettings?.support_whatsapp_message || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, support_whatsapp_message: e.target.value })}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none min-h-[80px]"
                              placeholder="Ex: Olá, gostaria de tirar uma dúvida..."
                            />
                          </div>
                          
                          <button 
                            onClick={async () => {
                              setIsSavingSettings(true);
                              await updateSettings({ 
                                support_whatsapp: localSettings.support_whatsapp,
                                support_email: localSettings.support_email,
                                support_whatsapp_message: localSettings.support_whatsapp_message
                              });
                              setIsSavingSettings(false);
                            }}
                            disabled={isSavingSettings}
                            className="w-full mt-2 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                          >
                            {isSavingSettings ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                            Salvar Dados de Suporte
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
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mt-2 italic opacity-80">
                          Editor de Textos Brutalista
                        </p>
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
                            onClick={() => setActivePageTab('nav')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'nav' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Navegação
                          </button>
                          <button 
                            onClick={() => setActivePageTab('home')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'home' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Dashboard
                          </button>
                          <button 
                            onClick={() => setActivePageTab('course')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'course' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
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
                            await updateSettings({ custom_texts: draftCustomTexts });
                            setIsSavingPages(false);
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
                        {/* Identidade Visual moved here */}
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                                <Layout size={20} />
                              </div>
                              <h4 className="font-bold text-white">Identidade Visual</h4>
                            </div>
                            <button 
                              onClick={async () => {
                                setIsSavingSettings(true);
                                await updateSettings({ 
                                  app_name: localSettings.app_name,
                                  app_description: localSettings.app_description,
                                  login_display_type: localSettings.login_display_type,
                                  logo_url: localSettings.logo_url,
                                  favicon_url: localSettings.favicon_url,
                                  primary_color: localSettings.primary_color,
                                  secondary_color: localSettings.secondary_color,
                                  background_color: localSettings.background_color,
                                  pwa_icon_url: localSettings.favicon_url
                                });
                                setIsSavingSettings(false);
                                toast.success('Identidade Visual salva!');
                              }}
                              disabled={isSavingSettings}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                            >
                              {isSavingSettings ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                              Salvar Identidade
                            </button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nome da Plataforma</label>
                                <input 
                                  type="text" 
                                  value={localSettings?.app_name || ''}
                                  onChange={(e) => setLocalSettings({ ...localSettings, app_name: e.target.value })}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                />
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Logo (URL)</label>
                                  <input 
                                    type="text" 
                                    value={localSettings?.logo_url || ''}
                                    onChange={(e) => setLocalSettings({ ...localSettings, logo_url: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                  />
                                </div>
                                <div className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Favicon (URL)</label>
                                  <input 
                                    type="text" 
                                    value={localSettings?.favicon_url || ''}
                                    onChange={(e) => setLocalSettings({ ...localSettings, favicon_url: e.target.value })}
                                    className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                  />
                                </div>
                              </div>

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

                              <div className="space-y-4">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Cor Principal</label>
                                <div className="flex flex-wrap gap-3 items-center">
                                  {[
                                    { name: 'Rosa', primary: '#ec4899', secondary: '#be185d' },
                                    { name: 'Azul', primary: '#3b82f6', secondary: '#1d4ed8' },
                                    { name: 'Verde', primary: '#10b981', secondary: '#047857' },
                                    { name: 'Roxo', primary: '#8b5cf6', secondary: '#6d28d9' },
                                    { name: 'Laranja', primary: '#f97316', secondary: '#c2410c' },
                                    { name: 'Vermelho', primary: '#ef4444', secondary: '#b91c1c' },
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

                              <div className="space-y-6 pt-4 border-t border-white/5">
                                <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Textos da Tela de Login</h5>
                                {[
                                  { key: 'auth.subtitle', label: 'Subtítulo do Login' },
                                  { key: 'auth.restricted_access_msg', label: 'Aviso de Acesso Restrito' },
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

                              <div className="space-y-4">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Cor de Fundo (Apps/Sites)</label>
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
                            </div>

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview Realista (Login)</label>
                              <div className="rounded-[2.5rem] border border-white/10 p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px] relative overflow-hidden shadow-2xl" 
                                   style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="absolute inset-0 blur-3xl rounded-full opacity-20" style={{ backgroundColor: `${localSettings?.primary_color}` }} />
                                <div className="relative z-10 w-full max-w-[200px]">
                                  {(localSettings?.login_display_type === 'logo' || localSettings?.login_display_type === 'both') && localSettings?.logo_url ? (
                                    <img src={localSettings.logo_url} className="h-10 mx-auto mb-4 object-contain" referrerPolicy="no-referrer" />
                                  ) : null}
                                  {(localSettings?.login_display_type === 'title' || localSettings?.login_display_type === 'both') && (
                                    <h2 className="text-xl font-black italic uppercase tracking-tighter" style={{ color: localSettings?.primary_color }}>{localSettings?.app_name || 'App Name'}</h2>
                                  )}
                                  
                                  <p className="text-[8px] text-gray-500 mt-2">
                                    {draftCustomTexts['auth.subtitle'] || settings.custom_texts?.['auth.subtitle'] || languagePresets.pt['auth.subtitle']}
                                  </p>

                                  <div className="mt-6 space-y-2">
                                    <div className="w-full h-8 bg-white/5 border border-white/10 rounded-lg" />
                                    <div className="w-full h-8 bg-white/5 border border-white/10 rounded-lg" />
                                    <div className="w-full h-8 rounded-lg flex items-center justify-center text-[8px] font-black text-white uppercase tracking-widest" style={{ backgroundColor: localSettings?.primary_color }}>
                                      Entrar
                                    </div>
                                    <p className="text-[6px] text-gray-600 mt-4 leading-tight">
                                      {draftCustomTexts['auth.restricted_access_msg'] || settings.custom_texts?.['auth.restricted_access_msg'] || languagePresets.pt['auth.restricted_access_msg']}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600/20 rounded-lg text-blue-500">
                              <LockIcon size={20} />
                            </div>
                            <h4 className="font-bold text-white">Customização da Página de Login</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              {[
                                { key: 'auth.welcome_back', label: 'Título de Boas-vindas' },
                                { key: 'auth.subtitle', label: 'Subtítulo' },
                                { key: 'auth.login', label: 'Texto do Botão' },
                                { key: 'auth.email', label: 'Label do E-mail' },
                                { key: 'auth.password', label: 'Label da Senha' },
                                { key: 'auth.restricted_access', label: 'Aviso de Acesso Restrito' },
                                { key: 'auth.support_box', label: 'Título da Caixa de Suporte' },
                                { key: 'auth.support_description', label: 'Descrição do Suporte', type: 'textarea' },
                                { key: 'auth.whatsapp_label', label: 'Label do WhatsApp' },
                                { key: 'auth.email_label', label: 'Label do E-mail Suporte' },
                                { key: 'auth.user_not_found', label: 'Erro: Usuário não encontrado' },
                                { key: 'auth.disclaimer', label: 'Disclaimer (Rodapé)', type: 'textarea' }
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

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview da Página de Login</label>
                              <div className="rounded-[2.5rem] border border-white/10 p-8 flex flex-col items-center justify-between text-center space-y-6 min-h-[600px] relative overflow-hidden" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[80px]" />
                                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[80px]" />
                                
                                <div className="relative z-10 w-full max-w-[280px] pt-8 flex-1 flex flex-col">
                                  <div className="mb-4">
                                    <div className="w-12 h-12 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center mx-auto mb-4">
                                      <LockIcon size={24} className="text-blue-500" />
                                    </div>
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter" style={{ color: localSettings?.primary_color || settings.primary_color }}>
                                      {draftCustomTexts['auth.welcome_back'] || 'Bem-vinda de volta!'}
                                    </h2>
                                    <p className="text-[11px] text-gray-500 mt-2 font-medium">
                                      {draftCustomTexts['auth.subtitle'] || 'Acesse sua área exclusiva para mamães'}
                                    </p>
                                  </div>
                                  
                                  <div className="mt-8 space-y-3">
                                    <div className="relative">
                                      <div className="w-full h-12 bg-white/5 border border-white/10 rounded-xl flex items-center px-4 text-xs text-gray-600 text-left">
                                        {draftCustomTexts['auth.email'] || 'E-mail'}
                                      </div>
                                    </div>
                                    <div className="relative">
                                      <div className="w-full h-12 bg-white/5 border border-white/10 rounded-xl flex items-center px-4 text-xs text-gray-600 text-left">
                                        {draftCustomTexts['auth.password'] || 'Senha'}
                                      </div>
                                    </div>
                                    <div className="w-full h-12 rounded-xl flex items-center justify-center text-xs font-black text-white uppercase tracking-widest shadow-xl shadow-blue-600/20" style={{ backgroundColor: localSettings?.primary_color || settings.primary_color }}>
                                      {draftCustomTexts['auth.login'] || 'Entrar'}
                                      <ArrowRight size={16} className="ml-2" />
                                    </div>
                                  </div>

                                  <div className="mt-8 pt-6 border-t border-white/5 space-y-4">
                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-4">
                                      {draftCustomTexts['auth.support_box'] || 'Caixa de Suporte'}
                                    </p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <div className="flex items-center justify-center gap-2 py-3 bg-green-500/10 border border-green-500/20 rounded-xl text-green-500 text-[10px] font-black uppercase">
                                        <Phone size={12} /> {draftCustomTexts['auth.whatsapp_label'] || 'WhatsApp'}
                                      </div>
                                      <div className="flex items-center justify-center gap-2 py-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-500 text-[10px] font-black uppercase">
                                        <Mail size={12} /> {draftCustomTexts['auth.email_label'] || 'E-mail'}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                <div className="mt-auto pt-6 pb-2 w-full border-t border-white/5">
                                  <p className="text-[10px] text-gray-600 max-w-[240px] mx-auto leading-relaxed">
                                    {draftCustomTexts['auth.disclaimer'] || 'Ao entrar, você concorda com nossos Termos de Uso e Política de Privacidade. Maternidade Premium! © 2026'}
                                  </p>
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
                                    <MessageSquare size={18} />
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
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-pink-500/20 rounded-lg text-pink-500">
                              <ShoppingBag size={20} />
                            </div>
                            <h4 className="font-bold text-white">Textos do Dashboard</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              {[
                                { key: 'dashboard.courses_paid', label: 'Título Cursos Pagos' },
                                { key: 'dashboard.courses_free', label: 'Título Produto Principal' },
                                { key: 'dashboard.courses_bonus', label: 'Título Cursos Bônus' },
                                { key: 'dashboard.empty_locked', label: 'Mensagem Sem Cursos' },
                                { key: 'dashboard.empty_all_unlocked', label: 'Mensagem Todos Liberados' }
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                              <div className="space-y-6">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview Seção Suporte</label>
                                <div className="p-6 rounded-3xl border border-white/10 h-full flex flex-col items-center justify-center space-y-4" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                  <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full space-y-4">
                                     <div className="space-y-1">
                                       <h6 className="text-sm font-black text-white uppercase tracking-tighter italic">Precisa de <span className="text-blue-500">Suporte?</span></h6>
                                       <p className="text-[8px] text-gray-500">Equipe pronta para te ajudar.</p>
                                     </div>
                                     <div className="flex gap-2">
                                       <div className="flex-1 py-1.5 bg-green-500 rounded-lg text-[8px] font-black text-white text-center">WHATSAPP</div>
                                       <div className="flex-1 py-1.5 bg-white/5 border border-white/10 rounded-lg text-[8px] font-black text-white text-center">EMAIL</div>
                                     </div>
                                  </div>
                                  <p className="text-[8px] text-center text-gray-600 font-bold uppercase tracking-widest">Aparece no final do Dashboard</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                          {/* Banner Settings */}
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
                                  banner_interval: localSettings.banner_interval,
                                  banner_config: localSettings.banner_config // We'll store professional adjustments here
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

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-6">
                              <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Gerenciar Lâminas</label>
                                  <button 
                                    onClick={() => {
                                      const newImages = [...(localSettings?.banner_images || []), ''];
                                      const newConfig = [...(localSettings?.banner_config || [])];
                                      newConfig.push({ scale: 100, x: 50, y: 50, stretch: true });
                                      setLocalSettings({ ...localSettings, banner_images: newImages, banner_config: newConfig });
                                    }}
                                    className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                  >
                                    <Plus size={14} /> Adicionar
                                  </button>
                                </div>
                                
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                  {(localSettings?.banner_images || []).map((url: string, index: number) => (
                                    <div key={index} className="space-y-3 p-4 bg-black/40 rounded-2xl border border-white/5 relative group">
                                      <div className="flex gap-2">
                                        <div className="flex flex-col gap-1 pr-2 border-r border-white/5">
                                          <button 
                                            onClick={() => {
                                              if (index === 0) return;
                                              const newImages = [...localSettings.banner_images];
                                              const newConfig = [...(localSettings.banner_config || [])];
                                              [newImages[index], newImages[index-1]] = [newImages[index-1], newImages[index]];
                                              [newConfig[index], newConfig[index-1]] = [newConfig[index-1], newConfig[index]];
                                              setLocalSettings({ ...localSettings, banner_images: newImages, banner_config: newConfig });
                                            }}
                                            className={`p-1 hover:bg-white/10 rounded-lg transition-all ${index === 0 ? 'opacity-20 cursor-not-allowed' : 'text-blue-500'}`}
                                            title="Subir"
                                          >
                                            <ArrowUp size={14} />
                                          </button>
                                          <button 
                                            onClick={() => {
                                              if (index === localSettings.banner_images.length - 1) return;
                                              const newImages = [...localSettings.banner_images];
                                              const newConfig = [...(localSettings.banner_config || [])];
                                              [newImages[index], newImages[index+1]] = [newImages[index+1], newImages[index]];
                                              [newConfig[index], newConfig[index+1]] = [newConfig[index+1], newConfig[index]];
                                              setLocalSettings({ ...localSettings, banner_images: newImages, banner_config: newConfig });
                                            }}
                                            className={`p-1 hover:bg-white/10 rounded-lg transition-all ${index === localSettings.banner_images.length - 1 ? 'opacity-20 cursor-not-allowed' : 'text-blue-500'}`}
                                            title="Descer"
                                          >
                                            <ArrowDown size={14} />
                                          </button>
                                        </div>
                                        <div className="flex flex-col gap-1 pr-2 border-r border-white/5 justify-center">
                                          <button 
                                            onClick={() => {
                                              const newConfig = [...(localSettings.banner_config || [])];
                                              if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50, stretch: true };
                                              newConfig[index].stretch = !newConfig[index].stretch;
                                              // If stretching, reset zoom and position
                                              if (newConfig[index].stretch) {
                                                newConfig[index].scale = 100;
                                                newConfig[index].x = 50;
                                                newConfig[index].y = 50;
                                              }
                                              setLocalSettings({ ...localSettings, banner_config: newConfig });
                                            }}
                                            className={`p-2 rounded-lg transition-all flex flex-col items-center gap-1 ${localSettings?.banner_config?.[index]?.stretch ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/40' : 'bg-white/5 text-gray-500 hover:bg-white/10'}`}
                                            title="Mostrar 100% da Foto (Esticar)"
                                          >
                                            <Layout size={12} />
                                            <span className="text-[6px] font-black uppercase whitespace-nowrap">100% Foto</span>
                                          </button>
                                        </div>
                                        <div className="flex-1 space-y-2">
                                          <div className="relative group/input">
                                            <input 
                                              type="text" 
                                              value={url}
                                              onFocus={() => setEditingBannerIndex(index)}
                                              onChange={(e) => {
                                                const newImages = [...localSettings.banner_images];
                                                newImages[index] = e.target.value;
                                                setLocalSettings({ ...localSettings, banner_images: newImages });
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
                                              value={localSettings?.banner_config?.[index]?.link || ''}
                                              onFocus={() => setEditingBannerIndex(index)}
                                              onChange={(e) => {
                                                const newConfig = [...(localSettings.banner_config || [])];
                                                if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50, stretch: true };
                                                newConfig[index].link = e.target.value;
                                                setLocalSettings({ ...localSettings, banner_config: newConfig });
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
                                              const newImages = localSettings.banner_images.filter((_: any, i: number) => i !== index);
                                              const newConfig = (localSettings?.banner_config || []).filter((_: any, i: number) => i !== index);
                                              setLocalSettings({ ...localSettings, banner_images: newImages, banner_config: newConfig });
                                            }}
                                            className="p-3 text-red-500 hover:bg-red-500/10 rounded-xl transition-all border border-transparent hover:border-red-500/20"
                                            title="Excluir Lâmina"
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                          <button 
                                            onClick={() => setEditingBannerIndex(index)}
                                            className={`p-3 rounded-xl transition-all border ${editingBannerIndex === index ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-600/40' : 'bg-white/5 text-blue-500 border-white/10 hover:bg-white/10 hover:border-blue-500/30'}`}
                                            title="Editar no Preview"
                                          >
                                            <Eye size={16} />
                                          </button>
                                        </div>
                                      </div>

                                      {url && (
                                          <div className={`space-y-3 pt-2 border-t border-white/5 ${localSettings?.banner_config?.[index]?.stretch ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                                            {localSettings?.banner_config?.[index]?.stretch && (
                                              <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-[2px] rounded-2xl">
                                                <div className="flex flex-col items-center gap-2">
                                                  <Layout size={20} className="text-blue-500" />
                                                  <span className="text-[10px] font-black uppercase text-white tracking-[0.2em]">Modo Foto 100% Ativo</span>
                                                  <button 
                                                    onClick={() => {
                                                      const newConfig = [...(localSettings.banner_config || [])];
                                                      if (newConfig[index]) newConfig[index].stretch = false;
                                                      setLocalSettings({ ...localSettings, banner_config: newConfig });
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
                                                <span>{(localSettings?.banner_config?.[index]?.scale || 100)}%</span>
                                              </div>
                                              <input 
                                                type="range" min="100" max="250" step="1"
                                                value={localSettings?.banner_config?.[index]?.scale || 100}
                                                onChange={(e) => {
                                                  const newConfig = [...(localSettings.banner_config || [])];
                                                  if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50 };
                                                  newConfig[index].scale = parseInt(e.target.value);
                                                  setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                }}
                                                className="w-full accent-blue-500 h-1 bg-black rounded-lg appearance-none cursor-pointer"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[8px] font-black uppercase text-gray-500 tracking-widest">
                                                <span>Posição X</span>
                                                <span>{(localSettings?.banner_config?.[index]?.x || 50)}%</span>
                                              </div>
                                              <input 
                                                type="range" min="0" max="100" step="1"
                                                value={localSettings?.banner_config?.[index]?.x || 50}
                                                onChange={(e) => {
                                                  const newConfig = [...(localSettings.banner_config || [])];
                                                  if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50 };
                                                  newConfig[index].x = parseInt(e.target.value);
                                                  setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                }}
                                                className="w-full accent-blue-500 h-1 bg-black rounded-lg appearance-none cursor-pointer"
                                              />
                                            </div>
                                            <div className="space-y-1">
                                              <div className="flex justify-between text-[8px] font-black uppercase text-gray-500 tracking-widest">
                                                <span>Posição Y</span>
                                                <span>{(localSettings?.banner_config?.[index]?.y || 50)}%</span>
                                              </div>
                                              <input 
                                                type="range" min="0" max="100" step="1"
                                                value={localSettings?.banner_config?.[index]?.y || 50}
                                                onChange={(e) => {
                                                  const newConfig = [...(localSettings.banner_config || [])];
                                                  if (!newConfig[index]) newConfig[index] = { scale: 100, x: 50, y: 50 };
                                                  newConfig[index].y = parseInt(e.target.value);
                                                  setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                }}
                                                className="w-full accent-blue-500 h-1 bg-black rounded-lg appearance-none cursor-pointer"
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  ))}
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

                                        {(localSettings?.banner_images || []).length > 0 ? (
                                          <>
                                            {/* Translucent Drag Overlay */}
                                            {!localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch && (
                                              <div 
                                                className="absolute inset-0 z-10 cursor-move"
                                                onPointerDown={(e) => {
                                                  const target = e.currentTarget as HTMLDivElement;
                                                  target.setPointerCapture(e.pointerId);
                                                  (target as any)._panStart = { 
                                                    x: e.clientX, 
                                                    y: e.clientY,
                                                    startX: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.x || 50,
                                                    startY: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.y || 50
                                                  };
                                                }}
                                                onPointerMove={(e) => {
                                                  if (!(e.currentTarget as any)._panStart) return;
                                                  const start = (e.currentTarget as any)._panStart;
                                                  const dx = e.clientX - start.x;
                                                  const dy = e.clientY - start.y;
                                                  
                                                  const idx = editingBannerIndex ?? 0;
                                                  const newConfig = [...(localSettings.banner_config || [])];
                                                  if (!newConfig[idx]) newConfig[idx] = { scale: 100, x: 50, y: 50 };
                                                  
                                                  const scale = (newConfig[idx].scale || 100) / 100;
                                                  // Sensitivity updated for 65% height
                                                  newConfig[idx].x = Math.max(0, Math.min(100, start.startX - (dx / (1.5 * 280 / scale)) * 100));
                                                  newConfig[idx].y = Math.max(0, Math.min(100, start.startY - (dy / (1.5 * (580 * 0.65) / scale)) * 100));
                                                  
                                                  setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                }}
                                                onPointerUp={(e) => {
                                                  (e.currentTarget as any)._panStart = null;
                                                  e.currentTarget.releasePointerCapture(e.pointerId);
                                                }}
                                              />
                                            )}
                                            <motion.img 
                                              src={localSettings.banner_images[editingBannerIndex ?? 0] || 'https://images.unsplash.com/photo-1555252333-9f8e92e65ee9'} 
                                              style={{ 
                                                objectFit: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch ? 'fill' : 'cover',
                                                width: '100%',
                                                height: '100%',
                                                scale: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch ? 1 : (localSettings?.banner_config?.[editingBannerIndex ?? 0]?.scale || 100) / 100,
                                                objectPosition: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch ? 'center' : `${localSettings?.banner_config?.[editingBannerIndex ?? 0]?.x || 50}% ${localSettings?.banner_config?.[editingBannerIndex ?? 0]?.y || 50}%`,
                                                transformOrigin: 'center center'
                                              }}
                                              className="transition-all duration-75 select-none"
                                              referrerPolicy="no-referrer"
                                            />
                                            {/* Drag hint overlay */}
                                            {!localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch && (
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
                                        )}
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
                                          {(localSettings?.banner_images || []).length > 0 ? (
                                            <>
                                              {/* Drag Overlay */}
                                              {!localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch && (
                                                <div 
                                                  className="absolute inset-0 z-10 cursor-move"
                                                  onPointerDown={(e) => {
                                                    const target = e.currentTarget as HTMLDivElement;
                                                    target.setPointerCapture(e.pointerId);
                                                    (target as any)._panStart = { 
                                                      x: e.clientX, 
                                                      y: e.clientY,
                                                      startX: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.x || 50,
                                                      startY: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.y || 50
                                                    };
                                                  }}
                                                  onPointerMove={(e) => {
                                                    if (!(e.currentTarget as any)._panStart) return;
                                                    const start = (e.currentTarget as any)._panStart;
                                                    const dx = e.clientX - start.x;
                                                    const dy = e.clientY - start.y;
                                                    
                                                    const idx = editingBannerIndex ?? 0;
                                                    const newConfig = [...(localSettings.banner_config || [])];
                                                    if (!newConfig[idx]) newConfig[idx] = { scale: 100, x: 50, y: 50 };
                                                    
                                                    const scale = (newConfig[idx].scale || 100) / 100;
                                                    newConfig[idx].x = Math.max(0, Math.min(100, start.startX - (dx / (1.5 * 850 / scale)) * 100));
                                                    newConfig[idx].y = Math.max(0, Math.min(100, start.startY - (dy / (1.5 * 450 * 0.75 / scale)) * 100));
                                                    
                                                    setLocalSettings({ ...localSettings, banner_config: newConfig });
                                                  }}
                                                  onPointerUp={(e) => {
                                                    (e.currentTarget as any)._panStart = null;
                                                    e.currentTarget.releasePointerCapture(e.pointerId);
                                                  }}
                                                />
                                              )}
                                              <motion.img 
                                                src={localSettings.banner_images[editingBannerIndex ?? 0] || 'https://images.unsplash.com/photo-1555252333-9f8e92e65ee9'} 
                                                style={{ 
                                                  objectFit: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch ? 'fill' : 'cover',
                                                  width: '100%',
                                                  height: '100%',
                                                  scale: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch ? 1 : (localSettings?.banner_config?.[editingBannerIndex ?? 0]?.scale || 100) / 100,
                                                  objectPosition: localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch ? 'center' : `${localSettings?.banner_config?.[editingBannerIndex ?? 0]?.x || 50}% ${localSettings?.banner_config?.[editingBannerIndex ?? 0]?.y || 50}%`,
                                                  transformOrigin: 'center center'
                                                }}
                                                className="transition-all duration-75 select-none"
                                                referrerPolicy="no-referrer"
                                              />
                                              {!localSettings?.banner_config?.[editingBannerIndex ?? 0]?.stretch && (
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
                                          )}
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
                      </div>
                    )}

                    {activePageTab === 'course' && (
                      <div className="space-y-8">
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-500">
                              <BookOpen size={20} />
                            </div>
                            <h4 className="font-bold text-white">Visualizador de Aula</h4>
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
                                { key: 'course.support_description', label: 'Texto de Suporte (Box)' }
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
                                { key: 'course.secure_payment', label: 'Texto Rodapé Seguro' }
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
                                { key: 'community.title', label: 'Título da Página' },
                                { key: 'community.subtitle', label: 'Subtítulo' },
                                { key: 'community.input_placeholder', label: 'Placeholder de Nova Postagem' },
                                { key: 'community.post', label: 'Botão Publicar' },
                                { key: 'community.like', label: 'Texto Curtir' },
                                { key: 'community.reply', label: 'Texto Responder' },
                                { key: 'community.comment_placeholder', label: 'Placeholder Comentar' },
                                { key: 'community.add_photo', label: 'Botão Adicionar Foto' },
                                { key: 'community.post_sent', label: 'Toast: Post Enviado' },
                                { key: 'community.post_updated', label: 'Toast: Post Atualizado' },
                                { key: 'community.edit_post', label: 'Título Modal Editar' },
                                { key: 'community.delete_post', label: 'Texto Excluir Post' },
                                { key: 'community.delete_post_confirm', label: 'Confirmação Excluir Post' },
                                { key: 'community.delete_success', label: 'Toast: Post Excluído' },
                                { key: 'community.delete_error', label: 'Toast: Erro Excluir Post' },
                                { key: 'community.comment_delete_success', label: 'Toast: Comentário Excluído' },
                                { key: 'community.comment_delete_error', label: 'Toast: Erro Excluir Comentário' },
                                { key: 'community.date_format', label: 'Formato da Data (Ex: d MMM, HH:mm)' },
                                { key: 'community.locale', label: 'Código do Idioma (ptBR, enUS, es)' }
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
                                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 text-gray-600 text-[10px] font-bold uppercase tracking-wider text-left">
                                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 shrink-0" />
                                  {draftCustomTexts['community.input_placeholder'] || settings.custom_texts?.['community.input_placeholder'] || languagePresets.pt['community.input_placeholder']}
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
                                { key: 'profile.push_description', label: 'Descrição Push (Perfil)', type: 'textarea' }
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
                              <div className="rounded-3xl border border-white/10 p-8 flex flex-col items-center shadow-2xl space-y-6" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="w-20 h-20 rounded-full border-4 border-blue-500/20 bg-white/5 flex items-center justify-center">
                                   <UserIcon className="text-white/20" size={32} />
                                </div>
                                <div className="text-center space-y-1">
                                  <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">
                                    {draftCustomTexts['profile.title'] || settings.custom_texts?.['profile.title'] || languagePresets.pt['profile.title']}
                                  </h3>
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                    {draftCustomTexts['profile.subtitle'] || settings.custom_texts?.['profile.subtitle'] || languagePresets.pt['profile.subtitle']}
                                  </p>
                                </div>
                                <div className="w-full h-px bg-white/5" />
                                <div className="w-full space-y-3">
                                  <div className="flex items-center gap-2 text-blue-500 font-bold text-[10px] tracking-widest uppercase">
                                    <UserIcon size={14} />
                                    {draftCustomTexts['profile.info_title'] || settings.custom_texts?.['profile.info_title'] || languagePresets.pt['profile.info_title']}
                                  </div>
                                  <div className="flex items-center gap-2 text-white/40 font-bold text-[10px] tracking-widest uppercase">
                                    <Bell size={14} />
                                    {draftCustomTexts['profile.push_title'] || settings.custom_texts?.['profile.push_title'] || languagePresets.pt['profile.push_title']}
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
                                { key: 'push.success', label: 'Toast Sucesso' }
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
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/20 rounded-lg text-primary">
                              <Smartphone size={20} />
                            </div>
                            <h4 className="font-bold text-white">Configuração do PWA (Instalação)</h4>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="space-y-8">
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
                                <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mt-8">Textos Globais do Modal</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                  {[
                                    { key: 'pwa.install_app', label: 'Texto do Botão Flutuante (Login)' },
                                    { key: 'pwa.install_title', label: 'Título do Modal' },
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

                              <div className="space-y-12">
                                <h5 className="text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 pb-2 mt-8">Configuração por Dispositivo</h5>
                                
                                {[
                                  { 
                                    id: 'ios', 
                                    label: 'Apple iOS (Safari)', 
                                    icon: <Smartphone size={16} />,
                                    titleKey: 'pwa.ios_label',
                                    stepsKey: 'pwa.steps.ios',
                                    imageKey: 'pwa.carousel.ios'
                                  },
                                  { 
                                    id: 'android', 
                                    label: 'Android (Chrome)', 
                                    icon: <Smartphone size={16} />,
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
                                  const currentUrls = (draftCustomTexts[device.imageKey] || '').split(',').filter(Boolean);
                                  const updateUrls = (urls: string[]) => {
                                    setDraftCustomTexts({ ...draftCustomTexts, [device.imageKey]: urls.join(',') });
                                  };

                                  const currentSteps = (() => {
                                    const raw = draftCustomTexts[device.stepsKey] || settings.custom_texts?.[device.stepsKey] || languagePresets.pt[device.stepsKey] || '[]';
                                    try { return JSON.parse(raw); } catch { return []; }
                                  })();

                                  const updateSteps = (steps: string[]) => {
                                    setDraftCustomTexts({ ...draftCustomTexts, [device.stepsKey]: JSON.stringify(steps) });
                                  };

                                  return (
                                    <div key={device.id} className="space-y-8 p-8 bg-zinc-900 border border-white/5 rounded-3xl relative overflow-hidden group/device">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                          <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                                            {device.icon}
                                          </div>
                                          <h6 className="font-bold text-white text-lg uppercase tracking-tight italic underline decoration-primary decoration-4 underline-offset-8 decoration-dotted">{device.label}</h6>
                                        </div>
                                      </div>

                                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                        <div className="space-y-8">
                                          <div className="space-y-4">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest block">Cabeçalho do Modal</label>
                                            <input 
                                              type="text" 
                                              value={draftCustomTexts[device.titleKey] !== undefined ? draftCustomTexts[device.titleKey] : (settings.custom_texts?.[device.titleKey] || languagePresets.pt[device.titleKey] || '')}
                                              onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [device.titleKey]: e.target.value })}
                                              className="w-full bg-black border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:border-primary outline-none"
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

                                        <div className="space-y-6">
                                          <div className="flex items-center justify-between">
                                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Capturas de Tela (9:16 Preferencial)</label>
                                            <button 
                                              onClick={() => {
                                                const newUrl = prompt('Insira a URL da imagem:');
                                                if (newUrl) updateUrls([...currentUrls, newUrl]);
                                              }}
                                              className="p-1 px-2.5 bg-primary rounded-md text-[10px] font-black text-white uppercase tracking-widest italic shadow-lg shadow-primary/20"
                                            >
                                              + ADD IMAGEM
                                            </button>
                                          </div>
                                          
                                          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-white/10 snap-x snap-mandatory">
                                            {currentUrls.map((url, index) => (
                                              <div key={index} className="relative group shrink-0 w-28 h-40 bg-zinc-950 rounded-xl border border-white/5 overflow-hidden snap-center shadow-2xl">
                                                <img src={url} className="w-full h-full object-contain" referrerPolicy="no-referrer" alt="" />
                                                <div className="absolute inset-0 bg-black/90 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3 p-2">
                                                  <div className="flex gap-2">
                                                    <button 
                                                      onClick={() => {
                                                        if (index === 0) return;
                                                        const newUrls = [...currentUrls];
                                                        [newUrls[index-1], newUrls[index]] = [newUrls[index], newUrls[index-1]];
                                                        updateUrls(newUrls);
                                                      }}
                                                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white disabled:opacity-20"
                                                      disabled={index === 0}
                                                    >
                                                      <ChevronLeft size={16} />
                                                    </button>
                                                    <button 
                                                      onClick={() => {
                                                        if (index === currentUrls.length - 1) return;
                                                        const newUrls = [...currentUrls];
                                                        [newUrls[index], newUrls[index+1]] = [newUrls[index+1], newUrls[index]];
                                                        updateUrls(newUrls);
                                                      }}
                                                      className="p-2 bg-white/5 hover:bg-white/10 rounded-lg text-white disabled:opacity-20"
                                                      disabled={index === currentUrls.length - 1}
                                                    >
                                                      <ChevronRight size={16} />
                                                    </button>
                                                  </div>
                                                  <button 
                                                    onClick={() => {
                                                      const newUrls = currentUrls.filter((_, i) => i !== index);
                                                      updateUrls(newUrls);
                                                    }}
                                                    className="p-2 bg-red-500/80 hover:bg-red-500 rounded-lg text-white shadow-lg shadow-red-500/20"
                                                  >
                                                    <Trash2 size={16} />
                                                  </button>
                                                </div>
                                                <div className="absolute top-2 left-2 bg-black/80 px-2 rounded text-[9px] font-black text-white italic tracking-tighter uppercase">{index + 1}º</div>
                                              </div>
                                            ))}
                                            {currentUrls.length === 0 && (
                                              <div className="flex-1 min-h-[192px] rounded-2xl border-2 border-dashed border-white/5 flex items-center justify-center opacity-30 italic font-bold uppercase text-[10px]">
                                                Nenhuma captura adicionada
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview do Botão de Instalação</label>
                              <div className="p-12 rounded-[2.5rem] bg-zinc-950 border border-white/5 flex flex-col items-center justify-center space-y-8 relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 left-0 right-0 h-16 flex items-center justify-center border-b border-white/5 bg-zinc-900/50 backdrop-blur-md">
                                  { (draftCustomTexts['pwa.enable_button'] !== 'false') && (
                                      <button className="flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-[10px] font-black text-primary uppercase tracking-widest italic animate-pulse">
                                        <Smartphone size={12} />
                                        {draftCustomTexts['pwa.install_app'] || settings.custom_texts?.['pwa.install_app'] || languagePresets.pt['pwa.install_app']}
                                      </button>
                                  )}
                                </div>
                                <div className="text-center space-y-4 opacity-20 mt-12 w-full">
                                   <div className="w-3/4 h-10 bg-white/10 rounded-xl mx-auto" />
                                   <div className="w-1/2 h-4 bg-white/5 rounded-full mx-auto" />
                                </div>
                              </div>
                              
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest block mt-12">Simulação de Dispositivo</label>
                              <div className="p-8 rounded-3xl border border-white/10 bg-zinc-900/30 space-y-4">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">O modal se adapta automaticamente ao detectar:</p>
                                <div className="flex gap-4">
                                  <div className="flex-1 p-3 bg-white/5 rounded-xl text-center border border-white/5">
                                    <Smartphone className="w-5 h-5 mx-auto mb-1 text-primary" />
                                    <span className="text-[9px] font-black uppercase text-white">Mobile</span>
                                  </div>
                                  <div className="flex-1 p-3 bg-white/5 rounded-xl text-center border border-white/5">
                                    <Monitor className="w-5 h-5 mx-auto mb-1 text-primary" />
                                    <span className="text-[9px] font-black uppercase text-white">Desktop</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'vendas' && (
                  <div className="space-y-6">
                    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Gerenciar Vendas</h3>
                        <p className="text-sm text-gray-500">Acompanhe as compras realizadas pelos usuários.</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                        <div className="flex-1 lg:flex-none px-4 py-2 bg-green-600/10 border border-green-500/20 rounded-xl text-green-500 font-bold text-xs text-center">
                          Total: R$ {(allPurchases.reduce((acc, sale) => acc + (sale.is_manual ? 0 : (sale.courses?.price || 0)), 0) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex-1 lg:flex-none px-4 py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl text-blue-500 font-bold text-xs text-center">
                          {allPurchases.length} Vendas
                        </div>
                      </div>
                    </div>

                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left min-w-[700px]">
                          <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                              <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Data</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Aluno</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Curso / Produto</th>
                              <th className="px-6 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {allPurchases.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                  Nenhuma venda encontrada.
                                </td>
                              </tr>
                            ) : (
                              allPurchases.map((sale) => (
                                <tr key={sale.id} className="hover:bg-white/5 transition-colors group">
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      <Clock size={14} className="text-gray-600" />
                                      <span className="text-xs text-gray-400 font-medium">
                                        {new Date(sale.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-white uppercase tracking-tighter">{sale.profiles?.full_name || 'Usuário'}</span>
                                      <span className="text-[10px] text-gray-500 font-medium lowercase italic">({sale.profiles?.email || 'N/A'})</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                      <BookOpen size={14} className="text-blue-500" />
                                      <span className="text-sm font-bold text-gray-300 uppercase tracking-tight">{sale.courses?.title || 'Produto Removido'}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className={`text-sm font-black ${sale.is_manual ? 'text-gray-500' : 'text-green-500'}`}>
                                      {sale.is_manual 
                                        ? 'R$ 0,00 (Atribuído)' 
                                        : (sale.courses?.price 
                                          ? `R$ ${(sale.courses.price / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                                          : 'R$ 0,00')}
                                    </span>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'security' && (
                  <div className="max-w-2xl space-y-8">
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Segurança do Administrador</h3>
                      <p className="text-sm text-gray-500">Altere a senha de acesso ao painel administrativo.</p>
                    </div>

                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-6">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nova Senha</label>
                          <input 
                            type="password" 
                            value={newAdminPassword}
                            onChange={e => setNewAdminPassword(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                            placeholder="Digite a nova senha..."
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Confirmar Nova Senha</label>
                          <input 
                            type="password" 
                            value={confirmAdminPassword}
                            onChange={e => setConfirmAdminPassword(e.target.value)}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                            placeholder="Confirme a nova senha..."
                          />
                        </div>
                      </div>

                      <button 
                        onClick={async () => {
                          if (newAdminPassword.length < 4) {
                            toast.error(settings.custom_texts?.['admin.security.error_length'] || 'A senha deve ter pelo menos 4 caracteres');
                            return;
                          }
                          if (newAdminPassword !== confirmAdminPassword) {
                            toast.error(settings.custom_texts?.['admin.security.error_mismatch'] || 'As senhas não coincidem');
                            return;
                          }
                          
                          setUpdatingPassword(true);
                          try {
                            const { error } = await supabase.auth.updateUser({ password: newAdminPassword });
                            if (error) throw error;
                            toast.success(settings.custom_texts?.['admin.security.success'] || 'Senha do administrador atualizada com sucesso!');
                            setNewAdminPassword('');
                            setConfirmAdminPassword('');
                          } catch (error: any) {
                            toast.error('Erro ao atualizar senha: ' + error.message);
                          } finally {
                            setUpdatingPassword(false);
                          }
                        }}
                        disabled={updatingPassword}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-3"
                      >
                        {updatingPassword ? <Loader2 className="animate-spin" size={20} /> : (
                          <>
                            <Save size={20} /> Atualizar Senha
                          </>
                        )}
                      </button>
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
          onClose={() => {
            setShowCourseEditor(false);
            setEditingCourseId(null);
            fetchData();
          }} 
        />
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
      <AnimatePresence>
        {confirmationModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
                    className="flex-1 py-4 px-6 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-2xl transition-all border border-white/5 active:scale-95"
                  >
                    {confirmationModal.cancelText || 'Cancelar'}
                  </button>
                  <button
                    onClick={() => {
                      confirmationModal.onConfirm();
                      setConfirmationModal(prev => ({ ...prev, isOpen: false }));
                    }}
                    className={`flex-1 py-4 px-6 text-white font-black rounded-2xl transition-all shadow-xl uppercase tracking-tighter active:scale-95 ${
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
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
    >
      {icon}
      {label}
    </button>
  );
}
