// supabase/functions/send-quotation-email/index.ts
//
// PHASE 1C security remediation. This function previously accepted an
// unauthenticated POST (CORS *) with arbitrary recipients, arbitrary HTML
// and arbitrary attachments — an open SMTP relay for this domain's mail
// reputation. Sending a quotation is an authenticated ERP action, so it now
// requires ALL of:
//   1. gateway JWT verification (verify_jwt = true in config.toml),
//   2. an active erp_users row for the caller (a bare JWT from any shop
//      customer account is NOT sufficient — see resolveErpUser),
//   3. same-origin allowlist as the contact form,
//   4. strict payload validation + attachment limits (validation.ts),
//   5. per-user rate limiting,
//   6. audit logging of every send attempt.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import nodemailer from "npm:nodemailer";
import { checkRateLimit, validateQuotationEmailRequest } from "./validation.ts";

const smtpUser = Deno.env.get("SMTP_USER")!;
const smtpPass = Deno.env.get("GMAIL_APP_PASSWORD")!;
const smtpHost = Deno.env.get("SMTP_HOST")!;
const smtpPort = Number(Deno.env.get("SMTP_PORT")!);

const allowedOrigins = [
  "https://dayandisli.com",
  "https://erp.dayandisli.com",
  "http://localhost:8080",
  "http://localhost:3000",
  "http://localhost:5173",
];

function corsFor(origin: string) {
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "https://dayandisli.com",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

/** Per-isolate rolling rate-limit buckets, keyed by auth user id. */
const sendBuckets = new Map<string, number[]>();

function logAudit(entry: Record<string, unknown>): void {
  // Single structured line per attempt — enough to detect abuse patterns in
  // edge logs without ever dumping message bodies or full recipient lists.
  console.log(JSON.stringify({ fn: "send-quotation-email", ...entry }));
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin") || "";
  const corsHeaders = corsFor(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: corsHeaders });
  }

  try {
    // --- Authorization: gateway JWT + active ERP user -------------------
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !anonKey) {
      logAudit({ outcome: "misconfigured", reason: "missing_supabase_env" });
      return new Response(JSON.stringify({ error: "Sunucu yapılandırması eksik." }), { status: 500, headers: corsHeaders });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace("Bearer ", "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "Yetkilendirme gerekli." }), { status: 401, headers: corsHeaders });
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser(token);
    const user = userData?.user;
    if (!user?.email) {
      logAudit({ outcome: "rejected", reason: "invalid_jwt" });
      return new Response(JSON.stringify({ error: "Geçersiz oturum." }), { status: 401, headers: corsHeaders });
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: erpUserRows } = await admin
      .from("erp_users")
      .select("id")
      .eq("is_active", true)
      .or(`auth_user_id.eq.${user.id},email.ilike.${user.email.replace(/[%_(),]/g, "")}`)
      .limit(1);
    const erpUser = Array.isArray(erpUserRows) && erpUserRows.length > 0 ? erpUserRows[0] : null;
    if (!erpUser) {
      logAudit({ outcome: "rejected", reason: "not_erp_user", userId: user.id });
      return new Response(JSON.stringify({ error: "Bu işlem için ERP yetkisi gerekli." }), { status: 403, headers: corsHeaders });
    }

    if (!checkRateLimit(sendBuckets, user.id, Date.now())) {
      logAudit({ outcome: "rejected", reason: "rate_limited", userId: user.id });
      return new Response(JSON.stringify({ error: "Çok fazla gönderim denemesi. Lütfen birkaç dakika sonra tekrar deneyin." }), { status: 429, headers: corsHeaders });
    }

    // --- Payload validation ---------------------------------------------
    const body = await req.json().catch(() => null);
    const validated = validateQuotationEmailRequest(body);
    if (!validated.ok) {
      logAudit({ outcome: "rejected", reason: "validation_failed", detail: validated.reason.slice(0, 120), userId: user.id });
      return new Response(JSON.stringify({ error: validated.reason }), { status: 400, headers: corsHeaders });
    }
    const { to, bcc, subject, html, attachment } = validated.value;

    // --- Send ------------------------------------------------------------
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    await transporter.sendMail({
      from: `"DAYAN Dişli" <${smtpUser}>`,
      to,
      bcc: bcc.length > 0 ? bcc : undefined,
      subject,
      html,
      attachments: attachment
        ? [{ filename: attachment.filename, content: attachment.contentBase64, encoding: "base64", contentType: "application/pdf" }]
        : [],
    });

    logAudit({
      outcome: "sent",
      userId: user.id,
      recipients: to.length,
      bccRecipients: bcc.length,
      hasAttachment: Boolean(attachment),
      attachmentBytes: attachment ? Math.floor((attachment.contentBase64.length * 3) / 4) : 0,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("SMTP ERROR:", error instanceof Error ? error.message : error);
    return new Response(
      JSON.stringify({ error: "E-posta gönderilemedi." }),
      { status: 500, headers: corsHeaders },
    );
  }
});
