import { useState } from 'react';
import { useAuth } from './AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { X, Send, Loader2, Quote } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Link } from 'react-router';

interface PostAuthor {
  id: string;
  displayName: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
}

interface QuotedPost {
  id: string;
  userId: string;
  content: string;
  mediaUrls?: string[];
  mediaType?: 'image' | 'video' | null;
  createdAt: string;
  author?: PostAuthor;
}

interface QuoteModalProps {
  post: QuotedPost;
  onClose: () => void;
  onQuoted: () => void;
}

export function QuoteModal({ post, onClose, onQuoted }: QuoteModalProps) {
  const { user, userProfile, getAuthHeaders } = useAuth();
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const author = post.author || { id: post.userId, displayName: 'Usuário' };
  const authorInitials = author.displayName
    .split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const myInitials = (userProfile?.displayName || user?.user_metadata?.displayName || 'U')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const timeAgo = formatDistanceToNow(new Date(post.createdAt), {
    addSuffix: true,
    locale: ptBR,
  });

  const handleSubmit = async () => {
    if (!user || submitting) return;
    if (!content.trim()) {
      toast.error('Adicione um comentário para citar');
      return;
    }

    setSubmitting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            content: content.trim(),
            quotedPostId: post.id,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao citar post');
      }

      toast.success('✅ Post citado!');
      onQuoted();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Erro ao citar post');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Quote className="w-5 h-5 text-primary" />
            Citar post
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Compose area */}
        <div className="p-5 space-y-4">
          {/* My input area */}
          <div className="flex gap-3">
            {userProfile?.avatar ? (
              <img
                src={userProfile.avatar}
                alt="Você"
                className="w-10 h-10 rounded-full object-cover shrink-0 border-2 border-border"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm shrink-0">
                {myInitials}
              </div>
            )}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Adicione um comentário..."
              className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground resize-none text-base min-h-[80px]"
              maxLength={280}
              autoFocus
              disabled={submitting}
            />
          </div>

          {/* Quoted post preview */}
          <div className="rounded-xl border border-border overflow-hidden bg-muted/30 hover:bg-muted/50 transition-colors">
            <div className="p-4">
              {/* Quoted author */}
              <div className="flex items-center gap-2 mb-2">
                {author.avatar ? (
                  <img
                    src={author.avatar}
                    alt={author.displayName}
                    className="w-5 h-5 rounded-full object-cover border border-border"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-[8px]">
                    {authorInitials}
                  </div>
                )}
                <span className="font-bold text-sm">{author.displayName}</span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="text-muted-foreground text-xs">{timeAgo}</span>
              </div>

              {/* Quoted content */}
              {post.content && (
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap break-words line-clamp-3">
                  {post.content}
                </p>
              )}

              {/* Quoted media preview */}
              {post.mediaUrls && post.mediaUrls.length > 0 && (
                <div className="mt-2 rounded-lg overflow-hidden" style={{ maxHeight: 120 }}>
                  {post.mediaType === 'video' ? (
                    <div className="bg-black/40 flex items-center justify-center h-20 rounded-lg text-muted-foreground text-xs">
                      🎬 Vídeo
                    </div>
                  ) : (
                    <img
                      src={post.mediaUrls[0]}
                      alt="Mídia"
                      className="w-full object-cover rounded-lg"
                      style={{ maxHeight: 120 }}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Char count */}
          <div className="flex items-center justify-between pt-1">
            <span className={`text-xs ${content.length > 250 ? 'text-destructive' : 'text-muted-foreground'}`}>
              {content.length}/280
            </span>
            <button
              onClick={handleSubmit}
              disabled={submitting || !content.trim()}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-md shadow-primary/30"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Citar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
