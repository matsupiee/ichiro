import { paymentMethod } from "@ichiro/db/schema/index";
import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import z from "zod";

import { protectedProcedure, router } from "../index";
import { completeSetup, startSetup } from "../lib/stripe";

function summarize(row: typeof paymentMethod.$inferSelect) {
  return { id: row.id, brand: row.brand, last4: row.last4, wallet: row.wallet };
}

export const paymentRouter = router({
  // 登録ずみの支払い方法。古い順
  methods: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select()
      .from(paymentMethod)
      .where(eq(paymentMethod.userId, ctx.session.user.id))
      .orderBy(asc(paymentMethod.createdAt));
    return rows.map(summarize);
  }),

  // PaymentSheet を開くための情報を返す
  startSetup: protectedProcedure.mutation(({ ctx }) =>
    startSetup(ctx.db, ctx.stripe, ctx.session.user),
  ),

  // PaymentSheet で登録が終わったら呼ぶ。登録した支払い方法を返す
  completeSetup: protectedProcedure
    .input(z.object({ setupIntentClientSecret: z.string().regex(/^seti_[^_]+_secret_/) }))
    .mutation(async ({ ctx, input }) => {
      const setupIntentId = input.setupIntentClientSecret.split("_secret_")[0]!;
      try {
        return summarize(
          await completeSetup(ctx.db, ctx.stripe, ctx.session.user.id, setupIntentId),
        );
      } catch (e) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: e instanceof Error ? e.message : "支払い方法を登録できませんでした",
        });
      }
    }),
});
