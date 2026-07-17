// ParasutContactWriteClient — the ONLY code in this repository allowed to
// send a write (POST) request to api.parasut.com. Built strictly against the
// confirmed contract in PARASUT_WRITE_API_DISCOVERY_REPORT.md (Paraşüt's own
// published OpenAPI spec) — never against inferred/guessed field names.
//
// Deliberately separate from server/parasut/client.ts (the read-only
// ParaşütClient used by the GET sync engine): mixing a write method into
// that class would make every future read-path change carry write-path risk.
// This file's only job is one HTTP call shape.
export interface ParasutContactCreateAttributes {
  name: string;
  account_type: "customer" | "supplier";
  short_name?: string;
  email?: string;
  phone?: string;
  tax_number?: string;
  tax_office?: string;
  city?: string;
  district?: string;
  address?: string;
  contact_type?: "person" | "company";
}

export interface ParasutContactCreateResponse {
  id: string;
  type: "contacts";
  attributes: Record<string, unknown>;
}

export interface ParasutWriteApiError {
  title: string;
  detail: string;
}

export class ParasutWriteApiClientError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
    public readonly errors: ParasutWriteApiError[],
  ) {
    super(message);
    this.name = "ParasutWriteApiClientError";
  }
}

export interface ParasutContactWriteClient {
  createContact(companyId: string, attributes: ParasutContactCreateAttributes): Promise<ParasutContactCreateResponse>;
}

/**
 * Real HTTP implementation. GET-only rule does not apply here by design —
 * this is the one deliberate, narrowly-scoped exception, gated entirely
 * behind CustomerWriteProvider/CreateCustomerCommandHandler (see
 * ACCOUNTING_PROVIDER_ARCHITECTURE.md) — nothing else in the codebase can
 * reach this class.
 */
export class ParasutContactWriteHttpClient implements ParasutContactWriteClient {
  constructor(
    private readonly accessToken: string,
    private readonly baseUrl = "https://api.parasut.com",
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 15_000,
  ) {}

  async createContact(companyId: string, attributes: ParasutContactCreateAttributes): Promise<ParasutContactCreateResponse> {
    // Per the confirmed spec: "When creating a new record, the ID parameter
    // of the relevant record should be sent empty or not sent at all" — this
    // body intentionally has no `data.id`.
    const body = {
      data: {
        type: "contacts",
        attributes,
      },
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/v4/${encodeURIComponent(companyId)}/contacts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/vnd.api+json",
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      // A timeout/abort here means the request outcome is genuinely
      // UNKNOWN — Paraşüt may or may not have created the contact. The
      // caller (CreateCustomerCommandHandler) is responsible for treating
      // this distinctly from a confirmed failure — see its `unknown_result`
      // handling. This client never retries automatically either way.
      throw new ParasutWriteApiClientError(
        error instanceof Error && error.name === "AbortError" ? "Paraşüt contact creation timed out — outcome unknown." : "Paraşüt contact creation request failed before a response was received.",
        0,
        [],
      );
    } finally {
      clearTimeout(timeout);
    }

    const payload = (await response.json()) as { data?: ParasutContactCreateResponse; errors?: ParasutWriteApiError[] };

    if (!response.ok || !payload.data) {
      throw new ParasutWriteApiClientError(
        `Paraşüt contact creation failed with HTTP ${response.status}`,
        response.status,
        payload.errors ?? [],
      );
    }

    return payload.data;
  }
}

/** True for a response-received validation/client error (safe to show); false for 401/403 (config problem) or 0 (no response received — unknown outcome, see ParasutContactWriteHttpClient's timeout handling). */
export function isKnownOutcomeError(error: ParasutWriteApiClientError): boolean {
  return error.httpStatus !== 0;
}
