// macOS: bun run packages/db/src/seed/avatar-photos.ts
// 起動中の iOS Simulator に、プロフィール写真の確認用画像を追加する。
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, URL } from "node:url";

if (process.platform !== "darwin") {
  throw new Error("iOS Simulator 用の画像作成は macOS で実行してください");
}

const source = fileURLToPath(
  new URL("../../../../apps/native/assets/images/icon.png", import.meta.url),
);
const directory = mkdtempSync(join(tmpdir(), "ichiro-avatar-photos-"));
const photos = ["jpeg", "png", "heic"].map((format) => {
  const destination = join(directory, `avatar.${format}`);
  execFileSync("sips", ["-s", "format", format, source, "--out", destination]);
  return destination;
});

for (const photo of photos) {
  execFileSync("xcrun", ["simctl", "addmedia", "booted", photo]);
}
console.log(`JPEG・PNG・HEIC を起動中の Simulator に追加しました: ${directory}`);
