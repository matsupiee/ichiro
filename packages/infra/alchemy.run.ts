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

// 画面と API を1つの Worker で配信する。Vite で apps/web（TanStack Start）をビルドし、
// サーバー側のバンドルを Worker に、クライアント側と public/ を Static Assets にする
export const server = Cloudflare.Website.Vite("server", {
  rootDir: "../../apps/web",
  // fetch は TanStack Start に任せ、cron の scheduled を足した自前のエントリ
  main: "src/server.ts",
  domain: process.env.APP_ENV === "prod" ? "ichiro.app" : undefined,
  compatibility: {
    flags: ["nodejs_compat"],
  },
  // 罰金の精算と徴収（apps/web/src/server.ts の scheduled）
  crons: ["5 * * * *"],
  env: {
    DB: db,
    APP_ENV: Config.String("APP_ENV"),
    RESEND_API_KEY: Config.Redacted("RESEND_API_KEY").pipe(Config.withDefault(Redacted.make(""))),
    AUTH_EMAIL_FROM: Config.String("AUTH_EMAIL_FROM"),
    AUTH_EMAIL_DELIVERY: Config.String("AUTH_EMAIL_DELIVERY"),
    AVATARS: avatars,
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Cloudflare.Worker.URL,
    STRIPE_SECRET_KEY: Config.Redacted("STRIPE_SECRET_KEY"),
    STRIPE_PUBLISHABLE_KEY: Config.String("STRIPE_PUBLISHABLE_KEY"),
    STRIPE_WEBHOOK_SECRET: Config.Redacted("STRIPE_WEBHOOK_SECRET"),
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
        // Alchemyの実行情報を受け取る
        const { dev } = yield* Alchemy.AlchemyContext;
        // ローカル開発なら、状態をローカルに保存して終了
        if (dev) return localState();

        // デプロイ先のstage（stg / prod）を受け取る
        const stage = yield* Alchemy.Stage;
        // stageと環境変数の組み合わせを検証する
        validateDeployment(stage, process.env);
        // デプロイ時は、状態をCloudflareに保存する
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
