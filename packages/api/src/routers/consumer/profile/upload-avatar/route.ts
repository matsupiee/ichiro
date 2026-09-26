import z from "zod";

import { protectedHttpRoute } from "../../../../http";
import { handler } from "./handler";

// 入力は写真のバイナリそのもの。Content-Type で形式を宣言する
export const profileUploadAvatarInputSchema = z.object({
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export const profileUploadAvatarOutputSchema = z.object({
  // user.image に入れた、サーバーからの相対パス
  image: z.string(),
});

// プロフィール写真をアップロードする。画像のバイナリを tRPC の JSON に載せると重いので、素の HTTP で受ける
export const profileUploadAvatarRoute = protectedHttpRoute("PUT", "/api/profile/avatar", handler);
