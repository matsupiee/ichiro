// Stripe のカードエラーを、画面に出せる文に直す。
// 引き落としの直後と Webhook のどちらで失敗を知っても、同じ文を残す
export function cardErrorMessage(code: string | undefined, fallback: string) {
  switch (code) {
    case "authentication_required":
      return "カードの本人認証が必要なため、この報告日分の自動請求を停止しました";
    case "card_declined":
      return "カードが拒否されました";
    case "expired_card":
      return "カードの有効期限が切れています";
    case "insufficient_funds":
      return "残高が足りませんでした";
    default:
      return fallback;
  }
}
