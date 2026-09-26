import { paymentMethod } from "@ichiro/db/schema/index";
import { asc, eq } from "drizzle-orm";

import type { AuthedContext } from "../../../../context";

export async function handler({ ctx }: { ctx: AuthedContext }) {
  return ctx.db
    .select({
      id: paymentMethod.id,
      brand: paymentMethod.brand,
      last4: paymentMethod.last4,
      wallet: paymentMethod.wallet,
    })
    .from(paymentMethod)
    .where(eq(paymentMethod.userId, ctx.session.user.id))
    .orderBy(asc(paymentMethod.createdAt));
}
