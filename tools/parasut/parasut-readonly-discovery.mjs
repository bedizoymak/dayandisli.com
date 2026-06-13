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

const OUTPUT_DIR = path.resolve("tools/parasut/discovery");
const BASE_URL = "https://api.parasut.com";
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

async function fetchResource(accessToken, resource) {
  const response = await fetch(`${BASE_URL}${resource.path}`, {
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
    path.join(OUTPUT_DIR, `${resource.file}.json`),
    `${JSON.stringify(output, null, 2)}\n`,
    "utf8",
  );

  return {
    name: resource.name,
    status: response.status,
    ok: response.ok,
    count: Array.isArray(payload?.data) ? payload.data.length : payload?.data ? 1 : 0,
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

const page = "?page[number]=1&page[size]=5";
const resources = [
  { name: "me", path: "/v4/me", file: "me" },
  { name: "contacts", path: `/v4/${PARASUT_COMPANY_ID}/contacts${page}`, file: "contacts" },
  { name: "products", path: `/v4/${PARASUT_COMPANY_ID}/products${page}`, file: "products" },
  { name: "sales_invoices", path: `/v4/${PARASUT_COMPANY_ID}/sales_invoices${page}`, file: "sales-invoices" },
  { name: "purchase_invoices", path: `/v4/${PARASUT_COMPANY_ID}/purchase_invoices${page}`, file: "purchase-invoices" },
  { name: "payments", path: `/v4/${PARASUT_COMPANY_ID}/payments${page}`, file: "payments" },
  { name: "accounts", path: `/v4/${PARASUT_COMPANY_ID}/accounts${page}`, file: "accounts" },
];

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const accessToken = await getToken();
const results = [];

for (const resource of resources) {
  results.push(await fetchResource(accessToken, resource));
}

await fs.writeFile(
  path.join(OUTPUT_DIR, "discovery-status.json"),
  `${JSON.stringify(
    {
      authentication: "success",
      company_id: PARASUT_COMPANY_ID,
      page_number: 1,
      page_size: 5,
      read_only: true,
      resources: results,
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log("Paraşüt read-only discovery completed. Sanitized samples were saved.");
for (const result of results) {
  console.log(`${result.name}: HTTP ${result.status}, sample count ${result.count}`);
}
