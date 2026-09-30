// global.css の @theme と同じ値。className が使えない場所（SVG・アニメーション・
// 動的な色）ではこちらを使う。
export const colors = {
  pink: "#FF5CF2",
  pinkDeep: "#D63FCB",
  pinkSoft: "#FFE1FC",
  pinkRay: "#FFEAFD",
  canvas: "#F4F4F4",
  card: "#EDEDED",
  field: "#E2E2E2",
  ink: "#1C1C1E",
  ink2: "#3A3A3C",
  mute: "#8E8E93",
  faint: "#A1A1A6",
  line: "#C7C7CC",
  chipOff: "#F4F4F6",
  dot: "#DADADA",
  toggleOn: "#34C759",
  amber: "#FFB800",
  amberDeep: "#E0A000",
  white: "#FFFFFF",
} as const;

export const fonts = {
  logo: "DelaGothicOne_400Regular",
} as const;

// デザインの影をそのまま RN の boxShadow に写したもの
export const shadows = {
  knob: "0px 2px 6px rgba(0, 0, 0, 0.18)",
  popover: "0px 12px 40px rgba(0, 0, 0, 0.14)",
  modal: "0px 20px 50px rgba(0, 0, 0, 0.18)",
} as const;
