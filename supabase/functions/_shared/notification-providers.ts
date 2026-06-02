import nodemailer from "npm:nodemailer";

export type NotificationEventType = "order_confirmation" | "payment_confirmation" | "refund_update" | "shipment_update";

export type NotificationPayload = {
  to: string;
  subject: string;
  html: string;
  eventType: NotificationEventType;
};

export type NotificationProvider = {
  id: "smtp";
  send(payload: NotificationPayload): Promise<{ providerMessageId: string | null }>;
};

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function getNotificationProvider(): NotificationProvider {
  return {
    id: "smtp",
    async send(payload) {
      const smtpUser = requireEnv("SMTP_USER");
      const smtpPass = requireEnv("GMAIL_APP_PASSWORD");
      const smtpHost = requireEnv("SMTP_HOST");
      const smtpPort = Number(requireEnv("SMTP_PORT"));

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      const result = await transporter.sendMail({
        from: `"DAYAN Dişli" <${smtpUser}>`,
        to: payload.to,
        subject: payload.subject,
        html: payload.html,
      });

      return { providerMessageId: result.messageId ?? null };
    },
  };
}
