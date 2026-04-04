import React, { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, supabaseAdmin, Product, CommunityPost, Notification } from '../lib/supabase';
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
  Send,
  Calendar,
  Clock,
  Shield,
  RefreshCw,
  User as UserIcon,
  Image as ImageIcon,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Info,
  Settings,
  Palette,
  Smartphone,
  Globe,
  MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useSettings } from '../contexts/SettingsContext';

interface AdminPanelProps {
  user: User;
}

export default function AdminPanel({ user }: AdminPanelProps) {
  const { refreshSettings } = useSettings();
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'courses' | 'community' | 'notifications' | 'settings'>('users');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  
  // Form states
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [priceInput, setPriceInput] = useState('');
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'both' | 'in-app' | 'push'>('both');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // App Settings states
  const [appSettings, setAppSettings] = useState<any>(null);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // New User states
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);

  // Spoof Post states
  const [spoofName, setSpoofName] = useState('');
  const [spoofAvatar, setSpoofAvatar] = useState('');
  const [spoofContent, setSpoofContent] = useState('');
  const [spoofDate, setSpoofDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [spoofTime, setSpoofTime] = useState(format(new Date(), 'HH:mm'));
  const [isSpoofing, setIsSpoofing] = useState(false);
  const [spoofAvatarFile, setSpoofAvatarFile] = useState<File | null>(null);
  const [uploadingSpoofAvatar, setUploadingSpoofAvatar] = useState(false);

  // Delete Confirmation states
  const [itemToDelete, setItemToDelete] = useState<{
    id: string;
    type: 'user' | 'course' | 'post' | 'comment';
    title: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Spoof Comment states
  const [spoofCommentPostId, setSpoofCommentPostId] = useState<string | null>(null);
  const [spoofCommentContent, setSpoofCommentContent] = useState('');
  const [isSpoofingComment, setIsSpoofingComment] = useState(false);

  useEffect(() => {
    fetchData();
  }, [activeSubTab]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeSubTab === 'users') {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Sessão não encontrada. Por favor, faça login novamente.');
        
        const response = await fetch('/api/admin/users', {
          headers: { 'Authorization': `Bearer ${session.access_token}` }
        });
        
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || `Erro ${response.status}: Falha ao buscar usuários`);
        }
        
        const adminUsers = await response.json();
        
        setAllUsers(adminUsers.map((u: any) => ({ 
          id: u.id,
          email: u.email,
          full_name: u.user_metadata?.full_name || null,
          phone: u.user_metadata?.phone || u.phone || null,
          created_at: u.created_at
        })) || []);
      } else if (activeSubTab === 'courses') {
        const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setProducts(data || []);
      } else if (activeSubTab === 'community') {
        const { data: postsData, error: postsError } = await supabase.from('community_posts').select('*').order('created_at', { ascending: false });
        if (postsError) throw postsError;
        setPosts(postsData || []);

        const { data: commentsData, error: commentsError } = await supabase.from('post_comments').select('*').order('created_at', { ascending: false });
        if (commentsError) throw commentsError;
        setComments(commentsData || []);
      } else if (activeSubTab === 'notifications') {
        // Fetch unique recent broadcasts by title and message
        const { data: notifs, error: notifError } = await supabase
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(500);
        
        if (notifError) throw notifError;
        
        // Group by title and message to show "broadcasts"
        const grouped = (notifs || []).reduce((acc: any[], curr: any) => {
          const existing = acc.find(a => a.title === curr.title && a.message === curr.message);
          if (existing) {
            existing.total++;
            if (curr.read) existing.readCount++;
            if (curr.read) existing.readers.push(curr.user_id);
          } else {
            acc.push({
              title: curr.title,
              message: curr.message,
              created_at: curr.created_at,
              total: 1,
              readCount: curr.read ? 1 : 0,
              readers: curr.read ? [curr.user_id] : []
            });
          }
          return acc;
        }, []);
        setRecentBroadcasts(grouped);
      } else if (activeSubTab === 'settings') {
        const { data, error } = await supabase.from('app_settings').select('*').eq('id', 1).single();
        if (error) throw error;
        setAppSettings(data);
      }
    } catch (err: any) {
      console.error('Error fetching admin data:', err);
      setError(err.message || 'Erro ao carregar dados do painel');
      toast.error('Erro ao carregar dados do painel');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appSettings) return;
    
    setIsSavingSettings(true);
    try {
      const { error } = await supabase
        .from('app_settings')
        .update({
          app_name: appSettings.app_name,
          app_description: appSettings.app_description,
          primary_color: appSettings.primary_color,
          secondary_color: appSettings.secondary_color,
          logo_url: appSettings.logo_url,
          favicon_url: appSettings.favicon_url,
          pwa_icon_url: appSettings.pwa_icon_url,
          support_whatsapp: appSettings.support_whatsapp,
          support_email: appSettings.support_email,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);
        
      if (error) throw error;
      toast.success('Configurações salvas com sucesso!');
      await refreshSettings();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleReauth = async () => {
    try {
      await supabase.auth.signOut();
      window.location.reload();
    } catch (err) {
      console.error('Error signing out:', err);
      window.location.reload();
    }
  };

  const handleDeleteUser = async (id: string) => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session?.access_token}` }
      });
      if (!response.ok) throw new Error('Falha ao excluir usuário');
      
      toast.success('Usuário excluído');
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir usuário');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Curso excluído');
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao excluir curso');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/community/posts/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}` 
        }
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao excluir publicação');
      }

      toast.success('Publicação excluída');
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error('Delete post error:', error);
      toast.error(error.message || 'Erro ao excluir publicação');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteComment = async (id: string) => {
    setIsDeleting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/admin/community/comments/${id}`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${session?.access_token}` 
        }
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao excluir comentário');
      }

      toast.success('Comentário excluído');
      setItemToDelete(null);
      fetchData();
    } catch (error: any) {
      console.error('Delete comment error:', error);
      toast.error(error.message || 'Erro ao excluir comentário');
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    if (!itemToDelete) return;
    switch (itemToDelete.type) {
      case 'user': handleDeleteUser(itemToDelete.id); break;
      case 'course': handleDeleteProduct(itemToDelete.id); break;
      case 'post': handleDeletePost(itemToDelete.id); break;
      case 'comment': handleDeleteComment(itemToDelete.id); break;
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword) return;
    
    setIsCreatingUser(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          full_name: newUserFullName
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erro ao criar usuário');
      }

      toast.success('Usuário criado com sucesso!');
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserFullName('');
      setShowCreateUser(false);
      fetchData();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast.error(error.message || 'Erro ao criar usuário');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handlePriceChange = (value: string) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      setPriceInput('0,00');
      return;
    }
    
    // Format as currency with comma
    const amount = parseInt(digits) / 100;
    const formatted = amount.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    setPriceInput(formatted);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct?.title) return;

    // Logic for Bonus/Free
    const priceInCents = Math.round(parseFloat(priceInput.replace('.', '').replace(',', '.')) * 100);
    const finalProduct = {
      ...editingProduct,
      price: editingProduct.is_bonus || editingProduct.is_free ? 0 : priceInCents,
      is_free: editingProduct.is_bonus ? true : editingProduct.is_free
    };

    try {
      if (isAddingProduct) {
        const { error } = await supabase.from('products').insert([finalProduct]);
        if (error) throw error;
        toast.success('Curso adicionado com sucesso');
      } else {
        const { error } = await supabase.from('products').update(finalProduct).eq('id', finalProduct.id);
        if (error) throw error;
        toast.success('Curso atualizado com sucesso');
      }
      setIsAddingProduct(false);
      setEditingProduct(null);
      fetchData();
    } catch (error: any) {
      console.error('Error saving product:', error);
      toast.error('Erro ao salvar curso');
    }
  };

  const handleUploadSpoofAvatar = async (file: File) => {
    setUploadingSpoofAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `spoof-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);
      
      setSpoofAvatar(publicUrl);
      toast.success('Foto do avatar carregada');
    } catch (error: any) {
      toast.error('Erro ao carregar foto do avatar');
    } finally {
      setUploadingSpoofAvatar(false);
    }
  };

  const handleSpoofPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spoofContent || !spoofName) return;
    setIsSpoofing(true);

    try {
      const combinedDateTime = new Date(`${spoofDate}T${spoofTime}:00`).toISOString();
      
      const { error } = await supabase.from('community_posts').insert({
        user_id: user.id, // Admin's ID but spoofed metadata
        user_email: 'spoofed@system.com',
        user_name: spoofName,
        user_avatar_url: spoofAvatar || null,
        content: spoofContent,
        created_at: combinedDateTime
      });

      if (error) throw error;
      toast.success('Mensagem importada com sucesso');
      setSpoofContent('');
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao importar mensagem');
    } finally {
      setIsSpoofing(false);
    }
  };

  const handleSpoofComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spoofCommentContent || !spoofCommentPostId || !spoofName) return;
    setIsSpoofingComment(true);

    try {
      const { error } = await supabase.from('post_comments').insert({
        post_id: spoofCommentPostId,
        user_id: user.id,
        user_name: spoofName,
        user_avatar_url: spoofAvatar || null,
        content: spoofCommentContent
      });

      if (error) throw error;
      toast.success('Comentário importado com sucesso');
      setSpoofCommentContent('');
      setSpoofCommentPostId(null);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao importar comentário');
    } finally {
      setIsSpoofingComment(false);
    }
  };

  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastTitle || !broadcastMessage || sendingBroadcast) return;
    console.log('AdminPanel: handleSendBroadcast called');
    setSendingBroadcast(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/admin/broadcast', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}` 
        },
        body: JSON.stringify({
          title: broadcastTitle,
          message: broadcastMessage,
          type: broadcastType
        })
      });

      if (!response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const err = await response.json();
          throw new Error(err.error || 'Erro ao enviar broadcast');
        } else {
          const text = await response.text();
          console.error('Server error (HTML/Text):', text);
          // If it's a long HTML, just show the first part
          const shortText = text.length > 100 ? text.substring(0, 100) + '...' : text;
          throw new Error(`Erro no servidor (500): ${shortText}`);
        }
      }

      const result = await response.json();
      console.log('Broadcast push results:', result.pushResults);
      
      if (result.pushResults && result.pushResults.length > 0) {
        const errors = result.pushResults.filter((r: any) => r.error);
        if (errors.length > 0) {
          console.warn('Some push notifications failed:', errors);
          toast.warning(`${result.count} notificações internas enviadas, mas houve falhas no Push. Verifique o console.`);
        } else {
          toast.success(`Broadcast enviado para ${result.count} usuários! 🚀`);
        }
      } else {
        toast.success(`Broadcast enviado para ${result.count} usuários! 🚀`);
      }
      
      setBroadcastTitle('');
      setBroadcastMessage('');
      fetchData();
    } catch (error: any) {
      console.error('Broadcast error details:', error);
      toast.error(error.message || 'Erro ao enviar broadcast');
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-pink-500 uppercase tracking-tighter">Painel Administrativo</h1>
          <p className="text-gray-400 text-sm">Gerencie usuários, cursos e notificações</p>
        </div>
        <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/5">
          <button 
            onClick={() => setActiveSubTab('users')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'users' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Users size={18} /> Usuários
          </button>
          <button 
            onClick={() => setActiveSubTab('courses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'courses' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <BookOpen size={18} /> Cursos
          </button>
          <button 
            onClick={() => setActiveSubTab('community')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'community' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <MessageSquare size={18} /> Comunidade
          </button>
          <button 
            onClick={() => setActiveSubTab('notifications')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'notifications' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Bell size={18} /> Notificações
          </button>
          <button 
            onClick={() => setActiveSubTab('settings')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeSubTab === 'settings' ? 'bg-pink-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
          >
            <Settings size={18} /> Configurações
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="animate-spin text-pink-500" size={48} />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-6">
            <AlertCircle size={32} />
          </div>
          <h3 className="text-xl font-bold mb-2">Erro de Acesso</h3>
          <p className="text-gray-400 max-w-md mb-8">
            {error}
          </p>
          <div className="flex gap-4">
            <button 
              onClick={fetchData}
              className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
            >
              Tentar Novamente
            </button>
            <button 
              onClick={handleReauth}
              className="px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold transition-all"
            >
              Sair e Entrar Novamente
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {activeSubTab === 'users' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => setShowCreateUser(!showCreateUser)}
                  className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                >
                  <Plus size={20} /> {showCreateUser ? 'Cancelar' : 'Criar Novo Usuário'}
                </button>
              </div>

              {showCreateUser && (
                <div className="bg-zinc-900 p-6 rounded-2xl border border-white/20 shadow-2xl animate-in fade-in slide-in-from-top-4">
                  <h3 className="text-xl font-bold mb-6">Cadastrar Aluna Manualmente</h3>
                  <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Nome Completo</label>
                      <input 
                        type="text" 
                        value={newUserFullName} 
                        onChange={e => setNewUserFullName(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-pink-500 outline-none"
                        placeholder="Nome da aluna"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">E-mail</label>
                      <input 
                        type="email" 
                        value={newUserEmail} 
                        onChange={e => setNewUserEmail(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-pink-500 outline-none"
                        placeholder="email@exemplo.com"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Senha Temporária</label>
                      <input 
                        type="text" 
                        value={newUserPassword} 
                        onChange={e => setNewUserPassword(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-pink-500 outline-none"
                        placeholder="Senha inicial"
                        required
                      />
                    </div>
                    <div className="md:col-span-3 pt-2">
                      <button 
                        type="submit" 
                        disabled={isCreatingUser}
                        className="w-full bg-pink-600 hover:bg-pink-700 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {isCreatingUser ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        CRIAR CONTA
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 font-bold">Usuário</th>
                    <th className="px-6 py-4 font-bold">Email</th>
                    <th className="px-6 py-4 font-bold">Telefone</th>
                    <th className="px-6 py-4 font-bold">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {allUsers.map((u, i) => (
                    <tr key={i} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-medium">{u.full_name || 'Sem nome'}</td>
                      <td className="px-6 py-4 text-gray-400">{u.email}</td>
                      <td className="px-6 py-4 text-gray-400">{u.phone || 'N/A'}</td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => setItemToDelete({ id: u.id, type: 'user', title: u.full_name || u.email })}
                          className="text-red-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeSubTab === 'courses' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button 
                  onClick={() => { setIsAddingProduct(true); setEditingProduct({ price: 9700, is_active: true }); }}
                  className="flex items-center gap-2 bg-pink-600 hover:bg-pink-700 text-white px-6 py-3 rounded-xl font-bold transition-all active:scale-95 shadow-lg"
                >
                  <Plus size={20} /> Novo Curso
                </button>
              </div>

              {editingProduct && (
                <div className="bg-zinc-900 p-6 rounded-2xl border border-pink-500/30 shadow-2xl animate-in fade-in slide-in-from-top-4">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold">{isAddingProduct ? 'Adicionar Novo Curso' : 'Editar Curso'}</h3>
                    <button onClick={() => { setEditingProduct(null); setPriceInput(''); }} className="text-gray-400 hover:text-white"><X size={24} /></button>
                  </div>
                  <form onSubmit={handleSaveProduct} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Título</label>
                      <input 
                        type="text" 
                        value={editingProduct.title || ''} 
                        onChange={e => setEditingProduct({...editingProduct, title: e.target.value})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-pink-500 outline-none"
                        required
                      />
                    </div>
                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editingProduct.is_bonus} 
                          onChange={e => setEditingProduct({...editingProduct, is_bonus: e.target.checked, is_free: e.target.checked ? true : editingProduct.is_free})}
                          className="w-5 h-5 rounded border-white/10 bg-black text-pink-600 focus:ring-pink-500"
                        />
                        <span className="text-sm font-bold">É Bônus?</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={editingProduct.is_free || editingProduct.is_bonus} 
                          disabled={editingProduct.is_bonus}
                          onChange={e => setEditingProduct({...editingProduct, is_free: e.target.checked})}
                          className="w-5 h-5 rounded border-white/10 bg-black text-pink-600 focus:ring-pink-500 disabled:opacity-50"
                        />
                        <span className="text-sm font-bold">É Grátis?</span>
                      </label>
                    </div>
                    
                    {!editingProduct.is_bonus && !editingProduct.is_free && (
                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase">Preço (Ex: 87,00)</label>
                        <input 
                          type="text" 
                          value={priceInput} 
                          onChange={e => handlePriceChange(e.target.value)}
                          placeholder="0,00"
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-pink-500 outline-none"
                          required
                        />
                      </div>
                    )}

                    <div className="space-y-2 md:col-span-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">Descrição</label>
                      <textarea 
                        value={editingProduct.description || ''} 
                        onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-pink-500 outline-none min-h-[100px]"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">URL da Capa (Imagem)</label>
                      <input 
                        type="text" 
                        value={editingProduct.cover_url || ''} 
                        onChange={e => setEditingProduct({...editingProduct, cover_url: e.target.value})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-pink-500 outline-none"
                        placeholder="https://exemplo.com/imagem.jpg"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-bold text-gray-400 uppercase">URL do Conteúdo (PDF)</label>
                      <input 
                        type="text" 
                        value={editingProduct.pdf_url || ''} 
                        onChange={e => setEditingProduct({...editingProduct, pdf_url: e.target.value})}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none"
                        placeholder="https://exemplo.com/arquivo.pdf"
                      />
                    </div>

                    <div className="md:col-span-2 pt-4">
                      <button type="submit" className="w-full bg-primary-hover hover:bg-primary-hover text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                        <Save size={20} /> Salvar Curso
                      </button>
                    </div>
                  </form>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {products.map(product => (
                  <div 
                    key={product.id} 
                    onClick={() => { 
                      setEditingProduct(product); 
                      setPriceInput((product.price / 100).toFixed(2).replace('.', ','));
                      setIsAddingProduct(false); 
                    }}
                    className="bg-zinc-900 p-4 rounded-2xl border border-white/10 flex items-center justify-between group cursor-pointer hover:border-primary/50 transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <img src={product.cover_url} className="w-16 h-16 rounded-lg object-cover" alt="" />
                      <div>
                        <h4 className="font-bold">{product.title}</h4>
                        <p className="text-xs text-gray-500">
                          {product.is_free ? 'Grátis' : `R$ ${(product.price / 100).toFixed(2)}`} • {product.is_bonus ? 'Bônus' : 'Curso'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setItemToDelete({ id: product.id, type: 'course', title: product.title });
                        }}
                        className="p-2 hover:bg-red-500/20 rounded-lg text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSubTab === 'community' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Spoof/Import Section */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-zinc-900 p-6 rounded-2xl border border-white/10 shadow-xl">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <ImageIcon size={20} className="text-pink-500" /> Importar Mensagem
                  </h3>
                  <form onSubmit={handleSpoofPost} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Nome do Usuário</label>
                      <input 
                        type="text" 
                        value={spoofName} 
                        onChange={e => setSpoofName(e.target.value)}
                        placeholder="Ex: Maria Silva"
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Foto do Avatar</label>
                      <div className="flex items-center gap-4">
                        {spoofAvatar && <img src={spoofAvatar} className="w-10 h-10 rounded-full object-cover" alt="" />}
                        <button 
                          type="button"
                          onClick={() => document.getElementById('spoof-avatar-upload')?.click()}
                          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold py-2 rounded-lg border border-white/5 transition-all"
                        >
                          {uploadingSpoofAvatar ? 'Enviando...' : 'Adicionar Foto'}
                        </button>
                        <input 
                          id="spoof-avatar-upload"
                          type="file" 
                          accept="image/*"
                          onChange={e => e.target.files?.[0] && handleUploadSpoofAvatar(e.target.files[0])}
                          className="hidden" 
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Data</label>
                        <input 
                          type="date" 
                          value={spoofDate} 
                          onChange={e => setSpoofDate(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase">Hora</label>
                        <input 
                          type="time" 
                          value={spoofTime} 
                          onChange={e => setSpoofTime(e.target.value)}
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-gray-500 uppercase">Conteúdo</label>
                      <textarea 
                        value={spoofContent} 
                        onChange={e => setSpoofContent(e.target.value)}
                        placeholder="Escreva a mensagem aqui..."
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500 min-h-[100px]"
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      disabled={isSpoofing}
                      className="w-full bg-primary-hover hover:bg-primary-hover text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                    >
                      {isSpoofing ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                      Importar Mensagem
                    </button>
                  </form>
                </div>

                {spoofCommentPostId && (
                  <div className="bg-zinc-900 p-6 rounded-2xl border border-primary/30 shadow-xl animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold">Responder como {spoofName || '...'}</h3>
                      <button onClick={() => setSpoofCommentPostId(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
                    </div>
                    <form onSubmit={handleSpoofComment} className="space-y-4">
                      <textarea 
                        value={spoofCommentContent} 
                        onChange={e => setSpoofCommentContent(e.target.value)}
                        placeholder="Escreva o comentário..."
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-pink-500 min-h-[80px]"
                        required
                      />
                      <button 
                        type="submit" 
                        disabled={isSpoofingComment}
                        className="w-full bg-white text-black py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-2"
                      >
                        {isSpoofingComment ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                        Enviar Comentário
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Recent Posts List */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-bold">Moderação da Comunidade</h3>
                <div className="space-y-6">
                  {posts.map(post => (
                    <div key={post.id} className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden">
                      <div className="p-4 flex items-start justify-between bg-white/5">
                        <div className="flex gap-3">
                          <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                            {post.user_avatar_url ? <img src={post.user_avatar_url} className="w-full h-full object-cover" alt="" /> : <UserIcon className="m-2 text-gray-600" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{post.user_name}</span>
                              <span className="text-[10px] text-gray-500">{format(new Date(post.created_at), 'dd/MM HH:mm')}</span>
                            </div>
                            <p className="text-sm text-gray-300 mt-1">{post.content}</p>
                            {post.image_url && (
                              <img src={post.image_url} className="mt-3 rounded-lg max-h-48 object-cover border border-white/10" alt="" />
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setSpoofCommentPostId(post.id)}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                            title="Responder como spoof"
                          >
                            <MessageSquare size={18} />
                          </button>
                          <button 
                            onClick={() => setItemToDelete({ id: post.id, type: 'post', title: post.user_name || 'Publicação' })}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                            title="Excluir Post"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Comments for this post */}
                      <div className="bg-black/20 px-4 py-2 divide-y divide-white/5">
                        {comments.filter(c => c.post_id === post.id).map(comment => (
                          <div key={comment.id} className="py-3 flex items-start justify-between group">
                            <div className="flex gap-2">
                              <div className="w-6 h-6 rounded-full bg-zinc-800 overflow-hidden shrink-0">
                                {comment.user_avatar_url ? <img src={comment.user_avatar_url} className="w-full h-full object-cover" alt="" /> : <UserIcon className="m-1 text-gray-600" size={16} />}
                              </div>
                              <div>
                                <span className="text-xs font-bold text-primary">{comment.user_name}</span>
                                <p className="text-xs text-gray-400">{comment.content}</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setItemToDelete({ id: comment.id, type: 'comment', title: 'Comentário' })}
                              className="p-1 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'settings' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-zinc-900 rounded-3xl border border-white/10 p-8">
                    <h3 className="text-xl font-bold flex items-center gap-2 mb-8">
                      <Globe size={20} className="text-primary" /> Identidade Visual
                    </h3>
                    
                    <form onSubmit={saveSettings} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Nome do Aplicativo</label>
                          <input 
                            type="text" 
                            value={appSettings?.app_name || ''} 
                            onChange={e => setAppSettings({...appSettings, app_name: e.target.value})}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none"
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Descrição Curta</label>
                          <input 
                            type="text" 
                            value={appSettings?.app_description || ''} 
                            onChange={e => setAppSettings({...appSettings, app_description: e.target.value})}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Palette size={14} /> Cor Primária (Botões/Destaques)
                          </label>
                          <div className="flex gap-3">
                            <input 
                              type="color" 
                              value={appSettings?.primary_color || '#ec4899'} 
                              onChange={e => setAppSettings({...appSettings, primary_color: e.target.value})}
                              className="w-12 h-12 bg-transparent border-none cursor-pointer"
                            />
                            <input 
                              type="text" 
                              value={appSettings?.primary_color || ''} 
                              onChange={e => setAppSettings({...appSettings, primary_color: e.target.value})}
                              className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none font-mono"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Palette size={14} /> Cor Secundária (Hover)
                          </label>
                          <div className="flex gap-3">
                            <input 
                              type="color" 
                              value={appSettings?.secondary_color || '#be185d'} 
                              onChange={e => setAppSettings({...appSettings, secondary_color: e.target.value})}
                              className="w-12 h-12 bg-transparent border-none cursor-pointer"
                            />
                            <input 
                              type="text" 
                              value={appSettings?.secondary_color || ''} 
                              onChange={e => setAppSettings({...appSettings, secondary_color: e.target.value})}
                              className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none font-mono"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                          <ImageIcon size={14} /> URL do Logo (PNG/SVG)
                        </label>
                        <input 
                          type="url" 
                          value={appSettings?.logo_url || ''} 
                          onChange={e => setAppSettings({...appSettings, logo_url: e.target.value})}
                          placeholder="https://exemplo.com/logo.png"
                          className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Smartphone size={14} /> Favicon URL
                          </label>
                          <input 
                            type="url" 
                            value={appSettings?.favicon_url || ''} 
                            onChange={e => setAppSettings({...appSettings, favicon_url: e.target.value})}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                            <Smartphone size={14} /> App Icon (PWA/Home Screen)
                          </label>
                          <input 
                            type="url" 
                            value={appSettings?.pwa_icon_url || ''} 
                            onChange={e => setAppSettings({...appSettings, pwa_icon_url: e.target.value})}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none"
                          />
                        </div>
                      </div>

                      <h3 className="text-xl font-bold flex items-center gap-2 pt-8 mb-4 border-t border-white/5">
                        <MessageCircle size={20} className="text-primary" /> Suporte e Contato
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">WhatsApp de Suporte</label>
                          <input 
                            type="text" 
                            value={appSettings?.support_whatsapp || ''} 
                            onChange={e => setAppSettings({...appSettings, support_whatsapp: e.target.value})}
                            placeholder="Ex: 5531997433488"
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">E-mail de Suporte</label>
                          <input 
                            type="email" 
                            value={appSettings?.support_email || ''} 
                            onChange={e => setAppSettings({...appSettings, support_email: e.target.value})}
                            className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:border-primary outline-none"
                          />
                        </div>
                      </div>

                      <button 
                        type="submit" 
                        disabled={isSavingSettings}
                        className="w-full bg-primary-hover hover:bg-primary-hover text-white py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 mt-8"
                      >
                        {isSavingSettings ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                        Salvar Configurações
                      </button>
                    </form>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-zinc-900 rounded-3xl border border-white/10 p-8 h-fit sticky top-8">
                    <h3 className="text-lg font-bold mb-4">Prévia do Tema</h3>
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-black border border-white/5 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: appSettings?.primary_color }}>
                          <Smartphone size={20} className="text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-bold" style={{ color: appSettings?.primary_color }}>Botão Primário</div>
                          <div className="text-[10px] text-gray-500 uppercase tracking-widest">Exemplo de cor</div>
                        </div>
                      </div>
                      
                      <button className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all" style={{ backgroundColor: appSettings?.primary_color }}>
                        Botão de Exemplo
                      </button>
                      
                      <div className="pt-4 border-t border-white/5">
                        <p className="text-xs text-gray-400 leading-relaxed">
                          As cores e logos serão aplicadas em todo o aplicativo assim que você salvar.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'notifications' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-zinc-900 p-8 rounded-3xl border border-white/10 shadow-2xl h-fit">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
                    <Bell size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Enviar Promoção (Broadcast)</h3>
                    <p className="text-sm text-gray-400">Envie para todos os usuários.</p>
                  </div>
                </div>

                <form onSubmit={handleSendBroadcast} className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tipo de Notificação</label>
                    <div className="grid grid-cols-3 gap-2">
                      <button 
                        type="button"
                        onClick={() => setBroadcastType('both')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${broadcastType === 'both' ? 'bg-primary-hover border-primary text-white' : 'bg-black border-white/10 text-gray-400'}`}
                      >
                        Ambos
                      </button>
                      <button 
                        type="button"
                        onClick={() => setBroadcastType('in-app')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${broadcastType === 'in-app' ? 'bg-primary-hover border-primary text-white' : 'bg-black border-white/10 text-gray-400'}`}
                      >
                        No App
                      </button>
                      <button 
                        type="button"
                        onClick={() => setBroadcastType('push')}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${broadcastType === 'push' ? 'bg-primary-hover border-primary text-white' : 'bg-black border-white/10 text-gray-400'}`}
                      >
                        Push
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Título</label>
                    <input 
                      type="text" 
                      value={broadcastTitle} 
                      onChange={e => setBroadcastTitle(e.target.value)}
                      placeholder="Ex: Oferta Imperdível! 🚀"
                      className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-primary outline-none text-lg font-medium"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Mensagem</label>
                    <textarea 
                      value={broadcastMessage} 
                      onChange={e => setBroadcastMessage(e.target.value)}
                      placeholder="Escreva o conteúdo aqui..."
                      className="w-full bg-black border border-white/10 rounded-2xl px-6 py-4 focus:border-primary outline-none min-h-[150px] text-gray-300"
                      required
                    />
                  </div>
                  <button 
                    type="submit" 
                    disabled={sendingBroadcast}
                    className="w-full bg-primary-hover hover:bg-primary-hover text-white py-5 rounded-2xl font-black text-lg uppercase tracking-tighter flex items-center justify-center gap-3 transition-all active:scale-[0.98] shadow-xl disabled:opacity-50"
                  >
                    {sendingBroadcast ? (
                      <Loader2 className="animate-spin" size={24} />
                    ) : (
                      <>
                        <Send size={24} /> Enviar para Todos
                      </>
                    )}
                  </button>
                </form>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Clock size={20} className="text-primary" /> Histórico de Broadcasts
                </h3>
                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {recentBroadcasts.length === 0 ? (
                    <div className="bg-zinc-900 p-8 rounded-3xl border border-white/5 text-center text-gray-500">
                      Nenhum broadcast enviado recentemente.
                    </div>
                  ) : (
                    recentBroadcasts.map((b, i) => (
                      <div key={i} className="bg-zinc-900 p-6 rounded-3xl border border-white/10 space-y-3">
                        <div className="flex justify-between items-start">
                          <h4 className="font-bold text-primary">{b.title}</h4>
                          <span className="text-[10px] text-gray-500">{format(new Date(b.created_at), 'dd/MM HH:mm')}</span>
                        </div>
                        <p className="text-sm text-gray-400 line-clamp-2">{b.message}</p>
                        <div className="pt-2 flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-green-500"></div>
                            <span className="text-xs font-bold text-gray-300">{b.readCount} lidas</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
                            <span className="text-xs font-bold text-gray-500">{b.total} total</span>
                          </div>
                          <div className="ml-auto text-[10px] font-bold text-primary/50 uppercase">
                            {Math.round((b.readCount / b.total) * 100)}% engajamento
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
          )}
        </div>
      )}
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {itemToDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[600] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl text-center"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-6 mx-auto">
                <Trash2 size={32} />
              </div>
              <h3 className="text-2xl font-bold mb-2">Excluir {itemToDelete.type === 'user' ? 'Usuário' : itemToDelete.type === 'course' ? 'Curso' : 'Item'}?</h3>
              <p className="text-gray-400 text-sm mb-8">
                Tem certeza que deseja excluir <strong>"{itemToDelete.title}"</strong>? Esta ação é permanente e não pode ser desfeita.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => setItemToDelete(null)}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? <Loader2 className="animate-spin" size={18} /> : 'Excluir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
