// docs/rules/backend.md のうち、機械的に確かめられるルールを検査する。
// 違反があれば一覧を出して終了コード 1 で終わる
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const src = join(root, "src");
const routersDir = join(src, "routers");
const sharedDir = join(src, "shared");

const USER_TYPES = ["consumer", "admin"];
const API_FILES = ["route.ts", "handler.ts", "handler.integration.test.ts"];
const ROUTE_SUFFIXES = ["InputSchema", "OutputSchema", "Route"];
const VAGUE_NAMES = ["utils.ts", "helpers.ts", "common.ts"];

const errors: string[] = [];
const rel = (path: string) => relative(root, path);

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const dirsIn = (dir: string) =>
  existsSync(dir) ? readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory()) : [];

const camel = (kebab: string) => kebab.replace(/-([a-z0-9])/g, (_, c: string) => c.toUpperCase());

const exportedFunctions = (code: string) =>
  [...code.matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]!);

const exportedConsts = (code: string) =>
  [...code.matchAll(/^export const (\w+)/gm)].map((m) => m[1]!);

// index.ts は routers/index.ts だけ
for (const file of walk(src)) {
  if (file.endsWith("/index.ts") && file !== join(routersDir, "index.ts")) {
    errors.push(`${rel(file)}: index.ts は src/routers/index.ts 以外に置かない`);
  }
}

// routers 配下は 利用者種別/ドメイン/API の3階層で、API ディレクトリには決まった3ファイルだけを置く
const routeFiles: string[] = [];
for (const name of readdirSync(routersDir)) {
  const path = join(routersDir, name);
  if (!statSync(path).isDirectory()) {
    if (name !== "index.ts") errors.push(`${rel(path)}: routers の直下には index.ts だけを置く`);
    continue;
  }
  if (!USER_TYPES.includes(name)) {
    errors.push(`${rel(path)}: routers の直下は ${USER_TYPES.join(" / ")} のどれかにする`);
    continue;
  }
  for (const domain of readdirSync(path)) {
    const domainPath = join(path, domain);
    if (!statSync(domainPath).isDirectory()) {
      errors.push(`${rel(domainPath)}: ドメインのディレクトリにファイルを置かない`);
      continue;
    }
    for (const api of readdirSync(domainPath)) {
      const apiPath = join(domainPath, api);
      if (!statSync(apiPath).isDirectory()) {
        errors.push(`${rel(apiPath)}: ドメインのディレクトリにファイルを置かない`);
        continue;
      }
      const files = readdirSync(apiPath);
      for (const file of files) {
        if (!API_FILES.includes(file)) {
          errors.push(
            `${rel(join(apiPath, file))}: API ディレクトリには ${API_FILES.join("・")} だけを置く`,
          );
        }
      }
      for (const file of API_FILES) {
        if (!files.includes(file)) errors.push(`${rel(apiPath)}: ${file} がない`);
      }

      const routePath = join(apiPath, "route.ts");
      if (existsSync(routePath)) {
        routeFiles.push(routePath);
        const prefix = camel(`${domain}-${api}`);
        for (const name of exportedConsts(readFileSync(routePath, "utf8"))) {
          if (!ROUTE_SUFFIXES.some((suffix) => name === `${prefix}${suffix}`)) {
            errors.push(
              `${rel(routePath)}: ${name} は ${prefix} + { ${ROUTE_SUFFIXES.join(" | ")} } の名前にする`,
            );
          }
        }
      }

      const handlerPath = join(apiPath, "handler.ts");
      if (existsSync(handlerPath)) {
        const fns = exportedFunctions(readFileSync(handlerPath, "utf8"));
        if (fns.length !== 1 || fns[0] !== "handler") {
          errors.push(
            `${rel(handlerPath)}: export する関数は handler だけにする（いま: ${fns.join(", ") || "なし"}）`,
          );
        }
      }
    }
  }
}

// すべての route.ts を routers/index.ts から import し、登録する
const index = readFileSync(join(routersDir, "index.ts"), "utf8");
for (const routePath of routeFiles) {
  const specifier = `./${relative(routersDir, routePath).replace(/\.ts$/, "")}`;
  const imported = index.match(
    new RegExp(`import \\{([^}]+)\\} from "${specifier.replaceAll(".", "\\.")}"`),
  );
  if (!imported) {
    errors.push(`${rel(routePath)}: routers/index.ts から import されていない`);
    continue;
  }
  for (const binding of imported[1]!
    .split(",")
    .map((b) => b.trim())
    .filter(Boolean)) {
    const local = binding.split(/\s+as\s+/).pop()!;
    if (!local.endsWith("Route")) continue;
    const uses = index.match(new RegExp(`\\b${local}\\b`, "g"))?.length ?? 0;
    if (uses < 2) errors.push(`${rel(routePath)}: ${local} が routers/index.ts で登録されていない`);
  }
}

// shared は1ファイル1関数で、ファイル名と関数名をそろえる
for (const file of walk(sharedDir)) {
  const name = file.split("/").pop()!;
  if (VAGUE_NAMES.includes(name)) {
    errors.push(`${rel(file)}: 用途のあいまいなファイルは作らない`);
  }
  if (name.endsWith(".test.ts") || !name.endsWith(".ts")) continue;
  const fns = exportedFunctions(readFileSync(file, "utf8"));
  const expected = camel(name.replace(/\.ts$/, ""));
  if (fns.length !== 1 || fns[0] !== expected) {
    errors.push(
      `${rel(file)}: export する関数は ${expected} の1つだけにする（いま: ${fns.join(", ") || "なし"}）`,
    );
  }
}

// 利用者種別をまたいで同じ名前のルートを import するときは、利用者種別を先頭につける
for (const domain of dirsIn(join(routersDir, "admin"))) {
  for (const api of dirsIn(join(routersDir, "admin", domain))) {
    if (!existsSync(join(routersDir, "consumer", domain, api))) continue;
    const name = camel(`${domain}-${api}`);
    for (const type of USER_TYPES) {
      const alias = `${name}Route as ${type}${name[0]!.toUpperCase()}${name.slice(1)}Route`;
      if (!index.includes(alias)) {
        errors.push(`routers/index.ts: ${type} の ${name}Route は「${alias}」で import する`);
      }
    }
  }
}

if (errors.length > 0) {
  console.error(errors.map((e) => `- ${e}`).join("\n"));
  console.error(`\n${errors.length} 件のルール違反があります（docs/rules/backend.md）`);
  process.exit(1);
}
console.log("docs/rules/backend.md のルールに沿っています");
