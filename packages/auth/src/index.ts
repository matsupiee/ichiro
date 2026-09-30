import { drizzleAdapter } from "@better-auth/drizzle-adapter/relations-v2";
import { expo } from "@better-auth/expo";
import type { Database } from "@ichiro/db";
import * as schema from "@ichiro/db/schema/auth";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";

export type AuthConfig = {
  BETTER_AUTH_URL: string;
  BETTER_AUTH_SECRET: string;
  CORS_ORIGIN: string;
};
export type VerificationMail = {
  email: string;
  otp: string;
  type: "email-verification" | "change-email";
};
export type SendVerificationMail = (mail: VerificationMail) => Promise<void>;

export function createAuth(env: AuthConfig, database: Database, sendMail: SendVerificationMail) {
  return betterAuth({
    database: drizzleAdapter(database, { provider: "sqlite", schema }),
    trustedOrigins: [env.CORS_ORIGIN, "ichiro://", "exp://", "http://localhost:8081"],
    emailAndPassword: { enabled: true, requireEmailVerification: true },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: false,
      autoSignInAfterVerification: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // メール確認以外の OTP ログイン・パスワード再設定は今回公開しない。
    disabledPaths: [
      "/sign-in/email-otp",
      "/email-otp/check-verification-otp",
      "/email-otp/request-password-reset",
      "/forget-password/email-otp",
      "/email-otp/reset-password",
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
      },
    },
    advanced: {
      // Cloudflare が付与する IP のみ信頼し、任意の X-Forwarded-For は使わない。
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      defaultCookieAttributes: { sameSite: "none", secure: true, httpOnly: true },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const path = ctx.path;
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
          path === "/email-otp/request-email-change"
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
      expo(),
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
        changeEmail: { enabled: true, verifyCurrentEmail: true },
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "email-verification" && type !== "change-email")
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
    ],
  });
}
export type Session = ReturnType<typeof createAuth>["$Infer"]["Session"];
