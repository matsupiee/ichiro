import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import type { Database } from "@ichiro/db";
import * as schema from "@ichiro/db/schema/auth";
import { type BetterAuthPlugin, betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { z } from "zod";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
};
export type VerificationMail = {
  email: string;
  otp: string;
  type: "email-verification" | "change-email" | "forget-password";
};
export type SendVerificationMail = (mail: VerificationMail) => Promise<void>;

// extraPlugins は末尾に足す。TanStack Start の Cookie 連携（tanstackStartCookies）は最後に置く必要があるため
// https://www.better-auth.com/docs/integrations/tanstack
export function createAuth(
  env: AuthConfig,
  database: Database,
  sendMail: SendVerificationMail,
  extraPlugins: BetterAuthPlugin[] = [],
) {
  const assertActive = async (id: string) => {
    const [row] = await database.select().from(schema.user).where(eq(schema.user.id, id));
    if (!row || row.withdrawnAt)
      throw new APIError("FORBIDDEN", {
        message: "このアカウントは利用できません",
        code: "ACCOUNT_WITHDRAWN",
      });
  };
  return betterAuth({
    databaseHooks: {
      user: {
        update: {
          before: async (_data, ctx) => {
            if (ctx?.context.session?.user.id) await assertActive(ctx.context.session.user.id);
          },
        },
      },
      session: {
        create: {
          before: async (data) => {
            await assertActive(data.userId);
          },
        },
      },
    },
    database: drizzleAdapter(database, { provider: "sqlite", schema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      revokeSessionsOnPasswordReset: true,
      // 登録済みの場合は成功扱いにせず、ログイン画面へ案内する。
      // await-auth-delivery がこのコールバックのエラーも応答へ伝播する。
      onExistingUserSignUp: async () => {
        throw new APIError("UNPROCESSABLE_ENTITY", {
          code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
          message: "登録済みのアカウントです。ログインしてください",
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // OTP ログイン・事前のコード照合・旧再設定 API は公開しない。
    disabledPaths: [
      "/sign-in/email-otp",
      "/email-otp/check-verification-otp",
      "/forget-password/email-otp",
      "/change-email",
      "/verify-email",
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 10 },
        "/sign-up/email": { window: 60, max: 5 },
        "/email-otp/send-verification-otp": { window: 60, max: 5 },
        "/send-verification-email": { window: 60, max: 5 },
        "/email-otp/verify-email": { window: 60, max: 10 },
        "/email-otp/request-email-change": { window: 60, max: 5 },
        "/email-otp/change-email": { window: 60, max: 10 },
        "/email-otp/request-password-reset": { window: 60, max: 5 },
        "/email-otp/reset-password": { window: 60, max: 10 },
      },
    },
    advanced: {
      // Cloudflare が付与する IP のみ信頼し、任意の X-Forwarded-For は使わない。
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const path = ctx.path;
        if (path === "/email-otp/request-password-reset" || path === "/email-otp/reset-password") {
          const email = z.email().safeParse(ctx.body?.email);
          if (!email.success)
            throw new APIError("BAD_REQUEST", {
              message: "メールアドレスが正しくありません",
              code: "INVALID_EMAIL",
            });
          const [user] = await database
            .select()
            .from(schema.user)
            .where(eq(schema.user.email, email.data.toLowerCase()));
          if (user?.withdrawnAt) {
            // 退会済みでも送信応答からアカウントの有無を判別させない。
            if (path === "/email-otp/request-password-reset") return ctx.json({ success: true });
            throw new APIError("BAD_REQUEST", {
              message: "認証コードが無効です",
              code: "INVALID_OTP",
            });
          }
        }
        if (
          path === "/email-otp/send-verification-otp" &&
          ctx.body?.type !== "email-verification"
        ) {
          throw new APIError("BAD_REQUEST", {
            message: "メール確認以外のコードは発行できません",
            code: "INVALID_OTP_TYPE",
          });
        }
        if (
          path === "/email-otp/verify-email" ||
          path === "/email-otp/change-email" ||
          path === "/email-otp/reset-password"
        ) {
          if (!/^\d{6}$/.test(ctx.body?.otp ?? "")) {
            throw new APIError("BAD_REQUEST", {
              message: "6桁の認証コードを入力してください",
              code: "INVALID_OTP",
            });
          }
        }
        // 確認済みユーザーがメール確認 API を OTP ログインとして使うことを防ぐ。
        if (path === "/email-otp/verify-email") {
          const [user] = await database
            .select()
            .from(schema.user)
            .where(eq(schema.user.email, String(ctx.body?.email ?? "").toLowerCase()));
          if (user?.emailVerified)
            throw new APIError("BAD_REQUEST", {
              message: "確認済みです。パスワードでログインしてください",
              code: "EMAIL_ALREADY_VERIFIED",
            });
        }
      }),
    },
    plugins: [
      {
        id: "await-auth-delivery",
        // Better Auth の既定処理は送信失敗を握りつぶすため、応答まで待って失敗を返す。
        // Worker のリクエスト終了後にメール送信だけが中断されることも防ぐ。
        init: () => ({
          context: {
            runInBackgroundOrAwait: async (promise: Promise<unknown> | void) => {
              await promise;
            },
          },
        }),
      },
      emailOTP({
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 5,
        storeOTP: "hashed",
        resendStrategy: "rotate",
        disableSignUp: true,
        overrideDefaultEmailVerification: true,
        changeEmail: { enabled: true, verifyCurrentEmail: false },
        async sendVerificationOTP({ email, otp, type }) {
          if (
            type !== "email-verification" &&
            type !== "change-email" &&
            type !== "forget-password"
          )
            throw new Error("Unsupported OTP purpose");
          try {
            await sendMail({ email, otp, type });
          } catch {
            // 外部サービスの本文・宛先・コードをクライアントや本番ログへ露出しない。
            throw new APIError("SERVICE_UNAVAILABLE", {
              message: "認証メールを送信できませんでした。時間をおいて再送してください",
              code: "EMAIL_DELIVERY_FAILED",
            });
          }
        },
      }),
      ...extraPlugins,
    ],
  });
}
export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
