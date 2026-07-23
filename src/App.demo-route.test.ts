import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.tsx", "utf8");
const demoSource = readFileSync("src/features/ebru-preview/EbruDemoPage.tsx", "utf8");

describe("temporary authenticated Ebru demo route", () => {
  it("registers /apps/demo before the canonical /apps wildcard", () => {
    expect(appSource.indexOf('path="/apps/demo/*"')).toBeGreaterThan(-1);
    expect(appSource.indexOf('path="/apps/demo/*"')).toBeLessThan(appSource.indexOf('path="/apps/*"'));
  });

  it("uses the same ProtectedRoute wrapper as canonical ERP routes", () => {
    expect(appSource).toContain('path="/apps/demo/*" element={protectedElement(<EbruDemoPage />)}');
  });

  it("enables demo mode only in the dedicated entrypoint", () => {
    expect(demoSource).toContain("<EbruPreviewPage demoMode />");
    expect(appSource).toContain('path="/apps/*" element={protectedElement(<EbruPreviewPage />)}');
  });

  it("does not expose the direct-only demo URL in canonical navigation", () => {
    const navigationSource = readFileSync("src/features/ebru-preview/previewData.ts", "utf8");
    expect(navigationSource).not.toContain("/apps/demo");
  });
});
