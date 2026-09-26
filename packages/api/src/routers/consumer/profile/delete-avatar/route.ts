import z from "zod";

import { protectedHttpRoute } from "../../../../http";
import { handler } from "./handler";

export const profileDeleteAvatarOutputSchema = z.object({
  image: z.null(),
});

// プロフィール写真を削除する。写真がなくても成功する
export const profileDeleteAvatarRoute = protectedHttpRoute(
  "DELETE",
  "/api/profile/avatar",
  handler,
);
