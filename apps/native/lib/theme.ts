// global.css の @theme と同じ値。className が使えない場所（SVG・アニメーション・
// 動的な色）ではこちらを使う。
export const colors = {
  brand: "#3DC4F4",
  brandPressed: "#29AFE1",
  brandInk: "#087DA8",
  brandSoft: "#DCF5FF",
  brandRay: "#EAF9FF",
  canvas: "#F4FAFD",
  card: "#EAF3F8",
  field: "#DEEAF1",
  ink: "#163447",
  ink2: "#365466",
  mute: "#647F90",
  faint: "#8098A7",
  line: "#C4D8E4",
  chipOff: "#EAF3F8",
  dot: "#CEDFE9",
  toggleOn: "#3DC4F4",
  amber: "#FFB800",
  amberDeep: "#E0A000",
  white: "#FFFFFF",
} as const;

export const fonts = {
  celebration: "DelaGothicOne_400Regular",
} as const;

// デザインの影をそのまま RN の boxShadow に写したもの
export const shadows = {
  knob: "0px 2px 6px rgba(0, 0, 0, 0.18)",
  popover: "0px 12px 40px rgba(0, 0, 0, 0.14)",
  modal: "0px 20px 50px rgba(0, 0, 0, 0.18)",
} as const;
