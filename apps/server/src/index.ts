import { trpcServer } from "@hono/trpc-server";
import { stubPaymentGateway } from "@ichiro/api/lib/payment";
import { runPenaltyJob } from "@ichiro/api/lib/penalty";
import { appRouter } from "@ichiro/api/routers/index";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import { createContext } from "./context";
import { ENV } from "./env.server";
import { createAuth, getDb } from "./services";

const app = new Hono();

app.use(logger());
app.use(
  "/*",
  cors({
    origin: ENV.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  }),
);

app.on(["POST", "GET"], "/api/auth/*", async (c) => (await createAuth()).handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, context) => {
      return createContext({ context });
    },
  }),
);

app.get("/", (c) => {
  return c.text("OK");
});

export default {
  fetch: app.fetch,
  // 1時間ごとの cron。締め切りを過ぎた未報告の日を精算し、罰金を引き落とす
  scheduled(controller, _env, ctx) {
    ctx.waitUntil(
      runPenaltyJob(getDb(), stubPaymentGateway, new Date(controller.scheduledTime)).then((r) =>
        console.log("penalty job", r),
      ),
    );
  },
} satisfies ExportedHandler;
