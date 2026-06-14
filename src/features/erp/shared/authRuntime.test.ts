import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const runtimeFiles = [
  "src/pages/Login.tsx",
  "src/contexts/ERPAuthContext.tsx",
  "src/components/ProtectedRoute.tsx",
  "src/features/erp/shared/erpApi.ts",
  "supabase/functions/payment-refund/index.ts",
];

describe("unified ERP user runtime authority", () => {
  it.each(runtimeFiles)("%s has no legacy authorization dependency", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/\b(admin_users|allowed_emails|is_email_allowed)\b/);
  });

  it("uses role-neutral protected-route authorization state", () => {
    const route = readFileSync("src/components/ProtectedRoute.tsx", "utf8");
    expect(route).toContain("isAuthorizedERPUser");
    expect(route).not.toContain("isActiveAdmin");
  });

  it("does not synthesize a viewer ERP profile", () => {
    const api = readFileSync("src/features/erp/shared/erpApi.ts", "utf8");
    expect(api).not.toMatch(/role:\s*"viewer"/);
    expect(api).toContain("resolveERPUserForAuthUser");
  });
});
