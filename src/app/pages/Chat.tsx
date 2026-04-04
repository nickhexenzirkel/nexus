import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { useAuth } from '../components/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  Send, Loader2, MessageSquare, Search, X, ArrowLeft, Users, Plus
} from 'lucide-react';
import { formatDistanceToNow, format, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface Message {
  id: string;
  fromUserId: string;
  content: string;
  read: boolean;
  createdAt: string;
}

interface Conversation {
  partnerId: string;
  partnerProfile: UserProfile | null;
  lastMessage: Message | null;
  unreadCount: number;
}

interface UserProfile {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  bio?: string;
}

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getUsername(u: UserProfile) {
  return `${(u.firstName || '').toLowerCase()}${(u.lastName || '').toLowerCase()}` ||
    u.displayName.toLowerCase().replace(/\s+/g, '');
}

function formatMsgTime(dateStr: string) {
  const date = new Date(dateStr);
  if (isToday(date)) return format(date, 'HH:mm');
  return format(date, 'dd/MM');
}

export function Chat() {
  const { partnerId } = useParams<{ partnerId?: string }>();
  const { user, getAuthHeaders } = useAuth();
  const navigate = useNavigate();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [partnerProfile, setPartnerProfile] = useState<UserProfile | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  // New conversation modal
  const [showNewConv, setShowNewConv] = useState(false);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [loadingUsers, setLoadingUsers] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    if (partnerId && user) {
      loadMessages();
      loadPartnerProfile();

      // Poll for new messages every 3 seconds
      pollRef.current = setInterval(loadMessages, 3000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [partnerId, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    if (!user) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/dm/conversations`,
        { headers: authHeaders }
      );
      if (res.ok) {
        const data = await res.json();
        setConversations(data);
      }
    } catch (e) {
      console.error('Error loading conversations:', e);
    } finally {
      setLoadingConvs(false);
    }
  };

  const loadMessages = async () => {
    if (!user || !partnerId) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/dm/${partnerId}/messages`,
        { headers: authHeaders }
      );
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        // Also refresh conversations to update unread counts
        loadConversations();
      }
    } catch (e) {
      console.error('Error loading messages:', e);
    } finally {
      setLoadingMsgs(false);
    }
  };

  const loadPartnerProfile = async () => {
    if (!partnerId) return;
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users/${partnerId}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setPartnerProfile(data);
      }
    } catch (e) {
      console.error('Error loading partner profile:', e);
    }
  };

  const sendMessage = async () => {
    if (!user || !partnerId || !newMessage.trim() || sending) return;
    setSending(true);
    const content = newMessage.trim();
    setNewMessage('');
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/dm/${partnerId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ content }),
        }
      );
      if (res.ok) {
        const msg: Message = await res.json();
        setMessages(prev => [...prev, msg]);
        loadConversations();
      } else {
        toast.error('Erro ao enviar mensagem');
        setNewMessage(content);
      }
    } catch (e) {
      toast.error('Erro ao enviar mensagem');
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const loadAllUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/users`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data: UserProfile[] = await res.json();
        setAllUsers(data.filter(u => u.id !== user?.id));
      }
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const openNewConv = () => {
    setShowNewConv(true);
    loadAllUsers();
  };

  const startConversation = (targetUser: UserProfile) => {
    setShowNewConv(false);
    setUserSearch('');
    navigate(`/chat/${targetUser.id}`);
  };

  const filteredUsers = allUsers.filter(u =>
    u.displayName.toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div className="flex h-screen max-h-screen overflow-hidden">
      {/* Conversations Sidebar */}
      <div className={`w-80 border-r border-border flex flex-col shrink-0 bg-background ${partnerId ? 'hidden md:flex' : 'flex'}`}>
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Bate-papo
          </h2>
          <button
            onClick={openNewConv}
            className="p-2 rounded-full hover:bg-primary/10 text-primary transition-colors"
            title="Nova conversa"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageSquare className="w-7 h-7 text-muted-foreground/50" />
              </div>
              <p className="font-semibold text-foreground">Nenhuma conversa</p>
              <p className="text-sm text-muted-foreground mt-1">
                Clique em + para iniciar um bate-papo
              </p>
            </div>
          ) : (
            conversations.map((conv) => {
              const profile = conv.partnerProfile;
              const name = profile?.displayName || 'Usuário';
              const isActive = partnerId === conv.partnerId;

              return (
                <button
                  key={conv.partnerId}
                  onClick={() => navigate(`/chat/${conv.partnerId}`)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/60 transition-colors text-left border-b border-border/30 ${isActive ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
                >
                  <div className="relative shrink-0">
                    {profile?.avatar ? (
                      <img
                        src={profile.avatar}
                        alt={name}
                        className="w-11 h-11 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                        {getInitials(name)}
                      </div>
                    )}
                    {conv.unreadCount > 0 && (
                      <div className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white">{conv.unreadCount}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className={`font-semibold text-sm truncate ${conv.unreadCount > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                        {name}
                      </span>
                      {conv.lastMessage && (
                        <span className="text-xs text-muted-foreground shrink-0 ml-1">
                          {formatMsgTime(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                        {conv.lastMessage.fromUserId === user?.id ? 'Você: ' : ''}
                        {conv.lastMessage.content}
                      </p>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Chat Window */}
      {partnerId ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-3 bg-background/90 backdrop-blur-sm">
            <button
              onClick={() => navigate('/chat')}
              className="md:hidden p-2 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            {partnerProfile && (
              <Link to={`/profile/${partnerProfile.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                {partnerProfile.avatar ? (
                  <img
                    src={partnerProfile.avatar}
                    alt={partnerProfile.displayName}
                    className="w-10 h-10 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                    {getInitials(partnerProfile.displayName)}
                  </div>
                )}
                <div>
                  <p className="font-bold text-sm">{partnerProfile.displayName}</p>
                  <p className="text-xs text-muted-foreground">@{getUsername(partnerProfile)}</p>
                </div>
              </Link>
            )}
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {loadingMsgs ? (
              <div className="flex justify-center py-10">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-3">
                  <MessageSquare className="w-7 h-7 text-muted-foreground/50" />
                </div>
                <p className="font-semibold">Nenhuma mensagem</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Envie uma mensagem para começar a conversa!
                </p>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => {
                  const isOwn = msg.fromUserId === user?.id;
                  const showTime =
                    index === 0 ||
                    new Date(msg.createdAt).getTime() - new Date(messages[index - 1].createdAt).getTime() > 5 * 60 * 1000;

                  return (
                    <div key={msg.id}>
                      {showTime && (
                        <p className="text-center text-xs text-muted-foreground py-2">
                          {isToday(new Date(msg.createdAt))
                            ? format(new Date(msg.createdAt), 'HH:mm')
                            : format(new Date(msg.createdAt), "dd/MM 'às' HH:mm")}
                        </p>
                      )}
                      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words ${
                            isOwn
                              ? 'bg-primary text-white rounded-br-sm'
                              : 'bg-muted text-foreground rounded-bl-sm'
                          }`}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Message Input */}
          <div className="px-4 py-3 border-t border-border bg-background">
            <div className="flex items-center gap-3 bg-muted rounded-2xl px-4 py-2.5 border border-border focus-within:border-primary transition-colors">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Escreva uma mensagem..."
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                className="text-primary hover:text-primary/80 disabled:opacity-40 transition-colors p-1"
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* No conversation selected */
        <div className="flex-1 hidden md:flex items-center justify-center bg-background/50">
          <div className="text-center">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="w-10 h-10 text-muted-foreground/40" />
            </div>
            <h3 className="text-xl font-bold mb-2">Bate-papo</h3>
            <p className="text-muted-foreground max-w-xs">
              Selecione uma conversa ou inicie uma nova para começar a trocar mensagens.
            </p>
            <button
              onClick={openNewConv}
              className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-full font-semibold transition-all mx-auto shadow-lg shadow-primary/30"
            >
              <Plus className="w-4 h-4" />
              Nova conversa
            </button>
          </div>
        </div>
      )}

      {/* New Conversation Modal */}
      {showNewConv && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowNewConv(false); }}
        >
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Nova conversa
              </h3>
              <button
                onClick={() => { setShowNewConv(false); setUserSearch(''); }}
                className="p-2 rounded-full hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b border-border">
              <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 border border-border focus-within:border-primary transition-colors">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Buscar colaboradores..."
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                  autoFocus
                />
              </div>
            </div>

            {/* User list */}
            <div className="max-h-80 overflow-y-auto">
              {loadingUsers ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum usuário encontrado
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-muted/60 transition-colors text-left border-b border-border/30 last:border-0"
                  >
                    {u.avatar ? (
                      <img
                        src={u.avatar}
                        alt={u.displayName}
                        className="w-10 h-10 rounded-full object-cover border-2 border-border"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm shrink-0">
                        {getInitials(u.displayName)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{u.displayName}</p>
                      <p className="text-xs text-muted-foreground truncate">@{getUsername(u)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
