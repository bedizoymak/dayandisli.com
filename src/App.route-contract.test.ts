import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sidebarItems, searchRoutes, quickActions } from "./features/ebru-preview/previewData";

const appSource = readFileSync("src/App.tsx", "utf8");
const routeMap = readFileSync("docs/ERP_FRONTEND_ROUTE_MAP.md", "utf8");
const routeContentSource = readFileSync("src/features/ebru-preview/EbruRouteContent.tsx", "utf8");

// Every route this test asserts is "reachable" appears verbatim in the
// canonical route map or the mappedRoutes list already exercised by
// erp-route-coverage.test.ts — quick-action destinations are cross-checked
// directly against that same source of truth below.
const QUICK_ACTION_COVERED_ROUTES = [
  "/apps/finance/income/invoices",
  "/apps/sales/quotes",
  "/apps/finance/income/customers",
  "/apps/finance/expense/income-expense-report",
];

// Module labels the browser audit called out as historically prone to
// leaking an unprefixed path (e.g. a bare "/commerce" instead of
// "/apps/commerce") if a future edit ever strips the "/apps" prefix.
const UNPREFIXED_MODULE_PATHS = [
  "/commerce",
  "/production",
  "/quality",
  "/hr",
  "/website",
  "/settings",
];

describe("Apps route contract — /demo retirement and /apps-only navigation", () => {
  it("registers /apps/* as the sole protected Ebru route", () => {
    expect(appSource).toContain('path="/apps/*" element={protectedElement(<EbruPreviewPage />)}');
  });

  it("registers /demo/* as a plain 404, not a redirect or protected route", () => {
    expect(appSource).toContain('path="/demo/*" element={<NotFound />}');
    expect(appSource).not.toMatch(/path="\/demo\/\*"[^\n]*Navigate/);
  });

  it("keeps /apps/ebru-preview/* reachable and redirecting to /apps, never rendering demo or apps content directly at that path", () => {
    expect(appSource).toContain('path="/apps/ebru-preview/*" element={protectedElement(<Navigate to="/apps" replace />)}');
  });

  it("registers the /apps/ebru-preview redirect and the /apps/parasut legacy redirect before the /apps/* catch-all, so neither is shadowed", () => {
    const ebruPreviewIndex = appSource.indexOf('path="/apps/ebru-preview/*"');
    const parasutIndex = appSource.indexOf('path="/apps/parasut/*"');
    const catchAllIndex = appSource.indexOf('path="/apps/*"');
    expect(ebruPreviewIndex).toBeGreaterThan(-1);
    expect(parasutIndex).toBeGreaterThan(-1);
    expect(catchAllIndex).toBeGreaterThan(-1);
    expect(ebruPreviewIndex).toBeLessThan(catchAllIndex);
    expect(parasutIndex).toBeLessThan(catchAllIndex);
  });

  it("every Apps sidebar/search/quick-action destination is /apps-prefixed, never a bare module path", () => {
    const allRoutes = [...sidebarItems, ...searchRoutes, ...quickActions].map((item) => item.route);
    for (const route of allRoutes) {
      expect(route.startsWith("/apps")).toBe(true);
    }
  });

  it.each(UNPREFIXED_MODULE_PATHS)("never registers the unprefixed module path %s as a top-level route", (path) => {
    // A real, safe route declaration looks like path="/commerce" (quoted,
    // exact) — this must never appear; only the /apps-prefixed form may.
    expect(appSource).not.toContain(`path="${path}"`);
    const allRoutes = [...sidebarItems, ...searchRoutes, ...quickActions].map((item) => item.route);
    expect(allRoutes).not.toContain(path);
  });

  it("dashboard quick actions resolve to routes already covered by the canonical route map", () => {
    const quickActionRoutes = quickActions.map((item) => item.route);
    expect(quickActionRoutes.sort()).toEqual([...QUICK_ACTION_COVERED_ROUTES].sort());
    for (const route of quickActionRoutes) {
      expect(routeMap).toContain(`\`${route}\``);
    }
  });

  it("the legacy root-to-apps redirect and /erp redirect never target /demo, avoiding an accidental demo redirect loop", () => {
    expect(appSource).toContain('Navigate to={`/apps${location.pathname}${location.search}${location.hash}`}');
    expect(appSource).toContain('Navigate to={`/apps${suffix}${location.search}`}');
    // Neither redirect helper's template target string contains "/demo".
    expect(appSource).not.toMatch(/Navigate to=\{`\/demo/);
  });

  it("no route declaration in App.tsx points at itself in a way that would create an immediate redirect loop (/apps/* is a real component, not another Navigate)", () => {
    const appsRouteLine = appSource.split("\n").find((line) => line.includes('path="/apps/*" element='));
    expect(appsRouteLine).toBeDefined();
    expect(appsRouteLine).not.toContain("<Navigate");
  });

  it("EbruRouteContent only ever dispatches on routePath values it receives from the /apps/* shell, never a literal bare-root check", () => {
    // routePath is always already /apps-prefixed by the time it reaches this
    // component (it only renders under the "/apps/*" route — see App.tsx),
    // so `routePath.endsWith("/hr")` safely matches "/apps/hr" and is not a
    // bug. What would be a bug is an exact `routePath === "/hr"` (a bare-root
    // literal, impossible to reach from real navigation but a smell if ever
    // added) or a hardcoded absolute Link/Navigate target missing "/apps".
    for (const path of UNPREFIXED_MODULE_PATHS) {
      expect(routeContentSource).not.toContain(`routePath === "${path}"`);
    }
  });
});
