import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { internal } from "varlock";

const infraDirectory = fileURLToPath(new URL("../", import.meta.url));
const events = "setup_intent.succeeded,payment_intent.succeeded,payment_intent.payment_failed";

export async function loadSettings(env = process.env) {
  const graph = await internal.loadEnvGraph({
    basePath: infraDirectory,
    // The real secret is supplied by the listener before the server starts.
    overrideValues: {
      ...env,
      NODE_ENV: "development",
      APP_ENV: "development",
      STRIPE_WEBHOOK_SECRET: "whsec_pending_listener",
    },
  });
  await graph.resolveEnvValues();
  if (graph.isInvalid) {
    throw new Error(
      "開発用の環境設定が不足しています。apps/server/.env と packages/infra/.env.schema を確認してください。",
    );
  }
  return { ...env, ...graph.getResolvedEnvStringObject() };
}

export function validateSettings(env, port) {
  if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
    throw new Error("STRIPE_SECRET_KEY に sk_test_ で始まるテスト用キーを設定してください。");
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("--port は 1〜65535 の整数で指定してください。");
  }
}

async function checkPort(port) {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", () =>
      reject(
        new Error(
          `ポート ${port} を使用できません。既存のサーバーを停止するか --port を指定してください。`,
        ),
      ),
    );
    probe.listen(port, "127.0.0.1", resolve);
  });
  await new Promise((resolve) => probe.close(resolve));
}

// Each child gets its own process group so Alchemy's workerd descendants also stop.
export async function run({
  env,
  port = 3000,
  stripeCommand = ["stripe"],
  serverCommand = [process.execPath, "run", "dev"],
  cwd = infraDirectory,
  signal,
  timeoutMs = 30000,
  log = console.log,
}) {
  validateSettings(env, port);
  await checkPort(port);
  const children = [];
  let finish;
  let stopping = false;
  const finished = new Promise((resolve) => {
    finish = (code) => {
      if (stopping) return;
      stopping = true;
      resolve(code);
    };
  });
  const abort = () => finish(0);
  signal?.addEventListener("abort", abort, { once: true });
  let timer;
  let started = false;
  const redact = (line) =>
    line.replace(/(?:whsec_|[sr]k_(?:test|live)_)[A-Za-z0-9_]+/g, "[REDACTED]");
  const childEnv = {
    ...env,
    NODE_ENV: "development",
    APP_ENV: "development",
    STRIPE_API_KEY: env.STRIPE_SECRET_KEY,
    ICHIRO_DEV_PORT: String(port),
  };
  function launch(command, environment, name, onLine) {
    const child = spawn(command[0], command.slice(1), {
      cwd,
      env: environment,
      detached: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    children.push(child);
    child.once("error", () => {
      log(`${name} を起動できません。インストールと PATH を確認してください。`);
      finish(1);
    });
    child.once("exit", (code) => {
      log(`${name} が終了したため、開発環境を停止します。`);
      finish(code || 1);
    });
    for (const stream of [child.stdout, child.stderr]) {
      const lines = createInterface({ input: stream });
      lines.on("line", (line) => {
        onLine?.(line);
        log(`[${name}] ${redact(line)}`);
      });
    }
    return child;
  }
  try {
    if (signal?.aborted) return 0;
    log(`Stripe のテスト環境に接続しています（転送先 http://localhost:${port}/stripe/webhook）…`);
    timer = setTimeout(() => {
      log(
        "Stripe の接続がタイムアウトしました。テスト用キーと外向き通信の許可を確認してください。",
      );
      finish(1);
    }, timeoutMs);
    launch(
      [
        ...stripeCommand,
        "listen",
        "--color",
        "off",
        "--skip-update",
        "--events",
        events,
        "--forward-to",
        `http://localhost:${port}/stripe/webhook`,
      ],
      childEnv,
      "stripe",
      (line) => {
        const secret = line.match(/\bwhsec_[A-Za-z0-9_]+\b/)?.[0];
        if (!secret || started || stopping || signal?.aborted) return;
        started = true;
        clearTimeout(timer);
        launch(serverCommand, { ...childEnv, STRIPE_WEBHOOK_SECRET: secret }, "server");
        log(
          "Webhook の署名シークレットを受け取りました。API サーバーを起動します。Ctrl+C で両方停止します。",
        );
      },
    );
    return await finished;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    const killGroups = (sig) => {
      for (const child of children) {
        if (!child.pid) continue;
        try {
          process.kill(-child.pid, sig);
        } catch (error) {
          if (error.code !== "ESRCH") throw error;
        }
      }
    };
    killGroups("SIGTERM");
    // Leave a short grace period, then also terminate surviving grandchildren.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    killGroups("SIGKILL");
  }
}

if (import.meta.main) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    const { values } = parseArgs({
      options: { port: { type: "string", default: "3000" }, help: { type: "boolean" } },
    });
    if (values.help) {
      console.log(
        "bun run dev:stripe [--port 3000]\nStripe CLI と API を起動します。STRIPE_SECRET_KEY は apps/server/.env または環境変数に設定してください。",
      );
    } else {
      process.exitCode = await run({
        env: await loadSettings(),
        port: Number(values.port),
        signal: controller.signal,
      });
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
}
