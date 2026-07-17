import { describe, expect, it } from "vitest";
import { ParasutContactVerifier, type MinimalParasutReadClient } from "./parasut-contact-verifier.ts";

describe("ParasutContactVerifier.verifyContact", () => {
  it("returns true when id, type, account_type, and name all match", async () => {
    const client: MinimalParasutReadClient = {
      get: async () => ({ data: { id: "999", type: "contacts", attributes: { name: "Acme", account_type: "customer" } } }),
    };
    const verifier = new ParasutContactVerifier(client);
    expect(await verifier.verifyContact("666034", "999", "Acme")).toBe(true);
  });

  it("returns false when the name does not match", async () => {
    const client: MinimalParasutReadClient = {
      get: async () => ({ data: { id: "999", type: "contacts", attributes: { name: "Different Name", account_type: "customer" } } }),
    };
    const verifier = new ParasutContactVerifier(client);
    expect(await verifier.verifyContact("666034", "999", "Acme")).toBe(false);
  });

  it("returns false when account_type is not customer", async () => {
    const client: MinimalParasutReadClient = {
      get: async () => ({ data: { id: "999", type: "contacts", attributes: { name: "Acme", account_type: "supplier" } } }),
    };
    const verifier = new ParasutContactVerifier(client);
    expect(await verifier.verifyContact("666034", "999", "Acme")).toBe(false);
  });

  it("returns false (never throws) when the GET returns no data", async () => {
    const client: MinimalParasutReadClient = { get: async () => ({ data: null }) };
    const verifier = new ParasutContactVerifier(client);
    expect(await verifier.verifyContact("666034", "999", "Acme")).toBe(false);
  });

  it("returns false (never throws) when the GET call itself throws", async () => {
    const client: MinimalParasutReadClient = { get: async () => { throw new Error("network error"); } };
    const verifier = new ParasutContactVerifier(client);
    await expect(verifier.verifyContact("666034", "999", "Acme")).resolves.toBe(false);
  });
});
