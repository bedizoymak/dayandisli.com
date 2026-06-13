import { config } from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";

const toolEnvPath = path.resolve("tools/parasut/.env");
const rootEnvPath = path.resolve(".env");

try {
  await fs.access(toolEnvPath);
  config({ path: toolEnvPath, quiet: true });
} catch {
  config({ path: rootEnvPath, quiet: true });
}

const {
  PARASUT_CLIENT_ID,
  PARASUT_CLIENT_SECRET,
  PARASUT_USERNAME,
  PARASUT_PASSWORD,
  PARASUT_COMPANY_ID,
} = process.env;

const BASE_URL = "https://api.parasut.com";
const OUTPUT_DIR = path.resolve(
  "tools/parasut/discovery/purchase-bill-checks",
);
const SENSITIVE_KEY =
  /(email|send_to|recipient|phone|fax|tax|address|city|district|name|title|description|note|identity|iban|account_number|contact_person|website)/i;

function requireEnv(name, value) {
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
}

function maskValue(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(() => "[REDACTED]");
  if (typeof value === "object") return sanitize(value, true);
  return "[REDACTED]";
}

function sanitize(value, forceMask = false) {
  if (Array.isArray(value)) return value.map((item) => sanitize(item, forceMask));
  if (!value || typeof value !== "object") return forceMask ? maskValue(value) : value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      forceMask || SENSITIVE_KEY.test(key)
        ? maskValue(item)
        : sanitize(item, false),
    ]),
  );
}

async function parseResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
}

async function getToken() {
  const body = new URLSearchParams({
    grant_type: "password",
    client_id: PARASUT_CLIENT_ID,
    client_secret: PARASUT_CLIENT_SECRET,
    username: PARASUT_USERNAME,
    password: PARASUT_PASSWORD,
    redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
  });
  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = await parseResponse(response);
  if (!response.ok || !payload?.access_token) {
    throw new Error(`Authentication failed with HTTP ${response.status}.`);
  }
  return payload.access_token;
}

async function fetchAndSave(accessToken, check) {
  const response = await fetch(`${BASE_URL}${check.path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await parseResponse(response);
  const output = response.ok
    ? sanitize(payload)
    : {
        discovery_error: {
          status: response.status,
          status_text: response.statusText,
        },
      };

  await fs.writeFile(
    path.join(OUTPUT_DIR, `${check.file}.json`),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );

  return {
    name: check.name,
    status: response.status,
    ok: response.ok,
    count: Array.isArray(payload?.data) ? payload.data.length : payload?.data ? 1 : 0,
    included_count: Array.isArray(payload?.included) ? payload.included.length : 0,
    payload,
  };
}

for (const [name, value] of Object.entries({
  PARASUT_CLIENT_ID,
  PARASUT_CLIENT_SECRET,
  PARASUT_USERNAME,
  PARASUT_PASSWORD,
  PARASUT_COMPANY_ID,
})) {
  requireEnv(name, value);
}

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const accessToken = await getToken();
const collectionPath =
  `/v4/${PARASUT_COMPANY_ID}/purchase_bills?page[number]=1&page[size]=5`;
const collection = await fetchAndSave(accessToken, {
  name: "purchase_bills_collection",
  path: collectionPath,
  file: "purchase-bills",
});

const collectionWithSpender = await fetchAndSave(accessToken, {
  name: "purchase_bills_collection_include_spender",
  path: `${collectionPath}&include=spender`,
  file: "purchase-bills-include-spender",
});

const results = [collection, collectionWithSpender];
const purchaseBillId = collection.payload?.data?.[0]?.id;

if (purchaseBillId) {
  const detailPath =
    `/v4/${PARASUT_COMPANY_ID}/purchase_bills/${encodeURIComponent(purchaseBillId)}`;
  const detailChecks = [
    {
      name: "purchase_bill_detail",
      path: detailPath,
      file: "purchase-bill-detail",
    },
    {
      name: "purchase_bill_include_spender",
      path: `${detailPath}?include=spender`,
      file: "purchase-bill-include-spender",
    },
    {
      name: "purchase_bill_include_details",
      path: `${detailPath}?include=details`,
      file: "purchase-bill-include-details",
    },
    {
      name: "purchase_bill_include_payments",
      path: `${detailPath}?include=payments`,
      file: "purchase-bill-include-payments",
    },
    {
      name: "purchase_bill_include_all",
      path: `${detailPath}?include=spender,details,payments`,
      file: "purchase-bill-include-all",
    },
  ];

  for (const check of detailChecks) {
    results.push(await fetchAndSave(accessToken, check));
  }
}

await fs.writeFile(
  path.join(OUTPUT_DIR, "purchase-bill-check-status.json"),
  `${JSON.stringify(
    {
      authentication: "success",
      company_id: PARASUT_COMPANY_ID,
      read_only: true,
      official_collection_endpoint: "/v4/{company_id}/purchase_bills",
      documented_includes_tested: ["spender", "details", "payments"],
      checks: results.map(({ payload: _payload, ...result }) => result),
      detail_skipped: !purchaseBillId,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log("Paraşüt purchase bill discovery completed with GET requests only.");
for (const { payload: _payload, ...result } of results) {
  console.log(
    `${result.name}: HTTP ${result.status}, records ${result.count}, included ${result.included_count}`,
  );
}
