import { expect, test } from "bun:test";

import { withSecurityHeaders } from "./security-headers";

test("アプリの HTML に、ほかのサイトへの埋め込みを禁止する CSP と基本のヘッダーを付ける", async () => {
  const response = withSecurityHeaders(
    new Response("<p>app</p>", { status: 200, headers: { "Content-Type": "text/html" } }),
  );
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("<p>app</p>");
  expect(response.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
});

test("紹介ページのより厳しい CSP とリダイレクトはそのまま残す", () => {
  const strict = withSecurityHeaders(
    new Response("", {
      headers: {
        "Content-Type": "text/html",
        "Content-Security-Policy": "default-src 'none'",
        "Referrer-Policy": "no-referrer",
      },
    }),
  );
  expect(strict.headers.get("Content-Security-Policy")).toBe("default-src 'none'");
  expect(strict.headers.get("Referrer-Policy")).toBe("no-referrer");

  const redirect = withSecurityHeaders(Response.redirect("http://localhost/app", 302));
  expect(redirect.status).toBe(302);
  expect(redirect.headers.get("Location")).toBe("http://localhost/app");
});

test("API の JSON には CSP を付けない", () => {
  const json = withSecurityHeaders(Response.json({ ok: true }));
  expect(json.headers.get("Content-Security-Policy")).toBeNull();
  expect(json.headers.get("X-Content-Type-Options")).toBe("nosniff");
});
