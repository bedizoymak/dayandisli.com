import { describe, expect, it } from "vitest";
import { erpApplications } from "../apps/applicationRegistry";
import { erpModules } from "@/config/erpModules";

describe("canonical ERP navigation", () => {
  it("does not register Paraşüt as a standalone application", () => {
    expect(erpApplications.map((app) => String(app.id))).not.toContain("parasut");
  });

  it("does not register the retired Ebru preview as an application", () => {
    expect(erpApplications.map((app) => String(app.id))).not.toContain("ebru-preview");
  });

  it("does not expose either retired experience in the canonical sidebar", () => {
    const routes = erpModules.map((module) => module.path);
    expect(routes.some((route) => route.startsWith("/apps/parasut"))).toBe(false);
    expect(routes.some((route) => route.startsWith("/apps/ebru-preview"))).toBe(false);
  });
});
