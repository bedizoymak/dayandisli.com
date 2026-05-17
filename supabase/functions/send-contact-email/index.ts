// supabase/functions/send-contact-email/index.ts

import nodemailer from "npm:nodemailer";

// 🌍 SMTP ENV Values (Enterprise Setup)
const smtpUser = Deno.env.get("SMTP_USER")!;
const smtpPass = Deno.env.get("GMAIL_APP_PASSWORD")!;
const smtpHost = Deno.env.get("SMTP_HOST")!;
const smtpPort = Number(Deno.env.get("SMTP_PORT")!);

Deno.serve(async (req: Request) => {
  const allowedOrigins = [
    "https://dayandisli.com",
    "http://localhost:8080",
    "http://localhost:3000",
    "http://localhost:5173",
  ];
  const origin = req.headers.get("origin") || "";
  const corsOrigin = allowedOrigins.includes(origin)
    ? origin
    : "https://dayandisli.com";

  const corsHeaders = {
    "Access-Control-Allow-Origin": corsOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    const { name, email, phone, company, message, token } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "reCAPTCHA token missing" }),
        { status: 400, headers: corsHeaders }
      );
    }

    const secret = Deno.env.get("RECAPTCHA_SECRET_KEY")!;
    const verifyRes = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        body: new URLSearchParams({
          secret,
          response: token,
        }),
      }
    );

    const verifyData = await verifyRes.json();
    if (!verifyData.success) {
      return new Response(
        JSON.stringify({ error: "reCAPTCHA doğrulanamadı." }),
        { status: 400, headers: corsHeaders }
      );
    }

    // 🚀 Gmail SMTP Transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    // 📥 Admin'e mesaj bildirimi
    await transporter.sendMail({
      from: `"DAYAN Dişli" <${smtpUser}>`,
      to: smtpUser,
      subject: "Yeni İletişim Formu - dayandisli.com",
      html: `
        <h2>Yeni İletişim Formu</h2>
        <p><strong>İsim:</strong> ${name}</p>
        <p><strong>E-posta:</strong> ${email}</p>
        <p><strong>Telefon:</strong> ${phone}</p>
        <p><strong>Firma:</strong> ${company || "-"}</p>
        <p><strong>Mesaj:</strong><br>${message.replace(/\n/g, "<br>")}</p>
      `,
    });

    // 📤 Kullanıcıya otomatik cevap
    await transporter.sendMail({
      from: `"DAYAN Dişli" <${smtpUser}>`,
      to: email,
      subject: "Formunuz bize ulaştı - DAYAN Dişli",
      html: `
        <p>Merhaba ${name},</p>
        <p>Mesajınız başarıyla elimize ulaştı.</p>
        <p>En kısa sürede sizinle iletişime geçeceğiz.</p>
      `,
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("SMTP ERROR:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: corsHeaders }
    );
  }
});