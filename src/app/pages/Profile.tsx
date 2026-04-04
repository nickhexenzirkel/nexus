import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useAuth } from '../components/AuthContext';
import { PostCard } from '../components/PostCard';
import { ImageAdjustModal } from '../components/ImageAdjustModal';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  Loader2, Camera, Edit2, X, Save, CalendarDays,
  ArrowLeft, UserPlus, UserCheck, MessageSquare,
  Image as ImageIcon, Heart, MessageCircle, AtSign
} from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserProfile {
  id: string;
  displayName: string;
  bio: string;
  avatar: string;
  banner: string;
  firstName: string;
  lastName: string;
  username?: string;
  createdAt?: string;
}

interface Post {
  id: string;
  userId: string;
  content: string;
  mediaUrls: string[];
  mediaType: 'image' | 'video' | null;
  isRepost?: boolean;
  likes: string[];
  reposts: string[];
  comments: any[];
  createdAt: string;
  author?: any;
  quotedPost?: any;
}

type ProfileTab = 'posts' | 'replies' | 'media';

export function Profile() {
  const { userId } = useParams<{ userId: string }>();
  const { user, userProfile: currentUserProfile, refreshProfile, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [replies, setReplies] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabLoading, setTabLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts');

  const [uploading, setUploading] = useState<'avatar' | 'banner' | null>(null);

  // Image adjust state
  const [adjustFile, setAdjustFile] = useState<File | null>(null);
  const [adjustType, setAdjustType] = useState<'avatar' | 'banner'>('avatar');

  // Follow state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followLoading, setFollowLoading] = useState(false);

  // Edit modal state
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editedDisplayName, setEditedDisplayName] = useState('');
  const [editedBio, setEditedBio] = useState('');
  const [editedUsername, setEditedUsername] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const isOwnProfile = user?.id === userId;

  const loadProfile = useCallback(async () => {
    if (!userId) return;
    try {
      const [profileRes, postsRes, followersRes, followingRes] = await Promise.all([
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${userId}`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/user/${userId}`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${userId}/followers`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }),
        fetch(`https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${userId}/following`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setProfile(profileData);
        setEditedDisplayName(profileData.displayName || '');
        setEditedBio(profileData.bio || '');
        setEditedUsername(profileData.username || '');
      }
      if (postsRes.ok) {
        const postsData = await postsRes.json();
        setPosts(postsData.filter((p: Post) => !p.isRepost));
      }
      if (followersRes.ok) {
        const followersData = await followersRes.json();
        setFollowersCount(followersData.count || 0);
        if (user && !isOwnProfile) {
          setIsFollowing(followersData.followers?.includes(user.id) || false);
        }
      }
      if (followingRes.ok) {
        const followingData = await followingRes.json();
        setFollowingCount(followingData.count || 0);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      toast.error('Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  }, [userId, user, isOwnProfile]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  useEffect(() => {
    if (isOwnProfile && currentUserProfile) {
      setProfile(currentUserProfile as UserProfile);
    }
  }, [currentUserProfile, isOwnProfile]);

  // Load tab data on demand
  const loadTabData = useCallback(async (tab: ProfileTab) => {
    if (!userId) return;
    if (tab === 'posts') return; // already loaded

    setTabLoading(true);
    try {
      if (tab === 'replies') {
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts/user/${userId}/replies`,
          { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
        );
        if (res.ok) setReplies(await res.json());
      }
    } catch (e) {
      console.error(`Error loading tab ${tab}:`, e);
    } finally {
      setTabLoading(false);
    }
  }, [userId]);

  const handleTabChange = (tab: ProfileTab) => {
    setActiveTab(tab);
    loadTabData(tab);
  };

  const handleFollow = async () => {
    if (!user || !userId) return;
    setFollowLoading(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${userId}/follow`,
        { method: 'POST', headers: authHeaders }
      );
      if (res.ok) {
        const data = await res.json();
        setIsFollowing(data.following);
        setFollowersCount(data.followersCount);
        toast.success(data.following ? '✅ Seguindo!' : 'Deixou de seguir');
      }
    } catch (e) {
      toast.error('Erro ao seguir');
    } finally {
      setFollowLoading(false);
    }
  };

  // Triggered after image adjustment — upload the cropped blob
  const handleAdjustedImage = async (blob: Blob) => {
    setAdjustFile(null);
    const type = adjustType;
    const authHeaders = await getAuthHeaders();
    if (!authHeaders['X-User-Token']) return;

    setUploading(type);
    try {
      const ext = 'jpg';
      const filename = `${type}_${Date.now()}.${ext}`;

      const signRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/upload/sign`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ filename, contentType: 'image/jpeg', fileSize: blob.size }),
        }
      );
      if (!signRes.ok) throw new Error('Falha ao obter URL de upload');

      const { signedUrl, publicUrl, contentType } = await signRes.json();
      const uploadRes = await fetch(signedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType || 'image/jpeg' },
        body: blob,
      });
      if (!uploadRes.ok) throw new Error('Falha ao enviar arquivo');

      const updateRes = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ [type]: publicUrl }),
        }
      );
      if (!updateRes.ok) throw new Error('Falha ao atualizar perfil');

      const updatedProfile = await updateRes.json();
      setProfile(updatedProfile);
      if (isOwnProfile) await refreshProfile();
      toast.success(type === 'avatar' ? '📸 Foto de perfil atualizada!' : '🖼️ Foto de capa atualizada!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao fazer upload');
    } finally {
      setUploading(null);
    }
  };

  // When user picks a file, open the adjust modal
  const handleFileSelected = (file: File, type: 'avatar' | 'banner') => {
    if (!file.type.startsWith('image/')) { toast.error('Por favor, selecione uma imagem'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Imagem muito grande. Máximo de 10 MB'); return; }
    setAdjustType(type);
    setAdjustFile(file);
  };

  const handleSaveProfile = async () => {
    if (!userId) return;
    if (!editedDisplayName.trim()) { toast.error('O nome de exibição não pode estar vazio'); return; }

    const authHeaders = await getAuthHeaders();
    if (!authHeaders['X-User-Token']) return;

    setSavingProfile(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            displayName: editedDisplayName.trim(),
            bio: editedBio.trim(),
            username: editedUsername.trim().replace(/^@/, '').toLowerCase(),
          }),
        }
      );
      if (!response.ok) throw new Error('Falha ao atualizar perfil');

      const updatedProfile = await response.json();
      setProfile(updatedProfile);
      if (isOwnProfile) await refreshProfile();
      setEditModalOpen(false);
      toast.success('✅ Perfil atualizado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar perfil');
    } finally {
      setSavingProfile(false);
    }
  };

  const openEditModal = () => {
    if (profile) {
      setEditedDisplayName(profile.displayName || '');
      setEditedBio(profile.bio || '');
      setEditedUsername(profile.username || '');
      setEditModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="w-10 h-10 text-primary animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col justify-center items-center min-h-[60vh] gap-4">
        <p className="text-muted-foreground text-lg">Perfil não encontrado</p>
        <Link to="/" className="text-primary hover:underline flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Voltar ao feed
        </Link>
      </div>
    );
  }

  const initials = profile.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const joinedDate = profile.createdAt ? format(new Date(profile.createdAt), "MMMM 'de' yyyy", { locale: ptBR }) : null;

  const usernameDisplay = profile.username
    ? `@${profile.username}`
    : `@${(profile.firstName || '').toLowerCase()}${(profile.lastName || '').toLowerCase()}`;

  // Media posts (only own posts with media)
  const mediaPosts = posts.filter(p => p.mediaUrls && p.mediaUrls.length > 0);

  const tabs: { key: ProfileTab; label: string; icon: React.ReactNode }[] = [
    { key: 'posts', label: 'Posts', icon: <Edit2 className="w-4 h-4" /> },
    { key: 'replies', label: 'Respostas', icon: <MessageCircle className="w-4 h-4" /> },
    { key: 'media', label: 'Mídia', icon: <ImageIcon className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-3xl mx-auto pb-10">
      {/* Image adjust modal */}
      {adjustFile && (
        <ImageAdjustModal
          file={adjustFile}
          shape={adjustType === 'avatar' ? 'circle' : 'rect'}
          aspectRatio={adjustType === 'banner' ? 3 : 1}
          onConfirm={handleAdjustedImage}
          onCancel={() => setAdjustFile(null)}
        />
      )}

      {/* Back button */}
      <div className="flex items-center gap-4 p-4 sticky top-0 bg-background/80 backdrop-blur-md z-10 border-b border-border">
        <Link to="/" className="p-2 hover:bg-muted rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-bold text-lg leading-tight">{profile.displayName}</h1>
          <p className="text-muted-foreground text-sm">{posts.length} posts</p>
        </div>
      </div>

      {/* Banner */}
      <div className="relative h-52 bg-gradient-to-br from-primary via-purple-600 to-secondary overflow-hidden group/banner">
        {profile.banner && (
          <img src={profile.banner} alt="Banner" className="w-full h-full object-cover" />
        )}
        {isOwnProfile && (
          <>
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/banner:opacity-100 transition-opacity bg-black/30">
              <button
                onClick={() => bannerInputRef.current?.click()}
                disabled={!!uploading}
                className="bg-black/60 hover:bg-black/80 backdrop-blur-sm text-white px-4 py-2 rounded-full flex items-center gap-2 transition-all"
              >
                {uploading === 'banner' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
                <span className="text-sm font-medium">{uploading === 'banner' ? 'Enviando...' : 'Alterar capa'}</span>
              </button>
            </div>
            <button
              onClick={() => bannerInputRef.current?.click()}
              disabled={!!uploading}
              className="absolute top-4 right-4 bg-black/60 hover:bg-black/80 p-2.5 rounded-full cursor-pointer transition-colors disabled:opacity-50"
              title="Alterar foto de capa"
            >
              {uploading === 'banner' ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
            </button>
          </>
        )}
        <input
          ref={bannerInputRef}
          type="file"
          accept="image/*"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f, 'banner'); e.target.value = ''; }}
          className="hidden"
        />
      </div>

      <div className="px-6">
        {/* Avatar + Action buttons row */}
        <div className="flex items-end justify-between -mt-16 mb-4">
          {/* Avatar */}
          <div className="relative group/avatar">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                alt={profile.displayName}
                className="w-32 h-32 rounded-full border-4 border-background object-cover shadow-xl"
              />
            ) : (
              <div className="w-32 h-32 rounded-full border-4 border-background bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-3xl font-bold shadow-xl">
                {initials}
              </div>
            )}
            {isOwnProfile && (
              <button
                onClick={() => avatarInputRef.current?.click()}
                disabled={!!uploading}
                className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-all disabled:opacity-60 cursor-pointer"
                title="Alterar foto de perfil"
              >
                {uploading === 'avatar' ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
              </button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f, 'avatar'); e.target.value = ''; }}
              className="hidden"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 mt-16">
            {isOwnProfile ? (
              <button
                onClick={openEditModal}
                className="flex items-center gap-2 border border-border hover:border-primary hover:text-primary px-5 py-2 rounded-full font-semibold transition-all text-sm"
              >
                <Edit2 className="w-4 h-4" />
                Editar perfil
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate(`/chat/${userId}`)}
                  className="flex items-center gap-2 border border-border hover:border-primary hover:text-primary px-4 py-2 rounded-full font-semibold transition-all text-sm"
                  title="Enviar mensagem"
                >
                  <MessageSquare className="w-4 h-4" />
                  Mensagem
                </button>
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center gap-2 px-5 py-2 rounded-full font-semibold transition-all text-sm disabled:opacity-60 ${
                    isFollowing
                      ? 'border border-border hover:border-destructive hover:text-destructive'
                      : 'bg-foreground text-background hover:bg-foreground/90'
                  }`}
                >
                  {followLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isFollowing ? <><UserCheck className="w-4 h-4" />Seguindo</> : <><UserPlus className="w-4 h-4" />Seguir</>}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Profile Info */}
        <div className="mb-4">
          <h2 className="text-2xl font-bold">{profile.displayName}</h2>
          <p className="text-muted-foreground text-sm mt-0.5">{usernameDisplay}</p>

          {profile.bio && (
            <p className="text-foreground mt-3 leading-relaxed">{profile.bio}</p>
          )}

          <div className="flex flex-wrap gap-4 mt-3 text-muted-foreground text-sm">
            {joinedDate && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4" />
                Entrou em {joinedDate}
              </span>
            )}
          </div>

          <div className="flex gap-6 mt-4">
            <div>
              <span className="font-bold">{posts.length}</span>
              <span className="text-muted-foreground ml-1 text-sm">Posts</span>
            </div>
            <div>
              <span className="font-bold">{followersCount}</span>
              <span className="text-muted-foreground ml-1 text-sm">Seguidores</span>
            </div>
            <div>
              <span className="font-bold">{followingCount}</span>
              <span className="text-muted-foreground ml-1 text-sm">Seguindo</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-border mb-4 flex">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 font-semibold text-sm border-b-2 transition-colors -mb-px ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tabLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* Posts Tab */}
            {activeTab === 'posts' && (
              posts.length === 0 ? (
                <EmptyState icon={<Edit2 className="w-8 h-8 opacity-40" />} text="Nenhum post ainda" sub={isOwnProfile ? 'Compartilhe algo com o mundo!' : undefined} />
              ) : (
                <div className="space-y-4">
                  {posts.map(post => (
                    <PostCard key={post.id} post={post} onDelete={loadProfile} onLike={loadProfile} />
                  ))}
                </div>
              )
            )}

            {/* Replies Tab */}
            {activeTab === 'replies' && (
              replies.length === 0 ? (
                <EmptyState icon={<MessageCircle className="w-8 h-8 opacity-40" />} text="Nenhuma resposta ainda" />
              ) : (
                <div className="space-y-4">
                  {replies.map(post => (
                    <PostCard key={post.id} post={post} onDelete={() => loadTabData('replies')} onLike={() => loadTabData('replies')} />
                  ))}
                </div>
              )
            )}

            {/* Media Tab */}
            {activeTab === 'media' && (
              mediaPosts.length === 0 ? (
                <EmptyState icon={<ImageIcon className="w-8 h-8 opacity-40" />} text="Nenhuma mídia ainda" />
              ) : (
                <div className="grid grid-cols-3 gap-1">
                  {mediaPosts.map(post => {
                    const url = post.mediaUrls[0];
                    const isVideo = post.mediaType === 'video';
                    return (
                      <Link
                        key={post.id}
                        to={`/post/${post.id}`}
                        className="relative aspect-square bg-muted rounded-sm overflow-hidden group hover:opacity-90 transition-opacity"
                      >
                        {isVideo ? (
                          <video
                            src={url}
                            className="w-full h-full object-cover"
                            muted
                            preload="metadata"
                          />
                        ) : (
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        )}
                        {isVideo && (
                          <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-medium">
                            ▶
                          </div>
                        )}
                        {post.mediaUrls.length > 1 && (
                          <div className="absolute top-1.5 right-1.5 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded-full font-medium">
                            +{post.mediaUrls.length - 1}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setEditModalOpen(false); }}
        >
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-xl font-bold">Editar perfil</h2>
              <button onClick={() => setEditModalOpen(false)} className="p-2 hover:bg-muted rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal body */}
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
              {/* Avatar preview in modal */}
              <div className="flex items-center gap-4">
                {profile.avatar ? (
                  <img src={profile.avatar} alt={profile.displayName} className="w-16 h-16 rounded-full object-cover border-2 border-primary/30" />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xl font-bold">
                    {initials}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium">Foto de perfil</p>
                  <button
                    onClick={() => { setEditModalOpen(false); setTimeout(() => avatarInputRef.current?.click(), 100); }}
                    className="text-primary text-sm hover:underline mt-0.5"
                  >
                    Alterar foto
                  </button>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-1.5">
                  Nome de exibição
                </label>
                <input
                  value={editedDisplayName}
                  onChange={(e) => setEditedDisplayName(e.target.value)}
                  maxLength={50}
                  placeholder="Seu nome"
                  className="w-full px-4 py-3 bg-input-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{editedDisplayName.length}/50</p>
              </div>

              {/* Username */}
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-1.5">
                  Nome de usuário (@)
                </label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={editedUsername}
                    onChange={(e) => setEditedUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                    maxLength={30}
                    placeholder={`${(profile.firstName || '').toLowerCase()}${(profile.lastName || '').toLowerCase()}`}
                    className="w-full pl-9 pr-4 py-3 bg-input-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all text-foreground"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Apenas letras, números e _ · {editedUsername.length}/30
                </p>
              </div>

              {/* Bio */}
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-1.5">
                  Biografia
                </label>
                <textarea
                  value={editedBio}
                  onChange={(e) => setEditedBio(e.target.value)}
                  maxLength={160}
                  placeholder="Conte um pouco sobre você..."
                  className="w-full px-4 py-3 bg-input-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none text-foreground"
                  rows={4}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{editedBio.length}/160</p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-3 px-6 pb-6">
              <button
                onClick={() => setEditModalOpen(false)}
                disabled={savingProfile}
                className="px-5 py-2.5 rounded-full border border-border hover:bg-muted transition-colors font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={savingProfile || !editedDisplayName.trim()}
                className="px-5 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold transition-all disabled:opacity-50 flex items-center gap-2 shadow-md shadow-primary/30"
              >
                {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, text, sub }: { icon: React.ReactNode; text: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-lg font-medium">{text}</p>
      {sub && <p className="text-sm mt-1">{sub}</p>}
    </div>
  );
}