import { Hono } from "hono";
import { legalPages } from "./site/legal";

const logo = `<img src="/images/ichiro-wordmark.png" alt="ichiro" width="2172" height="724">`;

const links = `<a href="/terms">利用規約</a><a href="/privacy">プライバシーポリシー</a><a href="/commerce">特定商取引法に基づく表記</a>`;
const footer = `<footer class="footer"><div class="wrap footer-inner"><nav aria-label="規約・運営情報">${links}</nav><span class="copyright">© ichiro</span></div></footer>`;
const header = (legal = false) =>
  `<header class="header ${legal ? "legal-header" : ""}"><a class="logo" href="/" aria-label="ichiro ホーム">${logo}</a><nav aria-label="メイン"><a href="/#how">使い方</a></nav></header>`;
function document(title: string, content: string, noIndex = false) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="目標を宣言して、毎日の達成を報告。ichiro は、続けたいことを応援するネイティブアプリです。公開準備中。">${noIndex ? '<meta name="robots" content="noindex">' : ""}<title>${title} | ichiro</title><link rel="stylesheet" href="/site.css"></head><body>${content}${footer}</body></html>`;
}
function phone(file: string, alt: string, eager = false) {
  const [width, height] = file === "penalty" ? [1206, 2622] : [1320, 2868];
  return `<div class="phone"><img src="/images/${file}.png" alt="${alt}" width="${width}" height="${height}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`;
}
const page = document(
  "続けたいことを、毎日の約束に。",
  `${header()}
<main>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
    <h1 class="logo" id="hero-title">${logo}</h1>
    <h2>小さな約束。<br>毎日、ちょっとずつ。</h2>
    </div>
    <div class="hero-art">
      ${phone("commitments", "朝の読書・英語・運動の目標を並べた ichiro の実際の一覧画面", true)}
      ${phone("celebration", "7日連続の達成をワンちゃんがお祝いする画面", true)}
    </div>
  </section>
  <section class="steps" id="how" aria-labelledby="how-title">
    <div class="wrap"><p class="how-label">ichiro の使い方</p><h2 class="section-title" id="how-title">やることを<br>決めて報告する</h2>
    <div class="steps-grid">
      <article class="step"><div class="step-visual">${phone("commitments", "目標と毎日の取り組みが並ぶ一覧画面")}</div><div class="step-copy"><span class="number">STEP 1</span><h3>やることを決めよう</h3><p>読書も、英語も、運動も。<br>続けたいことを登録。</p></div></article>
      <article class="step"><div class="step-visual step-penalty">${phone("penalty", "罰金の金額を設定するアプリ画面")}</div><div class="step-copy"><span class="number">STEP 2</span><h3>罰金を設定</h3><p>続けるきっかけに、金額を決めよう。<br>罰金の設定は任意です。</p></div></article>
      <article class="step"><div class="step-visual">${phone("progress", "連続達成の記録と今日の達成を報告するボタン")}</div><div class="step-copy"><span class="number">STEP 3</span><h3>できたら報告</h3><p>今日もできたら、ボタンをタップ。<br>毎日の一歩を記録しよう。</p></div></article>
    </div></div>
  </section>
  <section class="end"><p class="logo">${logo}</p><p>あなたの「続けたい」を応援。</p></section>
</main>`,
);

export function createPublicPageApp() {
  const app = new Hono();
  const pages = new Map<string, string>([["/", page]]);
  for (const [path, entry] of Object.entries(legalPages)) {
    pages.set(
      path,
      document(
        entry.title,
        `${header(true)}<main class="legal wrap"><p class="meta">施行日：2026年10月3日</p><h1>${entry.title}</h1>${entry.sections.map(([heading, body]) => `<section><h2>${heading}</h2><p>${body}</p></section>`).join("")}${path === "/privacy" ? '<p class="external">外部サービスの方針：<a href="https://stripe.com/jp/privacy">Stripe</a> / <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a> / <a href="https://resend.com/legal/privacy-policy">Resend</a></p><p class="external">データ処理契約・再委託先：<a href="https://stripe.com/legal/dpa">Stripe の契約</a> / <a href="https://stripe.com/legal/service-providers">Stripe の委託先</a> / <a href="https://www.cloudflare.com/cloudflare-customer-dpa/">Cloudflare の契約</a> / <a href="https://www.cloudflare.com/cloudflare-subprocessors/">Cloudflare の委託先</a> / <a href="https://resend.com/legal/dpa">Resend の契約</a> / <a href="https://resend.com/legal/subprocessors">Resend の委託先</a></p>' : ""}</main>`,
        true,
      ),
    );
  }
  for (const [path, body] of pages) {
    app.get(path, (c) => {
      c.header(
        "Content-Security-Policy",
        "default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
      );
      c.header("X-Content-Type-Options", "nosniff");
      c.header("Referrer-Policy", "no-referrer");
      return c.html(body);
    });
  }
  return app;
}
