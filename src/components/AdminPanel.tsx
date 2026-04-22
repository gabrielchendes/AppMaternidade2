import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Product, CommunityPost } from '../lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  BookOpen, 
  MessageSquare, 
  Bell, 
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
  Phone,
  Mail,
  Home,
  User as UserIcon,
  Play,
  ArrowDown,
  ArrowRight
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

interface AdminPanelProps {
  user: User;
}

export default function AdminPanel({ user }: AdminPanelProps) {
  const { settings, refreshSettings } = useSettings();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'courses' | 'community' | 'notifications' | 'texts' | 'settings' | 'security' | 'pages' | 'vendas' | 'packages'>('packages');
  const [activePageTab, setActivePageTab] = useState<'home' | 'community' | 'profile' | 'login' | 'nav' | 'course'>('home');
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
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [firebaseStatus, setFirebaseStatus] = useState<{ initialized: boolean, hasServiceAccount: boolean } | null>(null);

  useEffect(() => {
    if (activeTab === 'notifications') {
      checkFirebaseStatus();
    }
  }, [activeTab]);

  const checkFirebaseStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const status = await safeFetch('/api/admin/firebase-status', {
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
        <img src={course.cover_url} alt={course.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
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
          const data = await safeFetch('/api/admin/users', {
            headers: { 'Authorization': `Bearer ${session?.access_token}` }
          });
          setAllUsers(data || []);
        }

        if (activeTab === 'vendas') {
          const { data: { session } } = await supabase.auth.getSession();
          console.log('🔎 Chamando API Admin Purchases');
          const data = await safeFetch('/api/admin/purchases', {
            headers: { 'Authorization': `Bearer ${session?.access_token}` }
          });
          setAllPurchases(data || []);
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

      if (error) throw error;
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
      
      const response = await safeFetch('/api/admin/toggle-access', {
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
      
      const response = await safeFetch('/api/admin/toggle-access', {
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
      const data = await safeFetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          fullName: newUserName
        })
      });

      if (!data || data.error) throw new Error(data?.error || 'Erro ao criar usuário');

      toast.success('Usuário criado com sucesso!');
      setShowUserCreator(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
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
      const data = await safeFetch(`/api/admin/users/${userId}`, {
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
      // 1. Get users to notify
      console.log('🔎 Query Supabase: profiles (select)');
      let { data: usersToNotify, error: userError } = await supabase.from('profiles').select('id');
      
      if (userError) throw userError;

      // If profiles is empty, try to fetch from auth.users via API
      if (!usersToNotify || usersToNotify.length === 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const authUsers = await safeFetch('/api/admin/users', {
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
        console.log('🔎 Query Supabase: purchases (select)');
        const { data: owners, error: ownerError } = await supabase
          .from('purchases')
          .select('user_id')
          .eq('product_id', notificationExclusionCourseId);
        
        if (ownerError) throw ownerError;
        const ownerIds = new Set(owners.map(o => o.user_id));
        finalUserIds = finalUserIds.filter(id => !ownerIds.has(id));
      }

      // 3. Send notifications
      if (notificationType === 'in_app' || notificationType === 'both') {
        const notifications = finalUserIds.map(uid => ({
          user_id: uid,
          title: notificationTitle,
          body: notificationBody,
          message: notificationBody, // Send to both columns for backward compatibility and to satisfy constraints
        }));

        console.log('🔎 Query Supabase: notifications (insert)');
        const { error: notifyError } = await supabase.from('notifications').insert(notifications);
        if (notifyError) {
          console.error('Database notification error:', notifyError);
          // If message column is missing but body exists, try again without message
          if (notifyError.message.includes('column "message" does not exist')) {
             const cleanNotifications = finalUserIds.map(uid => ({
               user_id: uid,
               title: notificationTitle,
               body: notificationBody,
             }));
             const { error: retryError } = await supabase.from('notifications').insert(cleanNotifications);
             if (retryError) throw retryError;
          } else {
            throw notifyError;
          }
        }
      }

      if (notificationType === 'push' || notificationType === 'both') {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('🔎 Chamando API Admin Send Push');
        const pushRes = await safeFetch('/api/admin/send-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token}`
          },
          body: JSON.stringify({
            title: notificationTitle,
            body: notificationBody,
            userIds: finalUserIds
          })
        });

        if (pushRes?.error) {
          console.warn('Push error:', pushRes.error);
          toast.error('O Push Falhou: ' + (pushRes.error.message || pushRes.error));
        } else if (pushRes?.messageId) {
          console.log('✅ Push sent to global topic:', pushRes.messageId);
        }
      }

      toast.success(notificationTitle ? `Notificação enviada para ${finalUserIds.length} usuários!` : 'Notificação enviada!');
      setNotificationTitle('');
      setNotificationBody('');
      setNotificationExclusionCourseId(null);
    } catch (err: any) {
      console.error('Error sending notification:', err);
      toast.error('Erro ao enviar notificação: ' + err.message);
    } finally {
      setSendingNotification(false);
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
      const data = await safeFetch('/api/admin/update-password', {
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
            label="Pacotes / Produtos" 
            active={activeTab === 'packages'} 
            onClick={() => { setActiveTab('packages'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<BookOpen size={20} />} 
            label="Cursos (Conteúdo)" 
            active={activeTab === 'courses'} 
            onClick={() => { setActiveTab('courses'); setIsMobileMenuOpen(false); }} 
          />
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Alunos / Usuários" 
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
            <h2 className="text-lg font-bold text-white capitalize truncate">{activeTab === 'texts' ? 'Personalização de Texto' : activeTab}</h2>
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
                                <th className="px-6 py-4">Usuário</th>
                                <th className="px-6 py-4">Email</th>
                                <th className="px-6 py-4">Último Acesso</th>
                                <th className="px-6 py-4">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                              {allUsers.filter(u => 
                                u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                u.user_metadata?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
                              ).map((u, i) => (
                                <tr key={i} className="hover:bg-white/5 transition-colors group">
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-xs font-bold">
                                        {u.email?.[0].toUpperCase()}
                                      </div>
                                      <span className="font-bold text-sm text-white">{u.user_metadata?.full_name || 'Sem nome'}</span>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-sm text-gray-400">{u.email}</td>
                                  <td className="px-6 py-4 text-xs text-gray-500">
                                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex gap-2">
                                      <button 
                                        onClick={() => {
                                          setSelectedUserForCourses(u);
                                          fetchUserPurchases(u.id);
                                          setView('user_details');
                                        }}
                                        className="p-2 hover:bg-white/10 rounded-lg text-blue-500 hover:text-blue-600 transition-all flex items-center gap-2 text-xs font-bold"
                                      >
                                        <Eye size={16} /> Detalhes
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
                              <p className="text-gray-500 font-medium">{selectedUserForCourses?.email}</p>
                              <div className="flex items-center gap-4 mt-2">
                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                  <Clock size={12} /> Último Acesso: {selectedUserForCourses?.last_sign_in_at ? new Date(selectedUserForCourses.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}
                                </div>
                                <div className="flex items-center gap-2 text-[10px] font-black text-gray-600 uppercase tracking-widest">
                                  <BookOpen size={12} /> {userPurchases.length} Cursos Liberados
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-12">
                            {/* Pacotes / Produtos */}
                            <div className="space-y-4">
                              <h4 className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                                Pacotes / Produtos Adquiridos 📦💎
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
                  <div className="max-w-2xl space-y-8">
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Enviar Notificação Push</h3>
                      <p className="text-sm text-gray-500">Envie avisos e promoções diretamente para o celular das alunas.</p>
                    </div>

                    {firebaseStatus && !firebaseStatus.initialized && (
                      <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 flex items-start gap-4">
                        <div className="p-2 bg-red-500 rounded-lg text-white">
                          <ShieldAlert size={20} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="font-bold text-red-500">Push Não Configurado</h4>
                          <p className="text-xs text-red-500/80 leading-relaxed font-medium">
                            O Firebase Admin não foi inicializado. Para enviar notificações push, você precisa configurar a variável de ambiente <code className="bg-red-500/20 px-1 rounded">FIREBASE_SERVICE_ACCOUNT</code> nas configurações.
                          </p>
                        </div>
                      </div>
                    )}

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
                            <input 
                              type="text" 
                              value={localSettings?.support_whatsapp || ''}
                              onChange={(e) => setLocalSettings({ ...localSettings, support_whatsapp: e.target.value })}
                              className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                              placeholder="5531997433488"
                            />
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
                            onClick={() => setActivePageTab('nav')}
                            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all shrink-0 ${activePageTab === 'nav' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                          >
                            Gerais
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
                                { key: 'auth.whatsapp_label', label: 'Label do WhatsApp' },
                                { key: 'auth.email_label', label: 'Label do E-mail Suporte' },
                                { key: 'auth.disclaimer', label: 'Disclaimer (Rodapé)', type: 'textarea' }
                              ].map(field => (
                                <div key={field.key} className="space-y-2">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">{field.label}</label>
                                  {field.type === 'textarea' ? (
                                    <textarea 
                                      value={draftCustomTexts[field.key] || settings.custom_texts?.[field.key] || ''}
                                      placeholder={field.label}
                                      onChange={(e) => setDraftCustomTexts({ ...draftCustomTexts, [field.key]: e.target.value })}
                                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-blue-500 outline-none min-h-[100px]"
                                    />
                                  ) : (
                                    <input 
                                      type="text" 
                                      value={draftCustomTexts[field.key] || settings.custom_texts?.[field.key] || ''}
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
                                    value={draftCustomTexts[field.key] || settings.custom_texts?.[field.key] || ''}
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
                                    value={draftCustomTexts[field.key] || settings.custom_texts?.[field.key] || ''}
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
                              <h4 className="font-bold text-white">Banner Rotativo</h4>
                            </div>
                            <button 
                              onClick={async () => {
                                setIsSavingSettings(true);
                                await updateSettings({ 
                                  banner_images: localSettings.banner_images,
                                  banner_interval: localSettings.banner_interval
                                });
                                setIsSavingSettings(false);
                              }}
                              disabled={isSavingSettings}
                              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20"
                            >
                              {isSavingSettings ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                              Salvar Banner
                            </button>
                          </div>

                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            <div className="space-y-6">
                              <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                  <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Imagens do Banner (URLs)</label>
                                  <button 
                                    onClick={() => {
                                      const newImages = [...(localSettings?.banner_images || []), ''];
                                      setLocalSettings({ ...localSettings, banner_images: newImages });
                                    }}
                                    className="text-xs font-bold text-blue-500 hover:text-blue-600 flex items-center gap-1"
                                  >
                                    <Plus size={14} /> Adicionar Imagem
                                  </button>
                                </div>
                                
                                <div className="space-y-3">
                                  {(localSettings?.banner_images || []).map((url: string, index: number) => (
                                    <div key={index} className="flex gap-2">
                                      <div className="flex flex-col gap-1">
                                        <button 
                                          onClick={() => {
                                            if (index === 0) return;
                                            const newImages = [...localSettings.banner_images];
                                            [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index-1]];
                                            setLocalSettings({ ...localSettings, banner_images: newImages });
                                          }}
                                          disabled={index === 0}
                                          className="p-1 text-gray-500 hover:text-white disabled:opacity-0"
                                        >
                                          <ArrowUp size={14} />
                                        </button>
                                        <button 
                                          onClick={() => {
                                            if (index === localSettings.banner_images.length - 1) return;
                                            const newImages = [...localSettings.banner_images];
                                            [newImages[index + 1], newImages[index]] = [newImages[index], newImages[index+1]];
                                            setLocalSettings({ ...localSettings, banner_images: newImages });
                                          }}
                                          disabled={index === localSettings.banner_images.length - 1}
                                          className="p-1 text-gray-500 hover:text-white disabled:opacity-0"
                                        >
                                          <ArrowDown size={14} />
                                        </button>
                                      </div>
                                      <input 
                                        type="text" 
                                        value={url}
                                        onChange={(e) => {
                                          const newImages = [...localSettings.banner_images];
                                          newImages[index] = e.target.value;
                                          setLocalSettings({ ...localSettings, banner_images: newImages });
                                        }}
                                        className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:border-blue-500 outline-none"
                                        placeholder="https://exemplo.com/imagem.jpg"
                                      />
                                      <button 
                                        onClick={() => {
                                          const newImages = localSettings.banner_images.filter((_: any, i: number) => i !== index);
                                          setLocalSettings({ ...localSettings, banner_images: newImages });
                                        }}
                                        className="p-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl transition-all"
                                      >
                                        <Trash2 size={18} />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Tempo de Rotação (ms)</label>
                                <input 
                                  type="number" 
                                  value={localSettings?.banner_interval || 5000}
                                  onChange={(e) => setLocalSettings({ ...localSettings, banner_interval: parseInt(e.target.value) || 5000 })}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                  placeholder="5000"
                                />
                              </div>
                            </div>

                            <div className="space-y-4">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview do Banner</label>
                              <div className="aspect-video rounded-2xl border border-white/10 overflow-hidden relative" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                {localSettings?.banner_images?.[0] ? (
                                  <img src={localSettings.banner_images[0]} className="w-full h-full object-cover opacity-50" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-700">
                                    <Layout size={48} />
                                  </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Visualização Prévia</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Branding Settings */}
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
                                  admin_email: localSettings.admin_email,
                                  app_name: localSettings.app_name,
                                  app_description: localSettings.app_description,
                                  login_display_type: localSettings.login_display_type,
                                  logo_url: localSettings.logo_url,
                                  favicon_url: localSettings.favicon_url,
                                  primary_color: localSettings.primary_color,
                                  secondary_color: localSettings.secondary_color,
                                  background_color: localSettings.background_color,
                                  pwa_icon_url: localSettings.favicon_url,
                                  support_email: localSettings.support_email,
                                  support_whatsapp: localSettings.support_whatsapp,
                                  support_whatsapp_message: localSettings.support_whatsapp_message
                                });
                                setIsSavingSettings(false);
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
                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Exibição no Login</label>
                                <div className="flex p-1 bg-black rounded-xl border border-white/10">
                                  <button 
                                    onClick={() => setLocalSettings({ ...localSettings, login_display_type: 'title' })}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${localSettings?.login_display_type === 'title' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                  >
                                    TÍTULO
                                  </button>
                                  <button 
                                    onClick={() => setLocalSettings({ ...localSettings, login_display_type: 'logo' })}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${localSettings?.login_display_type === 'logo' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
                                  >
                                    LOGO
                                  </button>
                                  <button 
                                    onClick={() => setLocalSettings({ ...localSettings, login_display_type: 'both' })}
                                    className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${localSettings?.login_display_type === 'both' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-white'}`}
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
                                      className={`w-10 h-10 rounded-xl border-2 transition-all ${localSettings?.primary_color === color.primary ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                      style={{ backgroundColor: color.primary }}
                                    />
                                  ))}
                                  <div className="flex items-center gap-2 ml-2 p-2 bg-black/40 rounded-xl border border-white/10">
                                    <Palette size={16} className="text-gray-500" />
                                    <input 
                                      type="color" 
                                      value={localSettings?.primary_color || '#3b82f6'}
                                      onChange={(e) => setLocalSettings({ ...localSettings, primary_color: e.target.value, secondary_color: e.target.value })}
                                      className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                                    />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">Personalizada</span>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Cor de Fundo da App</label>
                                <div className="flex flex-wrap gap-3 items-center">
                                  {[
                                    { name: 'Escuro (Original)', color: '#0f0f0f' },
                                    { name: 'Preto Total', color: '#000000' },
                                    { name: 'Cinza Escuro', color: '#1a1a1a' },
                                    { name: 'Roxo Escuro', color: '#020617' },
                                    { name: 'Azul Escuro', color: '#0f172a' },
                                    { name: 'Marsala', color: '#2d0a0a' },
                                  ].map((bg) => (
                                    <button
                                      key={bg.color}
                                      onClick={() => setLocalSettings({ ...localSettings, background_color: bg.color })}
                                      className={`w-10 h-10 rounded-xl border-2 transition-all ${localSettings?.background_color === bg.color ? 'border-white scale-110 shadow-lg' : 'border-transparent hover:scale-105'}`}
                                      style={{ backgroundColor: bg.color }}
                                      title={bg.name}
                                    />
                                  ))}
                                  <div className="flex items-center gap-2 ml-2 p-2 bg-black/40 rounded-xl border border-white/10">
                                    <Palette size={16} className="text-gray-500" />
                                    <input 
                                      type="color" 
                                      value={localSettings?.background_color || '#0f0f0f'}
                                      onChange={(e) => setLocalSettings({ ...localSettings, background_color: e.target.value })}
                                      className="w-8 h-8 rounded bg-transparent border-0 cursor-pointer"
                                    />
                                    <span className="text-[10px] font-bold text-gray-500 uppercase">Personalizada</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview do Login</label>
                              <div className="rounded-[2rem] border border-white/10 p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[300px] relative overflow-hidden" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="absolute inset-0 blur-3xl rounded-full" style={{ backgroundColor: `${localSettings?.primary_color}10` }} />
                                <div className="relative z-10">
                                  {(localSettings?.login_display_type === 'logo' || localSettings?.login_display_type === 'both') && localSettings?.logo_url ? (
                                    <img src={localSettings.logo_url} className="h-12 mx-auto mb-2 object-contain" referrerPolicy="no-referrer" />
                                  ) : null}
                                  {(localSettings?.login_display_type === 'title' || localSettings?.login_display_type === 'both') && (
                                    <h2 className="text-2xl font-black italic uppercase tracking-tighter" style={{ color: localSettings?.primary_color }}>{localSettings?.app_name || 'App Name'}</h2>
                                  )}
                                  <p className="text-xs text-gray-500 mt-2 max-w-[200px] mx-auto">{localSettings?.app_description || 'Descrição da plataforma'}</p>
                                  
                                  <div className="mt-6 w-48 h-10 bg-white/5 border border-white/10 rounded-lg flex items-center px-3 text-[10px] text-gray-600">
                                    email@exemplo.com
                                  </div>
                                  <div className="mt-2 w-48 h-10 rounded-lg flex items-center justify-center text-[10px] font-black text-white uppercase tracking-widest" style={{ backgroundColor: localSettings?.primary_color }}>
                                    Entrar
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Support Settings */}
                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-green-500/20 rounded-lg text-green-500">
                                <MessageSquare size={20} />
                              </div>
                              <h4 className="font-bold text-white">Suporte ao Cliente (Home)</h4>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">WhatsApp de Suporte (Número)</label>
                                <input 
                                  type="text" 
                                  value={localSettings?.support_whatsapp || ''}
                                  onChange={(e) => setLocalSettings({ ...localSettings, support_whatsapp: e.target.value })}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                  placeholder="+55 11 99999-9999"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Mensagem Padrão WhatsApp</label>
                                <input 
                                  type="text" 
                                  value={localSettings?.support_whatsapp_message || ''}
                                  onChange={(e) => setLocalSettings({ ...localSettings, support_whatsapp_message: e.target.value })}
                                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-blue-500 outline-none"
                                  placeholder="Olá, gostaria de tirar uma dúvida..."
                                />
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
                            </div>

                            <div className="space-y-4 p-4 bg-black/20 rounded-xl border border-white/5 h-fit">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Ativar WhatsApp</span>
                                <button 
                                  onClick={() => updateSettings({ support_whatsapp_home_enabled: !settings.support_whatsapp_home_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_whatsapp_home_enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_whatsapp_home_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Ativar E-mail</span>
                                <button 
                                  onClick={() => updateSettings({ support_email_home_enabled: !settings.support_email_home_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_email_home_enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_email_home_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">WhatsApp Flutuante</span>
                                <button 
                                  onClick={() => updateSettings({ support_whatsapp_floating_enabled: !settings.support_whatsapp_floating_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_whatsapp_floating_enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_whatsapp_floating_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
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
                                { key: 'course.lesson_completed', label: 'Alerta de Conclusão' },
                                { key: 'course.prev_lesson', label: 'Botão Aula Anterior' },
                                { key: 'course.next_lesson', label: 'Botão Próxima Aula' },
                                { key: 'course.materials', label: 'Título Materiais' }
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

                            <div className="space-y-6">
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview de Navegação de Aula</label>
                              <div className="p-8 rounded-3xl border border-white/10 flex flex-col items-center justify-center gap-6" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="w-full h-32 bg-white/5 rounded-xl flex items-center justify-center">
                                  <Play className="text-white/20" size={32} />
                                </div>
                                <div className="w-full border-t border-white/10 pt-6 flex justify-between">
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-gray-600 uppercase">
                                    <ChevronLeft size={16} /> {draftCustomTexts['course.prev_lesson'] || 'Aula Anterior'}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] font-bold text-blue-500 uppercase">
                                    {draftCustomTexts['course.next_lesson'] || 'Próxima Aula'} <ChevronRight size={16} />
                                  </div>
                                </div>
                                <div className="w-full space-y-2">
                                   <p className="text-[10px] font-black text-white italic uppercase">{draftCustomTexts['course.materials'] || 'Materiais'}</p>
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

                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/20 rounded-lg text-green-500">
                              <MessageSquare size={20} />
                            </div>
                            <h4 className="font-bold text-white">Suporte ao Cliente (Aula)</h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4 p-4 bg-black/20 rounded-xl border border-white/5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Ativar WhatsApp</span>
                                <button 
                                  onClick={() => updateSettings({ support_whatsapp_course_enabled: !settings.support_whatsapp_course_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_whatsapp_course_enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_whatsapp_course_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Ativar E-mail</span>
                                <button 
                                  onClick={() => updateSettings({ support_email_course_enabled: !settings.support_email_course_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_email_course_enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_email_course_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">WhatsApp Flutuante</span>
                                <button 
                                  onClick={() => updateSettings({ support_whatsapp_floating_course_enabled: !settings.support_whatsapp_floating_course_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_whatsapp_floating_course_enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_whatsapp_floating_course_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
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
                                { key: 'community.delete_post', label: 'Texto Excluir Post' }
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
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview da Comunidade</label>
                              <div className="rounded-3xl border border-white/10 p-8 space-y-6 text-center shadow-2xl" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="space-y-1">
                                  <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">
                                    {draftCustomTexts['community.title'] || 'Comunidade'}
                                  </h3>
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                    {draftCustomTexts['community.subtitle'] || 'Compartilhe sua jornada com outras mães'}
                                  </p>
                                </div>
                                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-3 text-gray-600 text-[10px] font-bold uppercase tracking-wider text-left">
                                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 shrink-0" />
                                  {draftCustomTexts['community.input_placeholder'] || 'O que você quer compartilhar?'}
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

                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/20 rounded-lg text-green-500">
                              <MessageSquare size={20} />
                            </div>
                            <h4 className="font-bold text-white">Suporte ao Cliente (Comunidade)</h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4 p-4 bg-black/20 rounded-xl border border-white/5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Ativar WhatsApp</span>
                                <button 
                                  onClick={() => updateSettings({ support_whatsapp_community_enabled: !settings.support_whatsapp_community_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_whatsapp_community_enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_whatsapp_community_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Ativar E-mail</span>
                                <button 
                                  onClick={() => updateSettings({ support_email_community_enabled: !settings.support_email_community_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_email_community_enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_email_community_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">WhatsApp Flutuante</span>
                                <button 
                                  onClick={() => updateSettings({ support_whatsapp_floating_community_enabled: !settings.support_whatsapp_floating_community_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_whatsapp_floating_community_enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_whatsapp_floating_community_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
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
                                { key: 'profile.change_password', label: 'Botão Alterar Senha' }
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
                              <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Preview do Perfil</label>
                              <div className="rounded-3xl border border-white/10 p-8 flex flex-col items-center shadow-2xl space-y-6" style={{ backgroundColor: localSettings?.background_color || settings.background_color || '#0f0f0f' }}>
                                <div className="w-20 h-20 rounded-full border-4 border-blue-500/20 bg-white/5 flex items-center justify-center">
                                   <UserIcon className="text-white/20" size={32} />
                                </div>
                                <div className="text-center space-y-1">
                                  <h3 className="text-lg font-black text-white uppercase tracking-tighter italic">
                                    {draftCustomTexts['profile.title'] || 'Meu Perfil'}
                                  </h3>
                                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                                    {draftCustomTexts['profile.subtitle'] || 'Gerencie suas informações'}
                                  </p>
                                </div>
                                <div className="w-full h-px bg-white/5" />
                                <div className="w-full space-y-3">
                                  <div className="h-10 bg-white/5 border border-white/10 rounded-xl" />
                                  <div className="h-10 bg-white/5 border border-white/10 rounded-xl" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-500/20 rounded-lg text-green-500">
                              <MessageSquare size={20} />
                            </div>
                            <h4 className="font-bold text-white">Suporte ao Cliente (Perfil)</h4>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4 p-4 bg-black/20 rounded-xl border border-white/5">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Ativar WhatsApp</span>
                                <button 
                                  onClick={() => updateSettings({ support_whatsapp_profile_enabled: !settings.support_whatsapp_profile_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_whatsapp_profile_enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_whatsapp_profile_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Ativar E-mail</span>
                                <button 
                                  onClick={() => updateSettings({ support_email_profile_enabled: !settings.support_email_profile_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_email_profile_enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_email_profile_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">WhatsApp Flutuante</span>
                                <button 
                                  onClick={() => updateSettings({ support_whatsapp_floating_profile_enabled: !settings.support_whatsapp_floating_profile_enabled })}
                                  className={`w-10 h-5 rounded-full transition-all relative ${settings.support_whatsapp_floating_profile_enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_whatsapp_floating_profile_enabled ? 'left-6' : 'left-1'}`} />
                                </button>
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
