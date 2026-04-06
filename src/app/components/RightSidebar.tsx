import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from './AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { TrendingUp, Users, Loader2, MoreHorizontal, UserPlus, MessageCircle, Flame, Heart, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TrendingTopic {
  topic: string;
  count: number;
  userCount: number;
}

interface UserProfile {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
}

export function RightSidebar() {
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [trending, setTrending] = useState<TrendingTopic[]>([]);
  const [suggestions, setSuggestions] = useState<UserProfile[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [loadingFollow, setLoadingFollow] = useState<string | null>(null);
  const [loadingTrending, setLoadingTrending] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  // Hit do momento
  const [hitPost, setHitPost] = useState<any | null>(null);
  const [loadingHit, setLoadingHit] = useState(true);

  useEffect(() => {
    loadTrending();
    loadHitOfDay();
    if (user) {
      loadSuggestions();
    }
  }, [user]);

  const loadTrending = async (attempt = 0) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/trending`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` }, signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setTrending(data);
      }
    } catch (e: any) {
      if (attempt < 2) {
        setTimeout(() => loadTrending(attempt + 1), 2000 * (attempt + 1));
        return;
      }
      console.error('Error loading trending:', e?.message || e);
    } finally {
      setLoadingTrending(false);
    }
  };

  const loadHitOfDay = async (attempt = 0) => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/hit-of-day`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` }, signal: controller.signal }
      );
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setHitPost(data);
      }
    } catch (e: any) {
      if (attempt < 2) {
        setTimeout(() => loadHitOfDay(attempt + 1), 2000 * (attempt + 1));
        return;
      }
      console.error('Error loading hit of day:', e?.message || e);
    } finally {
      setLoadingHit(false);
    }
  };

  const loadSuggestions = async (attempt = 0) => {
    if (!user) return;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const headers = { 'Authorization': `Bearer ${publicAnonKey}` };
      const [usersRes, followingRes] = await Promise.all([
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users`, { headers, signal: controller.signal }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${user.id}/following`, { headers, signal: controller.signal }),
      ]);
      clearTimeout(timeout);

      if (usersRes.ok && followingRes.ok) {
        const allUsers: UserProfile[] = await usersRes.json();
        const followingData = await followingRes.json();
        const myFollowing: string[] = followingData.following || [];
        setFollowing(myFollowing);

        const filtered = allUsers.filter(u => u.id !== user.id && !myFollowing.includes(u.id)).slice(0, 8);
        setSuggestions(filtered);
      }
    } catch (e: any) {
      if (attempt < 2) {
        setTimeout(() => loadSuggestions(attempt + 1), 2000 * (attempt + 1));
        return;
      }
      console.error('Error loading suggestions:', e?.message || e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleFollow = async (targetUserId: string) => {
    if (!user) { toast.error('Faça login para seguir'); return; }
    setLoadingFollow(targetUserId);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${targetUserId}/follow`,
        { method: 'POST', headers: authHeaders }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.following) {
          setFollowing(prev => [...prev, targetUserId]);
          setSuggestions(prev => prev.filter(s => s.id !== targetUserId));
          toast.success('Seguindo!');
        }
      }
    } catch {
      toast.error('Erro ao seguir');
    } finally {
      setLoadingFollow(null);
    }
  };

  const displayedSuggestions = showAllSuggestions ? suggestions : suggestions.slice(0, 3);

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const getUsername = (u: UserProfile) =>
    `${(u.firstName || '').toLowerCase()}${(u.lastName || '').toLowerCase()}` ||
    u.displayName.toLowerCase().replace(/\s+/g, '');

  return (
    <div className="space-y-4">
      {/* Trending Topics */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            O que está acontecendo
          </h2>
        </div>

        {loadingTrending ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : trending.length === 0 ? (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">
            Nenhum assunto em destaque ainda
          </div>
        ) : (
          <div>
            {trending.map((item) => (
              <div
                key={item.topic}
                className="px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border/30 last:border-0 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground">
                      Nexus · Assunto do Momento
                    </p>
                    <p className="font-bold text-foreground mt-0.5 truncate">
                      {item.topic}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {item.count} {item.count === 1 ? 'menção' : 'menções'} · {item.userCount} {item.userCount === 1 ? 'pessoa' : 'pessoas'}
                    </p>
                  </div>
                  <button className="p-1.5 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-all">
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hit do Momento */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border/50">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Hit do momento
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Post mais curtido e comentado do dia</p>
        </div>

        {loadingHit ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : !hitPost ? (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">
            Nenhum post em destaque hoje ainda 🌟
          </div>
        ) : (
          <div className="p-3">
            {/* Hit post preview */}
            <Link to={`/post/${hitPost.id}`} className="block group">
              <div className="flex items-start gap-2.5 mb-2">
                {hitPost.author?.avatar ? (
                  <img
                    src={hitPost.author.avatar}
                    alt={hitPost.author?.displayName}
                    className="w-9 h-9 rounded-full object-cover border-2 border-orange-500/30 shrink-0"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xs shrink-0">
                    {getInitials(hitPost.author?.displayName || '?')}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">
                    {hitPost.author?.displayName || 'Usuário'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(hitPost.createdAt), { addSuffix: true, locale: ptBR })}
                  </p>
                </div>
                <div className="shrink-0">
                  <span className="text-[10px] bg-orange-500/15 text-orange-400 border border-orange-500/20 rounded-full px-2 py-0.5 font-bold">
                    🔥 Hit
                  </span>
                </div>
              </div>

              {hitPost.content && (
                <p className="text-sm text-foreground/90 leading-relaxed line-clamp-3 mb-2 ml-11">
                  {hitPost.content}
                </p>
              )}

              {hitPost.mediaUrls && hitPost.mediaUrls.length > 0 && (
                <div className="ml-11 rounded-xl overflow-hidden mb-2">
                  {hitPost.mediaType === 'video' ? (
                    <video src={hitPost.mediaUrls[0]} controls className="w-full rounded-xl" style={{ maxHeight: 300 }} />
                  ) : (
                    <img src={hitPost.mediaUrls[0]} alt="Mídia" className="w-full object-cover rounded-xl" style={{ maxHeight: 300 }} />
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-3 ml-11 text-xs text-muted-foreground">
                <span className="flex items-center gap-1 text-pink-500">
                  <Heart className="w-3.5 h-3.5" />
                  {hitPost.likes?.length || 0}
                </span>
                <span className="flex items-center gap-1 text-primary">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {hitPost.comments?.length || 0}
                </span>
                <span className="text-muted-foreground/60 text-[10px] ml-auto">
                  Score: {hitPost.score || 0}
                </span>
              </div>
            </Link>
          </div>
        )}
      </div>

      {/* Who to Follow — hidden when there are no suggestions (following everyone) */}
      {user && (loadingUsers || suggestions.length > 0) && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border/50">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Quem seguir
            </h2>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : suggestions.length === 0 ? null : (
            <div>
              {displayedSuggestions.map((suggestion) => (
                <div key={suggestion.id} className="px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/30 last:border-0">
                  <div className="flex items-center gap-3">
                    <Link to={`/profile/${suggestion.id}`} className="shrink-0">
                      {suggestion.avatar ? (
                        <img src={suggestion.avatar} alt={suggestion.displayName} className="w-10 h-10 rounded-full object-cover border-2 border-border hover:border-primary/50 transition-colors" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                          {getInitials(suggestion.displayName)}
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 min-w-0">
                      <Link to={`/profile/${suggestion.id}`} className="font-bold text-sm hover:text-primary transition-colors truncate block">
                        {suggestion.displayName}
                      </Link>
                      <p className="text-xs text-muted-foreground truncate">
                        @{getUsername(suggestion)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => navigate(`/chat/${suggestion.id}`)}
                        className="p-1.5 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                        title="Enviar mensagem"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFollow(suggestion.id)}
                        disabled={loadingFollow === suggestion.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-foreground hover:bg-foreground hover:text-background transition-all text-xs font-bold disabled:opacity-50"
                      >
                        {loadingFollow === suggestion.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <UserPlus className="w-3 h-3" />
                            Seguir
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {suggestions.length > 3 && (
                <button
                  onClick={() => setShowAllSuggestions(!showAllSuggestions)}
                  className="w-full px-4 py-3 text-primary hover:bg-primary/5 transition-colors text-sm font-medium text-left"
                >
                  {showAllSuggestions ? 'Mostrar menos' : 'Mostrar mais'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-2">
        <p className="text-xs text-muted-foreground">
          © 2026 Nexus · Desenvolvido por{' '}
          <span className="text-primary font-medium">Dodoco</span>
        </p>
      </div>
    </div>
  );
}