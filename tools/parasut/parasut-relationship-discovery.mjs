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
const DISCOVERY_DIR = path.resolve("tools/parasut/discovery");
const OUTPUT_DIR = path.join(DISCOVERY_DIR, "relationship-checks");
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
    included_count: Array.isArray(payload?.included) ? payload.included.length : 0,
    relationship_names: Object.keys(payload?.data?.relationships ?? {}).sort(),
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

const contacts = JSON.parse(
  await fs.readFile(path.join(DISCOVERY_DIR, "contacts.json"), "utf8"),
);
const salesInvoices = JSON.parse(
  await fs.readFile(path.join(DISCOVERY_DIR, "sales-invoices.json"), "utf8"),
);
const contactId = contacts.data?.[0]?.id;
const salesInvoiceId = salesInvoices.data?.[0]?.id;

if (!contactId || !salesInvoiceId) {
  throw new Error("Previous sanitized samples do not contain usable resource IDs.");
}

const invoicePath =
  `/v4/${PARASUT_COMPANY_ID}/sales_invoices/${encodeURIComponent(salesInvoiceId)}`;
const checks = [
  {
    name: "contact_detail",
    path: `/v4/${PARASUT_COMPANY_ID}/contacts/${encodeURIComponent(contactId)}`,
    file: "contact-detail",
  },
  {
    name: "sales_invoice_detail",
    path: invoicePath,
    file: "sales-invoice-detail",
  },
  {
    name: "sales_invoice_include_contact",
    path: `${invoicePath}?include=contact`,
    file: "sales-invoice-include-contact",
  },
  {
    name: "sales_invoice_include_details",
    path: `${invoicePath}?include=details`,
    file: "sales-invoice-include-details",
  },
  {
    name: "sales_invoice_include_payments",
    path: `${invoicePath}?include=payments`,
    file: "sales-invoice-include-payments",
  },
  {
    name: "sales_invoice_include_all",
    path: `${invoicePath}?include=contact,details,payments`,
    file: "sales-invoice-include-all",
  },
];

await fs.mkdir(OUTPUT_DIR, { recursive: true });
const accessToken = await getToken();
const results = [];

for (const check of checks) {
  results.push(await fetchAndSave(accessToken, check));
}

const localFiles = (await fs.readdir(DISCOVERY_DIR))
  .filter((file) => file.endsWith(".json") || file.endsWith(".md"));
const purchaseTerms = new Set();
const purchasePattern =
  /\b(?:purchase|purchases|purchase_invoice|purchase_invoices|purchase_bill|purchase_bills|supplier_invoice|supplier_invoices|purchase_invoice_details)\b/gi;

for (const file of localFiles) {
  const text = await fs.readFile(path.join(DISCOVERY_DIR, file), "utf8");
  for (const match of text.matchAll(purchasePattern)) {
    purchaseTerms.add(match[0].toLowerCase());
  }
}

await fs.writeFile(
  path.join(OUTPUT_DIR, "relationship-check-status.json"),
  `${JSON.stringify(
    {
      authentication: "success",
      company_id: PARASUT_COMPANY_ID,
      read_only: true,
      source_ids: "selected from prior sanitized samples",
      checks: results,
      local_purchase_terms: [...purchaseTerms].sort(),
    },
    null,
    2,
  )}\n`,
  "utf8",
);

console.log("Paraşüt relationship discovery completed with GET requests only.");
for (const result of results) {
  console.log(
    `${result.name}: HTTP ${result.status}, included resources ${result.included_count}`,
  );
}
