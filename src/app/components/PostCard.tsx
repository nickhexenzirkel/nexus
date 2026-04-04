import { useState } from 'react';
import { Heart, MessageCircle, Repeat2, Trash2, ChevronDown, ChevronUp, Send, X, Quote, BarChart2, Check } from 'lucide-react';
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
  embedUrl?: string | null;
  embedType?: 'youtube' | 'gif' | 'video' | null;
  poll?: Poll | null;
  author?: PostAuthor;
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
  createdAt: string;
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
        <img
          src={embedUrl}
          alt="GIF"
          className="max-h-80 object-contain rounded-xl"
          loading="lazy"
        />
      </div>
    );
  }

  if (embedType === 'video') {
    return (
      <div className="rounded-xl overflow-hidden bg-black">
        <video
          src={embedUrl}
          controls
          className="w-full"
          style={{ maxHeight: 480 }}
        />
      </div>
    );
  }

  return null;
}

// ─── Poll component ──────────────────────────────────────────────

function PollView({
  poll,
  postId,
  userId,
  onVoted,
}: {
  poll: Poll;
  postId: string;
  userId: string;
  onVoted: (newPoll: Poll) => void;
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
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ optionId }),
        }
      );
      if (res.ok) {
        const data = await res.json();
        onVoted(data.poll);
      } else {
        toast.error('Erro ao votar');
      }
    } catch {
      toast.error('Erro ao votar');
    } finally {
      setVoting(null);
    }
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
                ? isMyVote
                  ? 'border-primary bg-primary/5 cursor-default'
                  : 'border-border bg-muted/20 cursor-default'
                : 'border-border hover:border-primary/60 hover:bg-primary/5 cursor-pointer'
            } ${voting === option.id ? 'opacity-70' : ''}`}
          >
            {/* Progress bar */}
            {hasVoted && (
              <div
                className={`absolute inset-0 ${isMyVote ? 'bg-primary/15' : 'bg-muted/30'} transition-all`}
                style={{ width: `${pct}%` }}
              />
            )}
            <div className="relative flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                {isMyVote && <Check className="w-4 h-4 text-primary shrink-0" />}
                <span className={`text-sm font-medium ${isMyVote ? 'text-primary' : 'text-foreground'}`}>
                  {option.text}
                </span>
              </div>
              {hasVoted && (
                <span className={`text-sm font-semibold ${isMyVote ? 'text-primary' : 'text-muted-foreground'}`}>
                  {pct}%
                </span>
              )}
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

// ─── Main PostCard ───────────────────────────────────────────────

export function PostCard({ post, onDelete, onLike, isQuotedPreview = false }: PostCardProps) {
  const { user, userProfile, getAuthHeaders } = useAuth();
  const [liked, setLiked] = useState(post.likes?.includes(user?.id || ''));
  const [likesCount, setLikesCount] = useState(post.likes?.length || 0);
  const [repostsCount, setRepostsCount] = useState(post.reposts?.length || 0);
  const [deleting, setDeleting] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [poll, setPoll] = useState<Poll | null>(post.poll || null);

  // Repost dropdown
  const [repostDropdown, setRepostDropdown] = useState(false);

  // Quote modal
  const [showQuoteModal, setShowQuoteModal] = useState(false);

  // Comments
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>(
    (post.comments || []).map((c: any) => ({
      id: c.id || crypto.randomUUID(),
      userId: c.userId,
      content: c.content,
      authorName: c.authorName || 'Usuário',
      authorAvatar: c.authorAvatar,
      createdAt: c.createdAt || new Date().toISOString(),
    }))
  );
  const [newComment, setNewComment] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Media lightbox
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
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${post.id}/like`,
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

  const handleDelete = async () => {
    if (!user || post.userId !== user.id) return;
    if (!confirm('Tem certeza que deseja deletar este post?')) return;
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
  };

  const handleRepost = async () => {
    if (!user) { toast.error('Faça login para repostar'); return; }
    if (reposted) { toast('Você já repostou este post'); return; }
    setReposting(true);
    setRepostDropdown(false);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${post.id}/repost`,
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

  const handleComment = async () => {
    if (!user) { toast.error('Faça login para comentar'); return; }
    if (!newComment.trim()) return;
    setPostingComment(true);
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${post.id}/comment`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ content: newComment.trim() }),
        }
      );
      if (!response.ok) throw new Error('Failed to post comment');
      const newCommentObj: Comment = {
        id: crypto.randomUUID(),
        userId: user.id,
        content: newComment.trim(),
        authorName: userProfile?.displayName || user.user_metadata?.displayName || 'Usuário',
        authorAvatar: userProfile?.avatar,
        createdAt: new Date().toISOString(),
      };
      setComments(prev => [...prev, newCommentObj]);
      setNewComment('');
      toast.success('Comentário adicionado!');
    } catch {
      toast.error('Erro ao comentar');
    } finally {
      setPostingComment(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ptBR });
  const author = post.author || { id: post.userId, displayName: 'Usuário' };
  const initials = author.displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
  const isOwnPost = user && post.userId === user.id;

  // ── Quoted preview (simplified, non-interactive) ──────────────
  if (isQuotedPreview) {
    return (
      <Link
        to={`/post/${post.id}`}
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
          <span
            className="font-bold text-sm hover:text-primary transition-colors"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/profile/${author.id}`; }}
          >
            {author.displayName}
          </span>
          <span className="text-muted-foreground text-xs">·</span>
          <span className="text-muted-foreground text-xs">{timeAgo}</span>
        </div>
        {post.content && (
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words line-clamp-4">{post.content}</p>
        )}
        {post.mediaUrls && post.mediaUrls.length > 0 && (
          <div className="mt-2 rounded-lg overflow-hidden">
            {post.mediaType === 'video' ? (
              <video src={post.mediaUrls[0]} className="w-full rounded-lg" style={{ maxHeight: 200 }} />
            ) : (
              <img src={post.mediaUrls[0]} alt="Mídia" className="w-full object-cover rounded-lg" style={{ maxHeight: 140 }} />
            )}
          </div>
        )}
        {post.embedUrl && post.embedType && (
          <div className="mt-2 opacity-80">
            <EmbedContent embedUrl={post.embedUrl} embedType={post.embedType} />
          </div>
        )}
        {post.poll && (
          <div className="mt-2 p-2 bg-muted/40 rounded-lg text-xs text-muted-foreground flex items-center gap-1.5">
            <BarChart2 className="w-3.5 h-3.5 text-primary" />
            Enquete com {post.poll.options.length} opções
          </div>
        )}
      </Link>
    );
  }

  // ── Full post card ────────────────────────────────────────────
  return (
    <>
      <div className="bg-card border border-border rounded-2xl hover:border-primary/40 transition-all duration-200 overflow-hidden group">
        {/* Repost indicator */}
        {post.isRepost && (
          <div className="flex items-center gap-2 px-5 pt-3 pb-1 text-muted-foreground text-xs">
            <Repeat2 className="w-3.5 h-3.5 text-green-500" />
            <span className="text-green-500 font-medium">Repostado</span>
          </div>
        )}

        <div className="p-5 pb-3">
          {/* Author row */}
          <div className="flex items-start gap-3">
            <Link to={`/profile/${author.id}`} className="shrink-0">
              {author.avatar ? (
                <img
                  src={author.avatar}
                  alt={author.displayName}
                  className="w-11 h-11 rounded-full object-cover hover:opacity-90 transition-opacity border-2 border-transparent hover:border-primary/40"
                />
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
              {post.content && (
                <p className="mt-2 text-foreground whitespace-pre-wrap break-words leading-relaxed">
                  {post.content}
                </p>
              )}

              {/* Poll */}
              {poll && (
                <PollView
                  poll={poll}
                  postId={post.id}
                  userId={post.userId}
                  onVoted={(newPoll) => setPoll(newPoll)}
                />
              )}
            </div>
          </div>

          {/* Uploaded media */}
          {post.mediaUrls && post.mediaUrls.length > 0 && (
            <div className={`mt-3 ml-14 rounded-xl overflow-hidden ${
              post.mediaUrls.length > 1 ? 'grid grid-cols-2 gap-1' : ''
            }`}>
              {post.mediaUrls.map((url, index) => (
                <div key={index} className="relative overflow-hidden rounded-xl bg-black">
                  {post.mediaType === 'video' ? (
                    <AutoplayVideo
                      src={url}
                      maxHeight={520}
                    />
                  ) : (
                    <div
                      className="cursor-zoom-in"
                      onClick={() => setLightboxUrl(url)}
                    >
                      <img
                        src={url}
                        alt={`Mídia ${index + 1}`}
                        className="w-full object-cover hover:scale-105 transition-transform duration-300 block"
                        style={{ maxHeight: post.mediaUrls.length === 1 ? 520 : 300 }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Embedded YouTube / GIF / video */}
          {post.embedUrl && post.embedType && (
            <div className="mt-3 ml-14">
              <EmbedContent embedUrl={post.embedUrl} embedType={post.embedType} />
            </div>
          )}

          {/* Quoted post */}
          {post.quotedPost && (
            <div className="mt-3 ml-14">
              <PostCard post={post.quotedPost} isQuotedPreview />
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
                  <button
                    onClick={handleRepost}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted transition-colors text-sm font-medium text-left"
                  >
                    <Repeat2 className="w-4 h-4 text-green-500" />
                    Repostar
                  </button>
                  <div className="border-t border-border/50" />
                  <button
                    onClick={() => { setShowQuoteModal(true); setRepostDropdown(false); }}
                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-muted transition-colors text-sm font-medium text-left"
                  >
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
            {comments.length > 0 ? (
              <div className="space-y-3">
                {comments.map((comment) => {
                  const commentInitials = comment.authorName
                    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
                  return (
                    <div key={comment.id} className="flex gap-2.5">
                      {comment.authorAvatar ? (
                        <img src={comment.authorAvatar} alt={comment.authorName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {commentInitials}
                        </div>
                      )}
                      <div className="flex-1 bg-muted rounded-xl px-3 py-2">
                        <span className="font-semibold text-sm">{comment.authorName}</span>
                        <p className="text-sm text-foreground/90 mt-0.5">{comment.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-1">Nenhum comentário ainda. Seja o primeiro!</p>
            )}

            {user && (
              <div className="flex gap-2.5 items-center">
                {userProfile?.avatar ? (
                  <img src={userProfile.avatar} alt="Você" className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {(userProfile?.displayName || user.user_metadata?.displayName || 'U')
                      .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                )}
                <div className="flex-1 flex items-center gap-2 bg-muted rounded-full px-4 py-2 border border-border focus-within:border-primary transition-colors">
                  <input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                    placeholder="Escreva um comentário..."
                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                    disabled={postingComment}
                  />
                  <button
                    onClick={handleComment}
                    disabled={postingComment || !newComment.trim()}
                    className="text-primary hover:text-primary/80 disabled:opacity-40 transition-colors"
                  >
                    <Send className="w-4 h-4" />
                  </button>
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

      {/* Quote Modal */}
      {showQuoteModal && (
        <QuoteModal post={post} onClose={() => setShowQuoteModal(false)} onQuoted={() => { if (onLike) onLike(); }} />
      )}
    </>
  );
}