import { type CSSProperties, useMemo } from "react";

const COLORS = ["#3DC4F4", "#FFC800", "#4DD8FF", "#58E08A", "#FF8A4C", "#B67CFF"];

function makePieces(count: number) {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI * 2;
    const radius = 90 + Math.random() * 170;
    const width = 7 + Math.random() * 7;
    return {
      width,
      height: 10 + Math.random() * 10,
      color: COLORS[i % COLORS.length]!,
      round: i % 3 === 0,
      vars: {
        "--dx": `${Math.cos(angle) * radius}px`,
        "--up": `${-70 - Math.random() * 150}px`,
        "--dy": `${200 + Math.random() * 380}px`,
        "--rotate": `${Math.random() * 900 - 450}deg`,
        "--duration": `${1500 + Math.random() * 900}ms`,
        "--delay": `${550 + Math.random() * 250}ms`,
      },
    };
  });
}

// 画面の横中央・上から34%の位置から紙吹雪を飛ばす
export function Confetti({ count = 60 }: { count?: number }) {
  const pieces = useMemo(() => makePieces(count), [count]);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-[3] overflow-hidden">
      <div className="absolute top-[34%] left-1/2">
        {pieces.map((p, i) => (
          <span
            key={i}
            className="celebration-confetti absolute top-0 left-0"
            style={
              {
                ...p.vars,
                width: p.width,
                height: p.height,
                borderRadius: p.round ? p.width : 2,
                background: p.color,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
