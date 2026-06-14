import type { OAuthToken, ParaşütCredentials } from "./types.ts";

const TOKEN_PATH = "/oauth/token";

function required(value: string | undefined, name: string): string {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function tokenFromPayload(payload: Record<string, unknown>, fallback?: string): OAuthToken {
  const accessToken = required(
    typeof payload.access_token === "string" ? payload.access_token : undefined,
    "OAuth access token",
  );
  const expiresIn =
    typeof payload.expires_in === "number" && payload.expires_in > 0
      ? payload.expires_in
      : 7200;

  return {
    accessToken,
    refreshToken:
      typeof payload.refresh_token === "string" ? payload.refresh_token : fallback,
    expiresAt: Date.now() + expiresIn * 1000,
  };
}

async function tokenRequest(
  baseUrl: string,
  fetchImpl: typeof fetch,
  body: URLSearchParams,
): Promise<OAuthToken> {
  const response = await fetchImpl(`${baseUrl}${TOKEN_PATH}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as Record<string, unknown>;

  if (!response.ok) {
    const code = typeof payload.error === "string" ? payload.error : "oauth_error";
    throw new Error(`Paraşüt OAuth failed with HTTP ${response.status}: ${code}`);
  }

  return tokenFromPayload(payload);
}

export async function acquireToken(
  credentials: ParaşütCredentials,
  baseUrl = "https://api.parasut.com",
  fetchImpl: typeof fetch = fetch,
): Promise<OAuthToken> {
  if (credentials.refreshToken) {
    return refreshToken(credentials, credentials.refreshToken, baseUrl, fetchImpl);
  }

  const body = new URLSearchParams({
    grant_type: "password",
    client_id: required(credentials.clientId, "PARASUT_CLIENT_ID"),
    client_secret: required(credentials.clientSecret, "PARASUT_CLIENT_SECRET"),
    username: required(credentials.username, "PARASUT_USERNAME"),
    password: required(credentials.password, "PARASUT_PASSWORD"),
    redirect_uri: credentials.redirectUri ?? "urn:ietf:wg:oauth:2.0:oob",
  });

  return tokenRequest(baseUrl, fetchImpl, body);
}

export async function refreshToken(
  credentials: ParaşütCredentials,
  currentRefreshToken: string,
  baseUrl = "https://api.parasut.com",
  fetchImpl: typeof fetch = fetch,
): Promise<OAuthToken> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: currentRefreshToken,
    client_id: required(credentials.clientId, "PARASUT_CLIENT_ID"),
    client_secret: required(credentials.clientSecret, "PARASUT_CLIENT_SECRET"),
  });

  const token = await tokenRequest(baseUrl, fetchImpl, body);
  return { ...token, refreshToken: token.refreshToken ?? currentRefreshToken };
}

export class TokenManager {
  private token: OAuthToken | null = null;
  private readonly credentials: ParaşütCredentials;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(
    credentials: ParaşütCredentials,
    baseUrl = "https://api.parasut.com",
    fetchImpl: typeof fetch = fetch,
  ) {
    this.credentials = credentials;
    this.baseUrl = baseUrl;
    this.fetchImpl = fetchImpl;
  }

  async accessToken(forceRefresh = false): Promise<string> {
    const refreshThreshold = Date.now() + 60_000;

    if (!this.token) {
      this.token = await acquireToken(this.credentials, this.baseUrl, this.fetchImpl);
    } else if (forceRefresh || this.token.expiresAt <= refreshThreshold) {
      this.token = this.token.refreshToken
        ? await refreshToken(
            this.credentials,
            this.token.refreshToken,
            this.baseUrl,
            this.fetchImpl,
          )
        : await acquireToken(this.credentials, this.baseUrl, this.fetchImpl);
    }

    return this.token.accessToken;
  }
}
