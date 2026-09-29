import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { internal } from "varlock";
import { validateDeployment } from "./deployment-settings";

const directory = fileURLToPath(new URL("../", import.meta.url));

export async function loadDeployment(stage: string, env = process.env, basePath = directory) {
  if (stage !== "stg" && stage !== "prod")
    throw new Error("stage は stg または prod を指定してください。");
  if (env.APP_ENV && env.APP_ENV !== stage) throw new Error("APP_ENV とデプロイ先が異なります。");
  if (env.ALCHEMY_STAGE && env.ALCHEMY_STAGE !== stage)
    throw new Error("ALCHEMY_STAGE とデプロイ先が異なります。");
  const graph = await internal.loadEnvGraph({
    basePath,
    overrideValues: { ...env, APP_ENV: stage, NODE_ENV: "production" },
  });
  await graph.resolveEnvValues();
  if (graph.isInvalid)
    throw new Error(`apps/server/.env.${stage}.local または CI の環境変数を設定してください。`);
  const resolved = {
    ...env,
    ...graph.getResolvedEnvStringObject(),
    APP_ENV: stage,
    NODE_ENV: "production",
    ALCHEMY_STAGE: stage,
  };
  validateDeployment(stage, resolved);
  return resolved;
}

if (import.meta.main) {
  try {
    const [stage = "", ...flags] = process.argv.slice(2);
    if (flags.some((flag) => !["--check", "--dry-run", "--yes"].includes(flag))) {
      throw new Error("使用方法: deploy.ts stg|prod [--check | --dry-run] [--yes]");
    }
    const env = await loadDeployment(stage);
    if (flags.includes("--check")) {
      console.log(`${stage}: 環境設定の検証が完了しました（Cloudflare への接続なし）。`);
    } else {
      const child = spawn(process.execPath, ["run", "deploy", "--stage", stage, ...flags], {
        cwd: directory,
        env,
        stdio: "inherit",
      });
      process.exitCode = await new Promise<number>((resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code) => resolve(code ?? 1));
      });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "デプロイに失敗しました。");
    process.exitCode = 1;
  }
}
