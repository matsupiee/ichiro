import { defineConfig, devices } from "@playwright/test";

// ユーザーストーリー（docs/user-stories）をブラウザで通しで確かめる E2E テスト。
// 手順は docs/development/e2e.md。ローカルの開発サーバー（AUTH_EMAIL_DELIVERY=console）に対して実行する
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  // ローカル D1 と認証の回数制限を共有するので、1つずつ順に実行する
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    // スマートフォンの幅で確かめる
    viewport: { width: 390, height: 844 },
    locale: "ja-JP",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "bun run dev:server",
    cwd: "../..",
    url: `${baseURL}/app/welcome`,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
