import type { ReactNode } from "react";

// 丸いプロフィール写真。写真がなければ placeholder を出す
export function Avatar({
  src,
  size,
  placeholderClassName,
  loading = false,
  placeholder,
}: {
  src: string | null;
  size: number;
  placeholderClassName: string;
  loading?: boolean;
  placeholder?: ReactNode;
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full ${placeholderClassName}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <img src={src} alt="プロフィール写真" className="size-full object-cover" />
      ) : (
        placeholder
      )}
      {loading ? (
        <span
          role="status"
          aria-label="保存中"
          className="absolute inset-0 flex items-center justify-center bg-white/45"
        >
          <span className="size-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
        </span>
      ) : null}
    </span>
  );
}

export function PersonIcon() {
  return (
    <svg width={26} height={26} viewBox="0 0 24 24" aria-hidden className="fill-mute">
      <circle cx={12} cy={8} r={4} />
      <path d="M4 21v-1a8 8 0 0 1 16 0v1Z" />
    </svg>
  );
}
