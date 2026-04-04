import { useEffect, useRef } from 'react';

interface Blob {
  // center position (0–1 normalized)
  cx: number; cy: number;
  // amplitude of movement (0–1 normalized)
  ax: number; ay: number;
  // angular speed for x/y
  sx: number; sy: number;
  // phase offset
  px: number; py: number;
  // base radius (fraction of min screen dimension)
  r: number;
  // color rgb
  color: [number, number, number];
  // peak alpha
  alpha: number;
  // slow morph speed
  morphSpeed: number;
  morphPhase: number;
}

const BLOBS: Blob[] = [
  // Large bright lavender — top-left highlight (the dominant light area)
  { cx: 0.25, cy: 0.20, ax: 0.22, ay: 0.25, sx: 0.18, sy: 0.14, px: 0.0, py: 1.2,
    r: 0.52, color: [210, 180, 255], alpha: 0.58, morphSpeed: 0.12, morphPhase: 0.0 },

  // Medium lavender — bottom-right
  { cx: 0.72, cy: 0.75, ax: 0.20, ay: 0.22, sx: 0.14, sy: 0.20, px: 2.1, py: 0.5,
    r: 0.44, color: [180, 140, 240], alpha: 0.52, morphSpeed: 0.09, morphPhase: 1.5 },

  // White-lavender bright accent — center, smaller
  { cx: 0.55, cy: 0.42, ax: 0.18, ay: 0.16, sx: 0.25, sy: 0.22, px: 1.0, py: 3.0,
    r: 0.28, color: [235, 220, 255], alpha: 0.50, morphSpeed: 0.16, morphPhase: 3.0 },

  // Deep dark purple — bottom-left anchor
  { cx: 0.18, cy: 0.72, ax: 0.14, ay: 0.18, sx: 0.16, sy: 0.20, px: 3.5, py: 0.8,
    r: 0.40, color: [90, 50, 170], alpha: 0.70, morphSpeed: 0.10, morphPhase: 2.0 },

  // Pink-lilac accent — top-right
  { cx: 0.80, cy: 0.22, ax: 0.15, ay: 0.20, sx: 0.22, sy: 0.18, px: 0.8, py: 2.5,
    r: 0.35, color: [220, 165, 255], alpha: 0.45, morphSpeed: 0.13, morphPhase: 4.2 },

  // Large dark indigo base — bottom center
  { cx: 0.50, cy: 0.85, ax: 0.28, ay: 0.12, sx: 0.12, sy: 0.28, px: 1.8, py: 1.5,
    r: 0.50, color: [70, 35, 145], alpha: 0.65, morphSpeed: 0.08, morphPhase: 0.8 },

  // Soft lilac — center-right
  { cx: 0.78, cy: 0.52, ax: 0.16, ay: 0.20, sx: 0.20, sy: 0.15, px: 5.0, py: 2.2,
    r: 0.30, color: [195, 160, 250], alpha: 0.42, morphSpeed: 0.14, morphPhase: 1.8 },

  // Very light lavender glow — top-center
  { cx: 0.50, cy: 0.10, ax: 0.25, ay: 0.12, sx: 0.15, sy: 0.30, px: 2.8, py: 4.0,
    r: 0.36, color: [225, 210, 255], alpha: 0.38, morphSpeed: 0.11, morphPhase: 3.5 },
];

export function LavaLampBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    let animFrame: number;
    const startTime = performance.now();

    const draw = (now: number) => {
      const t = (now - startTime) / 1000;
      const W = canvas.width;
      const H = canvas.height;
      const S = Math.min(W, H);

      // Dark base
      ctx.fillStyle = '#0e0820';
      ctx.fillRect(0, 0, W, H);

      for (const b of BLOBS) {
        const x = (b.cx + b.ax * Math.sin(t * b.sx + b.px)) * W;
        const y = (b.cy + b.ay * Math.cos(t * b.sy + b.py)) * H;

        // Organic morphing: radius pulses slightly + aspect ratio changes
        const morphT = t * b.morphSpeed + b.morphPhase;
        const rBase = b.r * S;
        const rX = rBase * (1 + 0.18 * Math.sin(morphT));
        const rY = rBase * (1 + 0.18 * Math.cos(morphT * 1.3));
        const angle = t * b.morphSpeed * 0.5;

        // Radial gradient for soft glow
        const rMax = Math.max(rX, rY);
        const grad = ctx.createRadialGradient(x, y, 0, x, y, rMax);
        const [R, G, Bl] = b.color;
        grad.addColorStop(0,   `rgba(${R},${G},${Bl},${b.alpha})`);
        grad.addColorStop(0.35, `rgba(${R},${G},${Bl},${(b.alpha * 0.65).toFixed(3)})`);
        grad.addColorStop(0.70, `rgba(${R},${G},${Bl},${(b.alpha * 0.22).toFixed(3)})`);
        grad.addColorStop(1,   `rgba(${R},${G},${Bl},0)`);

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.scale(rX / rMax, rY / rMax);
        ctx.beginPath();
        ctx.arc(0, 0, rMax, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        // Re-create gradient in local space after transform for correct center
        const localGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, rMax);
        localGrad.addColorStop(0,    `rgba(${R},${G},${Bl},${b.alpha})`);
        localGrad.addColorStop(0.35, `rgba(${R},${G},${Bl},${(b.alpha * 0.65).toFixed(3)})`);
        localGrad.addColorStop(0.70, `rgba(${R},${G},${Bl},${(b.alpha * 0.22).toFixed(3)})`);
        localGrad.addColorStop(1,    `rgba(${R},${G},${Bl},0)`);
        ctx.fillStyle = localGrad;
        ctx.fill();
        ctx.restore();
      }

      // Soft dark vignette overlay to frame the edges
      const vignette = ctx.createRadialGradient(W/2, H/2, S * 0.3, W/2, H/2, S * 0.85);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(8,3,20,0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, W, H);

      animFrame = requestAnimationFrame(draw);
    };

    animFrame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animFrame);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}
