import { Resend } from "resend";

export type MailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

// メールの送り先。本番は Resend、テストでは送った内容をためておくだけの実装に差しかえる
export type Mailer = {
  send(message: MailMessage): Promise<{ id: string }>;
};

export type MailerConfig = {
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
};

export const DEFAULT_MAIL_FROM = "ichiro <onboarding@resend.dev>";

export function createResendMailer(apiKey: string, from: string = DEFAULT_MAIL_FROM): Mailer {
  const resend = new Resend(apiKey);
  return {
    async send(message) {
      const { data, error } = await resend.emails.send({ from, ...message });
      if (error || !data) {
        throw new Error(`Resend: ${error?.message ?? "no response"}`);
      }
      return { id: data.id };
    },
  };
}

// API キーがない開発環境では、送る代わりにログへ出す
export function createLogMailer(log: (line: string) => void = console.log): Mailer {
  let count = 0;
  return {
    async send(message) {
      count += 1;
      log(`[mail] to=${message.to} subject=${message.subject}\n${message.text}`);
      return { id: `log-${count}` };
    },
  };
}

export function createMailer(config: MailerConfig): Mailer {
  return config.RESEND_API_KEY
    ? createResendMailer(config.RESEND_API_KEY, config.MAIL_FROM || DEFAULT_MAIL_FROM)
    : createLogMailer();
}
