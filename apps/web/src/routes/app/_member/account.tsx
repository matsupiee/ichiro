import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import { useAddPaymentMethod } from "../../../components/add-payment-method";
import { Avatar } from "../../../components/avatar";
import { useDialog } from "../../../components/dialog";
import { Chevron, ErrorText, RowButton, RowLink, Screen } from "../../../components/ui";
import { authClient } from "../../../lib/auth-client";
import { useAvatar } from "../../../lib/avatar";
import { paymentMethodLabel } from "../../../lib/payments";
import { useTRPC } from "../../../lib/trpc";

export const Route = createFileRoute("/app/_member/account")({
  head: () => ({ meta: [{ title: "アカウント | ichiro" }] }),
  component: AccountScreen,
});

const CONTACT_EMAIL = "btq32jh@icloud.com";

const legalPages = [
  { path: "/terms", title: "利用規約" },
  { path: "/commerce", title: "特定商取引法に基づく表記" },
  { path: "/privacy", title: "プライバシーポリシー" },
] as const;

const row =
  "mx-[30px] flex min-h-16 items-center justify-between gap-3 rounded-[36px] bg-field pr-[22px] pl-[26px] text-[17px] text-ink transition-colors hover:bg-field-pressed";

function SectionLabel({ children, top = 22 }: { children: string; top?: number }) {
  return (
    <h2 className="px-[54px] pb-2.5 text-[17px] font-normal text-ink" style={{ paddingTop: top }}>
      {children}
    </h2>
  );
}

function NameDialog({ initial, onClose }: { initial: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) {
      setError("名前を入力してください");
      return;
    }
    setSaving(true);
    const { error: e } = await authClient.updateUser({ name });
    if (e) {
      setSaving(false);
      setError(e.message ?? "保存できませんでした");
      return;
    }
    await router.invalidate();
    onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby="name-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[calc(100%-44px)] max-w-[400px] rounded-[36px] bg-canvas px-[18px] pt-7 pb-[18px] text-ink shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop:bg-black/20"
    >
      <form method="post" noValidate onSubmit={(event) => void save(event)}>
        <h2 id="name-dialog-title" className="px-3 text-[20px] font-extrabold">
          名前を編集
        </h2>
        <label htmlFor="name-input" className="block px-3 pt-1.5 pb-4 text-[15px] text-mute">
          名前を入力してください
        </label>
        <div className="flex min-h-[62px] items-center rounded-[28px] bg-field px-[22px] focus-within:ring-2 focus-within:ring-brand">
          <input
            id="name-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
            autoComplete="name"
            className="flex-1 bg-transparent py-[18px] text-[18px] caret-brand outline-none"
          />
        </div>
        <ErrorText message={error} />
        <div className="flex gap-2.5 pt-[18px]">
          <button
            type="button"
            onClick={onClose}
            className="h-[54px] flex-1 rounded-full bg-field text-[17px] font-bold hover:bg-field-pressed"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-[54px] flex-1 rounded-full bg-brand text-[17px] font-bold text-white hover:bg-brand-pressed disabled:opacity-60"
          >
            保存
          </button>
        </div>
      </form>
    </dialog>
  );
}

// Stripe に登録した支払い方法。罰金はここから引き落とされる
function PaymentInfo() {
  const trpc = useTRPC();
  const { data: methods } = useQuery(trpc.consumer.payment.listMethods.queryOptions());
  const { add, adding, dialog } = useAddPaymentMethod();
  return (
    <div className="flex flex-col gap-2.5">
      {methods?.length === 0 ? (
        <p className="mx-[30px] flex min-h-16 items-center rounded-[36px] bg-field pr-[22px] pl-[26px] text-[17px] text-mute">
          未登録
        </p>
      ) : null}
      {methods?.map((m) => (
        <p
          key={m.id}
          className="mx-[30px] flex min-h-16 items-center truncate rounded-[36px] bg-field pr-[22px] pl-[26px] text-[17px] text-ink"
        >
          {paymentMethodLabel(m)}
        </p>
      ))}
      <RowButton disabled={adding} onClick={() => void add()}>
        {adding ? "準備中…" : "支払い方法を追加"}
        <Chevron />
      </RowButton>
      {dialog}
    </div>
  );
}

function ExternalRow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener" className={row}>
      {children}
      <Chevron />
    </a>
  );
}

// アカウントの管理。ホーム右上のアイコンから開く
function AccountScreen() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const dialog = useDialog();
  const avatar = useAvatar(user.image);
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoMenu, setPhotoMenu] = useState(false);
  const [nameOpen, setNameOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error(result.error.message);
      queryClient.clear();
      await navigate({ to: "/app/welcome", replace: true });
    } catch {
      setSigningOut(false);
      await dialog.alert({
        title: "ログアウトできませんでした",
        message: "通信環境を確認して、もう一度お試しください",
      });
    }
  };

  return (
    <Screen>
      <header className="flex items-center justify-between px-6 pt-3.5">
        <div className="w-11" />
        <h1 className="text-[24px] font-extrabold text-ink">アカウント</h1>
        <Link
          to="/app"
          aria-label="閉じる"
          className="flex size-11 items-center justify-center rounded-full bg-field text-[18px] text-ink-2 hover:bg-field-pressed"
        >
          ✕
        </Link>
      </header>

      <SectionLabel top={26}>プロフィール写真</SectionLabel>
      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={photoMenu}
          aria-label="プロフィール写真を変更"
          disabled={avatar.busy}
          onClick={() => setPhotoMenu((open) => !open)}
          className={`${row} w-[calc(100%-60px)] py-3 disabled:opacity-100`}
        >
          <Avatar src={avatar.src} size={44} placeholderClassName="bg-line" loading={avatar.busy} />
          <Chevron />
        </button>
        {photoMenu ? (
          <div
            role="menu"
            aria-label="プロフィール写真"
            className="absolute top-[78px] right-20 left-20 z-10 flex flex-col gap-2.5 rounded-[32px] bg-[rgba(246,246,246,0.97)] px-4 pt-[18px] pb-4 shadow-[0_12px_40px_rgba(0,0,0,0.14)]"
          >
            <p className="pb-1 text-center text-[17px] text-ink">プロフィール写真</p>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setPhotoMenu(false);
                fileInput.current?.click();
              }}
              className="h-[50px] rounded-full bg-field text-[17px] font-semibold text-ink hover:bg-field-pressed"
            >
              写真を選択
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setPhotoMenu(false);
                void avatar.remove();
              }}
              className="h-[50px] rounded-full bg-field text-[17px] font-semibold text-alert hover:bg-field-pressed"
            >
              削除
            </button>
          </div>
        ) : null}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          aria-label="写真ファイル"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void avatar.upload(file);
          }}
        />
      </div>

      <SectionLabel>名前</SectionLabel>
      <RowButton aria-label={`名前 ${user.name}`} onClick={() => setNameOpen(true)}>
        <span className="truncate text-[18px]">{user.name}</span>
        <Chevron />
      </RowButton>

      <SectionLabel>メールアドレス</SectionLabel>
      <RowLink to="/app/change-email">
        <span className="truncate text-[16px]">{user.email}</span>
      </RowLink>

      <SectionLabel>支払い情報</SectionLabel>
      <PaymentInfo />

      <nav aria-label="規約・問い合わせ" className="flex flex-col gap-2.5 pt-8">
        {legalPages.map((page) => (
          <ExternalRow key={page.path} href={page.path}>
            {page.title}
          </ExternalRow>
        ))}
        <a
          href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("ichiro 問い合わせ・報告")}`}
          className={row}
        >
          問い合わせ・報告
          <Chevron />
        </a>
        <p className="px-[54px] text-[13px] leading-5 text-faint">
          メールアプリが開かない場合は {CONTACT_EMAIL} 宛にお送りください。
        </p>
      </nav>

      <div className="pt-8">
        <RowButton disabled={signingOut} onClick={() => void signOut()}>
          ログアウト
        </RowButton>
      </div>
      <div className="pt-2.5">
        <Link to="/app/withdrawal" className={`${row} text-alert`}>
          退会
          <Chevron />
        </Link>
      </div>

      {nameOpen ? <NameDialog initial={user.name} onClose={() => setNameOpen(false)} /> : null}
    </Screen>
  );
}
