// supabase/functions/parasut-sync/index.ts

import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

serve(async (req: Request) => {
  try {
    if (req.method !== "GET") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const url = new URL(req.url);
    const code = url.searchParams.get("code");

    if (!code) {
      return new Response("Authorization code missing", { status: 400 });
    }

    const clientId = requireEnv("PARASUT_CLIENT_ID");
    const clientSecret = requireEnv("PARASUT_CLIENT_SECRET");
    const redirectUri = requireEnv("PARASUT_REDIRECT_URI");
    const companyId = requireEnv("PARASUT_COMPANY_ID");

    const tokenUrl = "https://api.parasut.com/oauth/token";

    const body = {
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    };

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Paraşüt OAuth token exchange failed", {
        status: response.status,
        error: data?.error,
        description: data?.error_description,
      });
      return new Response("OAuth token exchange failed", { status: 400 });
    }

    await saveTokenToDatabase(companyId, data);

    return new Response("Token successfully obtained & saved!", {
      status: 200,
    });

  } catch (err) {
    console.error("Internal Error:", err);
    return new Response("Internal Error", { status: 500 });
  }
});

async function saveTokenToDatabase(companyId: string, data: any) {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabase = createClient(url, key);

  const { error } = await supabase
    .from("parasut_tokens")
    .upsert({
      company_id: companyId,
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + data.expires_in * 1000,
      updated_at: new Date().toISOString()
    });

  if (error) {
    console.error("DB Error:", error);
    throw error;
  } else {
    console.log("Token saved successfully!");
  }
}
