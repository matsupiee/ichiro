import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { paymentMethodLabel } from "../lib/payments";
import { useTRPC } from "../lib/trpc";
import { useAddPaymentMethod } from "./add-payment-method";
import { NoteText, Spinner } from "./ui";

type Props = {
  value: string | null;
  onChange: (id: string) => void;
};

// 罰金を引き落とす支払い方法を、Stripe に登録ずみのものから選ぶ。その場で追加もできる
export function PaymentMethodPicker({ value, onChange }: Props) {
  const trpc = useTRPC();
  const { data: methods, isPending } = useQuery(trpc.consumer.payment.listMethods.queryOptions());
  const { add, adding, dialog } = useAddPaymentMethod();

  // まだ選んでいなければ、最初に登録した支払い方法を選んでおく
  const first = methods?.[0]?.id;
  useEffect(() => {
    if (value === null && first) onChange(first);
  }, [value, first, onChange]);

  if (isPending) return <Spinner className="py-4" />;

  return (
    <>
      <div role="radiogroup" aria-label="支払い方法" className="mx-[30px] flex flex-col gap-2.5">
        {methods?.map((m) => (
          <label
            key={m.id}
            className="flex min-h-[62px] cursor-pointer items-center justify-between gap-3 rounded-[31px] bg-field pr-[22px] pl-[26px] text-[17px] text-ink"
          >
            <span className="truncate">{paymentMethodLabel(m)}</span>
            <input
              type="radio"
              name="payment-method"
              checked={value === m.id}
              onChange={() => onChange(m.id)}
              className="size-6 shrink-0 accent-brand"
            />
          </label>
        ))}
        <button
          type="button"
          disabled={adding}
          onClick={async () => {
            const added = await add();
            if (added) onChange(added.id);
          }}
          className="flex min-h-[62px] items-center justify-center rounded-[31px] border border-dashed border-line text-[16px] font-semibold text-ink-2 transition-colors hover:bg-field disabled:opacity-60"
        >
          {adding ? "準備中…" : "＋ 支払い方法を追加"}
        </button>
      </div>
      {methods?.length === 0 ? (
        <div className="pt-3">
          <NoteText>カードを登録してください。登録は Stripe で安全に行われます。</NoteText>
        </div>
      ) : null}
      {dialog}
    </>
  );
}
