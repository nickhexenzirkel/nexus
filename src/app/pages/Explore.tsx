import { useState, useRef, useCallback } from 'react';
import { useAuth } from '../components/AuthContext';
import { PostCard } from '../components/PostCard';
import { Link } from 'react-router';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Search, Loader2, Users, FileText, X } from 'lucide-react';

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
  quotedPost?: any;
}

interface UserResult {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
  username?: string;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function Explore() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<'posts' | 'users'>('posts');
  const [posts, setPosts] = useState<Post[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setPosts([]);
      setUsers([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const [postsRes, usersRes] = await Promise.all([
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/search?q=${encodeURIComponent(q)}`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
        ),
        fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/search?q=${encodeURIComponent(q)}`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
        ),
      ]);

      if (postsRes.ok) setPosts(await postsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (e) {
      console.error('Search error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 400);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(query);
  };

  const clearSearch = () => {
    setQuery('');
    setPosts([]);
    setUsers([]);
    setSearched(false);
    inputRef.current?.focus();
  };

  return (
    <div className="max-w-2xl mx-auto pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border px-4 py-4">
        <h1 className="text-xl font-bold mb-3 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" />
          Explorar
        </h1>
        <form onSubmit={handleSubmit} className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Pesquisar posts, pessoas..."
            className="w-full pl-10 pr-10 py-3 bg-muted border border-border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all text-foreground placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted-foreground/20 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </form>

        {/* Tabs */}
        {searched && (
          <div className="flex mt-3 border-b border-border -mb-px">
            <button
              onClick={() => setTab('posts')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                tab === 'posts'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText className="w-4 h-4" />
              Posts {posts.length > 0 && <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{posts.length}</span>}
            </button>
            <button
              onClick={() => setTab('users')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                tab === 'users'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-4 h-4" />
              Pessoas {users.length > 0 && <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded-full">{users.length}</span>}
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="px-4 pt-4">
        {/* Loading */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        )}

        {/* Empty state (not searched yet) */}
        {!loading && !searched && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(139,92,246,0.1)' }}
            >
              <Search className="w-9 h-9 text-primary/60" />
            </div>
            <p className="text-lg font-semibold">Explore o Nexus</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-xs">
              Pesquise por posts, pessoas ou palavras-chave para descobrir conteúdo
            </p>
            {/* Suggestions */}
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {['bom dia', 'trabalho', 'reunião', 'projeto', 'almoço'].map(s => (
                <button
                  key={s}
                  onClick={() => { setQuery(s); handleChange(s); }}
                  className="px-4 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors border border-primary/20"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* No results */}
        {!loading && searched && posts.length === 0 && users.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground/40" />
            </div>
            <p className="text-lg font-semibold">Nenhum resultado</p>
            <p className="text-muted-foreground text-sm mt-1">
              Tente outras palavras-chave
            </p>
          </div>
        )}

        {/* Posts results */}
        {!loading && searched && tab === 'posts' && posts.length > 0 && (
          <div className="space-y-4">
            {posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={() => doSearch(query)}
                onLike={() => doSearch(query)}
              />
            ))}
          </div>
        )}

        {/* Users results */}
        {!loading && searched && tab === 'users' && users.length > 0 && (
          <div className="space-y-2">
            {users.map(u => (
              <Link
                key={u.id}
                to={`/profile/${u.id}`}
                className="flex items-center gap-3 p-4 rounded-2xl hover:bg-muted/60 transition-colors border border-transparent hover:border-border group"
              >
                {u.avatar ? (
                  <img
                    src={u.avatar}
                    alt={u.displayName}
                    className="w-12 h-12 rounded-full object-cover border-2 border-border group-hover:border-primary/40 transition-colors shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold shrink-0">
                    {getInitials(u.displayName || 'U')}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate group-hover:text-primary transition-colors">
                    {u.displayName}
                  </p>
                  <p className="text-muted-foreground text-sm truncate">
                    @{u.username || `${u.firstName || ''}${u.lastName || ''}`.toLowerCase()}
                  </p>
                  {u.bio && (
                    <p className="text-muted-foreground text-xs mt-0.5 truncate">{u.bio}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Posts tab empty, users have results */}
        {!loading && searched && tab === 'posts' && posts.length === 0 && users.length > 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-sm">Nenhum post encontrado.</p>
            <button onClick={() => setTab('users')} className="text-primary text-sm font-medium mt-1 hover:underline">
              Ver pessoas encontradas →
            </button>
          </div>
        )}

        {/* Users tab empty, posts have results */}
        {!loading && searched && tab === 'users' && users.length === 0 && posts.length > 0 && (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-sm">Nenhuma pessoa encontrada.</p>
            <button onClick={() => setTab('posts')} className="text-primary text-sm font-medium mt-1 hover:underline">
              Ver posts encontrados →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
