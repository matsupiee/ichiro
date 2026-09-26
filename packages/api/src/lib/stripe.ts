import type { Database } from "@ichiro/db";
import { paymentCustomer, paymentMethod, penalty } from "@ichiro/db/schema/index";
import type { PaymentWallet } from "@ichiro/db/schema/payment-method";
import { and, eq, ne } from "drizzle-orm";
import Stripe from "stripe";

import type { PaymentGateway } from "./payment";

// 使う Stripe の API だけを抜き出した型。テストではこの形の偽物を渡す
export type StripeClient = {
  customers: Pick<Stripe["customers"], "create">;
  ephemeralKeys: Pick<Stripe["ephemeralKeys"], "create">;
  setupIntents: Pick<Stripe["setupIntents"], "create" | "retrieve">;
  paymentMethods: Pick<Stripe["paymentMethods"], "retrieve">;
  paymentIntents: Pick<Stripe["paymentIntents"], "create">;
};

export function createStripe(secretKey: string) {
  return new Stripe(secretKey);
}

// Webhook の署名を確かめてイベントを取り出す。Workers でも動くよう非同期版を使う
export function verifyStripeEvent(
  stripe: Stripe,
  payload: string,
  signature: string,
  webhookSecret: string,
) {
  return stripe.webhooks.constructEventAsync(payload, signature, webhookSecret);
}

type User = { id: string; email: string; name: string };

// ユーザーの Stripe Customer を返す。まだなければ作る
export async function ensureCustomer(db: Database, stripe: StripeClient, user: User) {
  const [existing] = await db
    .select()
    .from(paymentCustomer)
    .where(eq(paymentCustomer.userId, user.id));
  if (existing) return existing.stripeCustomerId;

  // 同時に呼ばれても Customer が2つできないよう、ユーザーごとの冪等キーを付ける
  const customer = await stripe.customers.create(
    { email: user.email, name: user.name, metadata: { user_id: user.id } },
    { idempotencyKey: `customer:${user.id}` },
  );
  await db
    .insert(paymentCustomer)
    .values({ userId: user.id, stripeCustomerId: customer.id })
    .onConflictDoNothing();
  return customer.id;
}

// PaymentSheet で支払い方法を登録するための SetupIntent と、端末用の一時キーを作る
export async function startSetup(db: Database, stripe: StripeClient, user: User) {
  const customerId = await ensureCustomer(db, stripe, user);
  const ephemeralKey = await stripe.ephemeralKeys.create(
    { customer: customerId },
    { apiVersion: Stripe.API_VERSION },
  );
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    // 罰金はユーザーがアプリを開いていないときに引き落とす
    usage: "off_session",
    // Apple Pay もカードとして登録される
    payment_method_types: ["card"],
    metadata: { user_id: user.id },
  });
  return {
    customerId,
    ephemeralKeySecret: ephemeralKey.secret!,
    setupIntentClientSecret: setupIntent.client_secret!,
  };
}

const WALLETS: readonly string[] = ["apple_pay", "google_pay"] satisfies PaymentWallet[];

// Stripe の支払い方法を payment_method に保存する。同じものは1行だけ
export async function savePaymentMethod(db: Database, userId: string, pm: Stripe.PaymentMethod) {
  if (pm.type !== "card" || !pm.card) {
    throw new Error("カード以外の支払い方法には対応していません");
  }
  const walletType = pm.card.wallet?.type ?? null;
  const wallet = walletType && WALLETS.includes(walletType) ? (walletType as PaymentWallet) : null;
  await db
    .insert(paymentMethod)
    .values({
      userId,
      stripePaymentMethodId: pm.id,
      brand: pm.card.brand,
      last4: pm.card.last4,
      wallet,
    })
    .onConflictDoNothing();
  const [row] = await db
    .select()
    .from(paymentMethod)
    .where(eq(paymentMethod.stripePaymentMethodId, pm.id));
  if (!row || row.userId !== userId) {
    throw new Error("支払い方法を保存できませんでした");
  }
  return row;
}

function idOf(value: string | { id: string } | null): string | null {
  if (value === null) return null;
  return typeof value === "string" ? value : value.id;
}

// PaymentSheet で登録が終わった SetupIntent を確かめ、支払い方法を保存する
export async function completeSetup(
  db: Database,
  stripe: StripeClient,
  userId: string,
  setupIntentId: string,
) {
  const [customer] = await db
    .select()
    .from(paymentCustomer)
    .where(eq(paymentCustomer.userId, userId));
  const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
    expand: ["payment_method"],
  });
  // ほかのユーザーの SetupIntent を持ち込んでも保存しない
  if (!customer || idOf(setupIntent.customer) !== customer.stripeCustomerId) {
    throw new Error("支払い方法の登録が見つかりません");
  }
  if (setupIntent.status !== "succeeded" || !setupIntent.payment_method) {
    throw new Error("支払い方法の登録が終わっていません");
  }
  const pm =
    typeof setupIntent.payment_method === "string"
      ? await stripe.paymentMethods.retrieve(setupIntent.payment_method)
      : setupIntent.payment_method;
  return savePaymentMethod(db, userId, pm);
}

// Stripe のカードエラーを、画面に出せる文に直す
function cardErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "authentication_required":
      return "カードの本人認証が必要なため引き落とせませんでした";
    case "card_declined":
      return "カードが拒否されました";
    case "expired_card":
      return "カードの有効期限が切れています";
    case "insufficient_funds":
      return "残高が足りませんでした";
    default:
      return fallback;
  }
}

// 罰金を Stripe で引き落とす窓口。ユーザーがいないときに、保存した支払い方法で決済する
export function stripeGateway(stripe: StripeClient): PaymentGateway {
  return {
    async charge(request) {
      try {
        const intent = await stripe.paymentIntents.create(
          {
            // 円はそのままの金額で渡す（小数のない通貨）
            amount: request.amount,
            currency: "jpy",
            customer: request.stripeCustomerId,
            payment_method: request.stripePaymentMethodId,
            off_session: true,
            confirm: true,
            description: request.description,
            metadata: { penalty_id: request.penaltyId },
          },
          { idempotencyKey: request.idempotencyKey },
        );
        if (intent.status === "succeeded") return { status: "succeeded", reference: intent.id };
        if (intent.status === "processing") return { status: "processing", reference: intent.id };
        return {
          status: "failed",
          reference: intent.id,
          message: `決済が完了しませんでした（${intent.status}）`,
        };
      } catch (e) {
        // カードが原因の失敗は、試し直すかどうかを決めるために結果として返す
        if (e instanceof Stripe.errors.StripeCardError) {
          return {
            status: "failed",
            reference: e.payment_intent?.id ?? null,
            message: cardErrorMessage(e.code, e.message),
          };
        }
        throw e;
      }
    },
  };
}

// Stripe の Webhook。引き落としの結果と、支払い方法の登録を反映する
export async function handleStripeEvent(db: Database, stripe: StripeClient, event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      const penaltyId = intent.metadata.penalty_id;
      if (!penaltyId) return;
      await db
        .update(penalty)
        .set({
          status: "paid",
          chargeReference: intent.id,
          failureMessage: null,
          paidAt: new Date(event.created * 1000),
        })
        .where(eq(penalty.id, penaltyId));
      return;
    }
    case "payment_intent.payment_failed": {
      const intent = event.data.object;
      const penaltyId = intent.metadata.penalty_id;
      if (!penaltyId) return;
      const error = intent.last_payment_error;
      await db
        .update(penalty)
        .set({
          status: "failed",
          chargeReference: intent.id,
          failureMessage: cardErrorMessage(error?.code, error?.message ?? "決済に失敗しました"),
        })
        // 先に成功が届いていたら上書きしない
        .where(and(eq(penalty.id, penaltyId), ne(penalty.status, "paid")));
      return;
    }
    case "setup_intent.succeeded": {
      // アプリからの登録完了の通知が届かなかったときのため、Webhook でも保存する
      const setupIntent = event.data.object;
      const customerId = idOf(setupIntent.customer);
      const pmId = idOf(setupIntent.payment_method);
      if (!customerId || !pmId) return;
      const [customer] = await db
        .select()
        .from(paymentCustomer)
        .where(eq(paymentCustomer.stripeCustomerId, customerId));
      if (!customer) return;
      await savePaymentMethod(db, customer.userId, await stripe.paymentMethods.retrieve(pmId));
      return;
    }
    default:
      return;
  }
}
