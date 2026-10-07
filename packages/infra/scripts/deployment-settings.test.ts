import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadDeployment } from "./deploy";
import { validateDeployment } from "./deployment-settings";

const valid = {
  APP_ENV: "stg",
  RESEND_API_KEY: "re_fixture",
  AUTH_EMAIL_DELIVERY: "resend",
  AUTH_EMAIL_FROM: "ichiro <noreply@mail.ichiro.app>",
  NODE_ENV: "production",
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_PUBLISHABLE_KEY: "pk_test_fixture",
  STRIPE_WEBHOOK_SECRET: "whsec_fixture",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

test("stg と prod の Stripe キーを取り違えると停止する", () => {
  expect(() => validateDeployment("stg", valid)).not.toThrow();
  expect(() =>
    validateDeployment("stg", { ...valid, STRIPE_SECRET_KEY: "sk_live_fixture" }),
  ).toThrow("sk_test_");
  expect(() => validateDeployment("prod", { ...valid, APP_ENV: "prod" })).toThrow("sk_live_");
  expect(() =>
    validateDeployment("prod", {
      ...valid,
      APP_ENV: "prod",
      STRIPE_SECRET_KEY: "sk_live_fixture",
    }),
  ).toThrow("pk_live_");
  expect(() =>
    validateDeployment("stg", { ...valid, STRIPE_PUBLISHABLE_KEY: "pk_live_fixture" }),
  ).toThrow("pk_test_");
  expect(() =>
    validateDeployment("prod", {
      ...valid,
      APP_ENV: "prod",
      STRIPE_SECRET_KEY: "sk_live_fixture",
      STRIPE_PUBLISHABLE_KEY: "pk_live_fixture",
    }),
  ).not.toThrow();
});

test("暗黙の stage、環境不一致、未設定の秘密情報を拒否する", () => {
  expect(() => validateDeployment("dev_user", valid)).toThrow("stg または prod");
  expect(() => validateDeployment("stg", { ...valid, APP_ENV: "prod" })).toThrow("APP_ENV");
  expect(() => validateDeployment("stg", { ...valid, NODE_ENV: "development" })).toThrow(
    "NODE_ENV",
  );
  expect(() => validateDeployment("stg", { ...valid, STRIPE_WEBHOOK_SECRET: "" })).toThrow(
    "WEBHOOK",
  );
  expect(() => validateDeployment("stg", { ...valid, BETTER_AUTH_SECRET: "short" })).toThrow(
    "32文字",
  );
  expect(() =>
    validateDeployment("prod", {
      ...valid,
      APP_ENV: "prod",
      STRIPE_SECRET_KEY: "sk_live_fixture",
      STRIPE_PUBLISHABLE_KEY: "pk_live_fixture",
    }),
  ).not.toThrow();
});

const temporary: string[] = [];
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "ichiro-deploy-"));
  temporary.push(root);
  for (const dir of ["apps/web", "packages/infra"]) mkdirSync(join(root, dir), { recursive: true });
  for (const file of [
    "apps/web/.env.schema",
    "apps/web/.env.stg",
    "apps/web/.env.prod",
    "packages/infra/.env.schema",
  ]) {
    writeFileSync(join(root, file), readFileSync(new URL(`../../../${file}`, import.meta.url)));
  }
  return root;
}
function envFile(env: Record<string, string>) {
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
}

test("stage 別ファイルが開発用 .env の秘密情報を遮断し、.local から正しい設定を読む", async () => {
  const root = fixture();
  const basePath = join(root, "packages/infra");
  writeFileSync(
    join(root, "apps/web/.env"),
    envFile({ ...valid, STRIPE_PUBLISHABLE_KEY: "pk_test_development" }),
  );
  await expect(loadDeployment("stg", {}, basePath)).rejects.toThrow("環境変数");
  writeFileSync(join(root, "apps/web/.env.stg.local"), envFile(valid));
  const stg = await loadDeployment("stg", {}, basePath);
  expect(stg.APP_ENV).toBe("stg");
  expect(stg.NODE_ENV).toBe("production");
  expect(stg.STRIPE_SECRET_KEY).toBe("sk_test_fixture");
  expect(stg.STRIPE_PUBLISHABLE_KEY).toBe("pk_test_fixture");
  await expect(loadDeployment("prod", {}, basePath)).rejects.toThrow("環境変数");
  await expect(loadDeployment("stg", { APP_ENV: "prod" }, basePath)).rejects.toThrow("異なります");
  await expect(loadDeployment("stg", { ALCHEMY_STAGE: "prod" }, basePath)).rejects.toThrow(
    "異なります",
  );
});

test("プロセスの環境変数から prod を読み込み、ローカル設定より優先する", async () => {
  const root = fixture();
  const env = {
    ...valid,
    APP_ENV: "prod",
    STRIPE_SECRET_KEY: "sk_live_ci",
    STRIPE_PUBLISHABLE_KEY: "pk_live_ci",
  };
  expect((await loadDeployment("prod", env, join(root, "packages/infra"))).STRIPE_SECRET_KEY).toBe(
    "sk_live_ci",
  );
});

test("デプロイでメールの未設定・ローカル送信を拒否する", () => {
  expect(() => validateDeployment("stg", { ...valid, RESEND_API_KEY: "" })).toThrow("Resend");
  expect(() => validateDeployment("stg", { ...valid, AUTH_EMAIL_DELIVERY: "console" })).toThrow(
    "Resend",
  );
  expect(() =>
    validateDeployment("stg", { ...valid, AUTH_EMAIL_FROM: "test@example.com" }),
  ).toThrow("AUTH_EMAIL_FROM");
});
