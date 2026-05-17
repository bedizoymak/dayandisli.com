// supabase/functions/send-quotation-email/index.ts
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import nodemailer from "npm:nodemailer";

const smtpUser = Deno.env.get("SMTP_USER")!;
const smtpPass = Deno.env.get("GMAIL_APP_PASSWORD")!;
const smtpHost = Deno.env.get("SMTP_HOST")!;
const smtpPort = Number(Deno.env.get("SMTP_PORT")!);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const {
      to,
      bcc,
      subject,
      html,
      pdfBase64,
      pdfFileName,
    } = body;

    const finalSubject = subject || "DAYAN Dişli - Fiyat Teklifi";
    const finalHtml =
      html || "<p>Merhaba, fiyat teklifimiz ekte PDF olarak iletilmiştir.</p>";

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const attachments = [];

    if (pdfBase64 && pdfFileName) {
      attachments.push({
        filename: pdfFileName,
        content: pdfBase64,
        encoding: "base64",
        contentType: "application/pdf",
      });
    }

    await transporter.sendMail({
      from: `"DAYAN Dişli" <${smtpUser}>`,
      to,
      bcc,
      subject: finalSubject,
      html: finalHtml,
      attachments,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("SMTP ERROR:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});