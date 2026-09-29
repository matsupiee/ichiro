import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "drizzle-kit";

const dbDirectory = fileURLToPath(new URL("./", import.meta.url));
const storageDirectory = resolve(dbDirectory, "../infra/.alchemy/local/d1");
const override = process.env.D1_LOCAL_PATH;
const candidates = override
  ? [resolve(dbDirectory, override)]
  : existsSync(storageDirectory)
    ? readdirSync(storageDirectory, { recursive: true, encoding: "utf8" })
        .filter((path) => path.endsWith(".sqlite") && basename(path) !== "metadata.sqlite")
        .map((path) => resolve(storageDirectory, path))
        .filter((path) => statSync(path).isFile())
        .sort()
    : [];

if (candidates.length === 0) {
  throw new Error(
    "ローカル D1 が見つかりません。先にルートで bun run dev:server を起動してください。",
  );
}
if (candidates.length > 1) {
  throw new Error(
    `ローカル D1 が複数あります。D1_LOCAL_PATH に対象の絶対パスを指定してください。\n${candidates.join("\n")}`,
  );
}
const databasePath = candidates[0]!;
if (!existsSync(databasePath) || !statSync(databasePath).isFile()) {
  throw new Error(`指定されたローカル D1 ファイルがありません: ${databasePath}`);
}

console.log(`ローカル D1: ${databasePath}`);

export default defineConfig({
  dialect: "sqlite",
  schema: resolve(dbDirectory, "src/schema/index.ts"),
  dbCredentials: { url: databasePath },
});
