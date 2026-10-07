import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { localState } from "alchemy/State";
import * as Effect from "effect/Effect";

// alchemy profile（Cloudflare へのログイン）専用のエントリ。
// alchemy.run.ts は読み込み時に Varlock で環境変数を検証するため、
// 開発用の apps/web/.env が無いとログインもできなくなる。ログインに要るのはプロバイダだけなので分ける
export default Alchemy.Stack(
  "ichiro",
  // 状態は使わない。型の都合で指定する
  { providers: Cloudflare.providers(), state: localState() },
  Effect.succeed({}),
);
