import React, { useState, useRef, useCallback } from 'react';
import { Heart, MessageCircle, Repeat2, Trash2, ChevronDown, ChevronUp, Send, X, Quote, BarChart2, Check, Image, Video, Link2, CornerDownRight, AtSign, Loader2 } from 'lucide-react';
import { useAuth } from './AuthContext';
import { projectId } from '/utils/supabase/info';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router';
import { QuoteModal } from './QuoteModal';
import { AutoplayVideo } from './AutoplayVideo';

interface PostAuthor {
  id: string;
  displayName: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
}

interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

interface Poll {
  options: PollOption[];
  endsAt?: string | null;
}

interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | null;
  likes: string[];
  reposts: string[];
  comments: any[];
  createdAt: string;
  isRepost?: boolean;
  originalPostId?: string;
  quotedPostId?: string;
  quotedPost?: Post | null;
  originalPost?: Post | null;
  embedUrl?: string | null;
  embedType?: 'youtube' | 'gif' | 'video' | null;
  poll?: Poll | null;
  author?: PostAuthor;
  reposterName?: string;
  reposterAvatar?: string;
  originalAuthorName?: string;
  originalAuthorAvatar?: string;
}

interface PostCardProps {
  post: Post;
  onDelete?: () => void;
  onLike?: () => void;
  isQuotedPreview?: boolean;
}

interface Comment {
  id: string;
  userId: string;
  content: string;
  authorName: string;
  authorAvatar?: string;
  authorUsername?: string;
  createdAt: string;
  parentCommentId?: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video' | null;
  embedUrl?: string;
  embedType?: string;
}

// ─── Image compression ──────────────────────────────────────────────

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const MAX_DIM = 1920;
  const MAX_BYTES = 2 * 1024 * 1024;
  if (file.size <= MAX_BYTES) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(MAX_DIM / width, MAX_DIM / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const ext = outType === 'image/png' ? 'png' : 'jpg';
        const compressed = new File([blob], `${file.name.split('.')[0]}.${ext}`, { type: outType });
        resolve(compressed.size < file.size ? compressed : file);
      }, outType, 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function uploadFileDirect(file: File, authHeaders: Record<string, string>): Promise<string> {
  const compressed = file.type.startsWith('image/') ? await compressImage(file) : file;
  const signRes = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/upload/sign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ filename: compressed.name, contentType: compressed.type, fileSize: compressed.size }),
    }
  );
  if (!signRes.ok) throw new Error('Falha ao obter URL de upload');
  const { signedUrl, publicUrl, contentType } = await signRes.json();
  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || compressed.type },
    body: compressed,
  });
  if (!uploadRes.ok) throw new Error(`Falha ao enviar arquivo: ${uploadRes.status}`);
  return publicUrl as string;
}

// ─── Mention parser ──────────────────────────────────────────────

function parseMentions(content: string): React.ReactNode[] {
  const parts = content.split(/(@[a-zA-Z0-9_.]+)/g);
  return parts.map((part, i) => {
    if (/^@[a-zA-Z0-9_.]+$/.test(part)) {
      return (
        <span key={i} className="text-primary font-semibold cursor-pointer hover:underline">
          {part}
        </span>
      );
    }
    return part;
  });
}

// ─── Embed helpers ──────────────────────────────────────────────

function getYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function EmbedContent({ embedUrl, embedType }: { embedUrl: string; embedType: string }) {
  const youtubeId = embedType === 'youtube' ? getYoutubeId(embedUrl) : null;

  if (youtubeId) {
    return (
      <div className="rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '16/9' }}>
        <iframe
          src={`https://www.youtube.com/embed/${youtubeId}`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Vídeo incorporado"
        />
      </div>
    );
  }

  if (embedType === 'gif') {
    return (
      <div className="rounded-xl overflow-hidden flex justify-center bg-muted/30">
        <img src={embedUrl} alt="GIF" className="max-h-80 object-contain rounded-xl" loading="lazy" />
      </div>
    );
  }

  if (embedType === 'video') {
    return (
      <div className="rounded-xl overflow-hidden bg-black">
        <video src={embedUrl} controls className="w-full" style={{ maxHeight: 480 }} />
      </div>
    );
  }

  return null;
}

// ─── Poll component ──────────────────────────────────────────────

function PollView({ poll, postId, userId, onVoted }: {
  poll: Poll; postId: string; userId: string; onVoted: (newPoll: Poll) => void;
}) {
  const { user, getAuthHeaders } = useAuth();
  const [voting, setVoting] = useState<string | null>(null);

  const totalVotes = poll.options.reduce((sum, o) => sum + o.votes.length, 0);
  const myVote = poll.options.find(o => o.votes.includes(user?.id || ''));

  const vote = async (optionId: string) => {
    if (!user) { toast.error('Faça login para votar'); return; }
    if (voting) return;
    setVoting(optionId);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${postId}/vote`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders }, body: JSON.stringify({ optionId }) }
      );
      if (res.ok) { const data = await res.json(); onVoted(data.poll); }
      else toast.error('Erro ao votar');
    } catch { toast.error('Erro ao votar'); }
    finally { setVoting(null); }
  };

  return (
    <div className="mt-3 space-y-2">
      {poll.options.map((option) => {
        const pct = totalVotes === 0 ? 0 : Math.round((option.votes.length / totalVotes) * 100);
        const isMyVote = option.votes.includes(user?.id || '');
        const hasVoted = !!myVote;
        return (
          <button
            key={option.id}
            onClick={() => !hasVoted && vote(option.id)}
            disabled={voting !== null}
            className={`relative w-full text-left rounded-xl border overflow-hidden transition-all ${
              hasVoted
                ? isMyVote ? 'border-primary bg-primary/5 cursor-default' : 'border-border bg-muted/20 cursor-default'
                : 'border-border hover:border-primary/60 hover:bg-primary/5 cursor-pointer'
            } ${voting === option.id ? 'opacity-70' : ''}`}
          >
            {hasVoted && (
              <div className={`absolute inset-0 ${isMyVote ? 'bg-primary/15' : 'bg-muted/30'} transition-all`} style={{ width: `${pct}%` }} />
            )}
            <div className="relative flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {isMyVote && <Check className="w-4 h-4 text-primary shrink-0" />}
                <span className={`text-sm font-medium ${isMyVote ? 'text-primary' : 'text-foreground'}`}>{option.text}</span>
              </div>
              {hasVoted && <span className={`text-sm font-semibold ${isMyVote ? 'text-primary' : 'text-muted-foreground'}`}>{pct}%</span>}
            </div>
          </button>
        );
      })}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5 pl-1">
        <BarChart2 className="w-3.5 h-3.5" />
        {totalVotes} {totalVotes === 1 ? 'voto' : 'votos'}
        {!myVote && user && <span className="text-primary/70"> · Clique para votar</span>}
      </p>
    </div>
  );
}

// ─── Comment Item ────────────────────────────────────────────────

function CommentItem({
  comment,
  replies,
  onReply,
  currentUserId,
  postId,
  onDelete,
}: {
  comment: Comment;
  replies: Comment[];
  onReply: (name: string, commentId: string) => void;
  currentUserId?: string;
  postId: string;
  onDelete: (commentId: string) => void;
}) {
  const { getAuthHeaders } = useAuth();
  const initials = comment.authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const timeAgo = formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ptBR });
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState<string | null>(null);

  const handleDeleteComment = async (commentId: string) => {
    setDeletingComment(commentId);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${postId}/comment/${commentId}`,
        { method: 'DELETE', headers: authHeaders }
      );
      if (!res.ok) throw new Error('Failed to delete comment');
      onDelete(commentId);
      toast.success('Comentário excluído');
    } catch {
      toast.error('Erro ao excluir comentário');
    } finally {
      setDeletingComment(null);
    }
  };

  const isOwnComment = currentUserId && comment.userId === currentUserId;

  return (
    <>
      <div className="flex gap-2.5 group/comment">
        {comment.authorAvatar ? (
          <img src={comment.authorAvatar} alt={comment.authorName} className="w-8 h-8 rounded-full object-cover shrink-0 border border-border" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="bg-muted rounded-2xl px-3 py-2 relative">
            <div className="flex items-center justify-between gap-1.5 mb-0.5">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm">{comment.authorName}</span>
                <span className="text-muted-foreground text-xs">{timeAgo}</span>
              </div>
              {isOwnComment && (
                <button
                  onClick={() => handleDeleteComment(comment.id)}
                  disabled={deletingComment === comment.id}
                  className="opacity-0 group-hover/comment:opacity-100 p-1 rounded-full hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50 shrink-0"
                  title="Excluir comentário"
                >
                  {deletingComment === comment.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                </button>
              )}
            </div>
            {comment.content && (
              <p className="text-sm text-foreground/90 whitespace-pre-wrap break-words">{parseMentions(comment.content)}</p>
            )}
            {comment.mediaUrls && comment.mediaUrls.length > 0 && (
              <div className="mt-2 rounded-xl overflow-hidden">
                {comment.mediaType === 'video' ? (
                  <AutoplayVideo src={comment.mediaUrls[0]} maxHeight={400} />
                ) : (
                  <img
                    src={comment.mediaUrls[0]}
                    alt="Mídia"
                    className="w-full object-cover rounded-xl max-h-80 cursor-zoom-in hover:opacity-90 transition-opacity"
                    onClick={() => setLightboxUrl(comment.mediaUrls![0])}
                  />
                )}
              </div>
            )}
            {comment.embedUrl && comment.embedType && (
              <div className="mt-2">
                <EmbedContent embedUrl={comment.embedUrl} embedType={comment.embedType} />
              </div>
            )}
          </div>
          <button
            onClick={() => onReply(comment.authorName, comment.id)}
            className="flex items-center gap-1 mt-1 ml-2 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <CornerDownRight className="w-3 h-3" />
            Responder
          </button>
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="ml-10 space-y-2 mt-1">
          {replies.map(reply => {
            const replyInitials = reply.authorName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
            const replyTimeAgo = formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true, locale: ptBR });
            const isOwnReply = currentUserId && reply.userId === currentUserId;
            return (
              <div key={reply.id} className="flex gap-2 group/reply">
                {reply.authorAvatar ? (
                  <img src={reply.authorAvatar} alt={reply.authorName} className="w-6 h-6 rounded-full object-cover shrink-0 border border-border" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-[9px] font-bold shrink-0">
                    {replyInitials}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="bg-muted/60 rounded-2xl px-3 py-2">
                    <div className="flex items-center justify-between gap-1.5 mb-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-xs">{reply.authorName}</span>
                        <span className="text-muted-foreground text-[10px]">{replyTimeAgo}</span>
                      </div>
                      {isOwnReply && (
                        <button
                          onClick={() => handleDeleteComment(reply.id)}
                          disabled={deletingComment === reply.id}
                          className="opacity-0 group-hover/reply:opacity-100 p-0.5 rounded-full hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all disabled:opacity-50 shrink-0"
                          title="Excluir resposta"
                        >
                          {deletingComment === reply.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    {reply.content && (
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap break-words">{parseMentions(reply.content)}</p>
                    )}
                    {reply.mediaUrls && reply.mediaUrls.length > 0 && (
                      <div className="mt-1.5 rounded-xl overflow-hidden">
                        {reply.mediaType === 'video' ? (
                          <AutoplayVideo src={reply.mediaUrls[0]} maxHeight={360} />
                        ) : (
                          <img src={reply.mediaUrls[0]} alt="Mídia" className="w-full object-cover rounded-xl max-h-64" />
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => onReply(reply.authorName, reply.id)}
                    className="flex items-center gap-1 mt-0.5 ml-2 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    <CornerDownRight className="w-2.5 h-2.5" />
                    Responder
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2"><X className="w-6 h-6 text-white" /></button>
          <img src={lightboxUrl} alt="Imagem ampliada" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

// ─── Main PostCard ───────────────────────────────────────────────

export function PostCard({ post, onDelete, onLike, isQuotedPreview = false }: PostCardProps) {
  const { user, userProfile, getAuthHeaders } = useAuth();

  // Determine which post data to display for reposts
  const displayPost = (post.isRepost && post.originalPost) ? post.originalPost : post;
  const reposterInfo = post.isRepost ? {
    name: post.reposterName || post.author?.displayName || '',
    avatar: post.reposterAvatar || post.author?.avatar || '',
  } : null;

  const [liked, setLiked] = useState(displayPost.likes?.includes(user?.id || ''));
  const [likesCount, setLikesCount] = useState(displayPost.likes?.length || 0);
  const [repostsCount, setRepostsCount] = useState(displayPost.reposts?.length || 0);
  const [deleting, setDeleting] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [reposting, setReposting] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [poll, setPoll] = useState<Poll | null>(displayPost.poll || null);
  const [repostDropdown, setRepostDropdown] = useState(false);
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>(
    (displayPost.comments || []).map((c: any) => ({
      id: c.id || crypto.randomUUID(),
      userId: c.userId,
      content: c.content,
      authorName: c.authorName || 'Usuário',
      authorAvatar: c.authorAvatar,
      authorUsername: c.authorUsername || '',
      createdAt: c.createdAt || new Date().toISOString(),
      parentCommentId: c.parentCommentId,
      mediaUrls: c.mediaUrls || [],
      mediaType: c.mediaType || null,
      embedUrl: c.embedUrl || null,
      embedType: c.embedType || null,
    }))
  );

  const [newComment, setNewComment] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [postingComment, setPostingComment] = useState(false);

  // Comment media
  const [commentMediaFiles, setCommentMediaFiles] = useState<File[]>([]);
  const [commentMediaPreviews, setCommentMediaPreviews] = useState<{ url: string; type: string }[]>([]);
  const [commentEmbedUrl, setCommentEmbedUrl] = useState('');
  const [showCommentEmbed, setShowCommentEmbed] = useState(false);
  const commentImageRef = useRef<HTMLInputElement>(null);
  const commentVideoRef = useRef<HTMLInputElement>(null);

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleLike = async () => {
    if (!user) { toast.error('Faça login para curtir'); return; }
    const previousLiked = liked;
    const previousCount = likesCount;
    setLiked(!liked);
    setLikesCount(liked ? likesCount - 1 : likesCount + 1);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${displayPost.id}/like`,
        { method: 'POST', headers: authHeaders }
      );
      if (!response.ok) throw new Error('Failed to like post');
      const data = await response.json();
      setLiked(data.liked);
      setLikesCount(data.likesCount);
      if (onLike) onLike();
    } catch {
      setLiked(previousLiked);
      setLikesCount(previousCount);
      toast.error('Erro ao curtir post');
    }
  };

  const handleDelete = () => {
    if (!user || displayPost.userId !== user.id) return;
    setConfirmModal({
      message: 'Tem certeza que deseja deletar este post?',
      onConfirm: async () => {
        setConfirmModal(null);
        setDeleting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${post.id}`,
        { method: 'DELETE', headers: authHeaders }
      );
      if (!response.ok) throw new Error('Failed to delete post');
      toast.success('Post deletado');
      if (onDelete) onDelete();
    } catch {
      toast.error('Erro ao deletar post');
    } finally {
      setDeleting(false);
    }
      }
    });
  };

  const handleRepost = async () => {
    if (!user) { toast.error('Faça login para repostar'); return; }
    if (reposted) { toast('Você já repostou este post'); return; }
    setReposting(true);
    setRepostDropdown(false);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${displayPost.id}/repost`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders } }
      );
      if (!response.ok) throw new Error('Failed to repost');
      const data = await response.json();
      setRepostsCount(data.repostsCount);
      setReposted(true);
      toast.success('🔁 Post repostado!');
    } catch {
      toast.error('Erro ao repostar');
    } finally {
      setReposting(false);
    }
  };

  const handleReply = (authorName: string, commentId: string) => {
    const handle = authorName.split(' ')[0];
    setReplyingToId(commentId);
    setNewComment(`@${handle} `);
    setShowComments(true);
  };

  const handleDeleteComment = (commentId: string) => {
    setComments(prev => prev.filter(c => c.id !== commentId && c.parentCommentId !== commentId));
  };

  const addCommentFile = useCallback(async (files: File[]) => {
    if (commentMediaFiles.length >= 1) { toast.error('Máximo de 1 arquivo por comentário'); return; }
    const file = files[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video');
    const limitMB = isVideo ? 50 : 10;
    if (file.size > limitMB * 1024 * 1024) { toast.error(`Arquivo grande demais (máx ${limitMB} MB)`); return; }
    const processedFile = file.type.startsWith('image/') ? await compressImage(file) : file;
    setCommentMediaFiles([processedFile]);
    const reader = new FileReader();
    reader.onloadend = () => setCommentMediaPreviews([{ url: reader.result as string, type: file.type }]);
    reader.readAsDataURL(processedFile);
  }, [commentMediaFiles.length]);

  const removeCommentFile = () => {
    setCommentMediaFiles([]);
    setCommentMediaPreviews([]);
  };

  const handleComment = async () => {
    if (!user) { toast.error('Faça login para comentar'); return; }
    if (!newComment.trim() && commentMediaFiles.length === 0) return;
    setPostingComment(true);
    try {
      const authHeaders = await getAuthHeaders();
      let mediaUrls: string[] = [];
      let mediaType: string | null = null;
      if (commentMediaFiles.length > 0) {
        toast.loading('Enviando mídia...', { id: 'comment-upload' });
        mediaUrls = await Promise.all(commentMediaFiles.map(f => uploadFileDirect(f, authHeaders)));
        mediaType = commentMediaFiles[0].type.startsWith('video') ? 'video' : 'image';
        toast.dismiss('comment-upload');
      }

      const body: any = { content: newComment.trim() };
      if (replyingToId) body.parentCommentId = replyingToId;
      if (mediaUrls.length > 0) { body.mediaUrls = mediaUrls; body.mediaType = mediaType; }
      if (showCommentEmbed && commentEmbedUrl.trim()) { body.embedUrl = commentEmbedUrl.trim(); body.embedType = 'video'; }

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${displayPost.id}/comment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify(body),
        }
      );
      if (!response.ok) throw new Error('Failed to post comment');
      const newCommentObj: Comment = {
        id: crypto.randomUUID(),
        userId: user.id,
        content: body.content,
        authorName: userProfile?.displayName || user.user_metadata?.displayName || 'Usuário',
        authorAvatar: userProfile?.avatar,
        authorUsername: userProfile?.username || '',
        createdAt: new Date().toISOString(),
        parentCommentId: replyingToId || undefined,
        mediaUrls: mediaUrls,
        mediaType: mediaType as any,
        embedUrl: body.embedUrl,
        embedType: body.embedType,
      };
      setComments(prev => [...prev, newCommentObj]);
      setNewComment('');
      setReplyingToId(null);
      setCommentMediaFiles([]);
      setCommentMediaPreviews([]);
      setCommentEmbedUrl('');
      setShowCommentEmbed(false);
      toast.success('Comentário adicionado!');
    } catch {
      toast.dismiss('comment-upload');
      toast.error('Erro ao comentar');
    } finally {
      setPostingComment(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(displayPost.createdAt), { addSuffix: true, locale: ptBR });
  const author = displayPost.author || { id: displayPost.userId, displayName: 'Usuário' };
  const initials = author.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const isOwnPost = user && (post.userId === user.id || displayPost.userId === user.id);

  // Group comments for nested display
  const rootComments = comments.filter(c => !c.parentCommentId);
  const getReplies = (commentId: string) => comments.filter(c => c.parentCommentId === commentId);

  // ── Quoted preview (simplified) ────────────────────────────────
  if (isQuotedPreview) {
    return (
      <Link
        to={`/post/${displayPost.id}`}
        className="block rounded-xl border border-border bg-muted/20 p-3 hover:bg-muted/40 hover:border-primary/40 transition-all cursor-pointer"
      >
        <div className="flex items-center gap-2 mb-2">
          {author.avatar ? (
            <img src={author.avatar} alt={author.displayName} className="w-5 h-5 rounded-full object-cover border border-border" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[8px]">
              {initials}
            </div>
          )}
          <span className="font-bold text-sm hover:text-primary transition-colors" onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/profile/${author.id}`; }}>
            {author.displayName}
          </span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-muted-foreground text-xs">{timeAgo}</span>
        </div>
        {displayPost.content && (
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words line-clamp-4">{parseMentions(displayPost.content)}</p>
        )}
        {displayPost.mediaUrls && displayPost.mediaUrls.length > 0 && (
          <div className="mt-2 rounded-lg overflow-hidden">
            {displayPost.mediaType === 'video' ? (
              <video src={displayPost.mediaUrls[0]} className="w-full rounded-lg" style={{ maxHeight: 200 }} />
            ) : (
              <img src={displayPost.mediaUrls[0]} alt="Mídia" className="w-full object-cover rounded-lg" style={{ maxHeight: 140 }} />
            )}
          </div>
        )}
        {displayPost.embedUrl && displayPost.embedType && (
          <div className="mt-2 opacity-80">
            <EmbedContent embedUrl={displayPost.embedUrl} embedType={displayPost.embedType} />
          </div>
        )}
        {displayPost.poll && (
          <div className="mt-2 p-2 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            Enquete com {displayPost.poll.options.length} opções
          </div>
        )}
      </Link>
    );
  }

  // ── Full post card ─────────────────────────────────────────────
  return (
    <>
      <div className="bg-card border border-border rounded-2xl hover:border-primary/40 transition-all duration-200 overflow-hidden group">
        {/* Repost indicator with reposter info */}
        {post.isRepost && reposterInfo && (
          <div className="flex items-center gap-2 px-5 pt-3 pb-1 text-muted-foreground text-xs">
            <Repeat2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
            {reposterInfo.avatar ? (
              <img src={reposterInfo.avatar} alt={reposterInfo.name} className="w-4 h-4 rounded-full object-cover" />
            ) : (
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[7px]">
                {reposterInfo.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
            )}
            <span>
              <span className="text-green-500 font-semibold">{reposterInfo.name}</span>
              <span className="text-muted-foreground"> repostou</span>
            </span>
          </div>
        )}

        <div className="p-5 pb-3">
          {/* Author row */}
          <div className="flex items-start gap-3">
            <Link to={`/profile/${author.id}`} className="shrink-0">
              {author.avatar ? (
                <img src={author.avatar} alt={author.displayName} className="w-11 h-11 rounded-full object-cover hover:opacity-90 transition-opacity border-2 border-transparent hover:border-primary/40" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold text-sm hover:opacity-90 transition-opacity">
                  {initials}
                </div>
              )}
            </Link>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                  <Link to={`/profile/${author.id}`} className="font-bold hover:text-primary transition-colors truncate">
                    {author.displayName}
                  </Link>
                  <span className="text-muted-foreground text-sm shrink-0">·</span>
                  <span className="text-muted-foreground text-sm shrink-0">{timeAgo}</span>
                </div>
                {isOwnPost && (
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50 shrink-0"
                    title="Deletar post"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Text content */}
              {displayPost.content && (
                <p className="mt-2 text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {parseMentions(displayPost.content)}
                </p>
              )}

              {/* Poll */}
              {poll && (
                <PollView poll={poll} postId={displayPost.id} userId={displayPost.userId} onVoted={(newPoll) => setPoll(newPoll)} />
              )}
            </div>
          </div>

          {/* Uploaded media */}
          {displayPost.mediaUrls && displayPost.mediaUrls.length > 0 && (
            <div className={`mt-3 ml-14 rounded-xl overflow-hidden ${displayPost.mediaUrls.length > 1 ? 'grid grid-cols-2 gap-1' : ''}`}>
              {displayPost.mediaUrls.map((url, index) => (
                <div key={index} className="relative overflow-hidden rounded-xl bg-black">
                  {displayPost.mediaType === 'video' ? (
                    <AutoplayVideo src={url} maxHeight={520} />
                  ) : (
                    <div className="cursor-zoom-in" onClick={() => setLightboxUrl(url)}>
                      <img
                        src={url}
                        alt={`Mídia ${index + 1}`}
                        className="w-full object-cover hover:scale-105 transition-transform duration-300 block"
                        style={{ maxHeight: displayPost.mediaUrls.length === 1 ? 520 : 300 }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Embedded YouTube / GIF / video */}
          {displayPost.embedUrl && displayPost.embedType && (
            <div className="mt-3 ml-14">
              <EmbedContent embedUrl={displayPost.embedUrl} embedType={displayPost.embedType} />
            </div>
          )}

          {/* Quoted post */}
          {displayPost.quotedPost && (
            <div className="mt-3 ml-14">
              <PostCard post={displayPost.quotedPost} isQuotedPreview />
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-border/40" />

        {/* Action bar */}
        <div className="flex items-center px-4 py-1.5 gap-0">
          {/* Like */}
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all hover:bg-pink-500/10 flex-1 justify-center ${liked ? 'text-pink-500' : 'text-muted-foreground hover:text-pink-500'}`}
          >
            <Heart className={`w-[18px] h-[18px] ${liked ? 'fill-current' : ''} transition-transform ${liked ? 'scale-110' : ''}`} />
            <span className="text-sm font-medium">{likesCount}</span>
          </button>

          {/* Comment */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all flex-1 justify-center"
          >
            <MessageCircle className="w-[18px] h-[18px]" />
            <span className="text-sm font-medium">{comments.length}</span>
            {showComments ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {/* Repost / Quote dropdown */}
          <div className="relative flex-1 flex justify-center">
            <button
              onClick={() => setRepostDropdown(!repostDropdown)}
              disabled={reposting}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-full transition-all hover:bg-green-500/10 disabled:opacity-50 ${reposted ? 'text-green-500' : 'text-muted-foreground hover:text-green-500'}`}
            >
              <Repeat2 className={`w-[18px] h-[18px] ${reposted ? 'scale-110' : ''} transition-transform`} />
              <span className="text-sm font-medium">{repostsCount}</span>
            </button>

            {repostDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRepostDropdown(false)} />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-20 min-w-[160px]">
                  <button onClick={handleRepost} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted transition-colors text-sm font-medium text-left">
                    <Repeat2 className="w-4 h-4 text-green-500" />
                    Repostar
                  </button>
                  <div className="border-t border-border/50" />
                  <button onClick={() => { setShowQuoteModal(true); setRepostDropdown(false); }} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted transition-colors text-sm font-medium text-left">
                    <Quote className="w-4 h-4 text-primary" />
                    Citar post
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Comments section */}
        {showComments && (
          <div className="border-t border-border/40 px-5 py-4 space-y-4 bg-muted/20">
            {/* Comment list */}
            {rootComments.length > 0 ? (
              <div className="space-y-3">
                {rootComments.map((comment) => (
                  <CommentItem
                    key={comment.id}
                    comment={comment}
                    replies={getReplies(comment.id)}
                    onReply={handleReply}
                    currentUserId={user?.id}
                    postId={displayPost.id}
                    onDelete={handleDeleteComment}
                  />
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-1">Nenhum comentário ainda. Seja o primeiro!</p>
            )}

            {/* Comment input */}
            {user && (
              <div className="space-y-2">
                {/* Reply indicator */}
                {replyingToId && (
                  <div className="flex items-center gap-2 text-xs text-primary bg-primary/10 rounded-lg px-3 py-1.5">
                    <CornerDownRight className="w-3 h-3 shrink-0" />
                    <span className="flex-1">Respondendo a comentário</span>
                    <button onClick={() => { setReplyingToId(null); setNewComment(''); }} className="hover:text-destructive transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Comment media preview */}
                {commentMediaPreviews.length > 0 && (
                  <div className="relative inline-block">
                    {commentMediaPreviews[0].type.startsWith('video') ? (
                      <video src={commentMediaPreviews[0].url} className="max-h-32 rounded-xl" />
                    ) : (
                      <img src={commentMediaPreviews[0].url} alt="Preview" className="max-h-32 rounded-xl object-cover" />
                    )}
                    <button onClick={removeCommentFile} className="absolute top-1 right-1 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                )}

                {/* Embed input */}
                {showCommentEmbed && (
                  <div className="flex items-center gap-2 bg-muted/40 border border-border rounded-xl px-3 py-2">
                    <Link2 className="w-4 h-4 text-primary shrink-0" />
                    <input
                      type="url"
                      value={commentEmbedUrl}
                      onChange={(e) => setCommentEmbedUrl(e.target.value)}
                      placeholder="Cole link de vídeo ou YouTube..."
                      className="flex-1 bg-transparent outline-none text-xs placeholder:text-muted-foreground text-foreground"
                    />
                    <button onClick={() => { setShowCommentEmbed(false); setCommentEmbedUrl(''); }} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="flex gap-2.5 items-end">
                  {userProfile?.avatar ? (
                    <img src={userProfile.avatar} alt="Você" className="w-8 h-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {(userProfile?.displayName || user.user_metadata?.displayName || 'U').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 bg-muted rounded-2xl px-4 py-2 border border-border focus-within:border-primary transition-colors">
                      <input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                        placeholder={replyingToId ? "Escreva sua resposta..." : "Escreva um comentário... (use @nome para mencionar)"}
                        className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                        disabled={postingComment}
                      />
                      <button onClick={handleComment} disabled={postingComment || (!newComment.trim() && commentMediaFiles.length === 0)} className="text-primary hover:text-primary/80 disabled:opacity-40 transition-colors">
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    {/* Comment media/embed toolbar */}
                    <div className="flex items-center gap-1 mt-1 ml-1">
                      <button
                        onClick={() => { if (commentMediaFiles.length === 0) commentImageRef.current?.click(); }}
                        disabled={commentMediaFiles.length > 0 || showCommentEmbed}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Adicionar imagem"
                      >
                        <Image className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (commentMediaFiles.length === 0) commentVideoRef.current?.click(); }}
                        disabled={commentMediaFiles.length > 0 || showCommentEmbed}
                        className="p-1.5 rounded-lg hover:bg-primary/10 text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title="Adicionar vídeo"
                      >
                        <Video className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { if (commentMediaFiles.length === 0) setShowCommentEmbed(v => !v); }}
                        disabled={commentMediaFiles.length > 0}
                        className={`p-1.5 rounded-lg hover:bg-primary/10 text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${showCommentEmbed ? 'bg-primary/10' : ''}`}
                        title="Link de vídeo"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[10px] text-muted-foreground/50 ml-1 flex items-center gap-0.5">
                        <AtSign className="w-3 h-3" /> mencione alguém
                      </span>
                    </div>
                    <input ref={commentImageRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = Array.from(e.target.files || []); if (f.length) addCommentFile(f); e.target.value = ''; }} />
                    <input ref={commentVideoRef} type="file" accept="video/*" className="hidden" onChange={(e) => { const f = Array.from(e.target.files || []); if (f.length) addCommentFile(f); e.target.value = ''; }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setLightboxUrl(null)}>
          <button onClick={() => setLightboxUrl(null)} className="absolute top-4 right-4 text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors">
            <X className="w-6 h-6 text-white" />
          </button>
          <img src={lightboxUrl} alt="Imagem ampliada" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      {/* Confirm Modal */}
      {confirmModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <p className="text-foreground font-medium text-center mb-6">{confirmModal.message}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmModal(null)}
                className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmModal.onConfirm}
                className="flex-1 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors text-sm font-medium"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quote Modal */}
      {showQuoteModal && (
        <QuoteModal post={displayPost} onClose={() => setShowQuoteModal(false)} onQuoted={() => { if (onLike) onLike(); }} />
      )}
    </>
  );
}
