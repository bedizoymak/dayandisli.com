import { describe, expect, it } from "vitest";
import { erpModules, visibleErpModules } from "./erpModules";

describe("unified ERP sidebar navigation", () => {
  it("covers every real business module with a visible sidebar entry", () => {
    const expectedPaths = [
      "/dashboard",
      "/musteriler",
      "/tedarikciler",
      "/teklifler",
      "/siparisler",
      "/finans",
      "/production",
      "/inventory",
      "/purchasing",
      "/quality",
      "/maintenance",
      "/hr",
      "/website",
      "/commerce",
      "/reports",
      "/documents",
      "/ayarlar",
    ];

    const visiblePaths = visibleErpModules.map((module) => module.path);
    for (const path of expectedPaths) {
      expect(visiblePaths).toContain(path);
    }
  });

  it("never exposes the standalone Ebru preview route as a normal sidebar module", () => {
    const paths = erpModules.map((module) => module.path);
    expect(paths.some((path) => path.includes("ebru-preview"))).toBe(false);
  });

  it("has no duplicate module paths in the sidebar", () => {
    const paths = visibleErpModules.map((module) => module.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
