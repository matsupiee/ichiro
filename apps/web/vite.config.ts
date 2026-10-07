import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Cloudflare の Vite プラグインは、Alchemy（packages/infra/alchemy.run.ts）が開発・ビルドのときに差し込む
export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart(),
    // React のプラグインは Start のプラグインより後に置く
    viteReact(),
  ],
});
