import { afterEach, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:net";
import { loadSettings, run, validateSettings } from "./dev-stripe.mjs";

const directories = [];
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});
const env = {
  ...process.env,
  STRIPE_SECRET_KEY: "sk_test_fixture",
  STRIPE_API_KEY: "sk_live_wrong_account",
};
async function fixture(stripeCode) {
  const directory = await mkdtemp(join(tmpdir(), "ichiro-stripe-"));
  directories.push(directory);
  await writeFile(join(directory, "stripe.mjs"), stripeCode);
  await writeFile(
    join(directory, "server.mjs"),
    `
    import { writeFileSync } from 'node:fs';
    writeFileSync('server.json', JSON.stringify({secret: process.env.STRIPE_WEBHOOK_SECRET, key: process.env.STRIPE_SECRET_KEY, port: process.env.ICHIRO_DEV_PORT, pid: process.pid}));
    console.log('server-ready');
    setInterval(() => {}, 1000);
  `,
  );
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return {
    directory,
    port,
    cwd: directory,
    env,
    stripeCommand: [process.execPath, join(directory, "stripe.mjs")],
    serverCommand: [process.execPath, join(directory, "server.mjs")],
  };
}

test("本番キーと不正なポートでは接続しない", () => {
  expect(() => validateSettings({ STRIPE_SECRET_KEY: "sk_live_no" }, 3000)).toThrow("テスト用キー");
  for (const port of [0, 65536, NaN, 3.5])
    expect(() => validateSettings(env, port)).toThrow("--port");
});

test("Varlock が環境変数を優先し、既存の webhook シークレットなしでも読み込める", async () => {
  const settings = await loadSettings({
    NODE_ENV: "development",
    STRIPE_SECRET_KEY: "sk_test_override",
    STRIPE_WEBHOOK_SECRET: "",
    BETTER_AUTH_SECRET: "a".repeat(32),
  });
  expect(settings.STRIPE_SECRET_KEY).toBe("sk_test_override");
  expect(settings.STRIPE_WEBHOOK_SECRET).toBe("whsec_pending_listener");
});

test("分割された署名シークレットを渡し、キーを表示せず、終了時に両プロセスを止める", async () => {
  const options = await fixture(`
    import { writeFileSync } from 'node:fs';
    writeFileSync('stripe.json', JSON.stringify({ key: process.env.STRIPE_API_KEY, args: process.argv.slice(2), pid: process.pid }));
    process.stderr.write('Ready! Your webhook signing secret is wh');
    setTimeout(() => process.stderr.write('sec_fixture\\n'), 20);
    setInterval(() => {}, 1000);
  `);
  const controller = new AbortController();
  const lines = [];
  const code = await run({
    ...options,
    signal: controller.signal,
    log: (line) => {
      lines.push(line);
      if (line.includes("server-ready")) controller.abort();
    },
  });
  expect(code).toBe(0);
  const server = JSON.parse(await readFile(join(options.directory, "server.json"), "utf8"));
  const stripe = JSON.parse(await readFile(join(options.directory, "stripe.json"), "utf8"));
  expect(server).toMatchObject({
    secret: "whsec_fixture",
    key: "sk_test_fixture",
    port: String(options.port),
  });
  expect(stripe.key).toBe("sk_test_fixture");
  expect(stripe.args).toContain(`http://localhost:${options.port}/api/stripe/webhook`);
  expect(lines.join("\n")).not.toContain("whsec_fixture");
  for (const pid of [server.pid, stripe.pid]) expect(() => process.kill(pid, 0)).toThrow();
});

test("CLI が起動できなければサーバーを起動しない", async () => {
  const options = await fixture("");
  expect(
    await run({ ...options, stripeCommand: [join(options.directory, "missing")], log: () => {} }),
  ).toBe(1);
  expect(await readFile(join(options.directory, "server.json")).catch(() => null)).toBeNull();
});

test("認証失敗と接続タイムアウトでサーバーを起動しない", async () => {
  for (const code of ["process.exit(2)", "setInterval(() => {}, 1000)"]) {
    const options = await fixture(code);
    expect(await run({ ...options, timeoutMs: 100, log: () => {} })).toBeGreaterThan(0);
    expect(await readFile(join(options.directory, "server.json")).catch(() => null)).toBeNull();
  }
});

test("サーバーが終了したら Stripe CLI も停止する", async () => {
  const options = await fixture(`console.log('whsec_fixture'); setInterval(() => {}, 1000);`);
  await writeFile(join(options.directory, "server.mjs"), "process.exit(3)");
  expect(await run({ ...options, log: () => {} })).toBe(3);
});

test("使用中のポートでは既存のサーバーに接続しない", async () => {
  const options = await fixture("");
  const server = createServer();
  await new Promise((resolve) => server.listen(options.port, "127.0.0.1", resolve));
  try {
    await expect(run({ ...options, log: () => {} })).rejects.toThrow("使用できません");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("停止時は SIGTERM を無視する孫プロセスも残さない", async () => {
  const options = await fixture(`console.log('whsec_fixture'); setInterval(() => {}, 1000);`);
  await writeFile(
    join(options.directory, "grandchild.mjs"),
    `
    import { writeFileSync } from 'node:fs';
    process.on('SIGTERM', () => {});
    writeFileSync('grandchild.pid', String(process.pid));
    console.log('grandchild-ready');
    setInterval(() => {}, 1000);
  `,
  );
  await writeFile(
    join(options.directory, "server.mjs"),
    `
    import { spawn } from 'node:child_process';
    spawn(process.execPath, ['grandchild.mjs'], { stdio: 'inherit' });
    setInterval(() => {}, 1000);
  `,
  );
  const controller = new AbortController();
  expect(
    await run({
      ...options,
      signal: controller.signal,
      log: (line) => {
        if (line.includes("grandchild-ready")) controller.abort();
      },
    }),
  ).toBe(0);
  const pid = Number(await readFile(join(options.directory, "grandchild.pid"), "utf8"));
  // SIGKILL delivery and process reaping are asynchronous.
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      process.kill(pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("孫プロセスが残っています");
});
