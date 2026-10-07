import { expect, test } from "@playwright/test";

// docs/user-stories/view-service-introduction.md・read-legal-documents.md
test("ログインせずに紹介ページと規約を読める", async ({ page, request }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'none'");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator("script")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "やることを決めよう" })).toBeVisible();
  await expect(page.getByText("公開準備中")).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    "https://ichiro.app/images/og.png",
  );
  expect((await request.get("/images/og.png")).headers()["content-type"]).toContain("image/png");
  for (const image of await page.locator("main img").all()) {
    expect(await image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  }

  for (const [title, path] of [
    ["利用規約", "/terms"],
    ["プライバシーポリシー", "/privacy"],
    ["特定商取引法に基づく表記", "/commerce"],
  ] as const) {
    await page.goto("/");
    await page.locator("footer").getByRole("link", { name: title }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(page.getByText("施行日：", { exact: false })).toBeVisible();
  }

  // 開発環境は本番のドメインではないので、巡回を拒否する
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /\n");
  expect(await (await request.get("/sitemap.xml")).text()).toContain(
    "<loc>https://ichiro.app/commerce</loc>",
  );

  // API のパスは紹介ページで覆わない
  expect((await request.get("/api/auth/get-session")).headers()["content-type"]).toContain(
    "application/json",
  );
});

// docs/user-stories/view-service-introduction.md・onboarding.md
test("紹介ページのボタンからアプリのはじめにの画面へ進める", async ({ page }) => {
  await page.goto("/");
  await page.locator(".hero").getByRole("link", { name: "さっそくはじめる" }).click();
  await expect(page).toHaveURL(/\/app\/welcome$/);
  await expect(page.getByRole("link", { name: "アカウントを作る" })).toBeVisible();

  await page.goto("/");
  await page.locator("header").getByRole("link", { name: "はじめる" }).click();
  await expect(page).toHaveURL(/\/app\/welcome$/);

  await page.goto("/");
  await page.getByRole("link", { name: "アカウントを作ってはじめる" }).click();
  await expect(page).toHaveURL(/\/app\/welcome$/);
});
