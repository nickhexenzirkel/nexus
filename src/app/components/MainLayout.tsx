import { Outlet, useNavigate, Link, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import { useEffect, useState, useRef } from 'react';
import { Home, User, LogOut, Bell, MessageSquare, MessageCircleMore, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import nexusLogo from 'figma:asset/b9fc9ba1c54f0166784e3d5c5adc4d2864a4bfba.png';
import { projectId } from '/utils/supabase/info';

export function MainLayout() {
  const { user, userProfile, signOut, loading, getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Collapsible sidebar state (persisted)
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  };

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  // Poll unread notification count
  useEffect(() => {
    if (!user) return;
    const fetchUnread = async () => {
      try {
        const authHeaders = await getAuthHeaders();
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/notifications/unread-count`,
          { headers: authHeaders }
        );
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.count || 0);
        }
      } catch (_) {}
    };
    fetchUnread();
    pollRef.current = setInterval(fetchUnread, 30000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [user]);

  // Reset badge when visiting notifications page
  useEffect(() => {
    if (location.pathname === '/notifications') setUnreadCount(0);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-primary text-xl animate-pulse">Carregando...</div>
      </div>
    );
  }

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = userProfile?.displayName || user.user_metadata?.displayName || 'Usuário';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const isChat = location.pathname.startsWith('/chat');

  const isActive = (to: string) => {
    if (to === '/') return location.pathname === '/';
    if (to === '/chat') return location.pathname.startsWith('/chat');
    return location.pathname.startsWith(to);
  };

  const navItems = [
    { to: '/', icon: Home, label: 'Página Inicial' },
    { to: '/explore', icon: Search, label: 'Explorar' },
    {
      to: '/notifications',
      icon: Bell,
      label: 'Notificações',
      badge: unreadCount > 0 ? unreadCount : null,
    },
    { to: '/chat', icon: MessageSquare, label: 'Bate-papo' },
    { to: '/notes', icon: MessageCircleMore, label: 'Notas' },
    { to: `/profile/${user.id}`, icon: User, label: 'Meu Perfil' },
  ];

  const sidebarW = collapsed ? 'w-16' : 'w-64';
  const mainML = collapsed ? 'ml-16' : 'ml-64';

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className={`${sidebarW} border-r border-border fixed h-full flex flex-col z-20 transition-all duration-300 overflow-hidden bg-background`}>

        {/* Logo */}
        <div className={`flex items-center border-b border-border/50 h-[73px] shrink-0 ${collapsed ? 'justify-center px-2' : 'px-5 gap-3'}`}>
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <img
              src={nexusLogo}
              alt="Nexus"
              className="w-11 h-11 object-contain group-hover:scale-105 transition-transform shrink-0"
              style={{ filter: 'drop-shadow(0 0 8px rgba(139,92,246,0.5))' }}
            />
            {!collapsed && (
              <span
                className="text-2xl font-black tracking-widest whitespace-nowrap"
                style={{
                  fontFamily: "'Orbitron', sans-serif",
                  background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 50%, #7c3aed 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  letterSpacing: '0.15em',
                }}
              >
                NEXUS
              </span>
            )}
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ to, icon: Icon, label, badge }) => {
            const active = isActive(to);
            return (
              <Link
                key={to}
                to={to}
                title={collapsed ? label : undefined}
                className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-xl transition-all group relative ${
                  active ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <div className="relative shrink-0">
                  <Icon className={`w-6 h-6 transition-colors ${active ? 'text-primary' : 'group-hover:text-primary'}`} />
                  {badge && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <span className={`font-medium whitespace-nowrap text-sm ${active ? 'font-semibold' : ''}`}>
                    {label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className={`px-2 py-2 border-t border-border/50 ${collapsed ? 'flex justify-center' : ''}`}>
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground group"
            style={collapsed ? { justifyContent: 'center' } : {}}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 group-hover:text-primary transition-colors" />
            ) : (
              <>
                <ChevronLeft className="w-5 h-5 group-hover:text-primary transition-colors shrink-0" />
                <span className="text-sm font-medium whitespace-nowrap">Recolher</span>
              </>
            )}
          </button>
        </div>

        {/* User info */}
        <div className={`p-2 border-t border-border space-y-1`}>
          <Link
            to={`/profile/${user.id}`}
            title={collapsed ? displayName : undefined}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted transition-colors ${collapsed ? 'justify-center' : ''}`}
          >
            {userProfile?.avatar ? (
              <img
                src={userProfile.avatar}
                alt={displayName}
                className="w-9 h-9 rounded-full object-cover border-2 border-primary/30 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm shrink-0">
                {initials}
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{displayName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  @{userProfile?.username || `${(userProfile?.firstName || '').toLowerCase()}${(userProfile?.lastName || '').toLowerCase()}`}
                </div>
              </div>
            )}
          </Link>

          <button
            onClick={handleSignOut}
            title={collapsed ? 'Sair' : undefined}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all w-full ${collapsed ? 'justify-center' : ''}`}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!collapsed && <span className="font-medium text-sm">Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${mainML} flex-1 min-h-screen transition-all duration-300 ${isChat ? 'overflow-hidden h-screen' : ''}`}>
        <Outlet />
      </main>
    </div>
  );
}