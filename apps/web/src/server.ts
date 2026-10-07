import { runPenaltyJob } from "@ichiro/api/shared/penalty/run-penalty-job";
import handler from "@tanstack/react-start/server-entry";

import { withSecurityHeaders } from "./server/security-headers";
import { getDb, getStripe } from "./server/services";

// Worker のエントリ。HTTP はすべて TanStack Start に任せ、cron の処理だけをここで足す
// https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/#custom-entrypoints
export default {
  // 2番目の引数（Cloudflare の env）は渡さない。バインディングは cloudflare:workers の env から読む
  fetch: async (request) => withSecurityHeaders(await handler.fetch(request)),
  // 1時間ごとの cron。締め切りを過ぎた未報告の日を精算し、罰金を Stripe で引き落とす
  scheduled(controller, _env, ctx) {
    ctx.waitUntil(
      runPenaltyJob(getDb(), getStripe(), new Date(controller.scheduledTime)).then((r) =>
        console.log("penalty job", r),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
