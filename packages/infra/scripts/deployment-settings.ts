export function validateDeployment(stage: string, env: Record<string, string | undefined>) {
  if (stage !== "stg" && stage !== "prod") {
    throw new Error("デプロイ先は stg または prod を指定してください。");
  }
  if (env.APP_ENV !== stage || env.NODE_ENV !== "production") {
    throw new Error("APP_ENV と stage を一致させ、NODE_ENV=production を指定してください。");
  }
  const prefix = stage === "stg" ? "sk_test_" : "sk_live_";
  if (!env.STRIPE_SECRET_KEY?.startsWith(prefix)) {
    throw new Error(`${stage} の STRIPE_SECRET_KEY は ${prefix} で始まるキーが必要です。`);
  }
  if (!env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_")) {
    throw new Error("環境専用の STRIPE_WEBHOOK_SECRET が必要です。");
  }
  if ((env.BETTER_AUTH_SECRET?.length ?? 0) < 32) {
    throw new Error("環境専用の BETTER_AUTH_SECRET（32文字以上）が必要です。");
  }
  if (!env.CORS_ORIGIN || new URL(env.CORS_ORIGIN).protocol !== "https:") {
    throw new Error("CORS_ORIGIN に HTTPS の URL を設定してください。");
  }
  if (
    stage === "prod" &&
    (!env.RESEND_API_KEY || !env.MAIL_FROM || env.MAIL_FROM.includes("resend.dev"))
  ) {
    throw new Error("prod には RESEND_API_KEY と認証済みドメインの MAIL_FROM が必要です。");
  }
}
