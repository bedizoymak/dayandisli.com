import { describe, expect, it } from "vitest";
import { getInitials, resolveDisplayName } from "./displayName";

describe("resolveDisplayName", () => {
  it("uses erp_users.full_name even when it differs from the auth email prefix", () => {
    const erpUser = {
      email: "info@cehadisli.com",
      full_name: "Hayrettin Dayan",
    };

    expect(resolveDisplayName(erpUser, false)).toBe("Hayrettin Dayan");
    expect(getInitials(resolveDisplayName(erpUser, false))).toBe("HD");
  });

  it("falls back to a title-cased email prefix only when full_name is missing", () => {
    const erpUser = { email: "ali.veli@example.com", full_name: null };

    expect(resolveDisplayName(erpUser, false)).toBe("Ali Veli");
  });

  it("falls back to a generic label when there is no ERP profile at all", () => {
    expect(resolveDisplayName(null, false)).toBe("Ekip Üyesi");
  });

  it("does not flash the email-derived name while the ERP profile is still loading", () => {
    const erpUser = { email: "info@cehadisli.com", full_name: "Hayrettin Dayan" };

    expect(resolveDisplayName(erpUser, true)).toBe("Yükleniyor...");
  });
});
