import { type Page, expect, test } from "@playwright/test";

import { DEMO, hydrated, resetData, signIn } from "./support/app";

// docs/user-stories/commitment-list.md・create-commitment.md・edit-commitment.md・
// report-achievement.md・view-penalty-history.md・self-check.md
test.beforeEach(() => resetData());

const cards = (page: Page) => page.locator("main li");
const CANTONESE = "毎日30分広東語を練習する";
const GYM = "週3でジムに行って、筋トレ45分と有酸素運動20分をやる";
const QUIT = "禁煙する";

test("ホームに新しい順でコミットメントが並び、今日の報告の件数が分かる", async ({ page }) => {
  await signIn(page, DEMO.email, DEMO.password);
  await expect(page.getByRole("img", { name: "ichiro" })).toBeVisible();
  await expect(page.getByRole("link", { name: "アカウント" })).toBeVisible();
  await expect(page.getByRole("link", { name: "コミットメントを作成" })).toBeVisible();
  await expect(cards(page)).toHaveCount(3);
  await expect(cards(page).nth(0)).toContainText(CANTONESE);
  await expect(cards(page).nth(1)).toContainText(GYM);
  await expect(cards(page).nth(2)).toContainText(QUIT);
  await expect(cards(page).first()).toContainText(/\d+\/\d+〜\d+\/\d+/);
  await expect(
    page.getByText(/^(今日の報告 あと\d件|今日はぜんぶ報告ずみ|今日の報告はありません)$/),
  ).toBeVisible();
  // 報告ずみの「禁煙する」は塗りつぶしのチェック
  await expect(cards(page).nth(2).getByRole("img", { name: "今日の報告済み" })).toBeVisible();
});

test("確認してから今日の達成を報告すると、ワンちゃんがお祝いする", async ({ page }) => {
  await signIn(page, DEMO.email, DEMO.password);
  const card = cards(page).filter({ hasText: CANTONESE });
  const summary = page.getByText(/^今日の報告 あと\d件$/);
  const before = await summary.textContent();

  await card.getByRole("button", { name: "今日の達成を報告する" }).click();
  const confirm = page.getByRole("dialog", { name: "達成済みにしますか？？" });
  await expect(confirm).toContainText(`「${CANTONESE}」の今日の達成を報告します。`);
  await confirm.getByRole("button", { name: "キャンセル" }).click();
  await expect(confirm).toBeHidden();
  await expect(summary).toHaveText(before!);

  await card.getByRole("button", { name: "今日の達成を報告する" }).click();
  await page.getByRole("button", { name: "達成済みにする" }).click();
  const celebration = page.getByRole("dialog", { name: `「${CANTONESE}」今日も達成！` });
  await expect(celebration).toBeVisible();
  await expect(celebration.getByText("連続達成")).toBeVisible();
  await expect(celebration.getByText("8日")).toBeVisible();
  // 勉強か筋トレのどちらか一方だけを出す
  await expect(celebration.locator('[data-testid^="achievement-dog-"]')).toHaveCount(1);
  await expect(celebration.getByText("宣言したワン！")).toHaveCount(0);
  await celebration.getByRole("button", { name: "つづける" }).click();
  await expect(celebration).toBeHidden();
  await expect(card.getByRole("img", { name: "今日の報告済み" })).toBeVisible();
  const remaining = Number(before!.match(/\d+/)![0]) - 1;
  await expect(
    page.getByText(remaining > 0 ? `今日の報告 あと${remaining}件` : "今日はぜんぶ報告ずみ"),
  ).toBeVisible();

  // 詳細でも報告ずみになっている
  await card.getByRole("link").click();
  await expect(page.getByText("今日は報告ずみ　えらいワン")).toBeVisible();
});

test("2回の報告で勉強と筋トレの両方が1回ずつ出る", async ({ page }) => {
  await signIn(page, DEMO.email, DEMO.password);
  const seen = new Set<string>();
  for (const content of [CANTONESE, GYM]) {
    const card = cards(page).filter({ hasText: content });
    await card.getByRole("link").click();
    await hydrated(page);
    const streak = page.getByRole("region", { name: "連続達成" });
    await expect(streak).toBeVisible();
    const report = streak.getByRole("button", { name: "今日の達成を報告する" });
    if (!(await report.isVisible())) test.skip(true, `${content} は今日が報告日ではない`);
    await report.click();
    const dog = page.locator('[data-testid^="achievement-dog-"]');
    await expect(dog).toBeVisible();
    seen.add((await dog.getAttribute("data-testid"))!);
    await page.getByRole("button", { name: "つづける" }).click();
    await page.getByRole("button", { name: "戻る" }).click();
    await expect(page).toHaveURL(/\/app$/);
  }
  expect([...seen].sort()).toEqual(["achievement-dog-lifting", "achievement-dog-studying"]);
});

test("コミットメントを作成すると「宣言したワン！」で祝い、一覧の先頭に出る", async ({ page }) => {
  await signIn(page, DEMO.email, DEMO.password);
  await page.getByRole("link", { name: "コミットメントを作成" }).click();
  await expect(page).toHaveURL(/\/app\/commitments\/new$/);
  await hydrated(page);

  await page.getByRole("button", { name: "宣言する" }).click();
  await expect(page.getByRole("alert")).toHaveText("コミット内容を入力してください");

  const content = page.getByLabel("コミット内容");
  await content.fill("Web から宣言する");
  // Enter では改行しない
  await content.press("Enter");
  await expect(content).toHaveValue("Web から宣言する");

  await page.getByRole("radio", { name: "曜日ごと" }).click();
  await expect(page.getByRole("button", { name: /曜日$/ })).toHaveCount(7);
  await page.getByRole("radio", { name: "月の特定の日" }).click();
  await expect(page.getByRole("button", { name: /^\d+日$/ })).toHaveCount(31);
  await page.getByRole("radio", { name: "1回だけ" }).click();
  await expect(page.getByLabel("実施日")).toBeVisible();
  await page.getByRole("radio", { name: "毎日" }).click();
  const until = page.getByLabel("いつまで続ける？");
  const today = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await expect(until).toHaveAttribute("min", today);

  await page.getByRole("switch", { name: "罰金を設定する" }).check({ force: true });
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "100円減らす" }).click();
  await expect(page.getByLabel("罰金の金額")).toHaveText("¥100");
  await page.getByRole("button", { name: "¥1,000" }).click();
  await expect(page.getByLabel("罰金の金額")).toHaveText("¥1,000");
  const methods = page.getByRole("radiogroup", { name: "支払い方法" });
  await expect(methods.getByText("Visa •••• 4242")).toBeVisible();
  await expect(methods.getByText("Mastercard •••• 4444")).toBeVisible();
  await expect(methods.getByRole("radio").first()).toBeChecked();

  await page.getByRole("button", { name: "宣言する" }).click();
  const celebration = page.getByRole("dialog", { name: "宣言したワン！" });
  await expect(celebration).toBeVisible();
  await expect(celebration.getByText("期間")).toBeVisible();
  await expect(celebration.getByText("¥1,000")).toBeVisible();
  await expect(celebration.getByText(/チェック/)).toHaveCount(0);
  await celebration.getByRole("button", { name: "ホームに戻る" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(cards(page).first()).toContainText("Web から宣言する");
});

test("詳細で連続達成と今週の記録を見て、設定を変えて保存できる", async ({ page }) => {
  await signIn(page, DEMO.email, DEMO.password);
  await cards(page).filter({ hasText: GYM }).getByRole("link").click();
  await expect(page).toHaveURL(/\/app\/commitments\//);
  await hydrated(page);
  await expect(page.getByRole("region", { name: "連続達成" })).toBeVisible();
  await expect(page.getByRole("list", { name: "今週の記録" }).locator("li")).toHaveCount(7);
  // チェック者や招待の項目はない
  await expect(page.getByText(/チェック者|招待/)).toHaveCount(0);

  const content = page.getByLabel("コミット内容");
  await expect(content).toHaveValue(GYM);
  await expect(
    page.getByText("変更した金額と支払い方法は、今日の報告分から使われます。", { exact: false }),
  ).toBeVisible();
  // 開始日より前は選べない
  await expect(page.getByLabel("いつまで続ける？")).toHaveAttribute("min", /\d{4}-\d{2}-\d{2}/);

  // 罰金の履歴を開いて閉じても、編集中の内容は残る
  await content.fill("週3でジムに行く（Web で編集）");
  await page.getByRole("button", { name: "これまでの罰金" }).click();
  const history = page.getByRole("dialog", { name: "これまでの罰金" });
  await expect(history).toContainText("¥0");
  await expect(history).toContainText("まだ罰金はないワン。この調子でつづけよう。");
  await history.getByRole("button", { name: "戻る" }).click();
  await expect(history).toBeHidden();
  await expect(content).toHaveValue("週3でジムに行く（Web で編集）");

  await page.getByRole("button", { name: "¥3,000" }).click();
  await page.getByRole("button", { name: "変更を保存" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(cards(page).nth(1)).toContainText("週3でジムに行く（Web で編集）");
  await cards(page).nth(1).getByRole("link").click();
  await expect(page.getByLabel("罰金の金額")).toHaveText("¥3,000");
});

test("罰金の履歴は合計・回数・状況をシートで見られ、罰金のないものには導線がない", async ({
  page,
}) => {
  await signIn(page, DEMO.email, DEMO.password);
  await cards(page).filter({ hasText: CANTONESE }).getByRole("link").click();
  await hydrated(page);
  await page.getByRole("button", { name: "これまでの罰金" }).click();
  const history = page.getByRole("dialog", { name: "これまでの罰金" });
  await expect(history.getByText("合計")).toBeVisible();
  await expect(history.getByText(/^\d+回$/)).toBeVisible();
  await expect(
    history.getByText(/徴収ずみ|徴収待ち|処理中|徴収できませんでした/).first(),
  ).toBeVisible();
  // Esc でも閉じる
  await page.keyboard.press("Escape");
  await expect(history).toBeHidden();
});

test("動きを減らす設定では、お祝いのワンちゃんを止めて表示する", async ({ browser }) => {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 390, height: 844 },
    locale: "ja-JP",
  });
  const page = await context.newPage();
  await signIn(page, DEMO.email, DEMO.password);
  const card = cards(page).filter({ hasText: CANTONESE });
  await card.getByRole("button", { name: "今日の達成を報告する" }).click();
  await page.getByRole("button", { name: "達成済みにする" }).click();
  const dog = page.locator('[data-testid^="achievement-dog-"]');
  await expect(dog).toBeVisible();
  const visibleFrame = () =>
    dog
      .locator("img")
      .evaluateAll((images) =>
        images.findIndex((image) => getComputedStyle(image).opacity === "1"),
      );
  const first = await visibleFrame();
  await page.waitForTimeout(1500);
  expect(await visibleFrame()).toBe(first);
  await context.close();
});
