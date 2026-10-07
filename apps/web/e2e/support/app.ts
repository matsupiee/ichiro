import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { type Locator, type Page, expect } from "@playwright/test";

const root = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

export const DEMO = { email: "demo@ichiro.app", password: "password123" };
export const PASSWORD_RESET = {
  email: "password-reset@ichiro.example",
  password: "reset-demo-password",
};
export const REGISTERED = { email: "otp@ichiro.example", password: "otp-demo-password" };

// ローカル D1 にデモデータを入れ直し、認証の回数制限を消す（packages/db/src/seed/e2e.ts）
export function resetData() {
  execFileSync("bun", ["run", "--cwd", "packages/db", "db:seed:e2e"], { cwd: root, stdio: "pipe" });
}

// テストごとに重ならないメールアドレス
export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
}

// 入力はハイドレーションが済んでから行う（routes/__root.tsx が <html data-hydrated> を付ける）
export async function hydrated(page: Page) {
  await page.locator("html[data-hydrated]").waitFor({ state: "attached" });
}

export async function open(page: Page, path: string) {
  await page.goto(path);
  await hydrated(page);
}

export function passwordInput(page: Page): Locator {
  return page.getByLabel("パスワード", { exact: true });
}

export async function signIn(page: Page, email: string, password: string) {
  await open(page, "/app/sign-in");
  await page.getByLabel("メールアドレス").fill(email);
  await passwordInput(page).fill(password);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await page.waitForURL(/\/app$/);
  await hydrated(page);
}

// 開発サーバーが AUTH_EMAIL_DELIVERY=console のときに出す local-auth-email のログから、認証コードを読む
function mailLog() {
  const directory = join(root, "packages/infra/.alchemy/log");
  const files = readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((path) => path.endsWith(".log"))
    .map((path) => join(directory, path))
    .sort((a, b) => statSync(a).mtimeMs - statSync(b).mtimeMs);
  const latest = files.at(-1);
  if (!latest) throw new Error("開発サーバーのログが見つかりません");
  return readFileSync(latest, "utf8");
}

function codesFor(email: string) {
  const pattern = new RegExp(
    `"event":"local-auth-email","email":"${email.replace(/[.+]/g, "\\$&")}","otp":"(\\d{6})"`,
    "g",
  );
  return [...mailLog().matchAll(pattern)].map((match) => match[1]!);
}

// 操作の前に呼び、その操作で新しく届いたコードを next() で受け取る
export function mailbox(email: string) {
  const before = codesFor(email).length;
  return {
    async next() {
      let codes: string[] = [];
      await expect
        .poll(() => (codes = codesFor(email)).length, { message: `${email} への認証コード` })
        .toBeGreaterThan(before);
      return codes.at(-1)!;
    },
  };
}
