import { expect, test } from "@playwright/test";

import {
  PASSWORD_RESET,
  hydrated,
  mailbox,
  open,
  passwordInput,
  resetData,
  signIn,
} from "./support/app";

// docs/user-stories/reset-password.md・password-visibility.md
test.beforeAll(() => resetData());

test("登録したメールアドレスのコードでパスワードを再設定し、新しいパスワードでログインできる", async ({
  page,
}) => {
  await open(page, "/app/sign-in");
  await page.getByLabel("メールアドレス").fill(PASSWORD_RESET.email);
  await page.getByRole("link", { name: "パスワードを忘れた方はこちら" }).click();
  await expect(page).toHaveURL(/\/app\/reset-password/);
  await hydrated(page);
  // ログイン画面で入力したメールアドレスを引き継ぐ
  await expect(page.getByLabel("メールアドレス")).toHaveValue(PASSWORD_RESET.email);

  const inbox = mailbox(PASSWORD_RESET.email);
  await page.getByRole("button", { name: "認証コードを送信する" }).click();
  await expect(
    page.getByText("登録されているメールアドレスの場合", { exact: false }),
  ).toBeVisible();
  const code = await inbox.next();

  const password = page.getByLabel("新しいパスワード");
  await page.getByLabel("認証コード").fill("000000");
  await password.fill("new-reset-password");
  // 新しいパスワードも表示を切り替えられる
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "パスワードを表示" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "パスワードを再設定する" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.getByLabel("認証コード").fill(code);
  await page.getByRole("button", { name: "パスワードを再設定する" }).click();
  await expect(page.getByText("パスワードを再設定しました", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "ログイン画面へ" }).click();
  await expect(page).toHaveURL(/\/app\/sign-in/);
  await hydrated(page);

  await page.getByLabel("メールアドレス").fill(PASSWORD_RESET.email);
  await passwordInput(page).fill(PASSWORD_RESET.password);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("メールアドレスまたはパスワードが違います");
  await signIn(page, PASSWORD_RESET.email, "new-reset-password");
});

test("未登録のメールアドレスでも同じ案内になり、アカウントの有無を明かさない", async ({ page }) => {
  await open(page, "/app/reset-password");
  await page.getByLabel("メールアドレス").fill("nobody-registered@example.com");
  await page.getByRole("button", { name: "認証コードを送信する" }).click();
  await expect(
    page.getByText("登録されているメールアドレスの場合", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "メールアドレスを変更する" }).click();
  await expect(page.getByLabel("メールアドレス")).toBeVisible();
});
