import React, { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, CommunityPost, PostComment } from '../lib/supabase';
import { Send, User as UserIcon, Trash2, Loader2, Heart, MessageCircle, Image as ImageIcon, X, CornerUpRight, Edit3, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow, subDays, isAfter, formatRelative } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';
import { useSettings } from '../contexts/SettingsContext';
import { useI18n } from '../contexts/I18nContext';

interface CommunityProps {
  user: User;
  isImportMode?: boolean;
}

export default function Community({ user, isImportMode = false }: CommunityProps) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [likedPosts, setLikedPosts] = useState<string[]>([]);
  const [expandedComments, setExpandedComments] = useState<string[]>([]);
  const [comments, setComments] = useState<Record<string, PostComment[]>>({});
  const [newComment, setNewComment] = useState<Record<string, string>>({});
  const [replyingTo, setReplyingTo] = useState<CommunityPost | null>(null);
  
  const [selectedPostImage, setSelectedPostImage] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<{ id: string; imageUrl?: string } | null>(null);
  
  // Admin features
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);
  const [editContent, setEditContent] = useState('');
  const [adminMode, setAdminMode] = useState(isImportMode);
  const [personaActive, setPersonaActive] = useState(false);
  const [manualAuthorName, setManualAuthorName] = useState('');
  const [manualAvatarUrl, setManualAvatarUrl] = useState('');
  const [manualAvatarFile, setManualAvatarFile] = useState<File | null>(null);
  const [manualAvatarPreview, setManualAvatarPreview] = useState<string | null>(null);
  const [commentToDelete, setCommentToDelete] = useState<{ id: string; postId: string } | null>(null);

  const isAdmin = user.email?.toLowerCase() === settings?.admin_email?.toLowerCase() || user.email?.toLowerCase() === 'gabrielchendes@gmail.com';
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const manualAvatarInputRef = useRef<HTMLInputElement>(null);

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const localeCode = t('community.locale') || 'ptBR';
      const locales: Record<string, any> = { ptBR, enUS, es };
      const locale = locales[localeCode] || ptBR;

      // Facebook-like behavior: relative or absolute based on distance
      // If within 1 week, use formatRelative which gives "Today at...", "Yesterday at...", "Last Friday at..."
      if (isAfter(date, subDays(new Date(), 6))) {
        const relative = formatRelative(date, new Date(), { locale });
        // Capitalize first letter
        return relative.charAt(0).toUpperCase() + relative.slice(1);
      }

      // Older than a week, use the custom format
      const formatStr = t('community.date_format');
      return format(date, formatStr, { locale });
    } catch (e) {
      return dateString;
    }
  };
  const inputAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPosts();
    fetchUserLikes();

    const channelId = Math.random().toString(36).substring(2, 9);
    const channel = supabase
      .channel(`community_changes_${channelId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts' },
        () => fetchPosts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes' },
        () => {
          fetchPosts(); // Update counts
          fetchUserLikes(); // Update user's liked status (handles multi-device sync)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        (payload: any) => {
          const postId = payload.new?.post_id || payload.old?.post_id;
          if (postId) {
            fetchComments(postId);
            fetchPosts(); // Update comments_count
          }
        }
      )
      .subscribe();

    // Polling fallback every 30 seconds for better reliability
    const interval = setInterval(fetchPosts, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const fetchPosts = async () => {
    try {
      console.log('🔎 Query Supabase: community_posts (select)');
      const { data, error } = await supabase
        .from('community_posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error: any) {
      console.error('Error fetching posts:', error);
      toast.error('Erro ao carregar posts');
    } finally {
      setLoading(false);
    }
  };

  const fetchUserLikes = async () => {
    try {
      console.log('🔎 Query Supabase: post_likes (select)');
      const { data, error } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id);

      if (error) throw error;
      setLikedPosts(data?.map(l => l.post_id) || []);
    } catch (error) {
      console.error('Error fetching likes:', error);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      console.log('🔎 Query Supabase: post_comments (select)');
      const { data, error } = await supabase
        .from('post_comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(prev => ({ ...prev, [postId]: data || [] }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeletePost = async () => {
    if (!postToDelete) return;
    const { id: postId, imageUrl } = postToDelete;

    try {
      // Delete image from storage if exists
      if (imageUrl) {
        const fileName = imageUrl.split('/').pop();
        if (fileName) {
          await supabase.storage.from('community_images').remove([`posts/${fileName}`]);
        }
      }

      const { error } = await supabase.from('community_posts').delete().eq('id', postId);
      if (error) throw error;

      setPosts(prev => prev.filter(p => p.id !== postId));
      toast.success(t('community.delete_success'));
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error(t('community.delete_error') || 'Erro ao excluir publicação');
    } finally {
      setPostToDelete(null);
    }
  };

  const handleManualAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setManualAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setManualAvatarPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadManualAvatar = async (): Promise<string> => {
    if (!manualAvatarFile) return manualAvatarUrl;
    
    try {
      const options = {
        maxSizeMB: 0.05,
        maxWidthOrHeight: 400,
        useWebWorker: true,
      };
      const compressedFile = await imageCompression(manualAvatarFile, options);
      
      const fileExt = manualAvatarFile.name.split('.').pop();
      const fileName = `avatar-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('community_images')
        .upload(filePath, compressedFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('community_images')
        .getPublicUrl(filePath);
      
      return publicUrl;
    } catch (error) {
      console.error('Error uploading manual avatar:', error);
      return manualAvatarUrl;
    }
  };

  const handleDeleteComment = async () => {
    if (!commentToDelete) return;
    const { id: commentId, postId } = commentToDelete;

    try {
      const { error } = await supabase.from('post_comments').delete().eq('id', commentId);
      if (error) throw error;

      setComments(prev => ({
        ...prev,
        [postId]: prev[postId].filter(c => c.id !== commentId)
      }));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: Math.max(0, p.comments_count - 1) } : p));
      toast.success(t('community.comment_delete_success'));
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error(t('community.comment_delete_error') || 'Erro ao excluir comentário');
    } finally {
      setCommentToDelete(null);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newPostContent.trim();
    if ((!content && !selectedImage) || sending) return;

    setSending(true);
    let imageUrl = '';
    let finalAvatarUrl = manualAvatarUrl;

    try {
      if (adminMode && manualAvatarFile) {
        finalAvatarUrl = await uploadManualAvatar();
      }

      if (selectedImage) {
        // Slightly better quality for posts (target ~100KB)
        const options = {
          maxSizeMB: 0.1,
          maxWidthOrHeight: 1200,
          useWebWorker: true,
        };
        const compressedFile = await imageCompression(selectedImage, options);
        
        const fileExt = selectedImage.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `posts/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('community_images')
          .upload(filePath, compressedFile);

        if (uploadError) {
          console.error('Upload error details:', uploadError);
          // Generic error for users
          throw new Error('Não foi possível enviar a foto. Verifique sua conexão ou tente novamente mais tarde.');
        }

        const { data: { publicUrl } } = supabase.storage
          .from('community_images')
          .getPublicUrl(filePath);
        
        imageUrl = publicUrl;
      }

      console.log('🔎 Query Supabase: community_posts (insert)');
      const { data: newPost, error } = await supabase.from('community_posts').insert({
        user_id: user.id,
        user_email: user.email,
        user_name: (adminMode && personaActive) ? manualAuthorName : (user.user_metadata?.full_name || user.email?.split('@')[0]),
        user_avatar_url: (adminMode && personaActive) ? finalAvatarUrl : (user.user_metadata?.avatar_url || null),
        content: content,
        image_url: imageUrl || null,
        reply_to_id: replyingTo?.id || null,
        reply_to_content: replyingTo?.content || null,
        reply_to_user_name: replyingTo?.user_name || null,
      }).select().single();

      if (error) throw error;

      if (newPost) {
        setPosts(prev => [newPost as CommunityPost, ...prev]);
      }

      setNewPostContent('');
      setSelectedImage(null);
      setImagePreview(null);
      setReplyingTo(null);
      // Don't reset manual name/avatar if in admin mode to allow multiple posts as same person
      toast.success(t('community.post_sent'));
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Erro ao enviar post');
    } finally {
      setSending(false);
    }
  };

  const handleUpdatePost = async () => {
    if (!editingPost || !editContent.trim()) return;
    try {
      console.log('🔎 Query Supabase: community_posts (update)');
      const { error } = await supabase
        .from('community_posts')
        .update({ content: editContent })
        .eq('id', editingPost.id);
      if (error) throw error;
      setPosts(prev => prev.map(p => p.id === editingPost.id ? { ...p, content: editContent } : p));
      setEditingPost(null);
      toast.success(t('community.post_updated'));
    } catch (error) {
      toast.error(t('community.update_error') || 'Erro ao atualizar post');
    }
  };

  const handleLike = async (postId: string) => {
    const isLiked = likedPosts.includes(postId);
    
    // Optimistic update
    if (isLiked) {
      setLikedPosts(prev => prev.filter(id => id !== postId));
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: Math.max(0, p.likes_count - 1) } : p));
    } else {
      setLikedPosts(prev => [...prev, postId]);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: p.likes_count + 1 } : p));
    }

    try {
      if (isLiked) {
        console.log('🔎 Query Supabase: post_likes (delete)');
        await supabase.from('post_likes').delete().match({ user_id: user.id, post_id: postId });
      } else {
        console.log('🔎 Query Supabase: post_likes (insert)');
        await supabase.from('post_likes').insert({ user_id: user.id, post_id: postId });
      }
      // Realtime listener will sync counts globally
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert on error
      fetchPosts();
      fetchUserLikes();
    }
  };

  const handleAddComment = async (postId: string) => {
    const content = newComment[postId]?.trim();
    if (!content) return;

    let finalAvatarUrl = manualAvatarUrl;
    if (adminMode && manualAvatarFile) {
      finalAvatarUrl = await uploadManualAvatar();
    }

    const tempComment: PostComment = {
      id: Math.random().toString(),
      post_id: postId,
      user_id: user.id,
      user_name: (adminMode && personaActive) ? manualAuthorName : (user.user_metadata?.full_name || user.email?.split('@')[0]),
      user_avatar_url: (adminMode && personaActive) ? finalAvatarUrl : (user.user_metadata?.avatar_url || null),
      content: content,
      created_at: new Date().toISOString(),
    };

    // Optimistic update
    setComments(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), tempComment]
    }));
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p));
    setNewComment(prev => ({ ...prev, [postId]: '' }));

    try {
      console.log('🔎 Query Supabase: post_comments (insert)');
      const { data, error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        user_name: (adminMode && personaActive) ? manualAuthorName : (user.user_metadata?.full_name || user.email?.split('@')[0]),
        user_avatar_url: (adminMode && personaActive) ? finalAvatarUrl : (user.user_metadata?.avatar_url || null),
        content: content,
      }).select().single();

      if (error) throw error;
      
      // Update the optimistic comment with the real ID from DB to allow immediate deletion
      if (data) {
        setComments(prev => ({
          ...prev,
          [postId]: (prev[postId] || []).map(c => c.id === tempComment.id ? data : c)
        }));
      }
      
      // Realtime listener will sync counts globally
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Erro ao comentar');
      // Revert on error
      fetchComments(postId);
      fetchPosts();
    }
  };

  const toggleComments = (postId: string) => {
    if (expandedComments.includes(postId)) {
      setExpandedComments(prev => prev.filter(id => id !== postId));
    } else {
      setExpandedComments(prev => [...prev, postId]);
      if (!comments[postId]) {
        fetchComments(postId);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className={`animate-spin ${isImportMode ? 'text-blue-500' : 'text-primary'}`} size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)] max-w-2xl mx-auto px-4 pb-20">
      {/* Header - Even higher */}
      <div className="py-1 text-center border-b border-white/5 mb-2">
        <h2 className="text-lg font-bold">{t('community.title') || 'Comunidade'}</h2>
        <p className="text-gray-400 text-[10px]">{t('community.subtitle') || 'Compartilhe sua jornada com outras mães'}</p>
      </div>

      {/* Post Creation Card */}
      <div ref={inputAreaRef} className="bg-zinc-900 rounded-2xl border border-white/10 p-4 mb-6 shadow-xl">
        {isAdmin && isImportMode && (
          <div className="flex flex-col gap-4 mb-4 pb-4 border-b border-white/5">
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${isImportMode ? 'text-blue-500' : 'text-primary'}`}>
                <ShieldCheck size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Painel de Importação</span>
              </div>
            </div>

            <AnimatePresence>
              {adminMode && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-black/20 rounded-2xl p-4 border border-white/5 space-y-4"
                >
                  {!personaActive ? (
                    <>
                      <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-center">Configurar Perfil de Importação</p>
                      <div className="flex items-center gap-4">
                        <div 
                          className="relative w-16 h-16 rounded-full bg-zinc-800 border-2 border-white/10 flex items-center justify-center overflow-hidden cursor-pointer group shrink-0"
                          onClick={() => manualAvatarInputRef.current?.click()}
                        >
                          {manualAvatarPreview ? (
                            <img src={manualAvatarPreview} className="w-full h-full object-cover" />
                          ) : (
                            <UserIcon size={24} className="text-gray-600" />
                          )}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <ImageIcon size={16} className="text-white" />
                          </div>
                        </div>
                        <div className="flex-1 space-y-2">
                          <input 
                            type="text" 
                            placeholder="Nome do Autor (ex: Maria Silva)"
                            value={manualAuthorName}
                            onChange={e => setManualAuthorName(e.target.value)}
                            className={`w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-${isImportMode ? 'blue-500' : 'primary'}`}
                          />
                          <button 
                            onClick={() => {
                              if (!manualAuthorName.trim()) {
                                toast.error('Informe um nome para a persona');
                                return;
                              }
                              setPersonaActive(true);
                              toast.success(`Agora postando como ${manualAuthorName}`);
                            }}
                            className={`w-full ${isImportMode ? 'bg-blue-500/20 hover:bg-blue-500/40 text-blue-500' : 'bg-primary/20 hover:bg-primary/40 text-primary'} text-[10px] font-black py-2 rounded-lg transition-all`}
                          >
                            CONFIRMAR PERSONA
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full bg-zinc-800 border ${isImportMode ? 'border-blue-500/30' : 'border-primary/30'} overflow-hidden`}>
                          {manualAvatarPreview ? (
                            <img src={manualAvatarPreview} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-600">
                              <UserIcon size={20} />
                            </div>
                          )}
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Postando como</p>
                          <p className="text-sm font-bold text-white">{manualAuthorName}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => setPersonaActive(false)}
                        className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white text-[10px] font-black rounded-lg transition-all"
                      >
                        TROCAR PERSONA
                      </button>
                    </div>
                  )}
                  <input 
                    type="file" 
                    ref={manualAvatarInputRef} 
                    onChange={handleManualAvatarSelect} 
                    accept="image/*" 
                    className="hidden" 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <form onSubmit={handleCreatePost} className="space-y-4">
          
          <AnimatePresence>
            {replyingTo && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className={`bg-white/5 rounded-xl p-3 border-l-4 ${isImportMode ? 'border-blue-500' : 'border-primary'} relative mb-2`}
              >
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-white"
                >
                  <X size={16} />
                </button>
                <p className={`text-[10px] ${isImportMode ? 'text-blue-500' : 'text-primary'} font-bold mb-1 uppercase tracking-wider`}>Respondendo a {replyingTo.user_name}</p>
                <p className="text-xs text-gray-400 line-clamp-2 italic">"{replyingTo.content}"</p>
              </motion.div>
            )}
          </AnimatePresence>

            <div className="flex gap-3">
              {(!isImportMode || (isImportMode && personaActive)) && (
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 border border-white/5 shrink-0 overflow-hidden">
                  {(adminMode && personaActive) ? (
                    manualAvatarPreview ? (
                      <img src={manualAvatarPreview} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon size={20} />
                    )
                  ) : user.user_metadata?.avatar_url ? (
                    <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={20} />
                  )}
                </div>
              )}
              <textarea
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder={(adminMode && personaActive) ? `Postar como ${manualAuthorName}` : (adminMode ? t('community.admin_placeholder') || "Configure uma persona acima para postar..." : t('community.input_placeholder') || "O que você está pensando?")}
                disabled={adminMode && !personaActive}
                className="w-full bg-transparent border-none focus:ring-0 text-base resize-none placeholder:text-gray-600 min-h-[60px] disabled:opacity-50"
                style={{ fontSize: '16px' }} // Fix mobile zoom
              />
            </div>

          <AnimatePresence>
            {imagePreview && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative rounded-xl overflow-hidden aspect-video bg-black/20"
              >
                <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                <button
                  type="button"
                  onClick={() => { setSelectedImage(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
                >
                  <X size={18} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 text-sm font-medium transition-all"
            >
              <ImageIcon size={18} className="text-green-500" />
              {t('community.add_photo') || 'Adicionar foto'}
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageSelect} 
              accept="image/*" 
              className="hidden" 
            />
            
            <button
              type="submit"
              disabled={(!newPostContent.trim() && !selectedImage) || sending}
              className={`${isImportMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-primary hover:bg-primary-hover'} text-white px-6 py-2 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2`}
            >
              {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              {t('community.post') || 'Publicar'}
            </button>
          </div>
        </form>
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">{t('community.empty_title') || 'Ainda não há publicações.'}</p>
            <p className="text-sm">{t('community.empty_subtitle') || 'Comece compartilhando algo com a comunidade!'}</p>
          </div>
        ) : (
          posts.map((post) => (
            <motion.div
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              key={post.id}
              className="bg-zinc-900 rounded-2xl border border-white/10 overflow-hidden shadow-lg"
            >
              {/* Post Header */}
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 border border-white/5 overflow-hidden">
                    {post.user_avatar_url ? (
                      <img src={post.user_avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <UserIcon size={20} />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">{post.user_name}</h4>
                    <p className="text-[10px] text-gray-500">
                      {formatDate(post.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button 
                      onClick={() => { setEditingPost(post); setEditContent(post.content); }}
                      className={`text-gray-600 hover:${isImportMode ? 'text-blue-500' : 'text-primary'} transition-colors p-1`}
                    >
                      <Edit3 size={16} />
                    </button>
                  )}
                  {(post.user_id === user.id || isAdmin) && (
                    <button 
                      onClick={() => setPostToDelete({ id: post.id, imageUrl: post.image_url })}
                      className="text-gray-600 hover:text-red-500 transition-colors p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              {/* Reply Context */}
              {post.reply_to_id && (
                <div className="px-4 pb-2">
                  <div className={`bg-white/5 rounded-xl p-3 border-l-4 ${isImportMode ? 'border-blue-500/50' : 'border-primary/50'}`}>
                    <p className={`text-[10px] ${isImportMode ? 'text-blue-500/70' : 'text-primary/70'} font-bold mb-1 uppercase tracking-wider`}>Em resposta a {post.reply_to_user_name}</p>
                    <p className="text-xs text-gray-500 line-clamp-1 italic">"{post.reply_to_content}"</p>
                  </div>
                </div>
              )}

              {/* Post Content */}
              <div className="px-4 pb-4">
                <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">{post.content}</p>
              </div>

              {/* Post Image */}
              {post.image_url && (
                <div 
                  className="bg-black/20 border-y border-white/5 cursor-zoom-in"
                  onClick={() => setSelectedPostImage(post.image_url!)}
                >
                  <img 
                    src={post.image_url} 
                    loading="lazy"
                    className="w-full max-h-[500px] object-contain" 
                    alt="Post" 
                    referrerPolicy="no-referrer"
                  />
                </div>
              )}

              {/* Post Actions */}
              <div className="px-4 py-3 flex items-center gap-6 border-t border-white/5">
                <button 
                  onClick={() => handleLike(post.id)}
                  className={`flex items-center gap-2 text-sm font-bold transition-all active:scale-95 ${
                    likedPosts.includes(post.id) ? (isImportMode ? 'text-blue-500' : 'text-primary') : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <Heart size={20} className={likedPosts.includes(post.id) ? 'fill-current' : ''} />
                  <span>{post.likes_count || 0}</span>
                </button>
                
                <button 
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold transition-all active:scale-95"
                >
                  <MessageCircle size={20} />
                  <span>{post.comments_count || 0}</span>
                </button>

                <button 
                  onClick={() => {
                    setReplyingTo(post);
                    inputAreaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                  className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-bold transition-all active:scale-95 ml-auto"
                >
                  <CornerUpRight size={20} />
                  <span className="hidden sm:inline">{t('community.reply') || 'Responder'}</span>
                </button>
              </div>

              {/* Comments Section */}
              <AnimatePresence>
                {expandedComments.includes(post.id) && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-black/20 border-t border-white/5"
                  >
                    <div className="p-4 space-y-4">
                      {/* Comment List */}
                      <div className="space-y-3">
                        {comments[post.id]?.map((comment) => (
                          <div key={comment.id} className="flex gap-3 items-start group/comment">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-gray-500 border border-white/5 shrink-0 overflow-hidden">
                              {comment.user_avatar_url ? (
                                <img src={comment.user_avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <UserIcon size={14} />
                              )}
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                              <div className="bg-zinc-800 rounded-2xl px-3 py-2 max-w-[90%] relative">
                                <div className="flex items-center justify-between gap-4 mb-0.5">
                                  <h5 className={`font-bold text-[11px] ${isImportMode ? 'text-blue-500' : 'text-primary'}`}>{comment.user_name}</h5>
                                  <span className="text-[9px] text-gray-500">
                                    {formatDate(comment.created_at)}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-300">{comment.content}</p>
                              </div>
                              {(comment.user_id === user.id || isAdmin) && (
                                <button 
                                  onClick={() => setCommentToDelete({ id: comment.id, postId: post.id })}
                                  className="text-gray-600 hover:text-red-500 transition-all p-2 shrink-0"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Comment Input */}
                      <div className="space-y-3 pt-2">
                        <div className="flex gap-3">
                          {(!isImportMode || (isImportMode && personaActive)) && (
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-gray-500 border border-white/5 shrink-0 overflow-hidden">
                              {(adminMode && personaActive) ? (
                                manualAvatarPreview ? (
                                  <img src={manualAvatarPreview} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                  <UserIcon size={14} />
                                )
                              ) : user.user_metadata?.avatar_url ? (
                                <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <UserIcon size={14} />
                              )}
                            </div>
                          )}
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={newComment[post.id] || ''}
                              onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                              onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                              placeholder={(adminMode && personaActive) ? `Comentar como ${manualAuthorName}` : (adminMode ? "Configure uma persona acima..." : (t('community.comment_placeholder') || "Escreva um comentário..."))}
                              disabled={adminMode && !personaActive}
                              className={`w-full bg-zinc-800 border border-white/10 rounded-full px-4 py-2 pr-10 text-xs focus:outline-none focus:border-${isImportMode ? 'blue-500' : 'primary'} disabled:opacity-50`}
                              style={{ fontSize: '16px' }}
                            />
                            <button 
                              onClick={() => handleAddComment(post.id)}
                              disabled={adminMode && !personaActive}
                              className={`absolute right-2 top-1/2 -translate-y-1/2 ${isImportMode ? 'text-blue-500 hover:text-blue-600' : 'text-primary hover:text-primary-hover'} disabled:opacity-50`}
                            >
                              <Send size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))
        )}
      </div>
      {/* Full-screen Image Viewer */}
      <AnimatePresence>
        {selectedPostImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center p-2 sm:p-4 overflow-hidden"
            onClick={() => setSelectedPostImage(null)}
          >
            <button 
              className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/70 hover:text-white p-2 bg-white/10 rounded-full backdrop-blur-md z-[310]"
              onClick={() => setSelectedPostImage(null)}
            >
              <X size={24} />
            </button>
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative w-full h-full flex items-center justify-center"
            >
              <img
                src={selectedPostImage}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                alt="Full screen"
                referrerPolicy="no-referrer"
                onClick={(e) => e.stopPropagation()}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {(postToDelete || commentToDelete) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center text-red-500 mb-4 mx-auto">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold text-center mb-2">
                {postToDelete ? t('community.delete_post_confirm') || 'Excluir Publicação?' : t('community.delete_comment_confirm') || 'Excluir Comentário?'}
              </h3>
              <p className="text-gray-400 text-center text-sm mb-6">
                {postToDelete ? (t('community.delete_post_desc') || 'Esta ação não pode ser desfeita. A publicação e sua imagem serão removidas permanentemente.') : (t('community.delete_comment_desc') || 'O comentário será removido permanentemente.')}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setPostToDelete(null); setCommentToDelete(null); }}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                >
                  {t('global.cancel') || 'Cancelar'}
                </button>
                <button
                  onClick={postToDelete ? handleDeletePost : handleDeleteComment}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all"
                >
                  {t('global.delete') || 'Excluir'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Post Modal */}
      <AnimatePresence>
        {editingPost && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[500] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-white/10 flex justify-between items-center">
                <h3 className="font-bold text-white">{t('community.edit_post') || 'Editar Publicação'}</h3>
                <button onClick={() => setEditingPost(null)} className="text-gray-500 hover:text-white"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                <textarea 
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className={`w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:border-${isImportMode ? 'blue-500' : 'primary'} outline-none min-h-[150px] text-sm`}
                  placeholder={t('community.edit_placeholder') || "Conteúdo do post..."}
                />
                <button 
                  onClick={handleUpdatePost}
                  className={`w-full ${isImportMode ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20' : 'bg-primary hover:bg-primary-hover shadow-primary/20'} text-white font-bold py-4 rounded-xl transition-all shadow-lg`}
                >
                  {t('profile.save_changes') || 'Salvar Alterações'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
