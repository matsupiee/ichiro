import z from "zod";

import { publicHttpRoute } from "../../../../http";
import { handler } from "./handler";

export const profileGetAvatarInputSchema = z.object({
  userId: z.string(),
  file: z.string(),
});

// 出力は写真のバイナリそのもの。アップロードされたときの Content-Type で返す

// プロフィール写真を配信する。友達にも見せるので、ログインなしで読める。
// パスは推測できない ID を含み、差し替えるたびに変わる
export const profileGetAvatarRoute = publicHttpRoute("GET", "/avatars/:userId/:file", handler);
