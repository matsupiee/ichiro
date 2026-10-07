import { paymentCustomer } from "@ichiro/db/schema/index";
import { eq } from "drizzle-orm";

import type { AuthedContext } from "../../../../context";

export async function handler({ ctx }: { ctx: AuthedContext }) {
  const customerId = await ensureCustomer(ctx);
  const setupIntent = await ctx.stripe.setupIntents.create({
    customer: customerId,
    // 罰金はユーザーがアプリを開いていないときに引き落とす
    usage: "off_session",
    payment_method_types: ["card"],
    metadata: { user_id: ctx.session.user.id },
  });
  return { setupIntentClientSecret: setupIntent.client_secret! };
}

// ユーザーの Stripe Customer を返す。まだなければ作る
async function ensureCustomer({ db, stripe, session }: AuthedContext) {
  const { user } = session;
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
