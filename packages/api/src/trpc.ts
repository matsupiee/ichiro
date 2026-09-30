import { initTRPC, TRPCError } from "@trpc/server";

import { withActiveUser } from "./shared/account/with-active-user";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const withdrawalProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  if (!ctx.session.user.emailVerified) {
    throw new TRPCError({ code: "FORBIDDEN", message: "メールアドレスの確認が必要です" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

export const protectedProcedure = withdrawalProcedure.use(({ ctx, next }) =>
  withActiveUser(ctx.db, ctx.session.user.id, () => next({ ctx })),
);
