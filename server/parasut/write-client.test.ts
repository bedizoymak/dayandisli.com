import { describe, expect, it, vi } from "vitest";
import { ParasutContactWriteHttpClient, ParasutWriteApiClientError } from "./write-client.ts";

function fakeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  })) as unknown as typeof fetch;
}

describe("ParasutContactWriteHttpClient.createContact", () => {
  it("POSTs to the confirmed endpoint with Bearer auth and the JSON:API body shape, and never sends data.id", async () => {
    const fetchImpl = fakeFetch(201, { data: { id: "999", type: "contacts", attributes: { name: "Test Co" } } });
    const client = new ParasutContactWriteHttpClient("token-abc", "https://api.parasut.com", fetchImpl);

    const result = await client.createContact("666034", { name: "Test Co", account_type: "customer" });

    expect(result.id).toBe("999");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.parasut.com/v4/666034/contacts");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer token-abc");
    expect(init.headers["Content-Type"]).toMatch(/json/);

    const sentBody = JSON.parse(init.body);
    expect(sentBody.data.type).toBe("contacts");
    expect(sentBody.data.attributes).toEqual({ name: "Test Co", account_type: "customer" });
    expect(sentBody.data.id).toBeUndefined();
  });

  it("never puts the access token anywhere except the Authorization header", async () => {
    const fetchImpl = fakeFetch(201, { data: { id: "1", type: "contacts", attributes: {} } });
    const client = new ParasutContactWriteHttpClient("super-secret-token", "https://api.parasut.com", fetchImpl);
    await client.createContact("666034", { name: "X", account_type: "customer" });

    const [, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.body).not.toContain("super-secret-token");
    expect(JSON.stringify(init.headers)).toContain("Bearer super-secret-token");
  });

  it("throws ParasutWriteApiClientError with the parsed error list on a 422 validation failure", async () => {
    const fetchImpl = fakeFetch(422, { errors: [{ title: "Invalid", detail: "name can't be blank" }] });
    const client = new ParasutContactWriteHttpClient("token", "https://api.parasut.com", fetchImpl);

    await expect(client.createContact("666034", { name: "", account_type: "customer" })).rejects.toMatchObject({
      httpStatus: 422,
      errors: [{ title: "Invalid", detail: "name can't be blank" }],
    });
  });

  it("throws ParasutWriteApiClientError on a 401", async () => {
    const fetchImpl = fakeFetch(401, { errors: [{ title: "Unauthorized", detail: "invalid token" }] });
    const client = new ParasutContactWriteHttpClient("bad-token", "https://api.parasut.com", fetchImpl);
    await expect(client.createContact("666034", { name: "X", account_type: "customer" })).rejects.toBeInstanceOf(ParasutWriteApiClientError);
  });

  it("throws a known-outcome error on a 429 (rate limited) — never auto-retries", async () => {
    const fetchImpl = fakeFetch(429, { errors: [{ title: "Too Many Requests", detail: "rate limit exceeded" }] });
    const client = new ParasutContactWriteHttpClient("token", "https://api.parasut.com", fetchImpl);
    await expect(client.createContact("666034", { name: "X", account_type: "customer" })).rejects.toMatchObject({ httpStatus: 429 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("throws a known-outcome error on a 500 (Paraşüt server error) — response was received, so this is NOT an unknown outcome", async () => {
    const fetchImpl = fakeFetch(500, { errors: [{ title: "Internal Server Error", detail: "" }] });
    const client = new ParasutContactWriteHttpClient("token", "https://api.parasut.com", fetchImpl);
    await expect(client.createContact("666034", { name: "X", account_type: "customer" })).rejects.toMatchObject({ httpStatus: 500 });
  });

  it("classifies a request that times out before any response as httpStatus 0 (unknown outcome), distinct from a real HTTP error", async () => {
    const fetchImpl = vi.fn(() => new Promise((_resolve, reject) => {
      setTimeout(() => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), 5);
    })) as unknown as typeof fetch;
    const client = new ParasutContactWriteHttpClient("token", "https://api.parasut.com", fetchImpl, 1);
    await expect(client.createContact("666034", { name: "X", account_type: "customer" })).rejects.toMatchObject({ httpStatus: 0 });
  });
});
