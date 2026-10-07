import { expect, test } from "@playwright/test";

import {
  hydrated,
  mailbox,
  open,
  passwordInput,
  resetData,
  signIn,
  uniqueEmail,
} from "./support/app";

// docs/user-stories/verify-email.md・change-email.md
test.beforeAll(() => resetData());

async function signUp(page: import("@playwright/test").Page, email: string) {
  await open(page, "/app/sign-up");
  await page.getByLabel("名前").fill("メール確認");
  await page.getByLabel("メールアドレス").fill(email);
  await passwordInput(page).fill("password1234");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/\/app\/verify-email/);
  await hydrated(page);
}

test("誤ったコードでは確認できず、再送した最新のコードで確認できる", async ({ page }) => {
  const email = uniqueEmail("verify");
  const first = mailbox(email);
  await signUp(page, email);
  const oldCode = await first.next();
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole("button", { name: /秒後に再送できます/ })).toBeDisabled();

  await page.getByLabel("認証コード").fill("000000");
  await page.getByRole("button", { name: "確認してはじめる" }).click();
  await expect(page.getByRole("alert")).toContainText("認証コードが違います");

  // 未確認のままログイン画面へ戻り、パスワードでログインすると確認を再開できる
  await page.getByRole("button", { name: "ログイン画面に戻る" }).click();
  await expect(page).toHaveURL(/\/app\/sign-in$/);
  await hydrated(page);
  await page.getByLabel("メールアドレス").fill(email);
  await passwordInput(page).fill("password1234");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/verify-email/);
  await hydrated(page);

  const resent = mailbox(email);
  await page.getByRole("button", { name: "認証コードを再送する" }).click();
  await expect(page.getByRole("button", { name: /秒後に再送できます/ })).toBeVisible();
  const newCode = await resent.next();
  expect(newCode).not.toBe(oldCode);

  // 再送すると古いコードは使えない
  await page.getByLabel("認証コード").fill(oldCode);
  await page.getByRole("button", { name: "確認してはじめる" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("認証コード").fill(newCode);
  await page.getByRole("button", { name: "確認してはじめる" }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("新しいメールアドレスに届いたコードでメールアドレスを変更できる", async ({ page }) => {
  const email = uniqueEmail("change-from");
  const verify = mailbox(email);
  await signUp(page, email);
  await page.getByLabel("認証コード").fill(await verify.next());
  await page.getByRole("button", { name: "確認してはじめる" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await hydrated(page);

  await page.getByRole("link", { name: "アカウント" }).click();
  await page.getByRole("link", { name: email }).click();
  await expect(page).toHaveURL(/\/app\/change-email$/);
  await expect(page.getByText(`現在のメールアドレス：${email}`)).toBeVisible();

  await page.getByLabel("新しいメールアドレス").fill(email);
  await page.getByRole("button", { name: "認証コードを送る" }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "現在と異なる有効なメールアドレスを入力してください",
  );

  const next = uniqueEmail("change-to");
  const inbox = mailbox(next);
  await page.getByLabel("新しいメールアドレス").fill(next);
  await page.getByRole("button", { name: "認証コードを送る" }).click();
  await expect(page.getByText(`${next} に送信した6桁コード`, { exact: false })).toBeVisible();
  await page.getByLabel("新しいアドレスの認証コード").fill(await inbox.next());
  await page.getByRole("button", { name: "確認して変更する" }).click();
  await expect(page.getByText("メールアドレスを変更しました")).toBeVisible();
  await page.getByRole("link", { name: "ホームへ" }).click();
  await expect(page).toHaveURL(/\/app$/);

  // 新しいアドレスと同じパスワードでログインでき、古いアドレスではログインできない
  await page.getByRole("link", { name: "アカウント" }).click();
  await expect(page.getByRole("link", { name: next })).toBeVisible();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await open(page, "/app/sign-in");
  await page.getByLabel("メールアドレス").fill(email);
  await passwordInput(page).fill("password1234");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("メールアドレスまたはパスワードが違います");
  await signIn(page, next, "password1234");
});
