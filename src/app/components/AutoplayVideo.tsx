import { useEffect, useRef, useState, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';

interface AutoplayVideoProps {
  src: string;
  maxHeight?: number;
  className?: string;
}

export function AutoplayVideo({ src, maxHeight = 520, className = '' }: AutoplayVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-play/pause via IntersectionObserver
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
            // In view: play unless user manually paused
            if (!manuallyPaused) {
              video.play().catch(() => {
                // Autoplay blocked, silently ignore
              });
            }
          } else {
            // Out of view: always pause
            video.pause();
          }
        });
      },
      { threshold: 0.4 }
    );

    observer.observe(video);
    return () => observer.disconnect();
  }, [manuallyPaused]);

  // Sync playing state with video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().catch(() => {});
      setManuallyPaused(false);
    } else {
      video.pause();
      setManuallyPaused(true);
    }

    // Show controls briefly
    flashControls();
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
    flashControls();
  }, []);

  const flashControls = () => {
    setShowControls(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    hideTimeout.current = setTimeout(() => setShowControls(false), 2000);
  };

  const handleMouseEnter = () => {
    setShowControls(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
  };

  const handleMouseLeave = () => {
    hideTimeout.current = setTimeout(() => setShowControls(false), 1000);
  };

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden rounded-xl bg-black cursor-pointer select-none ${className}`}
      onClick={togglePlay}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <video
        ref={videoRef}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        className="w-full block"
        style={{ maxHeight, objectFit: 'contain' }}
      />

      {/* Overlay: play/pause icon flash */}
      <div
        className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="bg-black/50 backdrop-blur-sm rounded-full p-3">
          {playing ? (
            <Pause className="w-7 h-7 text-white" />
          ) : (
            <Play className="w-7 h-7 text-white fill-white" />
          )}
        </div>
      </div>

      {/* Mute/unmute button — always in corner, visible on hover */}
      <button
        onClick={toggleMute}
        className={`absolute bottom-3 right-3 p-2 rounded-full bg-black/60 backdrop-blur-sm text-white transition-all duration-200 hover:bg-black/80 hover:scale-110 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
        title={muted ? 'Ativar som' : 'Silenciar'}
      >
        {muted ? (
          <VolumeX className="w-4 h-4" />
        ) : (
          <Volume2 className="w-4 h-4" />
        )}
      </button>

      {/* Muted badge when controls are hidden */}
      {muted && !showControls && (
        <div className="absolute bottom-3 right-3 p-1.5 rounded-full bg-black/50 text-white/70 pointer-events-none">
          <VolumeX className="w-3.5 h-3.5" />
        </div>
      )}
    </div>
  );
}
