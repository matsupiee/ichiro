import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// ネイティブ版の Alert.alert の代わり。確認とお知らせのダイアログを <dialog> で出す

type DialogInput = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};
type DialogState = DialogInput & { kind: "confirm" | "alert"; resolve: (ok: boolean) => void };

type DialogApi = {
  confirm: (input: DialogInput) => Promise<boolean>;
  alert: (input: Omit<DialogInput, "cancelLabel">) => Promise<void>;
};

const DialogContext = createContext<DialogApi | null>(null);

export function useDialog() {
  const api = useContext(DialogContext);
  if (!api) throw new Error("DialogProvider の内側で使ってください");
  return api;
}

function DialogView({ state, onClose }: { state: DialogState; onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose(false);
      }}
      className="m-auto w-[calc(100%-44px)] max-w-[360px] rounded-[28px] bg-canvas p-0 text-ink shadow-[0_20px_50px_rgba(0,0,0,0.18)] backdrop:bg-black/20"
    >
      <div className="px-6 pt-7 pb-5 text-center">
        <h2 id="dialog-title" className="text-[18px] font-extrabold">
          {state.title}
        </h2>
        {state.message ? (
          <p className="pt-2 text-[15px] leading-6 whitespace-pre-line text-ink-2">
            {state.message}
          </p>
        ) : null}
      </div>
      <div className="flex gap-2.5 px-[18px] pb-[18px]">
        {state.kind === "confirm" ? (
          <button
            type="button"
            onClick={() => onClose(false)}
            className="h-[54px] flex-1 rounded-full bg-field text-[17px] font-bold transition-colors hover:bg-field-pressed"
          >
            {state.cancelLabel ?? "キャンセル"}
          </button>
        ) : null}
        <button
          type="button"
          autoFocus
          onClick={() => onClose(true)}
          className="h-[54px] flex-1 rounded-full bg-brand text-[17px] font-bold text-white transition-colors hover:bg-brand-pressed"
        >
          {state.confirmLabel ?? "OK"}
        </button>
      </div>
    </dialog>
  );
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DialogState | null>(null);
  const open = useCallback(
    (kind: DialogState["kind"], input: DialogInput) =>
      new Promise<boolean>((resolve) => setState({ ...input, kind, resolve })),
    [],
  );
  const api = useMemo<DialogApi>(
    () => ({
      confirm: (input) => open("confirm", input),
      alert: async (input) => {
        await open("alert", input);
      },
    }),
    [open],
  );
  return (
    <DialogContext.Provider value={api}>
      {children}
      {state ? (
        <DialogView
          state={state}
          onClose={(ok) => {
            setState(null);
            state.resolve(ok);
          }}
        />
      ) : null}
    </DialogContext.Provider>
  );
}
