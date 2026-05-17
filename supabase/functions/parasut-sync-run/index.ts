// supabase/functions/parasut-sync-run/index.ts
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

serve(async (req: Request) => {
  try {
    console.log("🚀 Sync started");

    const companyId = Deno.env.get("PARASUT_COMPANY_ID")!;
    const clientId = Deno.env.get("PARASUT_CLIENT_ID")!;
    const clientSecret = Deno.env.get("PARASUT_CLIENT_SECRET")!;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: tokens } = await supabase
      .from("parasut_tokens")
      .select("*")
      .eq("company_id", companyId)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!tokens?.length) {
      console.error("❌ No token found for company");
      return new Response("No token found", { status: 400 });
    }

    let tokenRow = tokens[0];
    const now = Date.now();

    if (!tokenRow.expires_at || now > tokenRow.expires_at - 60000) {
      console.log("🔁 Token refresh triggered");
      tokenRow = await refreshToken(companyId, clientId, clientSecret, supabase, tokenRow.refresh_token);
    }

    const token = tokenRow.access_token;

    const contactsCount = await syncContacts(companyId, token, supabase);
    const productsCount = await syncProducts(companyId, token, supabase);
    const invoicesCount = await syncSalesInvoices(companyId, token, supabase);

    console.log("🎉 Sync completed", { contactsCount, productsCount, invoicesCount });

    return new Response(JSON.stringify({ contactsCount, productsCount, invoicesCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("🔥 SYNC ERROR:", err);
    return new Response("Internal Error", { status: 500 });
  }
});

async function refreshToken(companyId: string, clientId: string, clientSecret: string, supabase: any, refreshToken: string) {
  const res = await fetch("https://api.parasut.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(json));

  await supabase.from("parasut_tokens").upsert({
    company_id: companyId,
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? refreshToken,
    expires_at: Date.now() + json.expires_in * 1000,
    updated_at: new Date()
  });

  return json;
}

// GLOBAL RATE LIMIT SAFE FETCHER
function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchAllPages(token: string, endpoint: string) {
  const results: any[] = [];
  let page = 1;
  const pageSize = 25;

  while (true) {
    const url = `${endpoint}?page[number]=${page}&page[size]=${pageSize}`;
    console.log(`📡 Fetching: ${url}`);

    let res;
    for (let attempt = 1; attempt <= 5; attempt++) {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (res.status === 429) {
        console.warn("⏳ Rate limit hit! Waiting 3s...");
        await delay(3000);
        continue;
      }
      break;
    }

    const json = await res!.json();
    if (!res!.ok) {
      console.error("❌ Fetch error", json);
      throw new Error(JSON.stringify(json));
    }

    if (!json.data?.length) break;

    results.push(...json.data);
    page++;

    if (!json.meta?.total_count || results.length >= json.meta.total_count) break;

    await delay(350);
  }
  return results;
}

// CONTACTS SYNC
async function syncContacts(companyId: string, token: string, supabase: any) {
  const items = await fetchAllPages(token, `https://api.parasut.com/v4/${companyId}/contacts`);
  if (!items.length) return 0;

  const rows = items.map((item) => {
    const a = item.attributes || {};
    return {
      parasut_id: item.id,
      name: a.name ?? a.full_name ?? "",
      email: a.email ?? null,
      phone: a.phone ?? null,
      tax_number: a.tax_number ?? null,
      updated_at: a.updated_at ? new Date(a.updated_at) : new Date(),
      raw_json: item,
    };
  });

  await supabase.from("parasut_contacts").upsert(rows);
  console.log(`👥 Synced contacts: ${rows.length}`);
  return rows.length;
}

// PRODUCTS SYNC
async function syncProducts(companyId: string, token: string, supabase: any) {
  const items = await fetchAllPages(token, `https://api.parasut.com/v4/${companyId}/products`);
  if (!items.length) return 0;

  const rows = items.map((item) => {
    const a = item.attributes || {};
    return {
      parasut_id: item.id,
      name: a.name ?? "",
      code: a.code ?? null,
      unit: a.unit ?? null,
      unit_price: a.list_price ?? null,
      currency: a.currency ?? null,
      updated_at: a.updated_at ? new Date(a.updated_at) : new Date(),
      raw_json: item,
    };
  });

  await supabase.from("parasut_products").upsert(rows);
  console.log(`📦 Synced products: ${rows.length}`);
  return rows.length;
}

// INVOICES SYNC
async function syncSalesInvoices(companyId: string, token: string, supabase: any) {
  const items = await fetchAllPages(token, `https://api.parasut.com/v4/${companyId}/sales_invoices`);
  if (!items.length) return 0;

  const rows = items.map((item) => {
    const a = item.attributes || {};
    return {
      parasut_id: item.id,
      invoice_no: a.invoice_no ?? null,
      issue_date: a.issue_date ?? null,
      net_total: a.net_total ?? null,
      gross_total: a.gross_total ?? null,
      currency: a.currency ?? null,
      updated_at: a.updated_at ? new Date(a.updated_at) : new Date(),
      raw_json: item,
    };
  });

  await supabase.from("parasut_invoices").upsert(rows);
  console.log(`🧾 Synced invoices: ${rows.length}`);
  return rows.length;
}
