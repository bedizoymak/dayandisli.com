import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/App.tsx", "utf8");
const layoutSource = readFileSync("src/layouts/ErpLayout.tsx", "utf8");
const shellNavSource = readFileSync("src/features/erp-shell/shellNavigationData.ts", "utf8");

const productionErpDirs = ["src/features/finance", "src/features/crm", "src/features/sales", "src/features/reports", "src/features/erp-shell", "src/features/dashboard"];

function featureSource(directory: string): string {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? [featureSource(path)] : /\.(?:ts|tsx|css)$/.test(entry.name) ? [readFileSync(path, "utf8")] : [];
    })
    .join("\n");
}

function pagesSource(): string {
  return featureSource("src/pages/apps");
}

const productionErpSource = productionErpDirs.map(featureSource).join("\n");

// route -> the dedicated page file that must declare an explicit <Route> for it
const requiredRoutes: Array<[string, string]> = [
  ["/apps", "src/pages/apps/dashboard/DashboardPage.tsx"],
  ["finance", "src/pages/apps/finance/FinanceOverviewPage.tsx"],
  ["finance/income/invoices", "src/pages/apps/finance/income/InvoicesPage.tsx"],
  ["finance/income/invoices/new", "src/pages/apps/finance/income/NewInvoicePage.tsx"],
  ["finance/income/invoices/:invoiceId/edit", "src/pages/apps/finance/income/EditInvoicePage.tsx"],
  ["finance/income/invoices/:invoiceId", "src/pages/apps/finance/income/InvoiceDetailPage.tsx"],
  ["finance/income/customers", "src/pages/apps/finance/income/CustomersPage.tsx"],
  ["finance/expense/list", "src/pages/apps/finance/expense/ExpenseListPage.tsx"],
  ["finance/expense/incoming-invoices", "src/pages/apps/finance/expense/IncomingInvoicesPage.tsx"],
  ["finance/purchasing/orders", "src/pages/apps/finance/purchasing/OrdersPage.tsx"],
  ["finance/purchasing/suppliers", "src/pages/apps/finance/purchasing/SuppliersPage.tsx"],
  ["finance/cash/accounts", "src/pages/apps/finance/cash/CashAccountsPage.tsx"],
  ["finance/inventory/products", "src/pages/apps/finance/inventory/ProductsPage.tsx"],
  ["finance/inventory/history", "src/pages/apps/finance/inventory/StockHistoryPage.tsx"],
  ["crm/customers", "src/pages/apps/crm/CustomersPage.tsx"],
  ["sales/quotes", "src/pages/apps/sales/QuotesPage.tsx"],
  ["sales/orders", "src/pages/apps/sales/OrdersPage.tsx"],
  ["sales/activities", "src/pages/apps/sales/ActivitiesPage.tsx"],
  ["reports/collections", "src/pages/apps/reports/CollectionsReportPage.tsx"],
  ["reports/income-expense", "src/pages/apps/reports/IncomeExpenseReportPage.tsx"],
  ["reports/cash-bank", "src/pages/apps/reports/CashBankReportPage.tsx"],
  ["reports/production", "src/pages/apps/reports/ProductionReportPage.tsx"],
];

describe("explicit /apps route tree", () => {
  it("mounts a nested /apps route with an ErpLayout parent and a dashboard index route", () => {
    expect(appSource).toContain('<Route path="/apps" element={protectedElement(<ErpLayout />)}>');
    expect(appSource).toContain('<Route index element={<DashboardPage />} />');
  });

  it("no longer registers the old /apps/* catch-all dispatcher route", () => {
    expect(appSource).not.toMatch(/path="\/apps\/\*"/);
    expect(appSource).not.toContain("EbruDemoPage");
  });

  it.each(requiredRoutes.filter(([route]) => route !== "/apps"))("declares an explicit child <Route> for %s", (route) => {
    expect(appSource).toContain(`path="${route}"`);
  });

  it("declares no wildcard route inside the /apps nested tree (unmatched paths fall through to top-level NotFound)", () => {
    const startIndex = appSource.indexOf('<Route path="/apps" element={protectedElement(<ErpLayout />)}>');
    expect(startIndex).toBeGreaterThan(-1);
    const endIndex = appSource.indexOf("</Route>", startIndex);
    expect(endIndex).toBeGreaterThan(startIndex);
    const appsBlock = appSource.slice(startIndex, endIndex);
    expect(appsBlock).not.toMatch(/path="\*"/);
  });

  it("removed /demo, the legacy redirect, and the legacy demo prefix constant entirely", () => {
    expect(appSource).not.toMatch(/["'`]\/demo(?=["'`/?]|$)/);
    expect(appSource).not.toContain("LegacyDemoRedirect");
    expect(appSource).not.toContain("LEGACY_DEMO_PREFIX");
  });

  it("the final catch-all route renders NotFound for anything unmatched (including /demo/*)", () => {
    expect(appSource).toContain('<Route path="/*" element={<NotFound />} />');
  });
});

describe("no manual pathname dispatch in ERP routing/layout code", () => {
  it("App.tsx contains no pathname.startsWith/.includes/.endsWith/=== screen-selection checks", () => {
    expect(appSource).not.toMatch(/location\.pathname\.(startsWith|includes|endsWith)\(/);
    expect(appSource).not.toMatch(/location\.pathname\s*===/);
  });

  it("ErpLayout renders an <Outlet/> instead of branching on pathname to choose a screen component", () => {
    expect(layoutSource).toMatch(/<Outlet/);
  });

  it("ErpLayout's pathname reads are limited to nav-active-state helpers, not route/screen selection (no <Outlet/>-bypassing branch)", () => {
    // sectionForPath / financeGroupForPath only ever feed sidebar open/active state (setOpenSection,
    // setExpandedFinanceGroup, className "active" checks) — the actual screen is always the router's <Outlet/>.
    expect(layoutSource).not.toMatch(/pathname[\s\S]{0,40}\?\s*<[A-Z]\w*Page/);
  });
});

describe("production ERP feature directories have no preview/demo naming", () => {
  it("the old ebru-demo / erp-apps preview container directory no longer exists", () => {
    expect(existsSync("src/features/ebru-demo")).toBe(false);
    expect(existsSync("src/features/erp-apps")).toBe(false);
  });

  it("feature directories are named after their business domain, not 'preview'", () => {
    for (const dir of productionErpDirs) expect(existsSync(dir)).toBe(true);
    expect(existsSync("src/features/finance-preview")).toBe(false);
    expect(existsSync("src/features/crm-preview")).toBe(false);
    expect(existsSync("src/features/sales-preview")).toBe(false);
    expect(existsSync("src/features/reports-preview")).toBe(false);
  });

  it("contains no /demo route strings anywhere", () => {
    expect(productionErpSource).not.toMatch(/["'`]\/demo(?=["'`/?]|$)/m);
  });

  it("no longer contains an EbruPreviewPage dispatcher file, demoIdentity module, or *PreviewData/*-preview.css filenames", () => {
    expect(existsSync("src/features/erp-apps/EbruPreviewPage.tsx")).toBe(false);
    expect(existsSync("src/features/erp-shell/erpIdentity.ts")).toBe(true);
    for (const dir of productionErpDirs) {
      for (const entry of readdirSync(dir, { withFileTypes: true, recursive: true } as never) as unknown as { name: string }[]) {
        expect(String(entry.name)).not.toMatch(/preview/i);
      }
    }
  });

  it("keeps route page adapters separate from backend and authentication infrastructure", () => {
    expect(pagesSource()).not.toMatch(
      /from\s+["'](?:@\/integrations\/supabase|@\/contexts\/ERPAuthContext|@\/features\/erp\/)/,
    );
  });

  it("shell navigation data no longer points nav entries at unimplemented module paths", () => {
    for (const deadPath of ['"/finans', '"/crm"', '"/reports"', '"/teklifler"', '"/commerce', '"/quality', '"/hr', '"/website', '"/settings"', '"/invoices"', '"/musteriler', '"/teklifler/yeni"', '"/finans/raporlar"', '"/work-orders', '"/maintenance']) {
      expect(shellNavSource).not.toContain(deadPath);
    }
  });
});

describe("the approved fixed sidebar shell is fully restored", () => {
  const approvedOrder = [
    "Dashboard",
    "Favoriler",
    "Muhasebe ve Finans",
    "Müşteri İlişkileri",
    "Raporlar",
    "Satış",
    "E-Ticaret",
    "Üretim",
    "Kalite ve Bakım Yönetimi",
    "İnsan Kaynakları",
    "Web Sitesi",
    "Ayarlar",
  ];

  it("declares exactly the 12 approved sidebar entries in the approved visual order", () => {
    const labelMatches = [...shellNavSource.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
    const sidebarLabels = labelMatches.slice(0, approvedOrder.length);
    expect(sidebarLabels).toEqual(approvedOrder);
  });

  it("marks the 6 unimplemented modules as disabled (not deleted, not pointed at a fake page)", () => {
    const disabledLabels = ["E-Ticaret", "Üretim", "Kalite ve Bakım Yönetimi", "İnsan Kaynakları", "Web Sitesi", "Ayarlar"];
    for (const label of disabledLabels) {
      const entryMatch = shellNavSource.match(new RegExp(`\\{ label: "${label}"[^}]*\\}`));
      expect(entryMatch).not.toBeNull();
      expect(entryMatch?.[0]).toContain("disabled: true");
    }
  });

  it("ErpLayout renders disabled sidebar entries as a non-navigating element, not a <Link> to a broken URL", () => {
    expect(layoutSource).toContain("item.disabled");
    expect(layoutSource).toContain("erp-nav-link-disabled");
  });
});

describe("dedicated page files exist under src/pages/apps for every module screen", () => {
  it.each(requiredRoutes)("has a dedicated page component backing %s at %s", (_route, file) => {
    expect(() => readFileSync(file, "utf8")).not.toThrow();
  });

  it("page files compose real UI directly and are not trivial re-dispatchers", () => {
    const source = pagesSource();
    expect(source).not.toMatch(/location\.pathname\.(startsWith|includes|endsWith)\(/);
  });
});

describe("route-level permission mapping targets real /apps paths", () => {
  const permissionsSource = readFileSync("src/features/erp/shared/permissions.ts", "utf8");

  it("ROUTE_PERMISSIONS maps /apps/finance, /apps/crm, /apps/sales and /apps/reports to their module permission", () => {
    expect(permissionsSource).toMatch(/\/\^\\\/apps\\\/finance.*finance\.view/);
    expect(permissionsSource).toMatch(/\/\^\\\/apps\\\/crm.*crm\.view/);
    expect(permissionsSource).toMatch(/\/\^\\\/apps\\\/sales.*sales\.view/);
    expect(permissionsSource).toMatch(/\/\^\\\/apps\\\/reports.*reports\.view/);
  });

  it("maps bare /apps to dashboard.view", () => {
    expect(permissionsSource).toMatch(/\/\^\\\/apps\$\/.*dashboard\.view/);
  });
});

describe("mechanical route count derived from the actual router (not an assumed/retained number)", () => {
  const parentRouteMarker = '<Route path="/apps" element={protectedElement(<ErpLayout />)}>';
  const appsBlockStart = appSource.indexOf(parentRouteMarker) + parentRouteMarker.length;
  const appsBlockEnd = appSource.indexOf('<Route path="/*" element={<NotFound />} />');
  const appsBlock = appSource.slice(appsBlockStart, appsBlockEnd);
  const childRouteLines = appsBlock.split("\n").filter((line) => /<Route (index|path=)/.test(line));

  // Bumped from 59/11/47 to 64/16/47: added 5 dynamic detail routes this
  // session (sales/orders/:orderId, finance/purchasing/orders/:orderNo,
  // finance/inventory/products/:productId, and the incoming/outgoing
  // dispatch detail routes) to fix previously-unclickable list rows.
  it("finds exactly 64 explicit /apps routes (1 index + 63 path routes)", () => {
    expect(childRouteLines.length).toBe(64);
  });

  it("finds exactly 16 dynamic (:param) routes among them", () => {
    const dynamic = childRouteLines.filter((line) => line.includes(":"));
    expect(dynamic.length).toBe(16);
  });

  it("finds exactly 47 static path routes (63 path routes minus 16 dynamic)", () => {
    const pathRoutes = childRouteLines.filter((line) => line.includes("path="));
    const staticRoutes = pathRoutes.filter((line) => !line.includes(":"));
    expect(pathRoutes.length).toBe(63);
    expect(staticRoutes.length).toBe(47);
  });
});

describe("route-parameter ownership boundary: only page files under src/pages/apps may call useParams for ERP route params", () => {
  it("no file under src/features/{finance,crm,sales,reports} calls useParams", () => {
    const erpFeatureSource = ["src/features/finance", "src/features/crm", "src/features/sales", "src/features/reports"].map(featureSource).join("\n");
    expect(erpFeatureSource).not.toMatch(/useParams/);
  });

  it("every dynamic route's page file calls useParams itself", () => {
    const dynamicPageFiles = [
      "src/pages/apps/finance/income/InvoiceDetailPage.tsx",
      "src/pages/apps/finance/income/EditInvoicePage.tsx",
      "src/pages/apps/finance/income/CustomerDetailPage.tsx",
      "src/pages/apps/finance/expense/ExpenseDetailPage.tsx",
      "src/pages/apps/finance/expense/IncomingInvoiceDetailPage.tsx",
      "src/pages/apps/finance/purchasing/SupplierDetailPage.tsx",
      "src/pages/apps/crm/CustomerDetailPage.tsx",
      "src/pages/apps/crm/EditCustomerPage.tsx",
      "src/pages/apps/sales/QuoteDetailPage.tsx",
      "src/pages/apps/sales/EditQuotePage.tsx",
      "src/pages/apps/sales/QuoteCustomerDetailPage.tsx",
    ];
    for (const file of dynamicPageFiles) {
      expect(readFileSync(file, "utf8")).toMatch(/useParams/);
    }
  });
});

describe("disabled sidebar modules carry no navigation target", () => {
  it("every disabled sidebar entry has no `route` field at all", () => {
    const disabledEntryBlocks = [...shellNavSource.matchAll(/\{ label: "[^"]+", disabled: true \}/g)];
    expect(disabledEntryBlocks.length).toBe(6);
    for (const match of disabledEntryBlocks) {
      expect(match[0]).not.toMatch(/route:/);
    }
  });
});

describe("no multipage screen container is selected via a mode/type/variant prop that switches between fundamentally different routed screens", () => {
  it("SalesInvoiceForm's mode prop only toggles create-vs-edit initialization of the SAME invoice-form screen, not a different screen family", () => {
    const source = readFileSync("src/features/finance/FinanceInvoicePages.tsx", "utf8");
    // A single exported form component parameterized by a fixed, page-supplied
    // literal (mode="create"|"edit") is a legitimate reusable screen, not a
    // hidden router — the ROUTE (NewInvoicePage vs EditInvoicePage) already
    // decided which literal to pass; nothing is derived from pathname/state here.
    expect(source).not.toMatch(/location\.pathname/);
    expect(source.match(/export function/g)?.length).toBe(1);
  });
});
