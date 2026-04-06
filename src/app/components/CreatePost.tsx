import { useState, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { projectId } from '/utils/supabase/info';
import { toast } from 'sonner';
import {
  Image, Video, Send, X, Loader2, Link2, BarChart2, Plus, Trash2, ClipboardPaste,
} from 'lucide-react';

interface CreatePostProps {
  onPostCreated: () => void;
}

const MAX_IMAGE_MB = 10;
const MAX_VIDEO_MB = 50;

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  const MAX_DIM = 1920;
  const MAX_BYTES = 2 * 1024 * 1024; // 2MB threshold
  if (file.size <= MAX_BYTES) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(MAX_DIM / width, MAX_DIM / height, 1);
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);
      const outType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob((blob) => {
        if (!blob) { resolve(file); return; }
        const ext = outType === 'image/png' ? 'png' : 'jpg';
        const compressed = new File([blob], `${file.name.split('.')[0]}.${ext}`, { type: outType });
        console.log(`Compressed ${file.name}: ${(file.size / 1024).toFixed(0)}KB → ${(compressed.size / 1024).toFixed(0)}KB`);
        resolve(compressed.size < file.size ? compressed : file);
      }, outType, 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

async function uploadFileDirect(
  file: File,
  authHeaders: Record<string, string>,
  projectId: string
): Promise<string> {
  // Compress images before uploading
  const processedFile = file.type.startsWith('image/') ? await compressImage(file) : file;
  const signRes = await fetch(
    `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/upload/sign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ filename: processedFile.name, contentType: processedFile.type, fileSize: processedFile.size }),
    }
  );
  if (!signRes.ok) {
    const err = await signRes.json().catch(() => ({}));
    throw new Error(err.error || 'Falha ao obter URL de upload');
  }
  const { signedUrl, publicUrl, contentType } = await signRes.json();
  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType || processedFile.type },
    body: processedFile,
  });
  if (!uploadRes.ok) throw new Error(`Falha ao enviar arquivo: ${uploadRes.status}`);
  return publicUrl as string;
}

/** Detect YouTube embed ID from various URL formats */
function getYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/** Detect embed type from URL */
function detectEmbedType(url: string): 'youtube' | 'gif' | 'video' | null {
  if (!url) return null;
  if (getYoutubeId(url)) return 'youtube';
  if (/\.(gif)$/i.test(url) || /giphy\.com|tenor\.com/i.test(url)) return 'gif';
  if (/\.(mp4|webm|mov|avi)$/i.test(url)) return 'video';
  return null;
}

interface PollOption {
  text: string;
}

export function CreatePost({ onPostCreated }: CreatePostProps) {
  const { user, userProfile, getAuthHeaders } = useAuth();
  const [content, setContent] = useState('');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [previews, setPreviews] = useState<{ url: string; type: string }[]>([]);
  const [pasteHighlight, setPasteHighlight] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Embed URL
  const [showEmbed, setShowEmbed] = useState(false);
  const [embedUrl, setEmbedUrl] = useState('');
  const detectedEmbedType = detectEmbedType(embedUrl.trim());

  // Poll
  const [showPoll, setShowPoll] = useState(false);
  const [pollOptions, setPollOptions] = useState<PollOption[]>([{ text: '' }, { text: '' }]);

  const addFiles = useCallback((files: File[]) => {
    const remaining = 4 - mediaFiles.length;
    const toAdd = files.slice(0, remaining);
    if (files.length > remaining) {
      toast.error(`Máximo de 4 arquivos. Adicionando apenas ${remaining}.`);
    }
    const valid: File[] = [];
    for (const file of toAdd) {
      const isVideo = file.type.startsWith('video');
      const limitMB = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
      if (file.size > limitMB * 1024 * 1024) {
        toast.error(`${file.name} é grande demais (máx ${limitMB} MB)`);
        continue;
      }
      valid.push(file);
    }
    if (valid.length === 0) return;
    setMediaFiles(prev => [...prev, ...valid]);
    valid.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews(prev => [...prev, { url: reader.result as string, type: file.type }]);
      };
      reader.readAsDataURL(file);
    });
  }, [mediaFiles.length]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
    e.target.value = '';
  };

  // Handle Ctrl+V paste anywhere inside the component
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.kind === 'file' && item.type.startsWith('image/'));
    if (imageItems.length === 0) return;

    // Only prevent default if we have images (let text paste work normally)
    e.preventDefault();

    const files = imageItems
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null)
      .map((f, i) => {
        // Give a proper name if missing
        const ext = f.type.split('/')[1] || 'png';
        return new File([f], `imagem_colada_${Date.now()}_${i}.${ext}`, { type: f.type });
      });

    if (files.length > 0) {
      addFiles(files);
      // Flash highlight feedback
      setPasteHighlight(true);
      setTimeout(() => setPasteHighlight(false), 600);
      toast.success(`📋 ${files.length === 1 ? 'Imagem colada!' : `${files.length} imagens coladas!`}`);
    }
  }, [addFiles]);

  const removeFile = (index: number) => {
    setMediaFiles(files => files.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const addPollOption = () => {
    if (pollOptions.length < 4) setPollOptions(prev => [...prev, { text: '' }]);
  };

  const removePollOption = (idx: number) => {
    if (pollOptions.length > 2) setPollOptions(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePollOption = (idx: number, text: string) => {
    setPollOptions(prev => prev.map((o, i) => (i === idx ? { text } : o)));
  };

  const clearPoll = () => {
    setShowPoll(false);
    setPollOptions([{ text: '' }, { text: '' }]);
  };

  const clearEmbed = () => {
    setShowEmbed(false);
    setEmbedUrl('');
  };

  const handlePost = async () => {
    const hasContent = content.trim().length > 0;
    const hasMedia = mediaFiles.length > 0;
    const hasEmbed = embedUrl.trim().length > 0 && detectedEmbedType !== null;
    const hasPoll = showPoll && pollOptions.filter(o => o.text.trim()).length >= 2;

    if (!hasContent && !hasMedia && !hasEmbed && !hasPoll) {
      toast.error('Escreva algo, adicione mídia, um link ou uma enquete');
      return;
    }

    if (showPoll && !hasPoll) {
      toast.error('A enquete precisa ter pelo menos 2 opções');
      return;
    }

    setUploading(true);
    try {
      const authHeaders = await getAuthHeaders();
      if (!authHeaders['X-User-Token']) {
        toast.error('Você precisa estar logado para postar');
        return;
      }

      let mediaUrls: string[] = [];
      if (mediaFiles.length > 0) {
        toast.loading('Enviando mídia...', { id: 'upload' });
        mediaUrls = await Promise.all(
          mediaFiles.map(file => uploadFileDirect(file, authHeaders, projectId))
        );
        toast.dismiss('upload');
      }

      const mediaType = mediaFiles.length > 0
        ? (mediaFiles[0].type.startsWith('video') ? 'video' : 'image')
        : null;

      const pollPayload = hasPoll ? {
        options: pollOptions.filter(o => o.text.trim()).map(o => ({ text: o.text.trim() })),
        endsAt: null,
      } : null;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-e9524f09/posts`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...authHeaders },
          body: JSON.stringify({
            content,
            mediaUrls,
            mediaType,
            embedUrl: hasEmbed ? embedUrl.trim() : null,
            embedType: hasEmbed ? detectedEmbedType : null,
            poll: pollPayload,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || 'Falha ao criar post');
      }

      toast.success('Post publicado! 🚀');
      setContent('');
      setMediaFiles([]);
      setPreviews([]);
      clearEmbed();
      clearPoll();
      onPostCreated();
    } catch (error: any) {
      toast.dismiss('upload');
      toast.error(error.message || 'Erro ao publicar post');
      console.error('Error creating post:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handlePost();
  };

  if (!user) return null;

  const displayName = userProfile?.displayName || user.user_metadata?.displayName || 'Usuário';
  const initials = displayName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  const charCount = content.length;
  const maxChars = 280;
  const isOverLimit = charCount > maxChars;
  const remaining = maxChars - charCount;

  // YouTube embed preview
  const youtubeId = embedUrl ? getYoutubeId(embedUrl) : null;

  return (
    <div
      className={`bg-card border rounded-2xl p-5 hover:border-border/80 transition-all ${
        pasteHighlight ? 'border-primary shadow-lg shadow-primary/20' : 'border-border'
      }`}
      onPaste={handlePaste}
    >
      <div className="flex gap-4">
        {/* Avatar */}
        <div className="shrink-0">
          {userProfile?.avatar ? (
            <img src={userProfile.avatar} alt={displayName} className="w-12 h-12 rounded-full object-cover border-2 border-primary/30" />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg border-2 border-primary/30">
              {initials}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* Text area */}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="O que está acontecendo?"
            className="w-full bg-transparent border-none outline-none resize-none text-lg placeholder:text-muted-foreground leading-relaxed"
            rows={3}
            disabled={uploading}
          />

          {/* Paste hint */}
          {mediaFiles.length === 0 && !showEmbed && !showPoll && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground/50 mb-2 select-none pointer-events-none">
              <ClipboardPaste className="w-3 h-3" />
              <span>Cole uma imagem aqui com Ctrl+V</span>
            </div>
          )}

          {/* Media Previews */}
          {previews.length > 0 && (
            <div className={`grid gap-2 mt-3 ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {previews.map((preview, index) => (
                <div key={index} className="relative group rounded-xl overflow-hidden bg-muted">
                  {preview.type.startsWith('video') ? (
                    <video src={preview.url} className="w-full max-h-60 object-contain bg-black" />
                  ) : (
                    <img src={preview.url} alt={`Preview ${index + 1}`} className="w-full max-h-60 object-cover" />
                  )}
                  <button
                    onClick={() => removeFile(index)}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center transition-all shadow-lg"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Embed URL input */}
          {showEmbed && (
            <div className="mt-3 p-3 bg-muted/40 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-primary" />
                  Embutir vídeo ou GIF
                </span>
                <button onClick={clearEmbed} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <input
                type="url"
                value={embedUrl}
                onChange={(e) => setEmbedUrl(e.target.value)}
                placeholder="Cole o link do YouTube ou URL de GIF..."
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground"
              />
              {/* Embed preview */}
              {youtubeId && (
                <div className="rounded-xl overflow-hidden aspect-video bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${youtubeId}`}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="Preview do YouTube"
                  />
                </div>
              )}
              {detectedEmbedType === 'gif' && embedUrl && (
                <div className="rounded-xl overflow-hidden bg-muted flex justify-center">
                  <img src={embedUrl} alt="GIF preview" className="max-h-48 object-contain rounded-xl" />
                </div>
              )}
              {detectedEmbedType === 'video' && embedUrl && !youtubeId && (
                <div className="rounded-xl overflow-hidden bg-black">
                  <video src={embedUrl} controls className="w-full max-h-48 object-contain" />
                </div>
              )}
              {embedUrl && detectedEmbedType === null && (
                <p className="text-xs text-amber-400">
                  ⚠️ Tipo de mídia não reconhecido. Suportamos: YouTube, links de GIF (.gif, giphy, tenor), links de vídeo (.mp4, .webm, .mov).
                </p>
              )}
              {embedUrl && detectedEmbedType && (
                <p className="text-xs text-green-400 flex items-center gap-1">
                  ✓ {detectedEmbedType === 'youtube' ? 'Vídeo do YouTube detectado' : detectedEmbedType === 'gif' ? 'GIF detectado' : 'Vídeo detectado'}
                </p>
              )}
            </div>
          )}

          {/* Poll creator */}
          {showPoll && (
            <div className="mt-3 p-3 bg-muted/40 border border-border rounded-xl space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-primary" />
                  Enquete
                </span>
                <button onClick={clearPoll} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {pollOptions.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => updatePollOption(idx, e.target.value)}
                    placeholder={`Opção ${idx + 1}`}
                    maxLength={60}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm outline-none focus:border-primary transition-colors text-foreground placeholder:text-muted-foreground"
                  />
                  {pollOptions.length > 2 && (
                    <button onClick={() => removePollOption(idx)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              {pollOptions.length < 4 && (
                <button
                  onClick={addPollOption}
                  className="flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar opção
                </button>
              )}
              <p className="text-xs text-muted-foreground">Máximo de 4 opções · 60 caracteres por opção</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
            {/* Media + tool buttons */}
            <div className="flex gap-0.5 flex-wrap">
              <button
                onClick={() => { if (!showPoll && !showEmbed) imageInputRef.current?.click(); }}
                disabled={uploading || mediaFiles.length >= 4 || showPoll || showEmbed}
                className="flex items-center gap-1.5 cursor-pointer hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-primary"
                title={`Adicionar imagem (máx ${MAX_IMAGE_MB} MB)`}
              >
                <Image className="w-5 h-5" />
                <span className="text-xs font-medium hidden sm:inline">Foto</span>
              </button>
              <input ref={imageInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />

              <button
                onClick={() => { if (!showPoll && !showEmbed) videoInputRef.current?.click(); }}
                disabled={uploading || mediaFiles.length >= 4 || showPoll || showEmbed}
                className="flex items-center gap-1.5 cursor-pointer hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-primary"
                title={`Adicionar vídeo (máx ${MAX_VIDEO_MB} MB)`}
              >
                <Video className="w-5 h-5" />
                <span className="text-xs font-medium hidden sm:inline">Vídeo</span>
              </button>
              <input ref={videoInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />

              {/* Embed URL button */}
              <button
                onClick={() => {
                  if (!showPoll && mediaFiles.length === 0) {
                    setShowEmbed(v => !v);
                  }
                }}
                disabled={uploading || showPoll || mediaFiles.length > 0}
                className={`flex items-center gap-1.5 cursor-pointer hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${showEmbed ? 'text-primary bg-primary/10' : 'text-primary'}`}
                title="Embutir vídeo ou GIF por link"
              >
                <Link2 className="w-5 h-5" />
                <span className="text-xs font-medium hidden sm:inline">Link</span>
              </button>

              {/* Poll button */}
              <button
                onClick={() => {
                  if (!showEmbed && mediaFiles.length === 0) {
                    setShowPoll(v => !v);
                  }
                }}
                disabled={uploading || showEmbed || mediaFiles.length > 0}
                className={`flex items-center gap-1.5 cursor-pointer hover:bg-primary/10 px-3 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${showPoll ? 'text-primary bg-primary/10' : 'text-primary'}`}
                title="Criar enquete"
              >
                <BarChart2 className="w-5 h-5" />
                <span className="text-xs font-medium hidden sm:inline">Enquete</span>
              </button>
            </div>

            {/* Char count + post button */}
            <div className="flex items-center gap-3 shrink-0">
              {charCount > 0 && (
                <span className={`text-sm tabular-nums ${isOverLimit ? 'text-red-500 font-semibold' : remaining <= 20 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                  {remaining}
                </span>
              )}
              <button
                onClick={handlePost}
                disabled={uploading || isOverLimit}
                className="bg-primary hover:bg-primary/90 active:scale-95 text-white font-semibold px-5 py-2 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md shadow-primary/30"
              >
                {uploading ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /><span>Publicando...</span></>
                ) : (
                  <><Send className="w-4 h-4" /><span>Postar</span></>
                )}
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-2 opacity-60">
            Ctrl+Enter para publicar · Foto/Vídeo até {MAX_IMAGE_MB}/{MAX_VIDEO_MB} MB
          </p>
        </div>
      </div>
    </div>
  );
}