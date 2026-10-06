import { toBengaliNumber } from '../../utils/bengali';
import type { DiagramSpec } from '../../api/client';

/** Renders a worked example's pictorial representation (see
 * service/db/diagram_spec.py, the schema this mirrors). Every number drawn
 * here comes straight from the already-verified spec -- this component only
 * lays shapes out, it never computes or guesses a new value. */
interface Props { spec: DiagramSpec; darkMode: boolean }

const W = 400, H = 240;

function palette(dark: boolean) {
  return {
    text: dark ? '#e2e8f0' : '#1e293b',
    sub: dark ? '#94a3b8' : '#64748b',
    border: dark ? '#334155' : '#e2e8f0',
    track: dark ? '#1e293b' : '#f1f5f9',
    accent: '#3b82f6',
    accentSoft: dark ? '#1e3a5f' : '#dbeafe',
    second: '#f59e0b',
    secondSoft: dark ? '#4a3310' : '#fef3c7',
    good: '#10b981',
  };
}
type P = ReturnType<typeof palette>;

function Caption({ children, c }: { children: React.ReactNode; c: P }) {
  return <text x={W / 2} y={H - 10} textAnchor="middle" fontSize={16} fontWeight={700} fill={c.text}>{children}</text>;
}

// ── ratio_icons: two rows of dots, one per unit, labeled underneath ────────
function RatioIcons({ spec, c }: { spec: Extract<DiagramSpec, { type: 'ratio_icons' }>; c: P }) {
  const [a, b] = spec.values;
  const row = (count: number, y: number, color: string, label: string) => {
    const r = 11, gap = 30, startX = W / 2 - ((count - 1) * gap) / 2;
    return (
      <g key={label}>
        {Array.from({ length: count }, (_, i) => (
          <circle key={i} cx={startX + i * gap} cy={y} r={r} fill={color} />
        ))}
        <text x={24} y={y + 5} fontSize={14} fontWeight={700} fill={c.text}>{label}</text>
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`অনুপাত ${toBengaliNumber(a)} : ${toBengaliNumber(b)}`}>
      {row(a, 60, c.accent, spec.labels[0])}
      {row(b, 120, c.second, spec.labels[1])}
      <Caption c={c}>{toBengaliNumber(a)} : {toBengaliNumber(b)}</Caption>
    </svg>
  );
}

// ── percent_grid: 10x10 unit squares, shaded up to the percentage ──────────
function PercentGrid({ spec, c }: { spec: Extract<DiagramSpec, { type: 'percent_grid' }>; c: P }) {
  const cell = 15, cols = 10, rows = 10;
  const shaded = Math.round(spec.percent);              // out of 100 cells
  const gx = (W - cell * cols) / 2, gy = 14;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`শতকরা ${toBengaliNumber(spec.percent)}%`}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        return (
          <rect key={i} x={gx + col * cell} y={gy + row * cell} width={cell - 1.5} height={cell - 1.5}
            fill={i < shaded ? c.accent : c.track} stroke={c.border} strokeWidth={0.5} rx={2} />
        );
      })}
      <Caption c={c}>{toBengaliNumber(spec.percent)}%</Caption>
    </svg>
  );
}

// ── fraction_split: one or more bars split into denominator pieces ─────────
function FractionSplit({ spec, c }: { spec: Extract<DiagramSpec, { type: 'fraction_split' }>; c: P }) {
  const { numerator: n, denominator: d } = spec;
  const bars = Math.max(1, Math.ceil(n / d));
  const barW = 320, barH = 44, gap = 14, pieceW = barW / d;
  const top = 16;
  let remaining = n;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`ভগ্নাংশ ${toBengaliNumber(n)}/${toBengaliNumber(d)}`}>
      {Array.from({ length: bars }, (_, bi) => {
        const y = top + bi * (barH + gap);
        const filled = Math.min(d, Math.max(0, remaining));
        remaining -= filled;
        return (
          <g key={bi}>
            {Array.from({ length: d }, (_, pi) => (
              <rect key={pi} x={(W - barW) / 2 + pi * pieceW} y={y} width={pieceW - 2} height={barH}
                fill={pi < filled ? c.accent : c.track} stroke={c.border} strokeWidth={1} rx={4} />
            ))}
          </g>
        );
      })}
      <Caption c={c}>{toBengaliNumber(n)}/{toBengaliNumber(d)}</Caption>
    </svg>
  );
}

// ── exponent_stack: base boxes × each other, building to the product ───────
function ExponentStack({ spec, c }: { spec: Extract<DiagramSpec, { type: 'exponent_stack' }>; c: P }) {
  const { base, exponent } = spec;
  const product = base ** exponent;
  const boxW = 42, boxH = 42, gapSym = 26;
  const total = exponent * boxW + (exponent - 1) * gapSym;
  const startX = (W - total) / 2, y = 40;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${toBengaliNumber(base)} এর ঘাত ${toBengaliNumber(exponent)}`}>
      {Array.from({ length: exponent }, (_, i) => {
        const x = startX + i * (boxW + gapSym);
        return (
          <g key={i}>
            <rect x={x} y={y} width={boxW} height={boxH} rx={8} fill={c.accentSoft} stroke={c.accent} strokeWidth={2} />
            <text x={x + boxW / 2} y={y + boxH / 2 + 7} textAnchor="middle" fontSize={20} fontWeight={700} fill={c.accent}>
              {toBengaliNumber(base)}
            </text>
            {i < exponent - 1 && (
              <text x={x + boxW + gapSym / 2} y={y + boxH / 2 + 7} textAnchor="middle" fontSize={20} fill={c.sub}>×</text>
            )}
          </g>
        );
      })}
      <Caption c={c}>{toBengaliNumber(base)}^{toBengaliNumber(exponent)} = {toBengaliNumber(product)}</Caption>
    </svg>
  );
}

// ── square_root_square: a root×root grid, side labeled ──────────────────────
function SquareRootSquare({ spec, c }: { spec: Extract<DiagramSpec, { type: 'square_root_square' }>; c: P }) {
  const root = Math.round(Math.sqrt(spec.n));
  const maxSide = 170, cell = maxSide / root;
  const gx = (W - cell * root) / 2, gy = 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`${toBengaliNumber(spec.n)} এর বর্গমূল`}>
      {Array.from({ length: root * root }, (_, i) => {
        const row = Math.floor(i / root), col = i % root;
        return (
          <rect key={i} x={gx + col * cell} y={gy + row * cell} width={cell - 1} height={cell - 1}
            fill={c.accentSoft} stroke={c.accent} strokeWidth={1} />
        );
      })}
      <text x={gx - 10} y={gy + (cell * root) / 2 + 5} textAnchor="end" fontSize={14} fontWeight={700} fill={c.text}>
        {toBengaliNumber(root)}
      </text>
      <text x={gx + (cell * root) / 2} y={gy + cell * root + 18} textAnchor="middle" fontSize={14} fontWeight={700} fill={c.text}>
        {toBengaliNumber(root)}
      </text>
      <Caption c={c}>√{toBengaliNumber(spec.n)} = {toBengaliNumber(root)}</Caption>
    </svg>
  );
}

// ── area_grid: rows×cols unit squares ───────────────────────────────────────
function AreaGrid({ spec, c }: { spec: Extract<DiagramSpec, { type: 'area_grid' }>; c: P }) {
  const { rows, cols } = spec;
  const cell = Math.min(28, 300 / cols, 170 / rows);
  const gx = (W - cell * cols) / 2, gy = 10;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`ক্ষেত্রফল ${toBengaliNumber(rows)} গুণ ${toBengaliNumber(cols)}`}>
      {Array.from({ length: rows * cols }, (_, i) => {
        const row = Math.floor(i / cols), col = i % cols;
        return (
          <rect key={i} x={gx + col * cell} y={gy + row * cell} width={cell - 1.5} height={cell - 1.5}
            fill={c.accentSoft} stroke={c.accent} strokeWidth={1} />
        );
      })}
      <text x={gx + (cell * cols) / 2} y={gy + cell * rows + 18} textAnchor="middle" fontSize={13} fill={c.sub}>
        {toBengaliNumber(cols)} একক
      </text>
      <text x={gx - 8} y={gy + (cell * rows) / 2 + 5} textAnchor="end" fontSize={13} fill={c.sub}>
        {toBengaliNumber(rows)}
      </text>
      <Caption c={c}>ক্ষেত্রফল = {toBengaliNumber(rows)} × {toBengaliNumber(cols)} = {toBengaliNumber(rows * cols)}</Caption>
    </svg>
  );
}

// ── equation_balance: a beam scale with term-boxes on each pan ─────────────
function EquationBalance({ spec, c }: { spec: Extract<DiagramSpec, { type: 'equation_balance' }>; c: P }) {
  const pan = (terms: (number | 'x')[], cx: number) => {
    const boxSize = 30, gap = 6, totalW = terms.length * boxSize + (terms.length - 1) * gap;
    const startX = cx - totalW / 2, y = 95;
    return (
      <g>
        <line x1={cx} y1={60} x2={cx} y2={88} stroke={c.sub} strokeWidth={2} />
        <line x1={startX - 10} y1={88} x2={startX + totalW + 10} y2={88} stroke={c.sub} strokeWidth={2} />
        {terms.map((t, i) => (
          <g key={i}>
            <rect x={startX + i * (boxSize + gap)} y={y} width={boxSize} height={boxSize} rx={6}
              fill={t === 'x' ? c.secondSoft : c.accentSoft} stroke={t === 'x' ? c.second : c.accent} strokeWidth={2} />
            <text x={startX + i * (boxSize + gap) + boxSize / 2} y={y + boxSize / 2 + 6} textAnchor="middle"
              fontSize={15} fontWeight={700} fill={t === 'x' ? c.second : c.accent}>
              {t === 'x' ? 'x' : toBengaliNumber(t)}
            </text>
          </g>
        ))}
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="সমীকরণ ভারসাম্য">
      <polygon points={`${W / 2 - 14},${60} ${W / 2 + 14},${60} ${W / 2},${40}`} fill={c.sub} />
      <line x1={70} y1={60} x2={W - 70} y2={60} stroke={c.text} strokeWidth={3} />
      {pan(spec.left, 110)}
      {pan(spec.right, W - 110)}
      <Caption c={c}>
        {spec.left.map(t => t === 'x' ? 'x' : toBengaliNumber(t)).join(' + ')}
        {'  =  '}
        {spec.right.map(t => t === 'x' ? 'x' : toBengaliNumber(t)).join(' + ')}
      </Caption>
    </svg>
  );
}

// ── symmetry_mirror: a shape and its true reflection across a dashed axis ──
// The second copy is produced by an SVG mirror transform (scale(-1,1) about
// the axis for a vertical line, scale(1,-1) for a horizontal one) rather than
// hand-flipping each shape's coordinates -- that guarantees a geometrically
// correct reflection for every shape (a right-angle triangle's reflection is
// NOT just a translated copy of itself; it must actually flip).
function SymmetryMirror({ spec, c }: { spec: Extract<DiagramSpec, { type: 'symmetry_mirror' }>; c: P }) {
  const size = 70;
  const originalCx = spec.axis === 'vertical' ? W / 2 - 50 : W / 2;
  const originalCy = spec.axis === 'horizontal' ? H / 2 - 44 : H / 2 - 10;

  const shape = () => {
    if (spec.shape === 'circle') {
      return <circle cx={originalCx} cy={originalCy} r={size / 2} fill={c.accentSoft} stroke={c.accent} strokeWidth={2} />;
    }
    if (spec.shape === 'rectangle') {
      return <rect x={originalCx - size / 2} y={originalCy - size / 3} width={size} height={(size * 2) / 3}
        fill={c.accentSoft} stroke={c.accent} strokeWidth={2} />;
    }
    // A right-angle triangle: asymmetric, so it's the shape that makes the
    // mirror transform's correctness actually visible (a circle would look
    // "correct" even with a plain duplicate instead of a real reflection).
    const { x, y } = { x: originalCx - size / 2, y: originalCy + size / 2 };
    return (
      <polygon points={`${x},${y} ${x},${y - size} ${x + size},${y}`}
        fill={c.accentSoft} stroke={c.accent} strokeWidth={2} />
    );
  };

  const mirrorTransform = spec.axis === 'vertical'
    ? `translate(${W}, 0) scale(-1, 1)`
    : `translate(0, ${H - 20}) scale(1, -1)`;

  const axisLine = spec.axis === 'vertical'
    ? <line x1={W / 2} y1={16} x2={W / 2} y2={H - 30} stroke={c.sub} strokeWidth={2} strokeDasharray="6,5" />
    : <line x1={30} y1={H / 2 - 10} x2={W - 30} y2={H / 2 - 10} stroke={c.sub} strokeWidth={2} strokeDasharray="6,5" />;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="প্রতিসাম্য">
      {axisLine}
      {shape()}
      <g transform={mirrorTransform}>{shape()}</g>
      <Caption c={c}>প্রতিসাম্য রেখা ({spec.axis === 'vertical' ? 'উলম্ব' : 'আনুভূমিক'})</Caption>
    </svg>
  );
}

export default function DiagramView({ spec, darkMode }: Props) {
  const c = palette(darkMode);
  const content = (() => {
    switch (spec.type) {
      case 'ratio_icons': return <RatioIcons spec={spec} c={c} />;
      case 'percent_grid': return <PercentGrid spec={spec} c={c} />;
      case 'fraction_split': return <FractionSplit spec={spec} c={c} />;
      case 'exponent_stack': return <ExponentStack spec={spec} c={c} />;
      case 'square_root_square': return <SquareRootSquare spec={spec} c={c} />;
      case 'area_grid': return <AreaGrid spec={spec} c={c} />;
      case 'equation_balance': return <EquationBalance spec={spec} c={c} />;
      case 'symmetry_mirror': return <SymmetryMirror spec={spec} c={c} />;
      default: return null;
    }
  })();
  if (!content) return null;
  return (
    <div style={{
      background: darkMode ? '#0f172a' : '#ffffff', border: `1px solid ${c.border}`,
      borderRadius: '0.7rem', padding: '0.6rem', marginBottom: '0.7rem', maxWidth: '420px',
    }}>
      {content}
    </div>
  );
}
