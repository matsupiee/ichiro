import { expect, test } from "@playwright/test";

import { DEMO, hydrated, resetData, signIn } from "./support/app";
import { FAKE_STRIPE_JS } from "./support/fake-stripe";

// docs/user-stories/register-payment-method.md
// Stripe には接続しない。Stripe.js を偽物に差し替え、Stripe の API を呼ぶ startSetup と completeSetup の応答を返す。
// 実際のカード入力と本人認証は Stripe のテスト環境で手動で確認する
test.beforeEach(() => resetData());

test("Payment Element のダイアログでカードを登録できる。閉じたときと拒否されたときは登録しない", async ({
  page,
}) => {
  let completed: unknown = null;
  await page.route("https://js.stripe.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: FAKE_STRIPE_JS }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = route.request().url();
    if (url.includes("consumer.payment.startSetup")) {
      return route.fulfill({
        json: [{ result: { data: { setupIntentClientSecret: "seti_e2e_secret_x" } } }],
      });
    }
    if (url.includes("consumer.payment.completeSetup")) {
      completed = route.request().postDataJSON();
      return route.fulfill({
        json: [{ result: { data: { id: "pm_e2e", brand: "jcb", last4: "0000", wallet: null } } }],
      });
    }
    if (url.includes("consumer.payment.listMethods") && completed) {
      const response = await route.fetch();
      const body = await response.json();
      body[0].result.data.push({ id: "pm_e2e", brand: "jcb", last4: "0000", wallet: null });
      return route.fulfill({ response, json: body });
    }
    return route.continue();
  });

  await signIn(page, DEMO.email, DEMO.password);
  await page.getByRole("link", { name: "アカウント" }).click();
  await hydrated(page);
  // 支払い方法を追加するまで Stripe.js は読み込まない
  expect(await page.locator('script[src^="https://js.stripe.com"]').count()).toBe(0);

  await page.getByRole("button", { name: "支払い方法を追加" }).click();
  const dialog = page.getByRole("dialog", { name: "支払い方法を追加" });
  await expect(dialog.getByLabel("カード番号（テスト用）")).toBeVisible();
  // 公開可能キーはサーバーの環境変数から受け取る
  expect(await page.evaluate(() => (window as { __stripeKey?: string }).__stripeKey)).toMatch(
    /^pk_/,
  );
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toBeHidden();
  expect(completed).toBeNull();

  await page.getByRole("button", { name: "支払い方法を追加" }).click();
  await page.evaluate(() => Object.assign(window, { __declineCard: true }));
  await dialog.getByRole("button", { name: "登録する" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("カードが拒否されました");
  expect(completed).toBeNull();

  await page.evaluate(() => Object.assign(window, { __declineCard: false }));
  await dialog.getByRole("button", { name: "登録する" }).click();
  await expect(dialog).toBeHidden();
  // カードだけなので、確定は画面遷移なしで行う
  expect(
    await page.evaluate(() => (window as { __confirm?: { redirect: string } }).__confirm?.redirect),
  ).toBe("if_required");
  expect(completed).toEqual({ 0: { setupIntentClientSecret: "seti_e2e_secret_x" } });
  await expect(page.getByText("JCB •••• 0000")).toBeVisible();
});

test("支払い方法がないまま罰金ありでは宣言できない", async ({ page }) => {
  await page.route("**/api/trpc/**consumer.payment.listMethods**", (route) =>
    route.fulfill({ json: [{ result: { data: [] } }] }),
  );
  await signIn(page, DEMO.email, DEMO.password);
  await page.getByRole("link", { name: "コミットメントを作成" }).click();
  await hydrated(page);
  await page.getByLabel("コミット内容").fill("罰金ありで宣言する");
  await page.getByRole("switch", { name: "罰金を設定する" }).check({ force: true });
  await expect(
    page.getByText("カードを登録してください。登録は Stripe で安全に行われます。"),
  ).toBeVisible();
  await page.getByRole("button", { name: "宣言する" }).click();
  await expect(page.getByRole("alert")).toHaveText("支払い方法を選んでください");
});

test("コミットメント作成の途中でカードを登録しても、入力した内容は消えずにそのまま宣言できる", async ({
  page,
}) => {
  let completed = false;
  let created: { values?: { content?: string; paymentMethodId?: string | null } } | null = null;
  await page.route("https://js.stripe.com/**", (route) =>
    route.fulfill({ contentType: "application/javascript", body: FAKE_STRIPE_JS }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = route.request().url();
    if (url.includes("consumer.payment.listMethods")) {
      const data = completed ? [{ id: "pm_e2e", brand: "jcb", last4: "0000", wallet: null }] : [];
      return route.fulfill({ json: [{ result: { data } }] });
    }
    if (url.includes("consumer.payment.startSetup")) {
      return route.fulfill({
        json: [{ result: { data: { setupIntentClientSecret: "seti_e2e_secret_x" } } }],
      });
    }
    if (url.includes("consumer.payment.completeSetup")) {
      completed = true;
      return route.fulfill({
        json: [{ result: { data: { id: "pm_e2e", brand: "jcb", last4: "0000", wallet: null } } }],
      });
    }
    if (url.includes("consumer.commitment.create")) {
      created = route.request().postDataJSON()[0];
      return route.abort();
    }
    return route.continue();
  });

  await signIn(page, DEMO.email, DEMO.password);
  await page.getByRole("link", { name: "コミットメントを作成" }).click();
  await hydrated(page);
  await page.getByLabel("コミット内容").fill("カードを登録してから宣言する");
  await page.getByRole("switch", { name: "罰金を設定する" }).check({ force: true });

  await page.getByRole("button", { name: "支払い方法を追加" }).click();
  const dialog = page.getByRole("dialog", { name: "支払い方法を追加" });
  await expect(dialog.getByLabel("カード番号（テスト用）")).toBeVisible();
  await dialog.getByRole("button", { name: "登録する" }).click();
  await expect(dialog).toBeHidden();

  // ダイアログの送信で、コミットメントのフォームが送信されたり画面が読み込み直されたりしない
  expect(created).toBeNull();
  await expect(page.getByLabel("コミット内容")).toHaveValue("カードを登録してから宣言する");
  await expect(page.getByRole("switch", { name: "罰金を設定する" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "JCB •••• 0000" })).toBeChecked();
  await expect(page.getByRole("alert")).toBeHidden();

  await page.getByRole("button", { name: "宣言する" }).click();
  await expect.poll(() => created?.values?.content).toBe("カードを登録してから宣言する");
  expect(created?.values?.paymentMethodId).toBe("pm_e2e");
});
