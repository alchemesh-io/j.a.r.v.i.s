import { useRef, useEffect } from 'react';
import './BrainAnimation.css';

// ── Ring geometry helpers ─────────────────────────────────────────────────────

const CX = 200;
const CY = 200;

function polar(angleDeg: number, radius: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY + radius * Math.sin(rad) };
}

function segmentedArc(r: number, arcLen: number, gapLen: number) {
  const circumference = 2 * Math.PI * r;
  const segCount = Math.floor(circumference / (arcLen + gapLen));
  const paths: string[] = [];
  for (let i = 0; i < segCount; i++) {
    const startAngle = (i * (arcLen + gapLen) / circumference) * 360;
    const endAngle = startAngle + (arcLen / circumference) * 360;
    const s = polar(startAngle, r);
    const e = polar(endAngle, r);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    paths.push(`M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArc} 1 ${e.x} ${e.y}`);
  }
  return paths;
}

// Pre-computed static ring geometry (module-level, computed once)
const R1 = 72;
const R2 = 112;
const R3 = 152;
const R4 = 192;
const R5 = 232;

const ticks3 = Array.from({ length: 24 }, (_, i) => {
  const inner = polar(i * 15, R3 - 6);
  const outer = polar(i * 15, R3 + 6);
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
});

const notches4 = [0, 90, 180, 270].map((a) => {
  const c = polar(a, R4);
  return { x: c.x - 2, y: c.y - 5 };
});

const squares5 = Array.from({ length: 12 }, (_, i) => {
  const c = polar(i * 30, R5);
  return { x: c.x - 1.5, y: c.y - 1.5 };
});

const arcs2 = segmentedArc(R2, 14, 5);

// ── Heart path helper & pre-computed heart arrays (Konami mode) ──────────────
// Symmetric heart: taller than wide (s = half-height)
function heartPath(cx: number, cy: number, s: number): string {
  const w = s * 0.68; // narrower = less squashed
  return `M ${cx} ${cy + s}`
    + ` C ${cx - w * 0.9} ${cy + s} ${cx - w * 1.55} ${cy + s * 0.25} ${cx - w * 1.55} ${cy - s * 0.2}`
    + ` C ${cx - w * 1.55} ${cy - s * 0.85} ${cx - w * 0.72} ${cy - s * 1.15} ${cx} ${cy - s * 0.55}`
    + ` C ${cx + w * 0.72} ${cy - s * 1.15} ${cx + w * 1.55} ${cy - s * 0.85} ${cx + w * 1.55} ${cy - s * 0.2}`
    + ` C ${cx + w * 1.55} ${cy + s * 0.25} ${cx + w * 0.9} ${cy + s} ${cx} ${cy + s}`
    + ' Z';
}

// Seeded pseudo-random — deterministic, no flicker on re-render
function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const rng = seededRand(42);
const hearts_r1 = heartPath(CX, CY, 32);

// Outer scatter: small hearts spread between R2 and R5
const outerHearts = Array.from({ length: 32 }, () => {
  const angle  = rng() * 360;
  const radius = R2 + rng() * (R5 - R2);
  const size   = 3.5 + rng() * 5.5;
  const p      = polar(angle, radius);
  return { d: heartPath(p.x, p.y, size), op: +(0.3 + rng() * 0.45).toFixed(2) };
});

// ── Component ─────────────────────────────────────────────────────────────────

interface Pt { x: number; y: number; vx: number; vy: number; r: number; }
interface FlyHeart { x: number; y: number; vx: number; vy: number; size: number; opacity: number; }

export default function BrainAnimation({ konamiMode = false }: { konamiMode?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const konamiRef = useRef(konamiMode);
  const flyHeartsRef = useRef<FlyHeart[]>([]);

  useEffect(() => {
    konamiRef.current = konamiMode;
    // Re-scatter firefly hearts when entering konami mode so they start in valid positions
    if (konamiMode && canvasRef.current) {
      const container = containerRef.current;
      if (!container) return;
      const sz = container.offsetWidth;
      const half = sz / 2;
      const flyMin = sz * (72 / 400);
      const flyMax = sz * (112 / 400) * 1.15;
      // Reassign onto the existing array (avoids closure capture issues)
      flyHeartsRef.current = Array.from({ length: 10 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist  = flyMin + Math.random() * (flyMax - flyMin);
        return {
          x: half + Math.cos(angle) * dist,
          y: half + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 0.6,
          vy: (Math.random() - 0.5) * 0.6,
          size: (sz / 400) * (5 + Math.random() * 7),
          opacity: 0.45 + Math.random() * 0.4,
        };
      });
    }
  }, [konamiMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let animId: number;
    let particles: Pt[] = [];
    let S = 0;

    // Draw a heart shape on canvas (mirrors the SVG heartPath formula)
    function canvasHeart(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number) {
      const w = s * 0.68;
      ctx.beginPath();
      ctx.moveTo(cx, cy + s);
      ctx.bezierCurveTo(cx - w*0.9, cy + s,   cx - w*1.55, cy + s*0.25,  cx - w*1.55, cy - s*0.2);
      ctx.bezierCurveTo(cx - w*1.55, cy - s*0.85, cx - w*0.72, cy - s*1.15, cx, cy - s*0.55);
      ctx.bezierCurveTo(cx + w*0.72, cy - s*1.15, cx + w*1.55, cy - s*0.85, cx + w*1.55, cy - s*0.2);
      ctx.bezierCurveTo(cx + w*1.55, cy + s*0.25, cx + w*0.9, cy + s,   cx, cy + s);
      ctx.closePath();
    }

    function init(size: number) {
      S = size;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = S * dpr;
      canvas!.height = S * dpr;
      canvas!.style.width = S + 'px';
      canvas!.style.height = S + 'px';
      const ctx = canvas!.getContext('2d')!;
      ctx.scale(dpr, dpr);

      const half = S / 2;
      // Particles float within ~ring 3 radius
      const maxDist = S * 0.36;
      // Firefly hearts roam between ring 1 and ring 2 (18%–28% of SVG viewbox → scale to S)
      const flyMin = S * (72 / 400);
      const flyMax = S * (112 / 400) * 1.15;

      particles = Array.from({ length: 45 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * maxDist;
        return {
          x: half + Math.cos(angle) * dist,
          y: half + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          r: 1 + Math.random() * 1.5,
        };
      });

      flyHeartsRef.current = Array.from({ length: 10 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const dist  = flyMin + Math.random() * (flyMax - flyMin);
        return {
          x: half + Math.cos(angle) * dist,
          y: half + Math.sin(angle) * dist,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          size: (S / 400) * (5 + Math.random() * 7),
          opacity: 0.45 + Math.random() * 0.4,
        };
      });
    }

    function draw() {
      const ctx = canvas!.getContext('2d')!;
      const half = S / 2;
      const maxDist = S * 0.36;
      const flyMax = S * (112 / 400) * 1.15;
      const isKonami = konamiRef.current;

      ctx.clearRect(0, 0, S, S);

      for (const p of particles) {
        // Random walk
        p.vx += (Math.random() - 0.5) * 0.05;
        p.vy += (Math.random() - 0.5) * 0.05;
        // Speed cap
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (speed > 1.0) { p.vx *= 0.97; p.vy *= 0.97; }

        p.x += p.vx;
        p.y += p.vy;

        // Soft circular boundary — repel back toward center
        const dx = p.x - half;
        const dy = p.y - half;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxDist) {
          const nx = dx / dist;
          const ny = dy / dist;
          p.vx -= nx * 0.4;
          p.vy -= ny * 0.4;
        }

        // Dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = isKonami ? 'rgba(255, 107, 157, 0.6)' : 'rgba(0, 212, 255, 0.55)';
        ctx.fill();

        // Soft glow around dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = isKonami ? 'rgba(255, 107, 157, 0.1)' : 'rgba(0, 212, 255, 0.08)';
        ctx.fill();
      }

      // Firefly hearts — only in konami mode
      if (isKonami) {
        for (const h of flyHeartsRef.current) {
          // Firefly-style random walk — clearly visible drift
          h.vx += (Math.random() - 0.5) * 0.07;
          h.vy += (Math.random() - 0.5) * 0.07;
          const spd = Math.sqrt(h.vx * h.vx + h.vy * h.vy);
          if (spd > 1.4) { h.vx *= 0.92; h.vy *= 0.92; }
          h.x += h.vx;
          h.y += h.vy;
          // Soft boundary: repel back toward center
          const dx = h.x - half;
          const dy = h.y - half;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > flyMax) {
            const nx = dx / dist;
            const ny = dy / dist;
            h.vx -= nx * 0.5;
            h.vy -= ny * 0.5;
          }
          // Draw heart
          ctx.save();
          ctx.globalAlpha = h.opacity;
          canvasHeart(ctx, h.x, h.y, h.size);
          ctx.fillStyle = '#ff8ab5';
          ctx.fill();
          // Soft glow
          ctx.globalAlpha = h.opacity * 0.35;
          canvasHeart(ctx, h.x, h.y, h.size * 1.8);
          ctx.fillStyle = '#ff6b9d';
          ctx.fill();
          ctx.restore();
        }
      }

      animId = requestAnimationFrame(draw);
    }

    function handleResize() {
      cancelAnimationFrame(animId);
      init(container!.offsetWidth);
      draw();
    }

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <div ref={containerRef} className={`brain-animation${konamiMode ? ' brain-animation--konami' : ''}`}>
      <svg
        className="brain-animation__svg"
        viewBox="0 0 400 400"
        role="img"
        aria-label="J.A.R.V.I.S brain animation"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="brain-bg-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,212,255,0.08)" />
            <stop offset="70%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <radialGradient id="brain-heart-grad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,107,157,0.15)" />
            <stop offset="70%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        {/* Background glow */}
        <circle cx={CX} cy={CY} r={R5 + 20} fill={konamiMode ? 'url(#brain-heart-grad)' : 'url(#brain-bg-grad)'} />

        {konamiMode ? (
          <>
            {/* ── Heart mode (Konami easter egg ♥) ── */}
            <path className="brain-heart--center" d={hearts_r1} fill="#ff6b9d" opacity="0.9" />
            {outerHearts.map((h, i) => <path key={`out-${i}`} d={h.d} fill="#ff6b9d" opacity={h.op} />)}
          </>
        ) : (
          <>
            {/* ── Ring 1 — static inner ring ── */}
            <circle cx={CX} cy={CY} r={R1} fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeOpacity="0.9" />

            {/* ── Ring 2 — CW 0.8rpm — segmented arcs ── */}
            <g className="brain-ring-2">
              {arcs2.map((d, i) => (
                <path key={i} d={d} fill="none" stroke="#00d4ff" strokeWidth="2" strokeOpacity="0.8" />
              ))}
            </g>

            {/* ── Ring 3 — CCW 0.5rpm — tick marks ── */}
            <g className="brain-ring-3">
              <circle cx={CX} cy={CY} r={R3} fill="none" stroke="#00d4ff" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="2 6" />
              {ticks3.map((t, i) => (
                <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#00d4ff" strokeWidth="1.5" strokeOpacity="0.7" />
              ))}
            </g>

            {/* ── Ring 4 — CW 0.3rpm — sparse dashes + notches ── */}
            <g className="brain-ring-4">
              <circle cx={CX} cy={CY} r={R4} fill="none" stroke="#00d4ff" strokeWidth="1" strokeOpacity="0.55" strokeDasharray="6 18" />
              {notches4.map((n, i) => (
                <rect key={i} x={n.x} y={n.y} width="4" height="10" fill="#00d4ff" opacity="0.8" />
              ))}
            </g>

            {/* ── Ring 5 — CCW 0.15rpm — dotted arc + squares ── */}
            <g className="brain-ring-5">
              <circle cx={CX} cy={CY} r={R5} fill="none" stroke="#00d4ff" strokeWidth="1" strokeOpacity="0.5" strokeDasharray="2 10" />
              {squares5.map((s, i) => (
                <rect key={i} x={s.x} y={s.y} width="3" height="3" fill="#00d4ff" opacity="0.7" />
              ))}
            </g>
          </>
        )}
      </svg>

      {/* Inner particles canvas overlay */}
      <canvas ref={canvasRef} className="brain-animation__particles" aria-hidden="true" />
    </div>
  );
}


