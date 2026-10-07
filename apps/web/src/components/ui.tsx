import { Link, type LinkProps } from "@tanstack/react-router";
import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  forwardRef,
  useId,
  useState,
} from "react";

// ネイティブ版（apps/native/components/ui.tsx）の大きな角丸パーツ。寸法はデザイン（393pt 幅）の値そのまま。

const primary =
  "flex h-[60px] w-full items-center justify-center rounded-full bg-brand text-[18px] font-bold text-white transition-colors hover:bg-brand-pressed active:bg-brand-pressed disabled:cursor-not-allowed disabled:opacity-60";
const secondary =
  "flex h-[60px] w-full items-center justify-center rounded-full bg-field text-[18px] font-bold text-ink transition-colors hover:bg-field-pressed active:bg-field-pressed";

// 水色のフラットなボタン
export function PrimaryButton({
  label,
  type = "button",
  ...props
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & { label: string }) {
  return (
    <button type={type} className={primary} {...props}>
      {label}
    </button>
  );
}

export function PrimaryLink({ label, ...props }: LinkProps & { label: string }) {
  return (
    <Link className={primary} {...props}>
      {label}
    </Link>
  );
}

export function SecondaryLink({ label, ...props }: LinkProps & { label: string }) {
  return (
    <Link className={secondary} {...props}>
      {label}
    </Link>
  );
}

// 文字だけのボタン。補助の操作（再送・画面の切り替えなど）に使う
export function TextButton({
  children,
  type = "button",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`block w-full px-[30px] py-[22px] text-center text-[15px] text-mute disabled:opacity-60 ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="戻る"
      onClick={onClick}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-white transition-colors hover:bg-field"
    >
      <span className="ml-1 block size-[10px] rotate-45 border-b-[2.5px] border-l-[2.5px] border-ink" />
    </button>
  );
}

// 戻る・タイトル・右の空きの3つを並べたヘッダー
export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="flex items-center justify-between px-6 pt-3.5">
      <BackButton onClick={onBack} />
      <h1 className="text-[21px] font-bold text-ink">{title}</h1>
      <div className="w-12" />
    </header>
  );
}

// スマートフォンの幅を基準にした1カラムの画面。PC では中央に寄せる
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col pb-10">{children}</main>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; trailing?: ReactNode };

// ラベル付きの入力欄。灰色の大きな角丸
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, trailing, id, ...props },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <div>
      <label htmlFor={inputId} className="block px-[54px] pt-[22px] pb-2.5 text-[17px] text-ink">
        {label}
      </label>
      <div className="mx-[30px] flex min-h-[62px] items-center rounded-[31px] bg-field px-[26px] focus-within:ring-2 focus-within:ring-brand">
        <input
          ref={ref}
          id={inputId}
          className="min-w-0 flex-1 bg-transparent py-[18px] text-[17px] text-ink caret-brand outline-none placeholder:text-faint disabled:opacity-60"
          {...props}
        />
        {trailing}
      </div>
    </div>
  );
});

// 右端のボタンで、入力したパスワードの表示・非表示を切り替える
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, "type" | "trailing">>(
  function PasswordField(props, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <Field
        ref={ref}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        {...props}
        type={visible ? "text" : "password"}
        trailing={
          <button
            type="button"
            aria-label={visible ? "パスワードを隠す" : "パスワードを表示"}
            aria-pressed={visible}
            onClick={() => setVisible((value) => !value)}
            className="-mr-3.5 flex size-11 shrink-0 items-center justify-center text-mute"
          >
            <EyeIcon off={visible} />
          </button>
        }
      />
    );
  },
);

function EyeIcon({ off }: { off: boolean }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
      <circle cx={12} cy={12} r={3} />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

// 6桁の認証コードの入力欄。数字以外は取り除く
export function OtpField({
  value,
  onChange,
  label = "認証コード",
  ...props
}: Omit<FieldProps, "value" | "onChange" | "label"> & {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}) {
  return (
    <Field
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="6桁のコード"
      {...props}
    />
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="px-11 pt-3 text-center text-[14px] leading-[22px] text-alert">
      {message}
    </p>
  );
}

export function NoteText({ children }: { children: ReactNode }) {
  return <p className="px-[30px] text-[14px] leading-6 text-mute">{children}</p>;
}

// ブランドの筆記体ロゴ。画像をマスクにして、ブランド色で塗る
export function BrandLogo({ width = 150 }: { width?: number }) {
  return (
    <span
      role="img"
      aria-label="ichiro"
      className="block bg-brand"
      style={{
        width,
        height: width / 3,
        maskImage: "url(/images/ichiro-wordmark.png)",
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
      }}
    />
  );
}

export function Chevron() {
  return (
    <span
      aria-hidden
      className="mr-1 block size-[9px] rotate-45 border-t-[2.5px] border-r-[2.5px] border-ink"
    />
  );
}

const row =
  "mx-[30px] flex min-h-16 items-center justify-between gap-3 rounded-[36px] bg-field pr-[22px] pl-[26px] text-left text-[17px] text-ink transition-colors hover:bg-field-pressed disabled:opacity-60";

// 灰色の大きな角丸の行。右に矢印
export function RowLink({ children, ...props }: LinkProps & { children: ReactNode }) {
  return (
    <Link className={row} {...props}>
      {children}
      <Chevron />
    </Link>
  );
}

export function RowButton({
  children,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={`${row} w-[calc(100%-60px)]`} {...props}>
      {children}
    </button>
  );
}

// 回転させた L 字で描くチェックマーク
export function CheckMark({
  width,
  height,
  thickness,
  offsetY,
}: {
  width: number;
  height: number;
  thickness: number;
  offsetY: number;
}) {
  return (
    <span
      aria-hidden
      className="block rotate-45 rounded-[1px] border-white"
      style={{
        width,
        height,
        marginTop: offsetY,
        borderRightWidth: thickness,
        borderBottomWidth: thickness,
      }}
    />
  );
}

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span role="status" aria-label="読み込み中" className={`flex justify-center ${className}`}>
      <span className="size-7 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
    </span>
  );
}
