import 'dotenv/config';
import fs from 'node:fs/promises';

const {
  PARASUT_CLIENT_ID,
  PARASUT_CLIENT_SECRET,
  PARASUT_USERNAME,
  PARASUT_PASSWORD,
  PARASUT_COMPANY_ID,
} = process.env;

function required(name, value) {
  if (!value) throw new Error(`Missing env: ${name}`);
}

required('PARASUT_CLIENT_ID', PARASUT_CLIENT_ID);
required('PARASUT_CLIENT_SECRET', PARASUT_CLIENT_SECRET);
required('PARASUT_USERNAME', PARASUT_USERNAME);
required('PARASUT_PASSWORD', PARASUT_PASSWORD);
required('PARASUT_COMPANY_ID', PARASUT_COMPANY_ID);

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();

  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    console.error('HTTP ERROR:', response.status, response.statusText);
    console.error(body);
    throw new Error(`Request failed: ${url}`);
  }

  return body;
}

async function getToken() {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: PARASUT_CLIENT_ID,
    client_secret: PARASUT_CLIENT_SECRET,
    username: PARASUT_USERNAME,
    password: PARASUT_PASSWORD,
    redirect_uri: 'urn:ietf:wg:oauth:2.0:oob',
  });

  return requestJson('https://api.parasut.com/oauth/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
}

async function main() {
  console.log('Starting Paraşüt smoke test...');

  const token = await getToken();
  console.log('TOKEN OK');

  const accessToken = token.access_token;

  const me = await requestJson('https://api.parasut.com/v4/me', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  console.log('ME OK');

  const contactsUrl =
    `https://api.parasut.com/v4/${PARASUT_COMPANY_ID}/contacts?page[number]=1&page[size]=5`;

  const contacts = await requestJson(contactsUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  console.log('CONTACTS FETCH OK');
  console.log(`COMPANY ID: ${PARASUT_COMPANY_ID}`);
  console.log(`CONTACT COUNT IN RESPONSE: ${contacts.data?.length ?? 0}`);

  const preview = (contacts.data ?? []).map((item) => ({
    id: item.id,
    type: item.type,
    name: item.attributes?.name,
    company_type: item.attributes?.company_type,
    tax_number: item.attributes?.tax_number,
    tax_office: item.attributes?.tax_office,
    email: item.attributes?.email,
    phone: item.attributes?.phone,
    city: item.attributes?.city,
    district: item.attributes?.district,
  }));

  console.table(preview);

  await fs.writeFile(
    'tools/parasut/parasut-contacts-preview.json',
    JSON.stringify(contacts, null, 2),
    'utf8'
  );

  console.log('Saved: tools/parasut/parasut-contacts-preview.json');
}

main().catch((error) => {
  console.error('SMOKE TEST FAILED');
  console.error(error);
  process.exit(1);
});