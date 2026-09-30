import { accountWithdrawRoute } from "./consumer/account/withdraw/route";
import type { HttpRoute } from "../http";
import { router } from "../trpc";
import { commitmentCreateRoute } from "./consumer/commitment/create/route";
import { commitmentGetRoute } from "./consumer/commitment/get/route";
import { commitmentListRoute } from "./consumer/commitment/list/route";
import { commitmentReportRoute } from "./consumer/commitment/report/route";
import { commitmentUpdateRoute } from "./consumer/commitment/update/route";
import { paymentCompleteSetupRoute } from "./consumer/payment/complete-setup/route";
import { paymentListMethodsRoute } from "./consumer/payment/list-methods/route";
import { paymentStartSetupRoute } from "./consumer/payment/start-setup/route";
import { profileDeleteAvatarRoute } from "./consumer/profile/delete-avatar/route";
import { profileGetAvatarRoute } from "./consumer/profile/get-avatar/route";
import { profileUploadAvatarRoute } from "./consumer/profile/upload-avatar/route";

export const appRouter = router({
  consumer: router({
    account: router({ withdraw: accountWithdrawRoute }),
    commitment: router({
      list: commitmentListRoute,
      get: commitmentGetRoute,
      create: commitmentCreateRoute,
      update: commitmentUpdateRoute,
      report: commitmentReportRoute,
    }),
    payment: router({
      listMethods: paymentListMethodsRoute,
      startSetup: paymentStartSetupRoute,
      completeSetup: paymentCompleteSetupRoute,
    }),
  }),
});

export type AppRouter = typeof appRouter;

// tRPC に載せない、素の HTTP のルート
export const httpRoutes: HttpRoute[] = [
  profileUploadAvatarRoute,
  profileDeleteAvatarRoute,
  profileGetAvatarRoute,
];
