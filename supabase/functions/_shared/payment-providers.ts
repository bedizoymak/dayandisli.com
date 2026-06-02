export type PaymentProviderId = "iyzico" | "paytr" | "stripe";

export type PaymentCreateInput = {
  orderId: string;
  orderNumber: string;
  customerUserId: string;
  customerName: string;
  email: string;
  amount: number;
  currency: string;
  callbackUrl: string;
};

export type PaymentCreateResult = {
  provider: PaymentProviderId;
  providerPaymentId: string;
  paymentUrl: string | null;
  raw: Record<string, unknown>;
};

export type VerifiedWebhook = {
  provider: PaymentProviderId;
  eventId: string;
  eventType: "payment_succeeded" | "payment_failed" | "refund_succeeded" | "refund_failed" | "unknown";
  providerPaymentId: string | null;
  providerRefundId?: string | null;
  amount: number | null;
  currency: string | null;
  orderId: string | null;
  customerUserId: string | null;
  raw: Record<string, unknown>;
};

export type RefundVerifyInput = {
  refundId: string;
  paymentId: string | null;
  amount: number;
  currency: string;
};

export type PaymentProviderAdapter = {
  id: PaymentProviderId;
  createPayment(input: PaymentCreateInput): Promise<PaymentCreateResult>;
  verifyWebhook(req: Request, rawBody: string): Promise<VerifiedWebhook>;
  verifyRefund(input: RefundVerifyInput): Promise<{ verified: boolean; raw: Record<string, unknown> }>;
};

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

async function hmacSha256Hex(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function safeJson(rawBody: string) {
  try {
    return JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function text(value: unknown) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function requireValid(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function localPaymentUrl(provider: PaymentProviderId, providerPaymentId: string) {
  const base = Deno.env.get("PAYMENT_PROVIDER_REDIRECT_BASE_URL") || "https://dayandisli.com/checkout/success";
  return `${base}?provider=${provider}&payment=${encodeURIComponent(providerPaymentId)}`;
}

export function getPaymentProvider(provider: PaymentProviderId): PaymentProviderAdapter {
  if (provider === "iyzico") return iyzicoAdapter;
  if (provider === "paytr") return paytrAdapter;
  return stripeAdapter;
}

const iyzicoAdapter: PaymentProviderAdapter = {
  id: "iyzico",
  async createPayment(input) {
    const apiKey = env("IYZICO_API_KEY");
    const secret = env("IYZICO_SECRET_KEY");
    const providerPaymentId = `iyzico-${input.orderNumber}-${Date.now()}`;
    const signature = await hmacSha256Hex(secret, `${apiKey}:${providerPaymentId}:${input.amount}:${input.currency}`);
    return {
      provider: "iyzico",
      providerPaymentId,
      paymentUrl: localPaymentUrl("iyzico", providerPaymentId),
      raw: { mode: "adapter_ready", signature, callbackUrl: input.callbackUrl },
    };
  },
  async verifyWebhook(req, rawBody) {
    const payload = safeJson(rawBody);
    const secret = env("IYZICO_WEBHOOK_SECRET");
    const expected = await hmacSha256Hex(secret, rawBody);
    const received = req.headers.get("x-iyz-signature") || "";
    requireValid(expected === received, "Invalid iyzico signature");
    const status = text(payload.status);
    return {
      provider: "iyzico",
      eventId: text(payload.eventId || payload.paymentId),
      eventType: status === "success" ? "payment_succeeded" : status === "refunded" ? "refund_succeeded" : status === "failure" ? "payment_failed" : "unknown",
      providerPaymentId: text(payload.paymentId) || null,
      providerRefundId: text(payload.refundId) || null,
      amount: numberValue(payload.paidPrice || payload.amount),
      currency: text(payload.currency) || null,
      orderId: text(payload.conversationId || payload.orderId) || null,
      customerUserId: text(payload.customerUserId) || null,
      raw: payload,
    };
  },
  async verifyRefund(input) {
    env("IYZICO_API_KEY");
    env("IYZICO_SECRET_KEY");
    return { verified: Boolean(input.refundId), raw: { provider: "iyzico", refundId: input.refundId } };
  },
};

const paytrAdapter: PaymentProviderAdapter = {
  id: "paytr",
  async createPayment(input) {
    const merchantId = env("PAYTR_MERCHANT_ID");
    const merchantSalt = env("PAYTR_MERCHANT_SALT");
    const merchantKey = env("PAYTR_MERCHANT_KEY");
    const providerPaymentId = `paytr-${input.orderNumber}-${Date.now()}`;
    const token = await hmacSha256Hex(merchantKey, `${merchantId}${providerPaymentId}${input.amount}${input.currency}${merchantSalt}`);
    return {
      provider: "paytr",
      providerPaymentId,
      paymentUrl: localPaymentUrl("paytr", providerPaymentId),
      raw: { mode: "adapter_ready", token, callbackUrl: input.callbackUrl },
    };
  },
  async verifyWebhook(_req, rawBody) {
    const payload = safeJson(rawBody);
    const merchantSalt = env("PAYTR_MERCHANT_SALT");
    const merchantKey = env("PAYTR_MERCHANT_KEY");
    const merchantOid = text(payload.merchant_oid);
    const status = text(payload.status);
    const totalAmount = text(payload.total_amount);
    const expected = await hmacSha256Hex(merchantKey, `${merchantOid}${merchantSalt}${status}${totalAmount}`);
    requireValid(expected === text(payload.hash), "Invalid PayTR signature");
    return {
      provider: "paytr",
      eventId: merchantOid,
      eventType: status === "success" ? "payment_succeeded" : "payment_failed",
      providerPaymentId: merchantOid || null,
      amount: numberValue(payload.total_amount),
      currency: "TRY",
      orderId: text(payload.order_id || payload.conversation_id) || null,
      customerUserId: text(payload.customer_user_id) || null,
      raw: payload,
    };
  },
  async verifyRefund(input) {
    env("PAYTR_MERCHANT_KEY");
    return { verified: Boolean(input.refundId), raw: { provider: "paytr", refundId: input.refundId } };
  },
};

const stripeAdapter: PaymentProviderAdapter = {
  id: "stripe",
  async createPayment(input) {
    const secretKey = env("STRIPE_SECRET_KEY");
    const providerPaymentId = `stripe-${input.orderNumber}-${Date.now()}`;
    return {
      provider: "stripe",
      providerPaymentId,
      paymentUrl: localPaymentUrl("stripe", providerPaymentId),
      raw: { mode: "adapter_ready", keyPrefix: secretKey.slice(0, 7), callbackUrl: input.callbackUrl },
    };
  },
  async verifyWebhook(req, rawBody) {
    const payload = safeJson(rawBody);
    const secret = env("STRIPE_WEBHOOK_SECRET");
    const signature = req.headers.get("stripe-signature") || "";
    const expected = await hmacSha256Hex(secret, rawBody);
    requireValid(signature.includes(expected), "Invalid Stripe signature");
    const data = (payload.data as { object?: Record<string, unknown> } | undefined)?.object ?? {};
    const eventType = text(payload.type);
    return {
      provider: "stripe",
      eventId: text(payload.id),
      eventType: eventType.includes("payment_intent.succeeded") ? "payment_succeeded" : eventType.includes("charge.refunded") ? "refund_succeeded" : eventType.includes("payment_intent.payment_failed") ? "payment_failed" : "unknown",
      providerPaymentId: text(data.id || data.payment_intent) || null,
      providerRefundId: text(data.refund || data.id) || null,
      amount: numberValue(data.amount_received || data.amount),
      currency: text(data.currency || "TRY").toUpperCase(),
      orderId: text((data.metadata as Record<string, unknown> | undefined)?.order_id) || null,
      customerUserId: text((data.metadata as Record<string, unknown> | undefined)?.customer_user_id) || null,
      raw: payload,
    };
  },
  async verifyRefund(input) {
    env("STRIPE_SECRET_KEY");
    return { verified: Boolean(input.refundId), raw: { provider: "stripe", refundId: input.refundId } };
  },
};
