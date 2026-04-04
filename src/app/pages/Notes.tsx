import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../components/AuthContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { MessageCircleMore, Plus, X, Pencil, Trash2, Loader2, SmilePlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface NoteAuthor {
  id: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

interface Note {
  userId: string;
  content: string;
  emoji: string;
  createdAt: string;
  author?: NoteAuthor;
}

const PRESET_EMOJIS = [
  '😊', '😢', '😡', '😍', '🤔', '😴', '🥳', '😎',
  '🤗', '💪', '🙏', '❤️', '😂', '🥺', '😤', '✨',
  '🎉', '🤯', '😅', '👀', '🔥', '💯', '🌟', '😌',
  '🥰', '😰', '🤩', '😶', '💤', '🫡', '🎭', '🏆',
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

interface NoteCircleProps {
  note: Note | null;
  isOwn?: boolean;
  onClick: () => void;
  currentUserId?: string;
}

function NoteCircle({ note, isOwn, onClick }: NoteCircleProps) {
  const author = note?.author || null;
  const name = isOwn ? 'Minha nota' : (author?.displayName || 'Usuário');
  const hasNote = !!note;
  const initials = author ? getInitials(author.displayName) : '?';

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-2 group"
      style={{ minWidth: 80 }}
    >
      <div className="relative">
        <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center transition-transform group-hover:scale-105 ${
          hasNote
            ? 'p-[2px] bg-gradient-to-br from-primary via-purple-400 to-pink-500'
            : isOwn
            ? 'border-2 border-dashed border-primary/60'
            : 'border-2 border-border'
        }`}>
          <div className={`w-full h-full rounded-full overflow-hidden flex items-center justify-center ${hasNote ? 'bg-background' : 'bg-muted'}`}>
            {author?.avatar ? (
              <img src={author.avatar} alt={author.displayName} className="w-full h-full object-cover rounded-full" />
            ) : isOwn && !hasNote ? (
              <Plus className="w-6 h-6 text-primary" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                {initials}
              </div>
            )}
          </div>
        </div>

        {hasNote && note.emoji && (
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-card border-2 border-border flex items-center justify-center text-xs shadow-sm">
            {note.emoji}
          </div>
        )}
      </div>

      <span className="text-xs text-muted-foreground truncate text-center font-medium" style={{ maxWidth: 76 }}>
        {name}
      </span>

      {hasNote && note.content && (
        <span className="text-[10px] text-muted-foreground/70 truncate text-center leading-tight" style={{ maxWidth: 76 }}>
          {note.content.slice(0, 20)}{note.content.length > 20 ? '...' : ''}
        </span>
      )}
    </button>
  );
}

export function Notes() {
  const { user, userProfile, getAuthHeaders } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [myNote, setMyNote] = useState<Note | null>(null);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteEmoji, setNoteEmoji] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  const loadNotes = async () => {
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/notes`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      if (res.ok) {
        const data: Note[] = await res.json();
        setNotes(data);
        const mine = data.find(n => n.userId === user?.id) || null;
        setMyNote(mine);
        if (mine) {
          setNoteContent(mine.content);
          setNoteEmoji(mine.emoji);
        }
      }
    } catch (e) {
      console.error('Error loading notes:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadNotes();
  }, [user]);

  const handleSaveNote = async () => {
    if (!noteContent.trim() && !noteEmoji) {
      toast.error('Adicione um texto ou emoji à sua nota');
      return;
    }
    setSaving(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/notes`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({ content: noteContent.trim(), emoji: noteEmoji }),
        }
      );
      if (res.ok) {
        toast.success('✅ Nota atualizada!');
        setShowModal(false);
        loadNotes();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Erro ao salvar nota');
      }
    } catch (e) {
      toast.error('Erro ao salvar nota');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!confirm('Excluir sua nota?')) return;
    setDeleting(true);
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/notes`,
        { method: 'DELETE', headers: authHeaders }
      );
      if (res.ok) {
        toast.success('Nota excluída');
        setMyNote(null);
        setNoteContent('');
        setNoteEmoji('');
        setShowModal(false);
        loadNotes();
      }
    } catch (e) {
      toast.error('Erro ao excluir nota');
    } finally {
      setDeleting(false);
    }
  };

  const openModal = (existing?: Note | null) => {
    if (existing) {
      setNoteContent(existing.content);
      setNoteEmoji(existing.emoji);
    } else {
      setNoteContent('');
      setNoteEmoji('');
    }
    setShowEmojiPicker(false);
    setShowModal(true);
  };

  const otherNotes = notes.filter(n => n.userId !== user?.id);

  const myNoteForCircle: Note | null = myNote
    ? {
        ...myNote,
        author: userProfile
          ? {
              id: user!.id,
              displayName: userProfile.displayName,
              avatar: userProfile.avatar,
              firstName: userProfile.firstName,
              lastName: userProfile.lastName,
            }
          : undefined,
      }
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircleMore className="w-6 h-6 text-primary" />
          Notas
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">Veja o que seus colegas estão sentindo</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* Story-style horizontal row */}
          <div className="bg-card border border-border rounded-2xl p-4 mb-6">
            <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
              <NoteCircle
                note={myNoteForCircle}
                isOwn
                onClick={() => openModal(myNote)}
                currentUserId={user?.id}
              />

              {otherNotes.length > 0 && (
                <div className="w-px bg-border shrink-0 self-stretch my-1" />
              )}

              {otherNotes.map(note => (
                <NoteCircle
                  key={note.userId}
                  note={note}
                  onClick={() => setViewingNote(note)}
                  currentUserId={user?.id}
                />
              ))}

              {notes.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm py-2">
                  Nenhuma nota ainda. Seja o primeiro!
                </div>
              )}
            </div>
          </div>

          {/* Your note card */}
          {myNote && (
            <div className="mb-4 bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  {userProfile?.avatar ? (
                    <img src={userProfile.avatar} alt="Você" className="w-10 h-10 rounded-full object-cover border-2 border-primary/40" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {getInitials(userProfile?.displayName || 'U')}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm text-foreground">Minha nota</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {myNote.emoji && <span className="text-xl">{myNote.emoji}</span>}
                      {myNote.content && <p className="text-foreground/90">{myNote.content}</p>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(myNote.createdAt), { addSuffix: true, locale: ptBR })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => openModal(myNote)}
                    className="p-1.5 rounded-full hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    title="Editar nota"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleDeleteNote}
                    disabled={deleting}
                    className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                    title="Excluir nota"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* All notes feed */}
          {otherNotes.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <MessageCircleMore className="w-9 h-9 text-muted-foreground/40" />
              </div>
              <p className="text-lg font-semibold">Nenhuma nota de colegas</p>
              <p className="text-muted-foreground text-sm mt-1">
                Quando alguém postar uma nota, ela aparecerá aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {otherNotes.map(note => {
                const author = note.author || { id: note.userId, displayName: 'Usuário' };
                const timeAgo = formatDistanceToNow(new Date(note.createdAt), { addSuffix: true, locale: ptBR });
                return (
                  <div
                    key={note.userId}
                    className="bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors cursor-pointer group"
                    onClick={() => setViewingNote(note)}
                  >
                    <div className="flex items-start gap-3">
                      <Link to={`/profile/${author.id}`} className="shrink-0" onClick={e => e.stopPropagation()}>
                        {author.avatar ? (
                          <img src={author.avatar} alt={author.displayName} className="w-10 h-10 rounded-full object-cover border-2 border-border group-hover:border-primary/40 transition-colors" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-sm">
                            {getInitials(author.displayName)}
                          </div>
                        )}
                      </Link>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            to={`/profile/${author.id}`}
                            className="font-bold text-sm hover:text-primary transition-colors"
                            onClick={e => e.stopPropagation()}
                          >
                            {author.displayName}
                          </Link>
                          <span className="text-muted-foreground text-xs">{timeAgo}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5">
                          {note.emoji && <span className="text-2xl">{note.emoji}</span>}
                          {note.content && (
                            <p className="text-foreground leading-relaxed">{note.content}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Create / Edit Note Modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <MessageCircleMore className="w-5 h-5 text-primary" />
                {myNote ? 'Editar nota' : 'Nova nota'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-muted-foreground">Como você está? (opcional)</label>
                  {noteEmoji && (
                    <button onClick={() => setNoteEmoji('')} className="text-xs text-muted-foreground hover:text-destructive transition-colors">
                      Remover
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all text-sm font-medium ${
                      noteEmoji ? 'border-primary/50 bg-primary/10 text-foreground' : 'border-border hover:border-primary/50 text-muted-foreground'
                    }`}
                  >
                    {noteEmoji ? (
                      <span className="text-2xl">{noteEmoji}</span>
                    ) : (
                      <>
                        <SmilePlus className="w-4 h-4" />
                        Adicionar emoji
                      </>
                    )}
                  </button>
                </div>
                {showEmojiPicker && (
                  <div className="mt-2 p-3 bg-muted/60 rounded-xl border border-border">
                    <div className="grid grid-cols-8 gap-1">
                      {PRESET_EMOJIS.map((emoji) => (
                        <button
                          key={emoji}
                          onClick={() => { setNoteEmoji(emoji); setShowEmojiPicker(false); }}
                          className={`text-xl p-1.5 rounded-lg hover:bg-background transition-colors ${noteEmoji === emoji ? 'bg-primary/20 ring-1 ring-primary' : ''}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-2">
                  Mensagem (opcional)
                </label>
                <textarea
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  maxLength={150}
                  placeholder="Como você está se sentindo hoje?..."
                  className="w-full px-4 py-3 bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none text-foreground placeholder:text-muted-foreground"
                  rows={3}
                  autoFocus={!showEmojiPicker}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">{noteContent.length}/150</p>
              </div>
            </div>

            <div className="flex items-center justify-between px-5 pb-5 gap-3">
              {myNote && (
                <button
                  onClick={handleDeleteNote}
                  disabled={deleting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-destructive/30 text-destructive hover:bg-destructive/10 transition-all text-sm font-medium disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  Excluir
                </button>
              )}
              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-full border border-border hover:bg-muted transition-colors text-sm font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNote}
                  disabled={saving || (!noteContent.trim() && !noteEmoji)}
                  className="flex items-center gap-2 px-5 py-2 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all disabled:opacity-50 shadow-md shadow-primary/30"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {myNote ? 'Atualizar' : 'Publicar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Note Detail Modal */}
      {viewingNote && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={() => setViewingNote(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 text-center">
              <div className="relative inline-block mb-4">
                <div className="w-20 h-20 rounded-full p-[3px] bg-gradient-to-br from-primary via-purple-400 to-pink-500">
                  <div className="w-full h-full rounded-full overflow-hidden bg-background">
                    {viewingNote.author?.avatar ? (
                      <img src={viewingNote.author.avatar} alt={viewingNote.author.displayName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-xl">
                        {getInitials(viewingNote.author?.displayName || 'U')}
                      </div>
                    )}
                  </div>
                </div>
                {viewingNote.emoji && (
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-card border-2 border-border flex items-center justify-center text-lg shadow">
                    {viewingNote.emoji}
                  </div>
                )}
              </div>

              <Link
                to={`/profile/${viewingNote.userId}`}
                className="block font-bold text-lg hover:text-primary transition-colors"
                onClick={() => setViewingNote(null)}
              >
                {viewingNote.author?.displayName || 'Usuário'}
              </Link>
              <p className="text-muted-foreground text-sm mt-0.5">
                {formatDistanceToNow(new Date(viewingNote.createdAt), { addSuffix: true, locale: ptBR })}
              </p>

              {viewingNote.content && (
                <p className="mt-4 text-foreground text-base leading-relaxed px-2">
                  {viewingNote.content}
                </p>
              )}

              <button
                onClick={() => setViewingNote(null)}
                className="mt-6 w-full py-2.5 rounded-full border border-border hover:bg-muted transition-colors text-sm font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
