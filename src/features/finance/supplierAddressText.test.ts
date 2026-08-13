import { describe, expect, it } from "vitest";
import { supplierAddressText } from "./OperationsPages";

describe("supplierAddressText", () => {
  it("does not repeat district/city already present in the free-text address, including a Turkish I/İ casing mismatch between the two fields", () => {
    // Reproduces the real reported case: the address field spells the
    // district/city with one I-variant, the separate district field spells
    // the same words with the other — a naive locale lowercase comparison
    // fails to detect this as the same text.
    const result = supplierAddressText({
      address: "MALTEPE KIŞLA CAD. 17/B MALTEPE MAH. / ZEYTİNBURNU İSTANBUL",
      district: "MALTEPE MAH. / ZEYTİNBURNU",
      city: "İSTANBUL",
    });
    expect(result).toBe("MALTEPE KIŞLA CAD. 17/B MALTEPE MAH. / ZEYTİNBURNU İSTANBUL");
  });

  it("appends district/city when genuinely absent from the address", () => {
    const result = supplierAddressText({
      address: "ATATÜRK CAD. NO:5",
      district: "KADIKÖY",
      city: "İSTANBUL",
    });
    expect(result).toBe("ATATÜRK CAD. NO:5, KADIKÖY, İSTANBUL");
  });

  it("returns em dash when no real address fields are present", () => {
    expect(supplierAddressText({})).toBe("—");
  });

  it("still appends city when only district is already present in the address", () => {
    const result = supplierAddressText({
      address: "ATATÜRK CAD. NO:5 KADIKÖY",
      district: "KADIKÖY",
      city: "İSTANBUL",
    });
    expect(result).toBe("ATATÜRK CAD. NO:5 KADIKÖY, İSTANBUL");
  });
});
