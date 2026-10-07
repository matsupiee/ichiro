const SIZE = 900;
const C = SIZE / 2;
// CSS の radial-gradient(circle) は一番遠い角までを 100% とする
const R = C * Math.SQRT2;

function wedge(fromDeg: number, toDeg: number) {
  const p = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return `${C + Math.cos(rad) * R} ${C + Math.sin(rad) * R}`;
  };
  return `M ${C} ${C} L ${p(fromDeg)} A ${R} ${R} 0 0 1 ${p(toDeg)} Z`;
}

// 30度ごとに10度幅の光線。中心から外へ向けて消えていく
const WEDGES = Array.from({ length: 12 }, (_, i) => wedge(i * 30, i * 30 + 10));

export function Rays({ centerY }: { centerY: number }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2"
      style={{ top: centerY, width: SIZE, height: SIZE, marginLeft: -C, marginTop: -C }}
    >
      <svg className="celebration-rays" width={SIZE} height={SIZE}>
        <defs>
          <radialGradient id="celebration-ray" cx={C} cy={C} r={R} gradientUnits="userSpaceOnUse">
            <stop offset="0.18" stopColor="#EAF9FF" stopOpacity={1} />
            <stop offset="0.52" stopColor="#EAF9FF" stopOpacity={0} />
          </radialGradient>
        </defs>
        {WEDGES.map((d, i) => (
          <path key={i} d={d} fill="url(#celebration-ray)" />
        ))}
      </svg>
    </div>
  );
}
