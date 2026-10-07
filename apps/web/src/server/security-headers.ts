// アプリの画面と API の応答に付けるセキュリティヘッダー。
// 紹介ページと規約はスクリプトを使わない、より厳しい CSP を public-page.ts で付けており、それを優先する。
// アプリの画面は TanStack Start のインラインスクリプトと Stripe.js を使うため、スクリプトの制限はここでは行わない
const APP_CSP = [
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join("; ");

export function withSecurityHeaders(response: Response): Response {
  const secured = new Response(response.body, response);
  const headers = secured.headers;
  if (!headers.has("X-Content-Type-Options")) headers.set("X-Content-Type-Options", "nosniff");
  if (!headers.has("Referrer-Policy"))
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  const html = headers.get("Content-Type")?.includes("text/html");
  if (html && !headers.has("Content-Security-Policy"))
    headers.set("Content-Security-Policy", APP_CSP);
  return secured;
}
