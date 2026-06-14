import { TokenManager } from "./auth.ts";
import type {
  JsonApiDocument,
  PaginatedPage,
  ParaşütClientOptions,
} from "./types.ts";

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

class NonRetryableHttpError extends Error {}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(
  response: Response | null,
  attempt: number,
  baseDelayMs: number,
): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const date = Date.parse(retryAfter);
    if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  }

  return baseDelayMs * 2 ** (attempt - 1);
}

function totalCount(meta: Record<string, unknown> | undefined): number | null {
  if (!meta) return null;
  for (const key of ["total_count", "totalCount", "count"]) {
    const value = meta[key];
    if (typeof value === "number" && value >= 0) return value;
  }
  return null;
}

export class ParaşütClient {
  private readonly tokens: TokenManager;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly maxAttempts: number;
  private readonly baseDelayMs: number;
  private readonly pageSize: number;
  private readonly maxPages: number;

  constructor(
    tokens: TokenManager,
    options: ParaşütClientOptions = {},
  ) {
    this.tokens = tokens;
    this.baseUrl = options.baseUrl ?? "https://api.parasut.com";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.maxAttempts = options.maxAttempts ?? 5;
    this.baseDelayMs = options.baseDelayMs ?? 500;
    this.pageSize = options.pageSize ?? 25;
    this.maxPages = options.maxPages ?? 10_000;
  }

  async get(path: string): Promise<JsonApiDocument> {
    let refreshed = false;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      let response: Response | null = null;
      try {
        const accessToken = await this.tokens.accessToken(refreshed);
        refreshed = false;
        response = await this.fetchImpl(`${this.baseUrl}${path}`, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (response.status === 401 && !refreshed) {
          refreshed = true;
          continue;
        }

        if (response.ok) return (await response.json()) as JsonApiDocument;

        if (!RETRYABLE_STATUS.has(response.status) || attempt === this.maxAttempts) {
          throw new NonRetryableHttpError(
            `Paraşüt GET failed with HTTP ${response.status}`,
          );
        }
      } catch (error) {
        if (error instanceof NonRetryableHttpError || attempt === this.maxAttempts) {
          throw error;
        }
      }

      await sleep(retryDelay(response, attempt, this.baseDelayMs));
    }

    throw new Error("Paraşüt GET exhausted retry attempts");
  }

  async *getPaginated(
    path: string,
    include: string[] = [],
  ): AsyncGenerator<PaginatedPage> {
    let observed = 0;

    for (let pageNumber = 1; pageNumber <= this.maxPages; pageNumber++) {
      const separator = path.includes("?") ? "&" : "?";
      const params = new URLSearchParams({
        "page[number]": String(pageNumber),
        "page[size]": String(this.pageSize),
      });
      if (include.length > 0) params.set("include", include.join(","));

      const document = await this.get(`${path}${separator}${params}`);
      const resources = Array.isArray(document.data) ? document.data : [];
      yield { pageNumber, document };

      observed += resources.length;
      const expected = totalCount(document.meta);
      if (
        resources.length === 0 ||
        resources.length < this.pageSize ||
        (expected !== null && observed >= expected)
      ) {
        return;
      }
    }

    throw new Error(`Pagination exceeded the ${this.maxPages}-page safety limit`);
  }
}
