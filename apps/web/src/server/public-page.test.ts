import { describe, expect, test } from "bun:test";
import { readFile, access } from "node:fs/promises";
import { URL } from "node:url";

import { createPublicPageApp } from "./public-page";

describe("公開紹介ページ", () => {
  test("認証・DB 接続なしで、日本語の紹介と規約への案内を読める", async () => {
    const response = await createPublicPageApp().request("/");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html; charset=UTF-8");
    expect(response.headers.get("set-cookie")).toBeNull();
    const html = await response.text();
    for (const text of ['lang="ja"', "ichiro", "公開準備中", "特定商取引法に基づく表記"]) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain("<script");
    expect(html).not.toContain("草案");
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
  });

  test("使い方を3つの画像付きステップとして順番に案内する", async () => {
    const html = await (await createPublicPageApp().request("/")).text();
    const steps = [...html.matchAll(/<article class="step">([\s\S]*?)<\/article>/g)];
    expect(steps).toHaveLength(3);
    for (const [index, step] of steps.entries()) {
      expect(step[1]).toContain(`STEP ${index + 1}`);
      expect(step[1]).toMatch(/class="step-visual[^"]*">[\s\S]*<img[\s\S]*class="step-copy"/);
      expect(step[1]).toContain(
        `<h3>${["やることを決めよう", "罰金を設定", "できたら報告"][index]}</h3>`,
      );
      expect(step[1]).toContain(`/images/${["commitments", "penalty", "progress"][index]}.png`);
    }
    for (const target of ["how"]) {
      expect(html).toContain(`id="${target}"`);
      expect(html).toContain(`href="/#${target}"`);
    }
  });

  test("トップのスクショ・スタイル・ロゴが配信対象に存在する", async () => {
    const html = await (await createPublicPageApp().request("/")).text();
    const images = [...html.matchAll(/<img[^>]+src="([^"]+)"[^>]+alt="([^"]+)"/g)];
    expect(images.length).toBeGreaterThanOrEqual(3);
    for (const match of images) {
      const file = new URL(`../../public${match[1]}`, import.meta.url);
      const bytes = await readFile(file);
      expect([...bytes.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(match[2]!.length).toBeGreaterThan(0);
    }
    for (const match of html.matchAll(/<img[^>]+src="([^"]+)"[^>]+width="(\d+)" height="(\d+)"/g)) {
      const bytes = await readFile(new URL(`../../public${match[1]}`, import.meta.url));
      const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      expect(header.getUint32(16)).toBe(Number(match[2]));
      expect(header.getUint32(20)).toBe(Number(match[3]));
    }
    await access(new URL("../../public/site.css", import.meta.url));
    expect(
      await readFile(new URL("../../public/images/ichiro-wordmark.png", import.meta.url)),
    ).toEqual(
      await readFile(new URL("../../../native/assets/images/ichiro-wordmark.png", import.meta.url)),
    );
    expect(html.match(/src="\/images\/ichiro-wordmark.png"/g)).toHaveLength(3);
    expect(html).not.toContain('id="payment"');
    expect(html).not.toContain("/#payment");
    expect(html).not.toContain("もうひと押し、ほしいときに。");
    expect(html).not.toContain("<script");
    expect(html).not.toContain("草案");
    expect(html).not.toContain("apps.apple.com");
  });

  test.each([
    ["/terms", "利用規約", "キャンセル・返金・利用終了"],
    ["/privacy", "プライバシーポリシー", "取得する情報"],
    ["/commerce", "特定商取引法に基づく表記", "販売事業者"],
  ])("%s を認証なしで読み、施行日を確認できる", async (path, title, heading) => {
    const app = createPublicPageApp();
    const response = await app.request(path!);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain(`<h1>${title}</h1>`);
    expect(html).toContain(heading!);
    expect(html).toContain("施行日：2026年10月3日");
    expect(html).not.toContain("草案");
    expect(html).not.toContain("未施行");
    expect(html).not.toContain("施行日は未定");
    expect(html).toContain('name="robots" content="noindex"');
    expect(html).toContain('href="/"');
    const homepage = await (await app.request("/")).text();
    expect(homepage).toContain(`href="${path}"`);
    expect((await app.request(path!, { method: "POST" })).status).toBe(404);
  });

  test("問い合わせ先を特商法表記に掲載し、規約とプライバシーポリシーから案内する", async () => {
    const app = createPublicPageApp();
    const commerce = await (await app.request("/commerce")).text();
    expect(commerce).toContain("btq32jh@icloud.com");
    for (const path of ["/terms", "/privacy"]) {
      const html = await (await app.request(path)).text();
      expect(html).toContain(
        "お問い合わせは「特定商取引法に基づく表記」に記載のメールアドレスへご連絡ください。",
      );
      expect(html).not.toContain("問い合わせ窓口は未設定");
    }
  });

  test("HEAD は本文なしで取得できる", async () => {
    const response = await createPublicPageApp().request("/", { method: "HEAD" });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toBe("");
  });
});
