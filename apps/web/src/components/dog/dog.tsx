import type { CSSProperties } from "react";

// ichiro の愛犬をモチーフにしたキャラクター。ネイティブ版（apps/native/components/dog/dog.tsx）と同じ形と動き。
// 200×200 の座標で組み立て、size に合わせて拡大縮小する。動きは dog.css のキーフレーム。

export type DogMood = "idle" | "jump";

const palette = {
  body: "#F2E3C6",
  tail: "#ECD3A6",
  head: "#F7ECD7",
  ear: "#EDD6AE",
  foot: "#FAF1E0",
  muzzle: "#FFF9EF",
  eye: "#1E1A18",
  noseShine: "#5A524C",
};

function box(left: number, top: number, width: number, height: number): CSSProperties {
  return { position: "absolute", left, top, width, height };
}

function Oval({
  left,
  top,
  width,
  height,
  color,
}: {
  left: number;
  top: number;
  width: number;
  height: number;
  color: string;
}) {
  return (
    <div style={{ ...box(left, top, width, height), borderRadius: "50%", background: color }} />
  );
}

function Eye({ left }: { left: number }) {
  return (
    <div
      className="dog-eye"
      style={{
        ...box(left, 74, 18, 20),
        borderRadius: 10,
        background: palette.eye,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          right: "18%",
          top: "14%",
          width: 6,
          height: 6,
          borderRadius: 3,
          background: "#fff",
        }}
      />
    </div>
  );
}

export function Dog({ size = 200, mood = "idle" }: { size?: number; mood?: DogMood }) {
  return (
    <div
      aria-hidden
      style={{ width: size, height: size, position: "relative", pointerEvents: "none" }}
    >
      {/* mood が変わったらアニメーションを最初からやり直す */}
      <div
        key={mood}
        className="dog"
        data-mood={mood}
        style={{
          ...box(0, 0, 200, 200),
          transformOrigin: "0 0",
          transform: `scale(${size / 200})`,
        }}
      >
        <div
          className="dog-shadow"
          style={{ ...box(48, 180, 104, 14), borderRadius: 52, background: "#000", opacity: 0.16 }}
        />
        <div className="dog-body" style={{ position: "absolute", inset: 0 }}>
          <div className="dog-tail" style={box(134, 98, 48, 48)}>
            <svg width={48} height={48} viewBox="0 0 48 48">
              <path
                d="M 8 40 C 28 40 42 28 36 16 C 32 6 20 6 18 16"
                stroke={palette.tail}
                strokeWidth={12}
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </div>
          <div
            style={{
              ...box(38, 106, 124, 80),
              borderRadius: "44px 44px 36px 36px",
              background: palette.body,
            }}
          />
          <Oval left={58} top={168} width={34} height={22} color={palette.foot} />
          <Oval left={108} top={168} width={34} height={22} color={palette.foot} />

          <div className="dog-head" style={{ position: "absolute", inset: 0 }}>
            <div className="dog-ear-left" style={box(20, 46, 44, 68)}>
              <Oval left={0} top={0} width={44} height={68} color={palette.ear} />
            </div>
            <div className="dog-ear-right" style={box(136, 46, 44, 68)}>
              <Oval left={0} top={0} width={44} height={68} color={palette.ear} />
            </div>
            <Oval left={38} top={28} width={124} height={112} color={palette.head} />
            <Eye left={68} />
            <Eye left={114} />
            <Oval left={74} top={94} width={52} height={38} color={palette.muzzle} />
            <div
              style={{
                ...box(88, 96, 24, 16),
                borderRadius: "12px 12px 10px 10px",
                background: palette.eye,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "22%",
                  top: "18%",
                  width: "30%",
                  height: "26%",
                  borderRadius: 4,
                  background: palette.noseShine,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
