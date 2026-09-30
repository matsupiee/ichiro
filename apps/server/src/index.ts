import { trpcServer } from "@hono/trpc-server";
import { createHttpApp } from "@ichiro/api/http";
import { appRouter, httpRoutes } from "@ichiro/api/routers/index";
import { handleStripeEvent } from "@ichiro/api/shared/payment/handle-stripe-event";
import { runPenaltyJob } from "@ichiro/api/shared/penalty/run-penalty-job";
import { verifyStripeEvent } from "@ichiro/api/third-party-lib/stripe";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { createPublicPageApp } from "./public-page";
import { createAuth, getDb, getStripe } from "./services";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: ENV.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => (await createAuth()).handler(c.req.raw));

// プロフィール写真のように、tRPC に載せない素の HTTP のルート
app.route("/", createHttpApp(httpRoutes, createContext));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => createContext(context),
  }),
);

// Stripe の Webhook。引き落としの結果と、支払い方法の登録を反映する
app.post("/stripe/webhook", async (c) => {
  const signature = c.req.header("stripe-signature");
  if (!signature) return c.text("missing signature", 400);
  const stripe = getStripe();
  let event;
  try {
    event = await verifyStripeEvent(
      stripe,
      await c.req.text(),
      signature,
      ENV.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    return c.text("invalid signature", 400);
  }
  await handleStripeEvent(getDb(), stripe, event);
  return c.json({ received: true });
});

app.route("/", createPublicPageApp());

export default {
  fetch: app.fetch,
  // 1時間ごとの cron。締め切りを過ぎた未報告の日を精算し、罰金を Stripe で引き落とす
  scheduled(controller, _env, ctx) {
    ctx.waitUntil(
      runPenaltyJob(getDb(), getStripe(), new Date(controller.scheduledTime)).then((r) =>
        console.log("penalty job", r),
      ),
    );
  },
} satisfies ExportedHandler;
