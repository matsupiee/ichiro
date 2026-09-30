export function authErrorMessage(error: { code?: string; status?: number; message?: string }) {
  if (error.status === 429 || error.code === "OTP_SEND_LIMIT")
    return "操作が多すぎます。時間をおいてからもう一度お試しください";
  switch (error.code) {
    case "INVALID_OTP":
      return "認証コードが違います。届いた最新の6桁コードを入力してください";
    case "OTP_EXPIRED":
      return "認証コードの有効期限が切れました。再送してください";
    case "TOO_MANY_ATTEMPTS":
      return "入力回数の上限に達しました。コードを再送してください";
    case "EMAIL_DELIVERY_FAILED":
      return "認証メールを送信できませんでした。時間をおいて再送してください";
    case "EMAIL_ALREADY_VERIFIED":
      return "確認済みのメールアドレスです。ログインしてください";
    case "INVALID_EMAIL_OR_PASSWORD":
      return "メールアドレスまたはパスワードが違います";
    case "SESSION_EXPIRED":
      return "もう一度ログインしてからお試しください";
    default:
      return "操作を完了できませんでした。入力内容を確認し、もう一度お試しください";
  }
}
