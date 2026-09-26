import { ENV } from "../src/env";

// app.json の @stripe/stripe-react-native プラグインと同じ値にする
export const APPLE_MERCHANT_ID = "merchant.com.anonymous.ichiro";
export const STRIPE_PUBLISHABLE_KEY = ENV.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
// 本人認証（3D セキュア）などでブラウザに出たあと、アプリに戻ってくる URL
export const STRIPE_RETURN_URL = "ichiro://stripe-redirect";
