import { expect, test } from "@playwright/test";

// docs/user-stories/view-service-introduction.md・read-legal-documents.md
test("ログインせずに紹介ページと規約を読める", async ({ page, request }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  expect(response?.headers()["content-security-policy"]).toContain("default-src 'none'");
  await expect(page.locator("html")).toHaveAttribute("lang", "ja");
  await expect(page.locator("script")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "やることを決めよう" })).toBeVisible();
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

  // API のパスは紹介ページで覆わない
  expect((await request.get("/api/auth/get-session")).headers()["content-type"]).toContain(
    "application/json",
  );
});
