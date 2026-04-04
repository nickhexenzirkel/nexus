import { useRef, useState, useCallback, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, Check, RotateCcw } from 'lucide-react';

interface ImageAdjustModalProps {
  file: File;
  shape: 'circle' | 'rect';
  aspectRatio?: number; // width/height, default 1 for circle, 3 for banner
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

export function ImageAdjustModal({ file, shape, aspectRatio, onConfirm, onCancel }: ImageAdjustModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const ratio = aspectRatio ?? (shape === 'circle' ? 1 : 3);

  // Preview container size
  const PREVIEW_W = shape === 'circle' ? 280 : 420;
  const PREVIEW_H = shape === 'circle' ? 280 : Math.round(420 / ratio);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgNaturalSize, setImgNaturalSize] = useState({ w: 1, h: 1 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImgNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
      setImgLoaded(true);
    };
    img.src = URL.createObjectURL(file);
    return () => { URL.revokeObjectURL(img.src); };
  }, [file]);

  // Draw preview on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = PREVIEW_W;
    canvas.height = PREVIEW_H;

    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);

    // Scale image to fit preview at zoom=1
    const baseScale = Math.max(PREVIEW_W / img.naturalWidth, PREVIEW_H / img.naturalHeight);
    const scale = baseScale * zoom;

    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;

    // Center + apply offset
    const x = (PREVIEW_W - drawW) / 2 + offset.x;
    const y = (PREVIEW_H - drawH) / 2 + offset.y;

    // Clip to shape
    ctx.save();
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(PREVIEW_W / 2, PREVIEW_H / 2, Math.min(PREVIEW_W, PREVIEW_H) / 2, 0, Math.PI * 2);
      ctx.clip();
    } else {
      ctx.beginPath();
      ctx.roundRect(0, 0, PREVIEW_W, PREVIEW_H, 12);
      ctx.clip();
    }

    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.restore();

    // Border overlay
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(PREVIEW_W / 2, PREVIEW_H / 2, Math.min(PREVIEW_W, PREVIEW_H) / 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(139,92,246,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }, [imgLoaded, zoom, offset, PREVIEW_W, PREVIEW_H, shape]);

  useEffect(() => { draw(); }, [draw]);

  // Mouse/Touch drag handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  }, [dragging, dragStart]);

  const onMouseUp = useCallback(() => { setDragging(false); }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  // Touch drag
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setDragging(true);
    setDragStart({ x: t.clientX - offset.x, y: t.clientY - offset.y });
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const t = e.touches[0];
    setOffset({ x: t.clientX - dragStart.x, y: t.clientY - dragStart.y });
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // On confirm: export cropped image
  const handleConfirm = () => {
    const img = imgRef.current;
    if (!img) return;

    // Render at high resolution
    const OUT_W = shape === 'circle' ? 400 : 1200;
    const OUT_H = shape === 'circle' ? 400 : Math.round(1200 / ratio);

    const offCanvas = document.createElement('canvas');
    offCanvas.width = OUT_W;
    offCanvas.height = OUT_H;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) return;

    const scaleRatio = OUT_W / PREVIEW_W;

    const baseScale = Math.max(PREVIEW_W / img.naturalWidth, PREVIEW_H / img.naturalHeight);
    const scale = baseScale * zoom * scaleRatio;

    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;

    const x = (OUT_W - drawW) / 2 + offset.x * scaleRatio;
    const y = (OUT_H - drawH) / 2 + offset.y * scaleRatio;

    ctx.save();
    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(OUT_W / 2, OUT_H / 2, OUT_W / 2, 0, Math.PI * 2);
      ctx.clip();
    }
    ctx.drawImage(img, x, y, drawW, drawH);
    ctx.restore();

    offCanvas.toBlob((blob) => {
      if (blob) onConfirm(blob);
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-lg font-bold">
            {shape === 'circle' ? 'Ajustar foto de perfil' : 'Ajustar foto de capa'}
          </h3>
          <button onClick={onCancel} className="p-2 rounded-full hover:bg-muted transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview */}
        <div className="p-6 flex flex-col items-center gap-5">
          <p className="text-sm text-muted-foreground text-center">
            Arraste para mover · Use o slider para ajustar o zoom
          </p>

          <div
            ref={containerRef}
            className="relative overflow-hidden cursor-grab active:cursor-grabbing select-none"
            style={{
              width: PREVIEW_W,
              height: PREVIEW_H,
              borderRadius: shape === 'circle' ? '50%' : 12,
              background: '#111',
              boxShadow: '0 0 0 3px rgba(139,92,246,0.4)',
              maxWidth: '100%',
            }}
            onMouseDown={onMouseDown}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={() => setDragging(false)}
          >
            <canvas
              ref={canvasRef}
              width={PREVIEW_W}
              height={PREVIEW_H}
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
          </div>

          {/* Zoom Slider */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            <button
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
              className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.05"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-purple-500"
            />
            <button
              onClick={() => setZoom(z => Math.min(4, z + 0.1))}
              className="p-1.5 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Resetar posição
          </button>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-5 pb-5">
          <button
            onClick={onCancel}
            className="px-5 py-2.5 rounded-full border border-border hover:bg-muted transition-colors font-medium text-sm"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-all shadow-md shadow-primary/30"
          >
            <Check className="w-4 h-4" />
            Aplicar
          </button>
        </div>
      </div>
    </div>
  );
}
