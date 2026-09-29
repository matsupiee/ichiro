import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { localState } from "alchemy/State";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import "varlock/auto-load";
import { validateDeployment } from "./scripts/deployment-settings";

export const db = Cloudflare.D1.Database("database", {
  migrations: "../../packages/db/src/migrations",
});

// プロフィール写真の置き場所。配信は Worker の /avatars/* から行うので、バケットは公開しない
export const avatars = Cloudflare.R2.Bucket("avatars");

export const server = Cloudflare.Worker("server", {
  main: "../../apps/server/src/index.ts",
  compatibility: {
    flags: ["nodejs_compat"],
  },
  // 罰金の精算と徴収（apps/server/src/index.ts の scheduled）
  crons: ["5 * * * *"],
  env: {
    DB: db,
    AVATARS: avatars,
    CORS_ORIGIN: Config.String("CORS_ORIGIN"),
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Cloudflare.Worker.URL,
    STRIPE_SECRET_KEY: Config.Redacted("STRIPE_SECRET_KEY"),
    STRIPE_WEBHOOK_SECRET: Config.Redacted("STRIPE_WEBHOOK_SECRET"),
    // 空のときは招待メールを送らず、Worker のログに出す
    RESEND_API_KEY: Config.Redacted("RESEND_API_KEY").pipe(Config.withDefault(Redacted.make(""))),
    MAIL_FROM: Config.String("MAIL_FROM").pipe(
      Config.withDefault("ichiro <onboarding@resend.dev>"),
    ),
  },
  dev: {
    port: Number(process.env.ICHIRO_DEV_PORT ?? 3000),
  },
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

export default Alchemy.Stack(
  "ichiro",
  {
    providers: Cloudflare.providers(),
    state: Layer.unwrap(
      Effect.gen(function* () {
        const { dev } = yield* Alchemy.AlchemyContext;
        if (dev) return localState();
        const stage = yield* Alchemy.Stage;
        validateDeployment(stage, process.env);
        return Cloudflare.state();
      }),
    ),
  },
  Effect.gen(function* () {
    const serverWorker = yield* server;

    return {
      server: serverWorker.url,
    };
  }),
);
