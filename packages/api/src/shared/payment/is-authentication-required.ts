// Stripe の同期応答・カードエラー・Webhook のいずれでも同じ停止条件を使う。
export function isAuthenticationRequired(
  error?: { code?: string; decline_code?: string } | null,
  status?: string,
) {
  return (
    status === "requires_action" ||
    error?.code === "authentication_required" ||
    error?.decline_code === "authentication_required"
  );
}
