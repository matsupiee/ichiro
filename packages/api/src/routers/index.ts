import { protectedProcedure, publicProcedure, router } from "../index";
import { commitmentRouter } from "./commitment";
import { paymentRouter } from "./payment";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  commitment: commitmentRouter,
  payment: paymentRouter,
});
export type AppRouter = typeof appRouter;
