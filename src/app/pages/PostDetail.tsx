import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { PostCard } from '../components/PostCard';
import { projectId, publicAnonKey } from '/utils/supabase/info';

export function PostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!postId) return;
    fetchPost();
  }, [postId]);

  const fetchPost = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/${postId}`,
        {
          headers: {
            Authorization: `Bearer ${publicAnonKey}`,
          },
        }
      );
      if (!res.ok) {
        if (res.status === 404) {
          setError('Post não encontrado.');
        } else {
          setError('Erro ao carregar o post.');
        }
        return;
      }
      const data = await res.json();
      setPost(data);
    } catch (err) {
      console.error('Error fetching post:', err);
      setError('Erro ao carregar o post.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Voltar"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold">Post</h1>
      </div>

      <div className="p-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-muted-foreground text-lg">{error}</p>
            <Link
              to="/"
              className="text-primary hover:underline text-sm font-medium"
            >
              Voltar ao feed
            </Link>
          </div>
        )}

        {post && !loading && (
          <PostCard
            post={post}
            onDelete={() => navigate(-1)}
            onLike={fetchPost}
          />
        )}
      </div>
    </div>
  );
}
