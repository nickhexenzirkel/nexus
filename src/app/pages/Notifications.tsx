import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../components/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Bell, Heart, MessageCircle, Repeat2, UserPlus, MessageSquare, Loader2, CheckCheck } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'like' | 'comment' | 'follow' | 'repost' | 'message';
  fromUserId: string;
  fromUserName: string;
  fromUserAvatar?: string;
  postId?: string;
  postContent?: string;
  content?: string;
  read: boolean;
  createdAt: string;
}

const notifIcons: Record<string, { icon: any; color: string; label: string }> = {
  like: { icon: Heart, color: 'text-pink-500', label: 'curtiu seu post' },
  comment: { icon: MessageCircle, color: 'text-primary', label: 'comentou no seu post' },
  repost: { icon: Repeat2, color: 'text-green-500', label: 'repostou seu post' },
  follow: { icon: UserPlus, color: 'text-blue-400', label: 'começou a te seguir' },
  message: { icon: MessageSquare, color: 'text-purple-400', label: 'te enviou uma mensagem' },
};

export function Notifications() {
  const { user, getAuthHeaders } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNotifications = async () => {
    if (!user) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/notifications`,
        { headers: authHeaders }
      );
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const markAllRead = async () => {
    if (!user) return;
    try {
      const authHeaders = await getAuthHeaders();
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/notifications/read`,
        { method: 'POST', headers: authHeaders }
      );
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('Todas as notificações marcadas como lidas');
    } catch (e) {
      console.error('Error marking read:', e);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            Notificações
            {unreadCount > 0 && (
              <span className="text-sm bg-primary text-white rounded-full px-2 py-0.5 font-bold">
                {unreadCount}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">Suas últimas atividades</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border hover:border-primary hover:text-primary transition-all text-sm font-medium"
          >
            <CheckCheck className="w-4 h-4" />
            Marcar tudo
          </button>
        )}
      </div>

      {/* Notifications list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <Bell className="w-9 h-9 text-muted-foreground/50" />
          </div>
          <p className="text-lg font-semibold text-foreground">Nenhuma notificação</p>
          <p className="text-muted-foreground text-sm mt-1">
            Quando alguém interagir com você, aparecerá aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {notifications.map((notif) => {
            const meta = notifIcons[notif.type] || notifIcons.like;
            const Icon = meta.icon;
            const timeAgo = formatDistanceToNow(new Date(notif.createdAt), {
              addSuffix: true,
              locale: ptBR,
            });

            const content = notif.type === 'message'
              ? `te enviou: "${notif.content}"`
              : notif.type === 'comment'
              ? `comentou: "${notif.postContent}"`
              : meta.label;

            return (
              <div
                key={notif.id}
                className={`flex items-start gap-4 p-4 rounded-2xl transition-all ${
                  notif.read
                    ? 'bg-card border border-border/50'
                    : 'bg-primary/5 border border-primary/20 shadow-sm'
                }`}
              >
                {/* Icon badge */}
                <div className={`mt-1 shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-card border border-border`}>
                  <Icon className={`w-4 h-4 ${meta.color}`} />
                </div>

                {/* Avatar */}
                <Link to={`/profile/${notif.fromUserId}`} className="shrink-0">
                  {notif.fromUserAvatar ? (
                    <img
                      src={notif.fromUserAvatar}
                      alt={notif.fromUserName}
                      className="w-10 h-10 rounded-full object-cover border-2 border-border hover:border-primary/50 transition-colors"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                      {getInitials(notif.fromUserName)}
                    </div>
                  )}
                </Link>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed">
                    <Link
                      to={`/profile/${notif.fromUserId}`}
                      className="font-bold hover:text-primary transition-colors"
                    >
                      {notif.fromUserName}
                    </Link>
                    {' '}
                    <span className="text-foreground/80">{content}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{timeAgo}</p>
                </div>

                {/* Unread dot */}
                {!notif.read && (
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
