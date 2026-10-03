// Composes App Store marketing screenshots (headline + device frame) from native captures.
// Usage (repo root): node scripts/render-app-store-screenshots.mjs <source-dir> <output-dir> [width height]
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const [sourceDir, outputDir, width = "1284", height = "2778"] = process.argv.slice(2);
if (!sourceDir || !outputDir) {
  console.error(
    "Usage: node scripts/render-app-store-screenshots.mjs <source-dir> <output-dir> [width height]",
  );
  process.exit(1);
}
const W = Number(width);
const H = Number(height);

const slides = [
  {
    file: "01-commitments.png",
    title: "小さな約束。<br><mark>毎日、ちょっとずつ。</mark>",
    body: "読書も、英語も、運動も。<br>続けたいことを登録しよう。",
  },
  {
    file: "02-progress.png",
    title: "できたら、<br><mark>タップで報告。</mark>",
    body: "連続達成の日数と今週の記録が<br>ひと目でわかる。",
  },
  {
    file: "03-celebration.png",
    title: "続くと、<br><mark>うれしい。</mark>",
    body: "達成するたびにワンちゃんがお祝い。<br>連続記録をのばしていこう。",
  },
];

// M PLUS Rounded 1c (SIL OFL) from Google Fonts, cached outside the repo.
const fontDir = join(tmpdir(), "ichiro-app-store-fonts");
mkdirSync(fontDir, { recursive: true });
const fonts = {
  500: "https://fonts.gstatic.com/s/mplusrounded1c/v22/VdGBAYIAV6gnpUpoWwNkYvrugw9RuM1y55sK.ttf",
  800: "https://fonts.gstatic.com/s/mplusrounded1c/v22/VdGBAYIAV6gnpUpoWwNkYvrugw9RuM0m4psK.ttf",
};
const fontFaces = Object.entries(fonts)
  .map(([weight, url]) => {
    const path = join(fontDir, `mplusrounded1c-${weight}.ttf`);
    if (!existsSync(path)) execFileSync("curl", ["-sSfL", "-o", path, url]);
    const data = readFileSync(path).toString("base64");
    return `@font-face{font-family:"Rounded";font-weight:${weight};src:url(data:font/ttf;base64,${data}) format("truetype");}`;
  })
  .join("");

// Phone geometry, proportional to the canvas width (tuned for 1284 px).
const u = W / 1284;
const phoneW = 940 * u;
const bezel = 24 * u;
const screenW = phoneW - bezel * 2;
const screenH = (screenW * 2868) / 1320;
const phoneH = screenH + bezel * 2;
const phoneTop = H - phoneH - 132 * u;

function page(slide) {
  const shot = readFileSync(resolve(sourceDir, slide.file)).toString("base64");
  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
${fontFaces}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden}
body{position:relative;font-family:"Rounded",sans-serif;color:#163447;
  background:linear-gradient(180deg,#d4f2ff 0%,#eaf8ff 45%,#f7fcff 100%)}
.blob{position:absolute;border-radius:50%;background:#3dc4f4}
.copy{position:absolute;left:0;right:0;top:${150 * u}px;text-align:center}
h1{font-weight:800;font-size:${100 * u}px;line-height:1.32;letter-spacing:.02em}
mark{color:inherit;background:linear-gradient(transparent 62%,#a8e6fc 62%,#a8e6fc 92%,transparent 92%);padding:0 ${6 * u}px}
p{margin-top:${36 * u}px;font-weight:500;font-size:${44 * u}px;line-height:1.55;color:#4d6a7c}
.phone{position:absolute;left:${(W - phoneW) / 2}px;top:${phoneTop}px;width:${phoneW}px;height:${phoneH}px;
  border-radius:${136 * u}px;background:#10212c;padding:${bezel}px;
  box-shadow:0 ${40 * u}px ${90 * u}px rgba(22,52,71,.22),inset 0 0 0 ${4 * u}px #2b3f4c}
.btn{position:absolute;width:${8 * u}px;background:#1b2f3b;border-radius:${4 * u}px}
.screen{position:relative;width:${screenW}px;height:${screenH}px;border-radius:${112 * u}px;overflow:hidden;background:#fff}
.screen img{display:block;width:100%;height:100%}
.island{position:absolute;left:50%;top:${22 * u}px;width:${255 * u}px;height:${75 * u}px;
  transform:translateX(-50%);border-radius:${40 * u}px;background:#000}
</style></head><body>
<div class="blob" style="width:${520 * u}px;height:${520 * u}px;left:${-200 * u}px;top:${1250 * u}px;opacity:.12"></div>
<div class="blob" style="width:${380 * u}px;height:${380 * u}px;right:${-150 * u}px;top:${520 * u}px;opacity:.14"></div>
<div class="blob" style="width:${120 * u}px;height:${120 * u}px;right:${90 * u}px;top:${2380 * u}px;opacity:.18"></div>
<div class="copy"><h1>${slide.title}</h1><p>${slide.body}</p></div>
<div class="phone">
  <div class="btn" style="left:${-8 * u}px;top:${300 * u}px;height:${70 * u}px"></div>
  <div class="btn" style="left:${-8 * u}px;top:${420 * u}px;height:${130 * u}px"></div>
  <div class="btn" style="left:${-8 * u}px;top:${580 * u}px;height:${130 * u}px"></div>
  <div class="btn" style="right:${-8 * u}px;top:${470 * u}px;height:${200 * u}px"></div>
  <div class="screen"><img src="data:image/png;base64,${shot}" alt=""><div class="island"></div></div>
</div>
</body></html>`;
}

mkdirSync(outputDir, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const slide of slides) {
  await tab.setContent(page(slide), { waitUntil: "load" });
  await tab.evaluate(() => document.fonts.ready);
  const output = join(outputDir, slide.file);
  await tab.screenshot({ path: output, type: "png", omitBackground: false });
  console.log(`Rendered ${output}`);
}
await browser.close();
