import {
  type CSSProperties,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import type { AchievementAnimation } from "../../lib/achievement-animation";
import { Dog } from "../dog/dog";
import { PrimaryButton } from "../ui";
import { AchievementDog } from "./achievement-dog";
import { Confetti } from "./confetti";
import { Rays } from "./rays";

// 達成を報告したとき・コミットメントを作ったときに出すお祝い。
// ワンちゃんが下から跳ねて出てきて、紙吹雪で祝福する。

export type Tile = { label: string; value: string };

export type CelebrationInput = {
  illustration?: AchievementAnimation;
  closeLabel?: string;
  title?: string;
  message: string;
  tiles: [Tile] | [Tile, Tile];
};

type CelebrationState = CelebrationInput & { id: number };

const CelebrationContext = createContext<(input: CelebrationInput) => void>(() => {});

export function useCelebrate() {
  return useContext(CelebrationContext);
}

const TILE_COLORS = [
  { frame: "#3DC4F4", value: "#3DC4F4" },
  { frame: "#FFB800", value: "#E0A000" },
];

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

function TileCard({ tile, index }: { tile: Tile; index: number }) {
  const c = TILE_COLORS[index]!;
  return (
    <div
      className="celebration-rise flex-1 overflow-hidden rounded-[22px] border-[3px]"
      style={{ ...delay(750 + index * 100), borderColor: c.frame, background: c.frame }}
    >
      <p className="py-1.5 text-center text-[14px] font-extrabold text-white">{tile.label}</p>
      <div className="rounded-[18px] bg-white py-3.5">
        <p
          className="celebration-count text-center text-[28px] font-black"
          style={{ ...delay(1200 + index * 150), color: c.value }}
        >
          {tile.value}
        </p>
      </div>
    </div>
  );
}

function CelebrationOverlay({ cel, onClose }: { cel: CelebrationState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // 背面の画面をスクロールさせない
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={cel.title ?? cel.message}
      tabIndex={-1}
      className="celebration fixed inset-0 z-[90] overflow-hidden bg-white outline-none"
    >
      {!cel.illustration ? <Rays centerY={26 + 220} /> : null}
      <div className="celebration-shake absolute inset-0 z-[2] mx-auto flex max-w-[440px] flex-col items-center px-7 pt-[26px] pb-3">
        <div className="celebration-dog mt-[60px]">
          {cel.illustration ? (
            <AchievementDog key={cel.illustration} size={280} variant={cel.illustration} />
          ) : (
            <Dog size={230} mood="jump" />
          )}
        </div>
        {cel.title ? (
          <h2
            className="celebration-rise mt-[18px] text-[40px] text-brand"
            style={{ ...delay(500), fontFamily: '"Dela Gothic One", sans-serif' }}
          >
            {cel.title}
          </h2>
        ) : null}
        <p
          className="celebration-rise mt-[22px] text-center text-[17px] font-bold text-ink-2"
          style={delay(600)}
        >
          {cel.message}
        </p>
        <div className="mt-7 flex w-full gap-3">
          {cel.tiles.map((tile, i) => (
            <TileCard key={tile.label} tile={tile} index={i} />
          ))}
        </div>
        <div className="flex-1" />
        <div className="celebration-rise w-full" style={delay(1000)}>
          <PrimaryButton label={cel.closeLabel ?? "つづける"} onClick={onClose} />
        </div>
      </div>
      <Confetti count={60} />
    </div>
  );
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [cel, setCel] = useState<CelebrationState | null>(null);
  const celebrate = useCallback(
    (input: CelebrationInput) => setCel({ ...input, id: Date.now() }),
    [],
  );
  const close = useCallback(() => setCel(null), []);
  return (
    <CelebrationContext.Provider value={celebrate}>
      {children}
      {cel ? <CelebrationOverlay key={cel.id} cel={cel} onClose={close} /> : null}
    </CelebrationContext.Provider>
  );
}
