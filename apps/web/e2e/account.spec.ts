import { fileURLToPath } from "node:url";

import { expect, test } from "@playwright/test";

import {
  DEMO,
  hydrated,
  mailbox,
  open,
  passwordInput,
  resetData,
  signIn,
  uniqueEmail,
} from "./support/app";

// docs/user-stories/profile-sheet.md・upload-profile-photo.md・contact-support.md・
// read-legal-documents.md・withdrawal.md
test.beforeEach(() => resetData());

const photo = fileURLToPath(new URL("./support/photo.png", import.meta.url));

test("アカウント画面で写真・名前・支払い情報・規約・問い合わせを扱える", async ({
  page,
  context,
}) => {
  await signIn(page, DEMO.email, DEMO.password);
  // 写真がないうちは人型のアイコン
  await expect(page.getByRole("link", { name: "アカウント" }).locator("img")).toHaveCount(0);
  await page.getByRole("link", { name: "アカウント" }).click();
  await expect(page).toHaveURL(/\/app\/account$/);
  await hydrated(page);
  await expect(page.getByRole("heading", { name: "アカウント" })).toBeVisible();

  // 写真を選ぶと、正方形の JPEG に縮めてサーバーに保存する
  await page.getByRole("button", { name: "プロフィール写真を変更" }).click();
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("menuitem", { name: "写真を選択" }).click(),
  ]);
  const upload = page.waitForRequest(
    (r) => r.url().endsWith("/api/profile/avatar") && r.method() === "PUT",
  );
  await chooser.setFiles(photo);
  const request = await upload;
  expect(request.headers()["content-type"]).toBe("image/jpeg");
  const avatar = page.getByRole("img", { name: "プロフィール写真" }).first();
  await expect(avatar).toHaveAttribute("src", /^\/avatars\//);
  const size = await avatar.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    return [img.naturalWidth, img.naturalHeight];
  });
  expect(size).toEqual([512, 512]);

  // 名前を編集する。空では保存できない
  await page.getByRole("button", { name: /^名前/ }).click();
  const nameDialog = page.getByRole("dialog", { name: "名前を編集" });
  await nameDialog.getByLabel("名前を入力してください").fill("");
  await nameDialog.getByRole("button", { name: "保存" }).click();
  await expect(nameDialog.getByRole("alert")).toHaveText("名前を入力してください");
  await nameDialog.getByLabel("名前を入力してください").fill("デモ太郎");
  await nameDialog.getByRole("button", { name: "保存" }).click();
  await expect(page.getByRole("button", { name: "名前 デモ太郎" })).toBeVisible();

  await expect(page.getByText("Visa •••• 4242")).toBeVisible();
  await expect(page.getByText("Mastercard •••• 4444")).toBeVisible();

  for (const title of ["利用規約", "特定商取引法に基づく表記", "プライバシーポリシー"]) {
    const [tab] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("link", { name: title }).click(),
    ]);
    await tab.waitForLoadState();
    await expect(tab).toHaveTitle(new RegExp(title));
    await tab.close();
  }
  const contact = page.getByRole("link", { name: "問い合わせ・報告" });
  await expect(contact).toHaveAttribute(
    "href",
    `mailto:btq32jh@icloud.com?subject=${encodeURIComponent("ichiro 問い合わせ・報告")}`,
  );
  await expect(
    page.getByText("btq32jh@icloud.com 宛にお送りください。", { exact: false }),
  ).toBeVisible();

  // ホームのアイコンにも写真が出る。削除すると人型のアイコンに戻る
  await page.getByRole("link", { name: "閉じる" }).click();
  await expect(
    page.getByRole("link", { name: "アカウント" }).getByRole("img", { name: "プロフィール写真" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "アカウント" }).click();
  await page.getByRole("button", { name: "プロフィール写真を変更" }).click();
  await page.getByRole("menuitem", { name: "削除" }).click();
  await expect(page.getByRole("img", { name: "プロフィール写真" })).toHaveCount(0);
  await open(page, "/app");
  await expect(page.getByRole("link", { name: "アカウント" }).locator("img")).toHaveCount(0);
});

test("注意事項を確認して退会すると、同じアカウントではログインできない", async ({ page }) => {
  const email = uniqueEmail("withdraw");
  await open(page, "/app/sign-up");
  await page.getByLabel("名前").fill("退会テスト");
  await page.getByLabel("メールアドレス").fill(email);
  await passwordInput(page).fill("password1234");
  const inbox = mailbox(email);
  await page.getByRole("button", { name: "登録する" }).click();
  await expect(page).toHaveURL(/\/app\/verify-email/);
  await hydrated(page);
  await page.getByLabel("認証コード").fill(await inbox.next());
  await page.getByRole("button", { name: "確認してはじめる" }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByRole("link", { name: "アカウント" }).click();
  await page.getByRole("link", { name: "退会" }).click();
  await expect(page).toHaveURL(/\/app\/withdrawal$/);
  await hydrated(page);
  await expect(page.getByText("退会は取り消せません。")).toBeVisible();
  // 戻るとアカウント画面へ。開き直すとチェックは外れている
  await page.getByRole("button", { name: "戻る" }).click();
  await expect(page).toHaveURL(/\/app\/account$/);
  await page.getByRole("link", { name: "退会" }).click();
  const confirm = page.getByLabel("注意事項を確認しました");
  await expect(confirm).not.toBeChecked();
  await expect(page.getByRole("button", { name: "退会" })).toBeDisabled();
  await confirm.check();
  await page.getByRole("button", { name: "退会" }).click();
  await expect(page.getByText("退会しました")).toBeVisible();
  await expect(page.getByText("ご利用ありがとうございました。")).toBeVisible();

  await page.getByRole("link", { name: "トップへ戻る" }).click();
  await open(page, "/app/sign-in");
  await page.getByLabel("メールアドレス").fill(email);
  await passwordInput(page).fill("password1234");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(
    "退会済みのため、このアカウントではログインできません",
  );
});
