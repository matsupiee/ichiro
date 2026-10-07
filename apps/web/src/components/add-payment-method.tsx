import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";

import type { PaymentMethodSummary } from "../lib/payments";
import { getStripePublishableKey, loadStripeOnce } from "../lib/stripe";
import { useTRPC } from "../lib/trpc";
import { useDialog } from "./dialog";
import { ErrorText, PrimaryButton, TextButton } from "./ui";

type Pending = {
  clientSecret: string;
  publishableKey: string;
  resolve: (method: PaymentMethodSummary | null) => void;
};

// Stripe の Payment Element（https://docs.stripe.com/payments/save-and-reuse）でカードを登録する。
// 登録できたらその支払い方法を返し、閉じただけなら null を返す
export function useAddPaymentMethod(): {
  add: () => Promise<PaymentMethodSummary | null>;
  adding: boolean;
  dialog: ReactNode;
} {
  const trpc = useTRPC();
  const dialog = useDialog();
  const start = useMutation(trpc.consumer.payment.startSetup.mutationOptions());
  const [adding, setAdding] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);

  const add = async () => {
    if (adding) return null;
    setAdding(true);
    try {
      const [setup, publishableKey] = await Promise.all([
        start.mutateAsync(),
        getStripePublishableKey(),
      ]);
      return await new Promise<PaymentMethodSummary | null>((resolve) =>
        setPending({ clientSecret: setup.setupIntentClientSecret, publishableKey, resolve }),
      );
    } catch (e) {
      await dialog.alert({
        title: "支払い方法を登録できませんでした",
        message: e instanceof Error ? e.message : undefined,
      });
      return null;
    } finally {
      setAdding(false);
    }
  };

  return {
    add,
    adding,
    dialog: pending ? (
      <SetupDialog
        key={pending.clientSecret}
        pending={pending}
        onClose={(method) => {
          setPending(null);
          pending.resolve(method);
        }}
      />
    ) : null,
  };
}

function SetupDialog({
  pending,
  onClose,
}: {
  pending: Pending;
  onClose: (method: PaymentMethodSummary | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby="payment-dialog-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose(null);
      }}
      className="m-auto w-[calc(100%-32px)] max-w-[420px] rounded-[28px] bg-canvas p-0 text-ink backdrop:bg-black/20"
    >
      <h2 id="payment-dialog-title" className="px-6 pt-7 text-center text-[20px] font-extrabold">
        支払い方法を追加
      </h2>
      <p className="px-6 pt-2 pb-4 text-center text-[14px] leading-6 text-mute">
        カード情報は Stripe で安全に登録されます。ichiro にはカード番号を保存しません。
      </p>
      <Elements
        stripe={loadStripeOnce(pending.publishableKey)}
        options={{
          clientSecret: pending.clientSecret,
          locale: "ja",
          appearance: {
            theme: "stripe",
            variables: {
              colorPrimary: "#3DC4F4",
              colorText: "#163447",
              colorDanger: "#FF3B30",
              borderRadius: "16px",
            },
          },
        }}
      >
        <SetupForm
          clientSecret={pending.clientSecret}
          onBusyChange={setBusy}
          onDone={(method) => onClose(method)}
          onCancel={() => onClose(null)}
        />
      </Elements>
    </dialog>
  );
}

function SetupForm({
  clientSecret,
  onBusyChange,
  onDone,
  onCancel,
}: {
  clientSecret: string;
  onBusyChange: (busy: boolean) => void;
  onDone: (method: PaymentMethodSummary) => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const complete = useMutation(trpc.consumer.payment.completeSetup.mutationOptions());
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || busy) return;
    setBusy(true);
    onBusyChange(true);
    setError(null);
    try {
      // カードだけなので画面遷移は起きない。本人認証（3D セキュア）は Stripe がこの画面の上で行う
      const result = await stripe.confirmSetup({
        elements,
        redirect: "if_required",
        confirmParams: { return_url: window.location.href },
      });
      if (result.error) {
        setError(result.error.message ?? "カードを登録できませんでした");
        return;
      }
      const method = await complete.mutateAsync({ setupIntentClientSecret: clientSecret });
      await queryClient.invalidateQueries(trpc.consumer.payment.listMethods.pathFilter());
      onDone(method);
    } catch (e) {
      setError(e instanceof Error ? e.message : "カードを登録できませんでした");
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  };

  return (
    <form method="post" noValidate onSubmit={(event) => void submit(event)}>
      <div className="min-h-[180px] px-6">
        <PaymentElement onReady={() => setReady(true)} />
      </div>
      <ErrorText message={error} />
      <div className="px-6 pt-6">
        <PrimaryButton
          type="submit"
          label={busy ? "登録中…" : "登録する"}
          disabled={!stripe || !ready || busy}
        />
      </div>
      <TextButton disabled={busy} onClick={onCancel}>
        キャンセル
      </TextButton>
    </form>
  );
}
