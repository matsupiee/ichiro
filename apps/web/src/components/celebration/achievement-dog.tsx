import { useEffect, useState } from "react";

import type { AchievementAnimation } from "../../lib/achievement-animation";

const ANIMATIONS: Record<AchievementAnimation, { frames: string[]; sequence: number[] }> = {
  lifting: {
    frames: [1, 2, 3].map((n) => `/images/celebration/dog-lift-${n}.png`),
    sequence: [0, 1, 2, 1],
  },
  studying: {
    frames: [1, 2, 3, 4].map((n) => `/images/celebration/dog-study-${n}.png`),
    sequence: [0, 1, 2, 3],
  },
};

// 1周1.2秒でコマを切り替える。選ばれたバージョンのコマだけを読み込み、すべて読み込めてから動かす
export function AchievementDog({ size, variant }: { size: number; variant: AchievementAnimation }) {
  const { frames, sequence } = ANIMATIONS[variant];
  const [loaded, setLoaded] = useState(0);
  const [step, setStep] = useState(0);
  const ready = loaded === frames.length;

  useEffect(() => {
    if (!ready || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(
      () => setStep((value) => (value + 1) % sequence.length),
      1200 / sequence.length,
    );
    return () => clearInterval(timer);
  }, [ready, sequence.length]);

  return (
    <div
      data-testid={`achievement-dog-${variant}`}
      className="relative"
      style={{ width: size, height: size }}
    >
      {frames.map((src, index) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          onLoad={() => setLoaded((value) => value + 1)}
          className="absolute inset-0 size-full object-contain"
          style={{ opacity: sequence[step] === index ? 1 : 0 }}
        />
      ))}
    </div>
  );
}
