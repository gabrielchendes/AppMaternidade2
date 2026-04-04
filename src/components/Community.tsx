import React, { useState, useEffect, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, CommunityPost, PostComment } from '../lib/supabase';
import { Send, User as UserIcon, Trash2, Loader2, Heart, MessageCircle, Image as ImageIcon, X, CornerUpRight } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import imageCompression from 'browser-image-compression';

interface CommunityProps {
  user: User;
}

export default function Community({ user }: CommunityProps) {
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
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPosts();
    fetchUserLikes();

    const channel = supabase
      .channel('community_posts')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_posts' },
        () => fetchPosts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_likes' },
        () => fetchPosts()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'post_comments' },
        (payload) => {
          if (payload.new) {
            const comment = payload.new as PostComment;
            fetchComments(comment.post_id);
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
      toast.success('Publicação excluída');
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Erro ao excluir publicação');
    } finally {
      setPostToDelete(null);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newPostContent.trim();
    if ((!content && !selectedImage) || sending) return;

    setSending(true);
    let imageUrl = '';

    try {
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

      const { data: newPost, error } = await supabase.from('community_posts').insert({
        user_id: user.id,
        user_email: user.email,
        user_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        user_avatar_url: user.user_metadata?.avatar_url || null,
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
      toast.success('Post enviado!');
    } catch (error: any) {
      console.error('Error creating post:', error);
      toast.error(error.message || 'Erro ao enviar post');
    } finally {
      setSending(false);
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
        await supabase.from('post_likes').delete().match({ user_id: user.id, post_id: postId });
      } else {
        await supabase.from('post_likes').insert({ user_id: user.id, post_id: postId });
      }
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

    const tempComment: PostComment = {
      id: Math.random().toString(),
      post_id: postId,
      user_id: user.id,
      user_name: user.user_metadata?.full_name || user.email?.split('@')[0],
      user_avatar_url: user.user_metadata?.avatar_url || null,
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
      const { error } = await supabase.from('post_comments').insert({
        post_id: postId,
        user_id: user.id,
        user_name: user.user_metadata?.full_name || user.email?.split('@')[0],
        user_avatar_url: user.user_metadata?.avatar_url || null,
        content: content,
      });

      if (error) throw error;
      fetchComments(postId);
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
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)] max-w-2xl mx-auto px-4 pb-20">
      {/* Header - Even higher */}
      <div className="py-1 text-center border-b border-white/5 mb-2">
        <h2 className="text-lg font-bold">Comunidade</h2>
        <p className="text-gray-400 text-[10px]">Compartilhe sua jornada com outras mães</p>
      </div>

      {/* Post Creation Card */}
      <div ref={inputAreaRef} className="bg-zinc-900 rounded-2xl border border-white/10 p-4 mb-6 shadow-xl">
        <form onSubmit={handleCreatePost} className="space-y-4">
          <AnimatePresence>
            {replyingTo && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white/5 rounded-xl p-3 border-l-4 border-primary relative mb-2"
              >
                <button 
                  onClick={() => setReplyingTo(null)}
                  className="absolute top-2 right-2 text-gray-500 hover:text-white"
                >
                  <X size={16} />
                </button>
                <p className="text-[10px] text-primary font-bold mb-1 uppercase tracking-wider">Respondendo a {replyingTo.user_name}</p>
                <p className="text-xs text-gray-400 line-clamp-2 italic">"{replyingTo.content}"</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-gray-400 border border-white/5 shrink-0 overflow-hidden">
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={20} />
              )}
            </div>
            <textarea
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              placeholder="O que você está pensando?"
              className="w-full bg-transparent border-none focus:ring-0 text-base resize-none placeholder:text-gray-600 min-h-[60px]"
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
              Adicionar foto
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
              className="bg-primary-hover hover:bg-primary-hover text-white px-6 py-2 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-50 flex items-center gap-2"
            >
              {sending ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              Publicar
            </button>
          </div>
        </form>
      </div>

      {/* Posts Feed */}
      <div className="space-y-6">
        {posts.length === 0 ? (
          <div className="text-center py-20 text-gray-500">
            <p className="text-lg font-medium">Ainda não há publicações.</p>
            <p className="text-sm">Comece compartilhando algo com a comunidade!</p>
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
                      {format(new Date(post.created_at), "d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
                {post.user_id === user.id && (
                  <button 
                    onClick={() => setPostToDelete({ id: post.id, imageUrl: post.image_url })}
                    className="text-gray-600 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              {/* Reply Context */}
              {post.reply_to_id && (
                <div className="px-4 pb-2">
                  <div className="bg-white/5 rounded-xl p-3 border-l-4 border-primary/50">
                    <p className="text-[10px] text-primary/70 font-bold mb-1 uppercase tracking-wider">Em resposta a {post.reply_to_user_name}</p>
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
                    likedPosts.includes(post.id) ? 'text-primary' : 'text-gray-400 hover:text-white'
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
                  <span className="hidden sm:inline">Responder</span>
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
                          <div key={comment.id} className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-gray-500 border border-white/5 shrink-0 overflow-hidden">
                              {comment.user_avatar_url ? (
                                <img src={comment.user_avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                              ) : (
                                <UserIcon size={14} />
                              )}
                            </div>
                            <div className="bg-zinc-800 rounded-2xl px-3 py-2 max-w-[85%]">
                              <h5 className="font-bold text-[11px] text-primary">{comment.user_name}</h5>
                              <p className="text-xs text-gray-300">{comment.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add Comment Input */}
                      <div className="flex gap-3 pt-2">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-gray-500 border border-white/5 shrink-0 overflow-hidden">
                          {user.user_metadata?.avatar_url ? (
                            <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <UserIcon size={14} />
                          )}
                        </div>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            value={newComment[post.id] || ''}
                            onChange={(e) => setNewComment(prev => ({ ...prev, [post.id]: e.target.value }))}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                            placeholder="Escreva um comentário..."
                            className="w-full bg-zinc-800 border border-white/10 rounded-full px-4 py-2 pr-10 text-xs focus:outline-none focus:border-primary"
                            style={{ fontSize: '16px' }}
                          />
                          <button 
                            onClick={() => handleAddComment(post.id)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-primary"
                          >
                            <Send size={16} />
                          </button>
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
        {postToDelete && (
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
              <h3 className="text-xl font-bold text-center mb-2">Excluir Publicação?</h3>
              <p className="text-gray-400 text-center text-sm mb-6">
                Esta ação não pode ser desfeita. A publicação e sua imagem serão removidas permanentemente.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setPostToDelete(null)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeletePost}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-all"
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
