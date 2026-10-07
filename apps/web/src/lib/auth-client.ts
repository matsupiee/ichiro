import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// 画面と API は同じオリジンなので baseURL は指定しない。セッションは HttpOnly の Cookie で持つ
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
});
