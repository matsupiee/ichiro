import { expect, test } from "@playwright/test";

import {
  REGISTERED,
  hydrated,
  mailbox,
  open,
  passwordInput,
  resetData,
  uniqueEmail,
} from "./support/app";

// docs/user-stories/onboarding.md・sign-up-consent.md・password-visibility.md・
// existing-account-sign-up.md・brand-appearance.md
test.beforeAll(() => resetData());

test("未ログインではじめに画面が開き、新規登録とログインを選べる", async ({ page }) => {
  await open(page, "/app");
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await expect(page.getByRole("img", { name: "ichiro" })).toBeVisible();
  await expect(page.getByText("目標を宣言して、毎日の達成を報告しよう。")).toBeVisible();

  // ワンちゃんを押すと少しのあいだ跳ねる
  await page.getByRole("button", { name: "ワンちゃん" }).click();
  await expect(page.locator(".dog")).toHaveAttribute("data-mood", "jump");
  await expect(page.locator(".dog")).toHaveAttribute("data-mood", "idle", { timeout: 4000 });

  await page.getByRole("link", { name: "アカウントを作る" }).click();
  await expect(page).toHaveURL(/\/app\/sign-up$/);
  await expect(page.getByLabel("名前")).toBeVisible();
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page.getByRole("alert")).toHaveText("名前を入力してください");

  await page.getByRole("button", { name: "戻る" }).click();
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await page.getByRole("link", { name: "ログイン" }).click();
  await expect(page).toHaveURL(/\/app\/sign-in$/);
  await expect(page.getByLabel("名前")).toHaveCount(0);
  await page.getByRole("link", { name: "はじめての方はこちら" }).click();
  await expect(page).toHaveURL(/\/app\/sign-up$/);
  await page.getByRole("link", { name: "アカウントをお持ちの方はこちら" }).click();
  await expect(page).toHaveURL(/\/app\/sign-in$/);
});

test("利用規約とプライバシーポリシーを別のタブで読んでも、入力内容が残る", async ({
  page,
  context,
}) => {
  await open(page, "/app/sign-up");
  await expect(page.getByText("に同意したものとみなします。", { exact: false })).toBeVisible();
  await page.getByLabel("名前").fill("規約を読む人");
  for (const title of ["利用規約", "プライバシーポリシー"]) {
    const [tab] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("link", { name: title }).click(),
    ]);
    await tab.waitForLoadState();
    await expect(tab).toHaveTitle(new RegExp(title));
    await tab.close();
  }
  await expect(page.getByLabel("名前")).toHaveValue("規約を読む人");
  await open(page, "/app/sign-in");
  await expect(page.getByText("に同意したものとみなします。", { exact: false })).toHaveCount(0);
});

test("パスワードの表示と非表示を切り替えても、入力した値で送信できる", async ({ page }) => {
  await open(page, "/app/sign-in");
  const password = passwordInput(page);
  await password.fill("abc12345");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "パスワードを表示" }).click();
  await expect(password).toHaveAttribute("type", "text");
  await password.press("End");
  await password.pressSequentially("6");
  await page.getByRole("button", { name: "パスワードを隠す" }).click();
  await expect(password).toHaveAttribute("type", "password");
  await expect(password).toHaveValue("abc123456");
});

test("新規登録してメールを確認し、ホームへ進み、ログアウトしてログインし直せる", async ({
  page,
}) => {
  const email = uniqueEmail("onboarding");
  await open(page, "/app/sign-up");
  await page.getByLabel("名前").fill("ウェブ太郎");
  await page.getByLabel("メールアドレス").fill(email);
  await passwordInput(page).fill("password1234");
  const inbox = mailbox(email);
  // Enter でも登録できる
  await passwordInput(page).press("Enter");
  await expect(page).toHaveURL(/\/app\/verify-email/);
  await hydrated(page);

  // メールを確認するまでホームは開けない（セッションがまだない）
  await open(page, "/app");
  await expect(page).toHaveURL(/\/app\/welcome$/);

  await open(
    page,
    `/app/verify-email?email=${encodeURIComponent(JSON.stringify(email))}&sent=true`,
  );
  await page.getByLabel("認証コード").fill(await inbox.next());
  await page.getByRole("button", { name: "確認してはじめる" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("まだ目標がないワン。", { exact: false })).toBeVisible();

  // ログイン済みでは認証画面と紹介ページからアプリへ戻る
  await open(page, "/app/sign-in");
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/app$/);
  await hydrated(page);

  await page.getByRole("link", { name: "アカウント" }).click();
  await page.getByRole("button", { name: "ログアウト" }).click();
  await expect(page).toHaveURL(/\/app\/welcome$/);

  await open(page, "/app/sign-in");
  await page.getByLabel("メールアドレス").fill(email);
  await passwordInput(page).fill("wrong-password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("メールアドレスまたはパスワードが違います");
  await passwordInput(page).fill("password1234");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("登録済みのメールアドレスで新規登録すると、ログインへ案内される", async ({ page }) => {
  await open(page, "/app/sign-up");
  await page.getByLabel("名前").fill("別の人");
  // 大文字にしても同じアカウントとして扱う
  await page.getByLabel("メールアドレス").fill(REGISTERED.email.toUpperCase());
  await passwordInput(page).fill("another-password");
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/\/app\/sign-in\?/);
  await hydrated(page);
  await expect(page.getByRole("alert")).toHaveText(
    "登録済みのアカウントです。ログインしてください",
  );
  await expect(page.getByLabel("メールアドレス")).toHaveValue(REGISTERED.email.toUpperCase());
  await expect(passwordInput(page)).toHaveValue("");
  await passwordInput(page).fill(REGISTERED.password);
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
});

test("ブランドの色とロゴで表示する", async ({ page }) => {
  await open(page, "/app/welcome");
  const button = page.getByRole("link", { name: "アカウントを作る" });
  await expect(button).toHaveCSS("background-color", "rgb(61, 196, 244)");
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(244, 250, 253)");
  const logo = page.getByRole("img", { name: "ichiro" });
  await expect(logo).toHaveCSS("background-color", "rgb(61, 196, 244)");
  expect(await logo.evaluate((el) => getComputedStyle(el).maskImage)).toContain(
    "ichiro-wordmark.png",
  );
});
