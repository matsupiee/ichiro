import { createHttpHandler } from "@ichiro/api/http";
import { httpRoutes } from "@ichiro/api/routers/index";

import { createContext } from "./context";

// プロフィール写真のように、tRPC に載せない素の HTTP のルート。
// サーバールート（routes/api/profile/avatar.ts・routes/avatars/$.ts）からリクエストを渡す
const handle = createHttpHandler(httpRoutes, createContext);

export function handleHttpRoute({ request }: { request: Request }) {
  return handle(request);
}
