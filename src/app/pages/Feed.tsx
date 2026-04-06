import { useState, useEffect } from 'react';
import { CreatePost } from '../components/CreatePost';
import { PostCard } from '../components/PostCard';
import { RightSidebar } from '../components/RightSidebar';
import { useAuth } from '../components/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Loader2, RefreshCw } from 'lucide-react';

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
  author?: any;
}

export function Feed() {
  const { accessToken } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = async (showRefreshing = false) => {
    if (showRefreshing) setRefreshing(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/feed?limit=30`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPosts(data);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFeed();
  }, []);

  const handlePostCreated = () => {
    loadFeed();
  };

  const handlePostDeleted = () => {
    loadFeed();
  };

  return (
    <div className="flex gap-0 min-h-screen">
      {/* Feed Column */}
      <div className="flex-1 min-w-0 border-r border-border">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold">Página Inicial</h1>
              <p className="text-muted-foreground text-sm">Veja o que está acontecendo</p>
            </div>
            <button
              onClick={() => loadFeed(true)}
              disabled={refreshing}
              className="p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-primary disabled:opacity-50"
              title="Atualizar feed"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Create post */}
          <div className="mb-6">
            <CreatePost onPostCreated={handlePostCreated} />
          </div>

          {/* Divider */}
          <div className="border-t border-border mb-6" />

          {/* Posts */}
          {loading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <span className="text-4xl">✨</span>
              </div>
              <p className="text-lg font-medium text-foreground mb-1">
                Nenhum post ainda
              </p>
              <p className="text-muted-foreground text-sm">
                Seja o primeiro a compartilhar algo!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onDelete={handlePostDeleted}
                  onLike={loadFeed}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-80 shrink-0 p-4 hidden xl:block">
        <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}