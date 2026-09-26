import { createId } from "@paralleldrive/cuid2";
import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const paymentWallets = ["apple_pay", "google_pay"] as const;
export type PaymentWallet = (typeof paymentWallets)[number];

// ユーザーが Stripe に登録した支払い方法。画面に出すためにカードの種類と下4桁を写しておく
export const paymentMethod = sqliteTable(
  "payment_method",
  {
    id: text("id")
      .$defaultFn(() => createId())
      .primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    stripePaymentMethodId: text("stripe_payment_method_id").notNull().unique(),
    // visa・mastercard・jcb など（Stripe の card.brand）
    brand: text("brand").notNull(),
    last4: text("last4").notNull(),
    // Apple Pay などのウォレット経由で登録したとき
    wallet: text("wallet", { enum: paymentWallets }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
      .notNull(),
  },
  (table) => [index("payment_method_userId_idx").on(table.userId)],
);
