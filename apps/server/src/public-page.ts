import { Hono } from "hono";
import { legalPages } from "./site/legal";

const links = `<a href="/terms">利用規約</a><a href="/privacy">プライバシーポリシー</a><a href="/commerce">特定商取引法に基づく表記</a>`;
const footer = `<footer class="footer"><div class="wrap footer-inner"><nav aria-label="規約・運営情報">${links}</nav><span class="copyright">© ichiro</span></div></footer>`;
const header = (legal = false) =>
  `<header class="header ${legal ? "legal-header" : ""}"><a class="logo" href="/" aria-label="ichiro ホーム">ichiro</a><nav aria-label="メイン"><a href="/#how">使い方</a><a href="/#payment">料金について</a></nav></header>`;
function document(title: string, content: string, noIndex = false) {
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="目標を宣言して、毎日の達成を報告。ichiro は、続けたいことを応援するネイティブアプリです。公開準備中。">${noIndex ? '<meta name="robots" content="noindex">' : ""}<title>${title} | ichiro</title><link rel="stylesheet" href="/site.css"></head><body>${content}${footer}</body></html>`;
}
function phone(file: string, alt: string, eager = false) {
  return `<div class="phone"><img src="/images/${file}.png" alt="${alt}" width="1206" height="2622" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async"></div>`;
}
const page = document(
  "続けたいことを、毎日の約束に。",
  `${header()}
<main>
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
    <p class="eyebrow">あなたの「続けたい」を応援。</p>
    <h1 class="logo" id="hero-title">ichiro</h1>
    <h2>小さな約束。<br>毎日、ちょっとずつ。</h2>
    <p class="release">ネイティブアプリ · 公開準備中</p>
    <a class="scroll-cue" href="#how">どんなアプリ？ ↓</a>
    </div>
    <div class="hero-art">
      ${phone("commitments", "朝の読書・英語・運動の目標を並べた ichiro の実際の一覧画面", true)}
      ${phone("celebration", "7日連続の達成をワンちゃんがお祝いする画面", true)}
    </div>
  </section>
  <section class="steps wrap" id="how" aria-labelledby="how-title">
    <p class="eyebrow">HOW TO USE</p><h2 class="section-title" id="how-title">続けるって、<br>こんなにシンプル。</h2>
    <p class="section-intro">読書も、英語も、運動も。あなたのペースで。</p>
    <div class="steps-grid">
      <article class="step"><span class="number">STEP 01</span><h3>やることを、宣言。</h3>${phone("commitments", "目標と毎日の取り組みが並ぶ一覧画面")}<p>続けたいことを登録。<br>今日やることが、ひと目でわかる。</p></article>
      <article class="step"><span class="number">STEP 02</span><h3>できたら、報告。</h3>${phone("progress", "連続達成の記録と今日の達成を報告するボタン")}<p>今日もできたら、ボタンをタップ。<br>小さな一歩を、記録に残そう。</p></article>
      <article class="step"><span class="number">STEP 03</span><h3>がんばりを、お祝い。</h3>${phone("celebration", "朝の読書の7日連続達成を祝うワンちゃん")}<p>がんばった日は、ワンちゃんが祝福。</p></article>
    </div>
  </section>
  <section class="payment wrap" id="payment" aria-labelledby="payment-title">
    <p class="eyebrow">もうひと押し、ほしいときに。</p><h2 id="payment-title">自分との約束に、<br>罰金をつけることも。</h2>
    <p>設定は任意。未報告の日だけ、決めた金額を自動で請求。<br>罰金を設定せずに使うこともできます。</p>
    <details><summary>金額・請求条件を確認する</summary><dl>
      <div><dt>金額</dt><dd>報告日1日あたり100円以上で、自分で設定します。</dd></div>
      <div><dt>請求の条件</dt><dd>コミットメントのタイムゾーンで、報告日の23:59:59までに報告がなかった場合に請求します。</dd></div>
      <div><dt>支払い方法</dt><dd>Stripe を通じて登録した支払い方法から、締め切り後に自動で請求します。</dd></div>
      <div><dt>変更・キャンセル</dt><dd>設定の変更は今日の報告分から適用されます。締め切りを過ぎた分は変更前の設定で精算します。アプリの削除やログアウトでは解除されません。</dd></div>
    </dl><p class="small">返金等の詳細条件は、<a href="/commerce">特定商取引法に基づく表記</a>をご確認ください。</p></details>
  </section>
  <section class="end"><p class="logo">ichiro</p><p>あなたの「続けたい」を応援。</p><span>ただいま、アプリ公開準備中。</span></section>
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
        `${header(true)}<main class="legal wrap"><p class="meta">施行日：2026年9月30日</p><h1>${entry.title}</h1>${entry.sections.map(([heading, body]) => `<section><h2>${heading}</h2><p>${body}</p></section>`).join("")}${path === "/privacy" ? '<p class="external">外部サービスの方針：<a href="https://stripe.com/jp/privacy">Stripe</a> / <a href="https://www.cloudflare.com/privacypolicy/">Cloudflare</a></p>' : ""}</main>`,
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
