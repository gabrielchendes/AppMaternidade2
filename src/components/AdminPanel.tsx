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
  ChevronRight,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Lock as LockIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';
import CourseEditor from './CourseEditor';
import CourseViewer from './CourseViewer';

interface AdminPanelProps {
  user: User;
}

export default function AdminPanel({ user }: AdminPanelProps) {
  const { settings, refreshSettings } = useSettings();
  const [activeTab, setActiveTab] = useState<'users' | 'courses' | 'community' | 'notifications' | 'texts' | 'settings' | 'security'>('users');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [courseStats, setCourseStats] = useState<Record<string, { lessons: number, materials: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  
  // Editor states
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [showCourseEditor, setShowCourseEditor] = useState(false);
  const [viewingCourseId, setViewingCourseId] = useState<string | null>(null);
  const [editingTextKey, setEditingTextKey] = useState<string | null>(null);
  const [editingTextValue, setEditingTextValue] = useState('');
  const [selectedUserForCourses, setSelectedUserForCourses] = useState<any | null>(null);
  const [userPurchases, setUserPurchases] = useState<string[]>([]);
  const [notificationExclusionCourseId, setNotificationExclusionCourseId] = useState<string | null>(null);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationBody, setNotificationBody] = useState('');
  const [sendingNotification, setSendingNotification] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [updatingPassword, setUpdatingPassword] = useState(false);

  // User management states
  const [showUserCreator, setShowUserCreator] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        const { data: { session } } = await supabase.auth.getSession();
        const response = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        });
        const data = await response.json();
        setAllUsers(data || []);
      } else if (activeTab === 'courses') {
        const [coursesRes, productsRes] = await Promise.all([
          supabase.from('courses').select('*').order('created_at', { ascending: false }),
          supabase.from('products').select('*').order('created_at', { ascending: false })
        ]);
        
        if (coursesRes.error) throw coursesRes.error;
        if (productsRes.error) throw productsRes.error;

        // Merge courses and products (legacy)
        const allCourses = [
          ...(coursesRes.data || []),
          ...(productsRes.data || []).map(p => ({
            ...p,
            tenant_id: p.tenant_id || 'default-tenant'
          }))
        ];

        // Remove duplicates by ID (preferring 'courses' table if same ID exists)
        const uniqueCourses = allCourses.reduce((acc: any[], curr) => {
          if (!acc.find(c => c.id === curr.id)) {
            acc.push(curr);
          }
          return acc;
        }, []);

        setCourses(uniqueCourses);

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
      const { error } = await supabase
        .from('app_settings')
        .update(newSettings)
        .eq('id', 1);

      if (error) throw error;
      toast.success('Configurações atualizadas!');
      refreshSettings();
    } catch (err: any) {
      console.error('Error updating settings:', err);
      toast.error('Erro ao atualizar configurações');
    }
  };

  const fetchUserPurchases = async (userId: string) => {
    try {
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
      if (isUnlocked) {
        // Remove access
        const { error } = await supabase
          .from('purchases')
          .delete()
          .eq('user_id', userId)
          .eq('product_id', courseId);
        if (error) throw error;
        setUserPurchases(prev => prev.filter(id => id !== courseId));
        toast.success('Acesso removido');
      } else {
        // Grant access
        const { error } = await supabase
          .from('purchases')
          .insert({ user_id: userId, product_id: courseId });
        if (error) throw error;
        setUserPurchases(prev => [...prev, courseId]);
        toast.success('Acesso liberado');
      }
    } catch (err: any) {
      toast.error('Erro ao alterar acesso');
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
      const response = await fetch('/api/admin/create-user', {
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

      const data = await response.json();
      if (data.error) throw new Error(data.error);

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
    if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação é irreversível.')) return;

    setDeletingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      toast.success('Usuário excluído com sucesso!');
      setSelectedUserForCourses(null);
      fetchData();
    } catch (err: any) {
      toast.error('Erro ao excluir usuário: ' + err.message);
    } finally {
      setDeletingUser(false);
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
      let query = supabase.from('profiles').select('id');
      
      const { data: usersToNotify, error: userError } = await query;
      if (userError) throw userError;

      let finalUserIds = usersToNotify.map(u => u.id);

      // 2. Filter by exclusion if needed
      if (notificationExclusionCourseId) {
        const { data: owners, error: ownerError } = await supabase
          .from('purchases')
          .select('user_id')
          .eq('product_id', notificationExclusionCourseId);
        
        if (ownerError) throw ownerError;
        const ownerIds = new Set(owners.map(o => o.user_id));
        finalUserIds = finalUserIds.filter(id => !ownerIds.has(id));
      }

      // 3. Send notifications
      const notifications = finalUserIds.map(uid => ({
        user_id: uid,
        title: notificationTitle,
        message: notificationBody,
      }));

      const { error: notifyError } = await supabase.from('notifications').insert(notifications);
      if (notifyError) throw notifyError;

      toast.success(`Notificação enviada para ${finalUserIds.length} usuários!`);
      setNotificationTitle('');
      setNotificationBody('');
      setNotificationExclusionCourseId(null);
    } catch (err: any) {
      toast.error('Erro ao enviar notificação');
    } finally {
      setSendingNotification(false);
    }
  };

  const handleUpdateAdminPassword = async () => {
    if (!newAdminPassword || newAdminPassword.length < 4) {
      toast.error('A senha deve ter pelo menos 4 caracteres');
      return;
    }

    setUpdatingPassword(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/update-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({ newPassword: newAdminPassword })
      });

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      toast.success('Senha do administrador atualizada com sucesso!');
      setNewAdminPassword('');
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
    <div className="min-h-screen bg-[#0f0f0f] flex">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-white/10 flex flex-col bg-black/40 backdrop-blur-xl">
        <div className="p-6 border-b border-white/10">
          <h1 className="text-xl font-black text-primary italic uppercase tracking-tighter">
            ADMIN<span className="text-white not-italic">PANEL</span>
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          <SidebarItem 
            icon={<Users size={20} />} 
            label="Usuários" 
            active={activeTab === 'users'} 
            onClick={() => setActiveTab('users')} 
          />
          <SidebarItem 
            icon={<BookOpen size={20} />} 
            label="Cursos" 
            active={activeTab === 'courses'} 
            onClick={() => setActiveTab('courses')} 
          />
          <SidebarItem 
            icon={<Languages size={20} />} 
            label="Textos" 
            active={activeTab === 'texts'} 
            onClick={() => setActiveTab('texts')} 
          />
          <SidebarItem 
            icon={<MessageSquare size={20} />} 
            label="Comunidade" 
            active={activeTab === 'community'} 
            onClick={() => setActiveTab('community')} 
          />
          <SidebarItem 
            icon={<Bell size={20} />} 
            label="Notificações" 
            active={activeTab === 'notifications'} 
            onClick={() => setActiveTab('notifications')} 
          />
          <SidebarItem 
            icon={<Settings size={20} />} 
            label="Configurações" 
            active={activeTab === 'settings'} 
            onClick={() => setActiveTab('settings')} 
          />
          <SidebarItem 
            icon={<LockIcon size={20} />} 
            label="Segurança" 
            active={activeTab === 'security'} 
            onClick={() => setActiveTab('security')} 
          />
        </nav>

        <div className="p-4 border-t border-white/10">
          <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
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
        <header className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black/20">
          <h2 className="text-lg font-bold text-white capitalize">{activeTab === 'texts' ? 'Personalização de Texto' : activeTab}</h2>
          
          <div className="flex items-center gap-4">
            <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">
              Painel Administrativo
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-8">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="animate-spin text-primary" size={48} />
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
                    <div className="flex justify-between items-center">
                      <div className="relative w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                        <input 
                          type="text" 
                          placeholder="Buscar usuários..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white focus:border-primary outline-none transition-all"
                        />
                      </div>
                      <button 
                        onClick={() => setShowUserCreator(true)}
                        className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
                      >
                        <Plus size={20} /> Novo Usuário
                      </button>
                    </div>

                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 overflow-hidden">
                      <table className="w-full text-left">
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
                                    }}
                                    className="p-2 hover:bg-white/10 rounded-lg text-primary hover:text-primary-hover transition-all flex items-center gap-2 text-xs font-bold"
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
                )}

                {activeTab === 'courses' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Gerenciar Cursos</h3>
                      <button 
                        onClick={() => { setEditingCourseId(null); setShowCourseEditor(true); }}
                        className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-primary/20"
                      >
                        <Plus size={20} /> Criar Curso
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {courses.map((course) => (
                        <div key={course.id} className="bg-zinc-900/50 rounded-2xl border border-white/10 overflow-hidden group hover:border-primary/50 transition-all">
                          <div className="aspect-video relative overflow-hidden">
                            <img src={course.cover_url} className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                            <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end">
                              <div className="flex gap-2">
                                {course.is_bonus && (
                                  <span className="px-2 py-1 bg-amber-500 text-white text-[10px] font-black rounded uppercase">Bônus</span>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <button 
                                  onClick={() => setViewingCourseId(course.id)}
                                  className="p-2 bg-white/10 hover:bg-white text-white hover:text-black rounded-lg backdrop-blur-md transition-all"
                                  title="Visualizar como Professor"
                                >
                                  <Eye size={16} />
                                </button>
                                <button 
                                  onClick={() => { setEditingCourseId(course.id); setShowCourseEditor(true); }}
                                  className="p-2 bg-white/10 hover:bg-white text-white hover:text-black rounded-lg backdrop-blur-md transition-all"
                                  title="Editar Curso"
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button className="p-2 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-lg backdrop-blur-md transition-all">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="p-5">
                            <h4 className="font-bold text-white mb-1">{course.title}</h4>
                            <p className="text-xs text-gray-500 line-clamp-2 mb-4">{course.description}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-primary font-black">{course.is_free ? 'GRÁTIS' : `R$ ${(course.price / 100).toFixed(2)}`}</span>
                              <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase">
                                <Layout size={12} /> {courseStats[course.id]?.lessons || 0} Aulas
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'notifications' && (
                  <div className="max-w-2xl space-y-8">
                    <div>
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Enviar Notificação Push</h3>
                      <p className="text-sm text-gray-500">Envie avisos e promoções diretamente para o celular das alunas.</p>
                    </div>

                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-6">
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Título da Notificação</label>
                        <input 
                          type="text" 
                          value={notificationTitle}
                          onChange={e => setNotificationTitle(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                          placeholder="Ex: Nova aula liberada! 🚀"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Mensagem</label>
                        <textarea 
                          value={notificationBody}
                          onChange={e => setNotificationBody(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none min-h-[100px]"
                          placeholder="Digite o conteúdo da notificação..."
                        />
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
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none text-sm"
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
                        className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-3"
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
                          <div className="p-2 bg-primary/20 rounded-lg text-primary">
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
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settings.auth_method === 'passwordless' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
                              >
                                SEM SENHA (OTP)
                              </button>
                              <button 
                                onClick={() => updateSettings({ auth_method: 'password' })}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settings.auth_method === 'password' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
                              >
                                COM SENHA
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-600 italic">O login sem senha envia um link temporário para o e-mail da aluna.</p>
                          </div>
                        </div>
                      </div>

                      {/* Support Settings */}
                      <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-6 space-y-6">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="p-2 bg-green-500/20 rounded-lg text-green-500">
                            <MessageSquare size={20} />
                          </div>
                          <h4 className="font-bold text-white">Suporte ao Cliente</h4>
                        </div>
                        
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-400">Exibir na Tela de Login</span>
                            <button 
                              onClick={() => updateSettings({ show_support_login: !settings.show_support_login })}
                              className={`w-10 h-5 rounded-full transition-all relative ${settings.show_support_login ? 'bg-primary' : 'bg-zinc-700'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.show_support_login ? 'left-6' : 'left-1'}`} />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-gray-400">Exibir Dentro do App</span>
                            <button 
                              onClick={() => updateSettings({ show_support_app: !settings.show_support_app })}
                              className={`w-10 h-5 rounded-full transition-all relative ${settings.show_support_app ? 'bg-primary' : 'bg-zinc-700'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.show_support_app ? 'left-6' : 'left-1'}`} />
                            </button>
                          </div>
                          <div className="pt-4 border-t border-white/5 space-y-4">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-400">Ativar WhatsApp</span>
                              <button 
                                onClick={() => updateSettings({ support_whatsapp_enabled: !settings.support_whatsapp_enabled })}
                                className={`w-10 h-5 rounded-full transition-all relative ${settings.support_whatsapp_enabled ? 'bg-green-500' : 'bg-zinc-700'}`}
                              >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_whatsapp_enabled ? 'left-6' : 'left-1'}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-400">Ativar E-mail</span>
                              <button 
                                onClick={() => updateSettings({ support_email_enabled: !settings.support_email_enabled })}
                                className={`w-10 h-5 rounded-full transition-all relative ${settings.support_email_enabled ? 'bg-primary' : 'bg-zinc-700'}`}
                              >
                                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${settings.support_email_enabled ? 'left-6' : 'left-1'}`} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Branding Settings */}
                    <div className="bg-zinc-900/50 rounded-2xl border border-white/10 p-8 space-y-8">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-500/20 rounded-lg text-amber-500">
                          <Layout size={20} />
                        </div>
                        <h4 className="font-bold text-white">Identidade Visual</h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Email do Administrador</label>
                          <input 
                            type="email" 
                            value={settings.admin_email}
                            onChange={(e) => updateSettings({ admin_email: e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                            placeholder="admin@exemplo.com"
                          />
                          <p className="text-[10px] text-amber-500 italic">Cuidado: Mudar este e-mail altera quem tem acesso ao painel admin.</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nome da Plataforma</label>
                          <input 
                            type="text" 
                            value={settings.app_name}
                            onChange={(e) => updateSettings({ app_name: e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Exibição no Login</label>
                          <div className="flex p-1 bg-black rounded-xl border border-white/10">
                            <button 
                              onClick={() => updateSettings({ login_display_type: 'title' })}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settings.login_display_type === 'title' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                              TÍTULO
                            </button>
                            <button 
                              onClick={() => updateSettings({ login_display_type: 'logo' })}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${settings.login_display_type === 'logo' ? 'bg-primary text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                              LOGO
                            </button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Descrição (Login)</label>
                          <input 
                            type="text" 
                            value={settings.app_description}
                            onChange={(e) => updateSettings({ app_description: e.target.value })}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'texts' && (
                  <div className="space-y-8 pb-20">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Personalização de Texto</h3>
                        <p className="text-sm text-gray-500">Altere os textos que aparecem no aplicativo.</p>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                        <input 
                          type="text" 
                          placeholder="Buscar texto..." 
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs text-white outline-none focus:border-primary transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-6">
                      {['auth', 'dashboard', 'course', 'community', 'admin', 'common'].map(group => {
                        const defaultTexts: any = {
                          'auth.welcome': 'Bem-vinda de volta!',
                          'auth.subtitle': 'Acesse sua área exclusiva para mamães',
                          'auth.login': 'Entrar',
                          'auth.email': 'E-mail',
                          'auth.password': 'Senha',
                          'community.title': 'Comunidade',
                          'community.subtitle': 'Compartilhe sua jornada com outras mães',
                          'courses.title': 'Meus Cursos',
                          'courses.subtitle': 'Continue seu aprendizado',
                          'course.next_module': 'Próximo módulo liberado',
                          'course.progress': 'Progresso',
                        };

                        const groupKeys = Object.keys(defaultTexts).filter(key => 
                          key.startsWith(group + '.') && 
                          (key.toLowerCase().includes(searchQuery.toLowerCase()) || (settings.custom_texts?.[key] || defaultTexts[key]).toLowerCase().includes(searchQuery.toLowerCase()))
                        );

                        if (groupKeys.length === 0) return null;

                        return (
                          <div key={group} className="bg-zinc-900/50 rounded-2xl border border-white/10 overflow-hidden">
                            <div className="px-6 py-4 bg-white/5 border-b border-white/10">
                              <h4 className="text-xs font-black text-primary uppercase tracking-widest">
                                {group === 'auth' ? 'Tela de Login' : 
                                 group === 'dashboard' ? 'Painel do Aluno' :
                                 group === 'course' ? 'Visualizador de Curso' :
                                 group === 'community' ? 'Comunidade' :
                                 group === 'admin' ? 'Painel Admin' : 'Geral'}
                              </h4>
                            </div>
                            
                            <div className="divide-y divide-white/5">
                              {groupKeys.map((key, i) => (
                                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors group">
                                  <div className="flex-1 min-w-0 mr-4">
                                    <p className="text-[10px] font-mono text-gray-500 mb-1">{key}</p>
                                    <p className="text-sm text-white font-medium">{settings.custom_texts?.[key] || defaultTexts[key]}</p>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      setEditingTextKey(key);
                                      setEditingTextValue(settings.custom_texts?.[key] || defaultTexts[key]);
                                    }}
                                    className="px-4 py-2 bg-white/5 hover:bg-primary text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2"
                                  >
                                    <Edit3 size={14} /> Editar
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
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
                      <div className="space-y-2">
                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Nova Senha</label>
                        <input 
                          type="password" 
                          value={newAdminPassword}
                          onChange={e => setNewAdminPassword(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                          placeholder="Digite a nova senha..."
                        />
                      </div>

                      <button 
                        onClick={handleUpdateAdminPassword}
                        disabled={updatingPassword}
                        className="w-full bg-primary hover:bg-primary-hover text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-3"
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
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none min-h-[120px]"
                  placeholder="Digite o texto personalizado..."
                  required
                />
                <p className="text-[10px] text-gray-500">Dica: Use variáveis como {'{nome_aluno}'} para textos dinâmicos.</p>
              </div>
              <button 
                type="submit"
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20"
              >
                Salvar Texto
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUserForCourses && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex justify-between items-center bg-black/20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                  {selectedUserForCourses.email?.[0].toUpperCase()}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{selectedUserForCourses.user_metadata?.full_name || 'Sem nome'}</h3>
                  <p className="text-xs text-gray-500">{selectedUserForCourses.email}</p>
                </div>
              </div>
              <button onClick={() => setSelectedUserForCourses(null)} className="text-gray-500 hover:text-white p-2 hover:bg-white/5 rounded-lg transition-all"><X size={20} /></button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <Clock size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Último Acesso</span>
                  </div>
                  <p className="text-sm font-bold text-white">
                    {selectedUserForCourses.last_sign_in_at ? new Date(selectedUserForCourses.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca'}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 text-gray-500 mb-1">
                    <BookOpen size={14} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Cursos Liberados</span>
                  </div>
                  <p className="text-sm font-bold text-white">{userPurchases.length} cursos</p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-xs font-black text-gray-500 uppercase tracking-widest">Gerenciar Acesso aos Cursos</h4>
                <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                  {courses.map(course => {
                    const isUnlocked = userPurchases.includes(course.id);
                    return (
                      <div key={course.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg overflow-hidden bg-black shrink-0">
                            <img src={course.cover_url} className="w-full h-full object-cover opacity-50" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-white truncate max-w-[200px]">{course.title}</h4>
                            <p className="text-[10px] text-gray-500 uppercase font-black">{course.is_bonus ? 'Bônus' : 'Curso'}</p>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => toggleCourseAccess(selectedUserForCourses.id, course.id, isUnlocked)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black transition-all ${
                            isUnlocked 
                              ? 'bg-green-500/10 text-green-500 hover:bg-red-500/10 hover:text-red-500 group' 
                              : 'bg-white/5 text-gray-400 hover:bg-primary/10 hover:text-primary'
                          }`}
                        >
                          {isUnlocked ? (
                            <>
                              <CheckCircle2 size={12} className="group-hover:hidden" />
                              <X size={12} className="hidden group-hover:block" />
                              <span className="group-hover:hidden uppercase">LIBERADO</span>
                              <span className="hidden group-hover:block uppercase">BLOQUEAR</span>
                            </>
                          ) : (
                            <>
                              <LockIcon size={12} />
                              <span className="uppercase">BLOQUEADO</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-black/20 flex justify-between items-center">
              <button 
                onClick={() => handleDeleteUser(selectedUserForCourses.id)}
                disabled={deletingUser}
                className="flex items-center gap-2 text-red-500 hover:text-red-400 text-xs font-bold transition-all px-4 py-2 rounded-xl hover:bg-red-500/10"
              >
                {deletingUser ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                Excluir Usuário
              </button>
              <button 
                onClick={() => setSelectedUserForCourses(null)}
                className="bg-white/5 hover:bg-white/10 text-white px-6 py-2 rounded-xl font-bold transition-all text-sm"
              >
                Fechar
              </button>
            </div>
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
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  placeholder="Nome do aluno"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black text-gray-500 uppercase tracking-widest">E-mail</label>
                <input 
                  type="email" 
                  value={newUserEmail}
                  onChange={e => setNewUserEmail(e.target.value)}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
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
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary outline-none"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button 
                type="submit"
                disabled={creatingUser}
                className="w-full bg-primary hover:bg-primary-hover text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
              >
                {creatingUser ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                Cadastrar Usuário
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all ${active ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
    >
      {icon}
      {label}
    </button>
  );
}
