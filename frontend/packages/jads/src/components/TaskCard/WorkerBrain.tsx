import './WorkerBrain.css';

const CX = 50;
const CY = 50;

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

const R1 = 14;
const R2 = 22;
const R3 = 30;
const R4 = 38;
const R5 = 46;

const ticks3 = Array.from({ length: 12 }, (_, i) => {
  const inner = polar(i * 30, R3 - 2);
  const outer = polar(i * 30, R3 + 2);
  return { x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y };
});

const notches4 = [0, 90, 180, 270].map((a) => {
  const c = polar(a, R4);
  return { x: c.x - 0.5, y: c.y - 1.5 };
});

const arcs2 = segmentedArc(R2, 4, 2);

const STATE_COLORS: Record<string, string> = {
  initialized: '#6b7280',
  working: '#3b82f6',
  waiting_for_human: '#ef4444',
  done: '#10b981',
  archived: '#374151',
};

const STATE_LABELS: Record<string, string> = {
  initialized: 'INIT',
  working: 'ACTIVE',
  waiting_for_human: 'WAIT',
  done: 'DONE',
  archived: 'OFF',
};

export function WorkerBrain({ state }: { state: string }) {
  const color = STATE_COLORS[state] || '#6b7280';
  const label = STATE_LABELS[state] || state.toUpperCase().slice(0, 5);
  const isActive = state === 'working';

  return (
    <div className={`worker-brain${isActive ? ' worker-brain--active' : ''}`}>
      <svg
        className="worker-brain__svg"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="wb-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.15" />
            <stop offset="70%" stopColor={color} stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={R5 + 2} fill="url(#wb-glow)" />

        {/* Ring 1 — static inner */}
        <circle cx={CX} cy={CY} r={R1} fill="none" stroke={color} strokeWidth="0.8" strokeOpacity="0.9" />

        {/* Ring 2 — CW segmented arcs */}
        <g className="worker-brain__ring-2">
          {arcs2.map((d, i) => (
            <path key={i} d={d} fill="none" stroke={color} strokeWidth="1" strokeOpacity="0.8" />
          ))}
        </g>

        {/* Ring 3 — CCW tick marks */}
        <g className="worker-brain__ring-3">
          <circle cx={CX} cy={CY} r={R3} fill="none" stroke={color} strokeWidth="0.5" strokeOpacity="0.5" strokeDasharray="1 3" />
          {ticks3.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke={color} strokeWidth="0.8" strokeOpacity="0.7" />
          ))}
        </g>

        {/* Ring 4 — CW dashes + notches */}
        <g className="worker-brain__ring-4">
          <circle cx={CX} cy={CY} r={R4} fill="none" stroke={color} strokeWidth="0.5" strokeOpacity="0.45" strokeDasharray="2 6" />
          {notches4.map((n, i) => (
            <rect key={i} x={n.x} y={n.y} width="1" height="3" fill={color} opacity="0.7" />
          ))}
        </g>

        {/* Ring 5 — CCW dotted */}
        <g className="worker-brain__ring-5">
          <circle cx={CX} cy={CY} r={R5} fill="none" stroke={color} strokeWidth="0.5" strokeOpacity="0.4" strokeDasharray="1 5" />
        </g>

        {/* State label in center */}
        <text
          x={CX}
          y={CY + 1}
          textAnchor="middle"
          dominantBaseline="central"
          fill={color}
          fontSize="7"
          fontWeight="700"
          fontFamily="var(--jads-font-family, system-ui)"
          letterSpacing="0.5"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}
