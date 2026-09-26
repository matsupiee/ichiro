import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import "varlock/auto-load";

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
  env: {
    DB: db,
    AVATARS: avatars,
    CORS_ORIGIN: Config.String("CORS_ORIGIN"),
    BETTER_AUTH_SECRET: Config.Redacted("BETTER_AUTH_SECRET"),
    BETTER_AUTH_URL: Cloudflare.Worker.URL,
    // 空のときは招待メールを送らず、Worker のログに出す
    RESEND_API_KEY: Config.Redacted("RESEND_API_KEY").pipe(Config.withDefault(Redacted.make(""))),
    MAIL_FROM: Config.String("MAIL_FROM").pipe(
      Config.withDefault("ichiro <onboarding@resend.dev>"),
    ),
  },
  dev: {
    port: 3000,
  },
});

export type ServerEnv = Cloudflare.InferEnv<typeof server>;

export default Alchemy.Stack(
  "ichiro",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const serverWorker = yield* server;

    return {
      server: serverWorker.url,
    };
  }),
);
