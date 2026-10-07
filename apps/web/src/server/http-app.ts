import { createHttpApp } from "@ichiro/api/http";
import { httpRoutes } from "@ichiro/api/routers/index";

import { createContext } from "./context";

// プロフィール写真のように、tRPC に載せない素の HTTP のルート。
// サーバールート（routes/api/profile/avatar.ts・routes/avatars/$.ts）からリクエストを渡す
const httpApp = createHttpApp(httpRoutes, (c, options) => createContext(c.req.raw, options));

export function handleHttpRoute({ request }: { request: Request }) {
  return httpApp.fetch(request);
}
