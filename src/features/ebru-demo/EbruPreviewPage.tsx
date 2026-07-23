import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Factory,
  FilePlus2,
  Gauge,
  Globe2,
  HeartHandshake,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  ReceiptText,
  Search,
  Settings,
  ShoppingCart,
  Star,
  Sun,
  UserRound,
  Users,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import { useDemoIdentity } from "./demoIdentity";
import {
  approvals,
  calendarEvents,
  previewMetrics,
  quickActions,
  searchRoutes,
  sidebarItems,
  systemNotifications,
  upcomingItems,
} from "./previewData";
import { FinanceOverview } from "./finance-preview/FinanceOverview";
import { financeNavigation } from "./finance-preview/financePreviewData";
import { SalesInvoiceForm } from "./finance-preview/FinanceInvoicePages";
import {
  CollectionReportPage,
  CustomerFormPage,
  CustomerListPage,
  InvoiceListPage,
} from "./finance-preview/FinanceIncomePages";
import {
  ExpenseInvoicePage,
  ExpenseListPage,
  IncomingInvoicesPage,
  SimpleExpenseForm,
} from "./finance-preview/FinanceExpensePages";
import {
  CashAccountsPage,
  CashBankReportPage,
  CashFlowReportPage,
  ChecksPage,
  IncomeExpenseReportPage,
  PaymentsReportPage,
  VatReportPage,
} from "./finance-preview/FinanceReportPages";
import {
  CheckFormPage,
  DispatchFormPage,
  DispatchesPage,
  OrderFormPage,
  OrdersPage,
  ProductFormPage,
  ProductsPage,
  StockHistoryPage,
  StockReportPage,
  SupplierFormPage,
  SuppliersPage,
} from "./finance-preview/OperationsPages";
import { CustomerListPage as CrmCustomerListPage } from "./crm-preview/CustomerListPage";
import { CustomerFormPage as CrmCustomerFormPage } from "./crm-preview/CustomerFormPage";
import { CustomerDetailPage } from "./crm-preview/CustomerDetailPage";
import { crmSubmenu } from "./crm-preview/crmCustomerData";
import "./crm-preview/crm-preview.css";
import { salesSubmenu } from "./sales-preview/salesData";
import {
  QuotesPage,
  SalesActivitiesPage,
  SalesOrdersPage,
} from "./sales-preview/SalesListPages";
import {
  QuoteDetailPage,
  QuoteFormPage,
  SalesOrderFormPage,
} from "./sales-preview/QuotePages";
import "./sales-preview/sales-preview.css";
import { QuotePrintPage } from "./sales-preview/pdf/QuotePrintPage";
import { reportsNavigation } from "./reports-preview/reportsPreviewData";
import { ProductionReportPage } from "./reports-preview/ProductionReportPage";
import "./ebru-preview.css";

const navIcons = [
  Gauge,
  Star,
  WalletCards,
  HeartHandshake,
  BarChart3,
  ReceiptText,
  ShoppingCart,
  Factory,
  Wrench,
  Users,
  Globe2,
  Settings,
];
const quickIcons = [FilePlus2, ReceiptText, UserRound, BarChart3];

function initials(value: string) {
  return (
    value
      .split(/[\s.@_-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toLocaleUpperCase("tr-TR"))
      .join("") || "DD"
  );
}

export default function EbruPreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { erpUser, roles, signOut } = useDemoIdentity();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [activeView, setActiveView] = useState<
    "dashboard" | "finance" | "crm" | "sales" | "reports"
  >("finance");
  const [openSection, setOpenSection] = useState<string | null>("finance");
  const [activeCrmPage, setActiveCrmPage] = useState("customers");
  const [activeSalesPage, setActiveSalesPage] = useState("quotes");
  const [expandedFinanceGroup, setExpandedFinanceGroup] = useState<
    string | null
  >("income");
  const [activeFinancePage, setActiveFinancePage] = useState("overview");
  const [now, setNow] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const quickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const userLabel =
    erpUser?.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Ekip Üyesi";
  const displayName = userLabel.replace(/(^|\s)\S/g, (letter) =>
    letter.toLocaleUpperCase("tr-TR"),
  );
  const roleLabel = roles[0] || "ERP Kullanıcısı";
  const istanbulParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const time = `${istanbulParts.find((part) => part.type === "hour")?.value}:${istanbulParts.find((part) => part.type === "minute")?.value}`;
  const hour = Number(
    istanbulParts.find((part) => part.type === "hour")?.value || 12,
  );
  const greeting =
    hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  const today = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  })
    .format(now)
    .replace(",", "");
  const matches = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("tr-TR");
    if (!value) return [];
    return searchRoutes
      .filter((item) =>
        `${item.label} ${item.keywords || ""}`
          .toLocaleLowerCase("tr-TR")
          .includes(value),
      )
      .slice(0, 6);
  }, [query]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setQuickOpen(false);
        setUserMenuOpen(false);
        setCalendarOpen(false);
        setQuery("");
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!quickMenuRef.current?.contains(target)) setQuickOpen(false);
      if (!userMenuRef.current?.contains(target)) setUserMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    const clockTimer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
      window.clearInterval(clockTimer);
      if (quickTimerRef.current) clearTimeout(quickTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (quickTimerRef.current) clearTimeout(quickTimerRef.current);
    if (quickOpen)
      quickTimerRef.current = setTimeout(() => setQuickOpen(false), 4_000);
    return () => {
      if (quickTimerRef.current) clearTimeout(quickTimerRef.current);
    };
  }, [quickOpen]);

  useEffect(() => {
    if (location.pathname.includes("/reports/")) {
      setActiveView("reports");
      setOpenSection("reports");
    } else if (location.pathname.includes("/sales/")) {
      setActiveView("sales");
      setOpenSection("sales");
      if (location.pathname.includes("/orders")) setActiveSalesPage("orders");
      else if (location.pathname.includes("/activities"))
        setActiveSalesPage("activities");
      else setActiveSalesPage("quotes");
    } else if (location.pathname.includes("/crm/customers")) {
      setActiveView("crm");
      setOpenSection("crm");
      setActiveCrmPage("customers");
    } else if (location.pathname.includes("/finance/income/invoices")) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("income");
      setActiveFinancePage("invoices");
    } else if (location.pathname.includes("/finance/income/customers")) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("income");
      setActiveFinancePage("customers");
    } else if (
      location.pathname.includes("/finance/income/collection-report")
    ) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("income");
      setActiveFinancePage("collections-report");
    } else if (location.pathname.includes("/finance/expense/list")) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("expenses");
      setActiveFinancePage("expense-list");
    } else if (
      location.pathname.includes("/finance/expense/income-expense-report")
    ) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("expenses");
      setActiveFinancePage("income-expense-report");
    } else if (location.pathname.includes("/finance/expense/payments-report")) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("expenses");
      setActiveFinancePage("payments-report");
    } else if (location.pathname.includes("/finance/expense/vat-report")) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("expenses");
      setActiveFinancePage("vat-report");
    } else if (location.pathname.includes("/finance/inventory/")) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("inventory");
      if (location.pathname.includes("/products"))
        setActiveFinancePage("products");
      else if (location.pathname.includes("/outgoing-dispatches"))
        setActiveFinancePage("outgoing-dispatches");
      else if (location.pathname.includes("/incoming-dispatches"))
        setActiveFinancePage("incoming-dispatches");
      else if (location.pathname.endsWith("/history"))
        setActiveFinancePage("stock-history");
      else setActiveFinancePage("stock-report");
    } else if (location.pathname.includes("/finance/purchasing/")) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("purchasing");
      setActiveFinancePage(
        location.pathname.includes("/suppliers") ? "suppliers" : "orders",
      );
    } else if (location.pathname.includes("/finance/cash/")) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("cash");
      if (location.pathname.endsWith("/accounts"))
        setActiveFinancePage("cash-accounts");
      else if (location.pathname.endsWith("/checks"))
        setActiveFinancePage("checks");
      else if (location.pathname.endsWith("/cash-bank-report"))
        setActiveFinancePage("cash-bank-report");
      else setActiveFinancePage("cash-flow");
    } else if (
      location.pathname.includes("/finance/expense/incoming-invoices")
    ) {
      setActiveView("finance");
      setOpenSection("finance");
      setExpandedFinanceGroup("expenses");
      setActiveFinancePage("incoming-invoices");
    }
  }, [location.pathname]);

  const toggleSection = (sectionId: string) => {
    setOpenSection((current) => (current === sectionId ? null : sectionId));
  };

  const logout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    if (matches[0]) navigate(matches[0].route);
  };

  return (
    <div className="ebru-dashboard">
      <div
        className={`ebru-shell${collapsed ? " is-collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}
      >
        <aside className="ebru-sidebar">
          <div className="ebru-brand-row">
            <Link
              to="/apps/demo"
              className="ebru-brand"
              aria-label="Ebru dashboard ana sayfası"
            >
              <img
                src={`${import.meta.env.BASE_URL}logo-header.png`}
                alt="Dayan Dişli"
              />
              <span className="ebru-brand-copy">
                DAYAN<small>DİŞLİ</small>
              </span>
            </Link>
            <button
              className="ebru-collapse"
              onClick={() => setCollapsed((value) => !value)}
              aria-label="Kenar çubuğunu daralt"
            >
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
          </div>
          <nav className="ebru-nav" aria-label="ERP modülleri">
            {sidebarItems.map((item, index) => {
              const Icon = navIcons[index];
              if (item.label === "Muhasebe ve Finans")
                return (
                  <div className="ebru-finance-module" key={item.label}>
                    <button
                      className={`ebru-nav-link ebru-finance-trigger${activeView === "finance" ? " active" : ""}`}
                      onClick={() => {
                        toggleSection("finance");
                        setActiveView("finance");
                        setMobileOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      <ChevronRight
                        className="ebru-chevron"
                        style={{
                          transform:
                            openSection === "finance"
                              ? "rotate(90deg)"
                              : undefined,
                        }}
                      />
                    </button>
                    {openSection === "finance" && (
                      <div className="ebru-finance-submenu">
                        <button
                          className={`ebru-finance-overview-link${activeFinancePage === "overview" ? " active" : ""}`}
                          onClick={() => {
                            setActiveFinancePage("overview");
                            setActiveView("finance");
                            navigate("/apps/demo");
                          }}
                        >
                          Güncel Durum
                        </button>
                        {financeNavigation.map((group) => {
                          const isOpen = expandedFinanceGroup === group.id;
                          return (
                            <div key={group.id}>
                              <button
                                className="ebru-finance-group-trigger"
                                onClick={() =>
                                  setExpandedFinanceGroup(
                                    isOpen ? null : group.id,
                                  )
                                }
                              >
                                <span>{group.label}</span>
                                <ChevronRight
                                  size={13}
                                  style={{
                                    transform: isOpen
                                      ? "rotate(90deg)"
                                      : undefined,
                                  }}
                                />
                              </button>
                              {isOpen && (
                                <div className="ebru-finance-pages">
                                  {group.pages.map((page) => (
                                    <button
                                      key={page.id}
                                      className={`ebru-finance-page${activeFinancePage === page.id ? " active" : ""}`}
                                      onClick={() => {
                                        setActiveFinancePage(page.id);
                                        if (page.route) navigate(page.route);
                                      }}
                                    >
                                      {page.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              if (item.label === "Müşteri İlişkileri")
                return (
                  <div className="ebru-finance-module" key={item.label}>
                    <button
                      className={`ebru-nav-link ebru-finance-trigger${activeView === "crm" ? " active" : ""}`}
                      onClick={() => {
                        toggleSection("crm");
                        setActiveView("crm");
                        setMobileOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      <ChevronRight
                        className="ebru-chevron"
                        style={{
                          transform:
                            openSection === "crm" ? "rotate(90deg)" : undefined,
                        }}
                      />
                    </button>
                    {openSection === "crm" && (
                      <div className="ebru-finance-submenu ebru-crm-submenu">
                        {crmSubmenu.map((page) => (
                          <button
                            key={page.id}
                            className={`ebru-finance-page${activeCrmPage === page.id ? " active" : ""}`}
                            onClick={() => {
                              setActiveCrmPage(page.id);
                              setActiveView(
                                page.id === "customers" ? "crm" : "dashboard",
                              );
                              navigate(page.route);
                            }}
                          >
                            {page.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              if (item.label === "Satış")
                return (
                  <div className="ebru-finance-module" key={item.label}>
                    <button
                      className={`ebru-nav-link ebru-finance-trigger${activeView === "sales" ? " active" : ""}`}
                      onClick={() => {
                        const isOpen = openSection === "sales";
                        toggleSection("sales");
                        if (!isOpen) {
                          setActiveView("sales");
                          navigate("/apps/demo/sales/quotes");
                        }
                        setMobileOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      <ChevronRight
                        className="ebru-chevron"
                        style={{
                          transform:
                            openSection === "sales"
                              ? "rotate(90deg)"
                              : undefined,
                        }}
                      />
                    </button>
                    {openSection === "sales" && (
                      <div className="ebru-finance-submenu">
                        {salesSubmenu.map((page) => (
                          <button
                            key={page.id}
                            className={`ebru-finance-page${activeSalesPage === page.id ? " active" : ""}`}
                            onClick={() => {
                              setActiveSalesPage(page.id);
                              navigate(page.route);
                            }}
                          >
                            {page.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              if (item.label === "Raporlar")
                return (
                  <div className="ebru-finance-module" key={item.label}>
                    <button
                      className={`ebru-nav-link ebru-finance-trigger${activeView === "reports" ? " active" : ""}`}
                      onClick={() => {
                        const isOpen = openSection === "reports";
                        toggleSection("reports");
                        if (!isOpen) {
                          setActiveView("reports");
                          navigate("/apps/demo/reports/collections");
                        }
                        setMobileOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      <ChevronRight
                        className="ebru-chevron"
                        style={{
                          transform:
                            openSection === "reports"
                              ? "rotate(90deg)"
                              : undefined,
                        }}
                      />
                    </button>
                    {openSection === "reports" && (
                      <div className="ebru-finance-submenu">
                        {reportsNavigation.map((page) => (
                          <button
                            key={page.id}
                            className={`ebru-finance-page${location.pathname === page.route ? " active" : ""}`}
                            onClick={() => navigate(page.route)}
                          >
                            {page.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              return (
                <Link
                  key={item.label}
                  to={item.route}
                  className={`ebru-nav-link${index === 0 && activeView === "dashboard" ? " active" : ""}`}
                  onClick={() => {
                    if (index === 0) setActiveView("dashboard");
                    setMobileOpen(false);
                  }}
                >
                  <Icon />
                  <span>{item.label}</span>
                  {index > 1 && <ChevronRight className="ebru-chevron" />}
                </Link>
              );
            })}
          </nav>
          <div className="ebru-sidebar-bottom">
            <Link to="/apps" className="ebru-footer-link">
              <CircleHelp />
              <span>Yardım &amp; Destek</span>
            </Link>
            <button
              className="ebru-footer-link"
              onClick={logout}
              style={{ width: "100%", border: 0, background: "transparent" }}
            >
              <LogOut />
              <span>Çıkış Yap</span>
            </button>
            <div className="ebru-profile">
              <span className="ebru-avatar">{initials(displayName)}</span>
              <span className="ebru-profile-copy">
                <strong>{displayName}</strong>
                <small>ERP Kullanıcısı</small>
              </span>
            </div>
          </div>
        </aside>

        <main className="ebru-main">
          <header className="ebru-topbar">
            <button
              className="ebru-icon-btn"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="Menüyü aç"
            >
              <Menu />
            </button>
            <form className="ebru-search" onSubmit={submitSearch}>
              <div className="ebru-search-box">
                <Search size={18} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Global arama... (Ctrl + K)"
                  aria-label="Global arama"
                />
              </div>
              {query && (
                <div className="ebru-search-results">
                  {matches.length ? (
                    matches.map((item) => (
                      <Link
                        key={item.label}
                        to={item.route}
                        onClick={() => setQuery("")}
                      >
                        {item.label}
                      </Link>
                    ))
                  ) : (
                    <div className="ebru-empty-search">
                      Eşleşen erişilebilir özellik bulunamadı.
                    </div>
                  )}
                </div>
              )}
            </form>
            <div className="ebru-top-actions">
              <div className="ebru-quick-wrap" ref={quickMenuRef}>
                <button
                  className="ebru-action-btn"
                  onClick={() => setQuickOpen((value) => !value)}
                >
                  ＋ Hızlı İşlem
                </button>
                {quickOpen && (
                  <div className="ebru-popover">
                    {quickActions.map((item) => (
                      <Link
                        key={item.label}
                        to={item.route}
                        onClick={() => setQuickOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <button className="ebru-icon-btn" aria-label="Bildirimler">
                <Bell />
                <span className="ebru-badge">3</span>
              </button>
              <button
                className="ebru-icon-btn"
                onClick={() => setCalendarOpen(true)}
                aria-label="Ödeme ve tahsilat takvimi"
              >
                <CalendarDays />
              </button>
              <div className="ebru-user-menu-wrap" ref={userMenuRef}>
                <button
                  className="ebru-avatar ebru-topbar-avatar"
                  onClick={() => setUserMenuOpen((value) => !value)}
                  aria-label="Kullanıcı menüsü"
                  aria-expanded={userMenuOpen}
                >
                  {initials(displayName)}
                </button>
                {userMenuOpen && (
                  <div className="ebru-user-menu">
                    <div className="ebru-user-menu-head">
                      <strong>{displayName}</strong>
                      <small>{roleLabel}</small>
                    </div>
                    <button onClick={() => setUserMenuOpen(false)}>
                      Profil
                    </button>
                    <Link to="/settings" onClick={() => setUserMenuOpen(false)}>
                      Ayarlar
                    </Link>
                    <button
                      className="danger"
                      onClick={() => {
                        setUserMenuOpen(false);
                        void logout();
                      }}
                    >
                      Çıkış Yap
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          {activeView === "reports" ? (
            location.pathname.endsWith("/reports/collections") ? (
              <CollectionReportPage />
            ) : location.pathname.endsWith("/reports/income-expense") ? (
              <IncomeExpenseReportPage />
            ) : location.pathname.endsWith("/reports/cash-bank") ? (
              <CashBankReportPage />
            ) : (
              <ProductionReportPage />
            )
          ) : activeView === "sales" ? (
            location.pathname.endsWith("/print") ? (
              <QuotePrintPage />
            ) : location.pathname.endsWith("/sales/quotes/new") ||
              location.pathname.endsWith("/edit") ? (
              <QuoteFormPage />
            ) : location.pathname.endsWith("/sales/quotes") ? (
              <QuotesPage />
            ) : location.pathname.includes("/sales/quotes/") ? (
              <QuoteDetailPage />
            ) : location.pathname.endsWith("/sales/orders/new") ? (
              <SalesOrderFormPage />
            ) : location.pathname.endsWith("/sales/orders") ? (
              <SalesOrdersPage />
            ) : (
              <SalesActivitiesPage />
            )
          ) : activeView === "crm" ? (
            location.pathname.endsWith("/crm/customers/new") ? (
              <CrmCustomerFormPage />
            ) : location.pathname.endsWith("/edit") ? (
              <CrmCustomerFormPage edit />
            ) : location.pathname.endsWith("/crm/customers") ? (
              <CrmCustomerListPage />
            ) : (
              <CustomerDetailPage />
            )
          ) : activeView === "finance" ? (
            location.pathname.endsWith("/finance/income/invoices/new") ? (
              <SalesInvoiceForm />
            ) : location.pathname.endsWith(
                "/finance/expense/list/new/invoice",
              ) ? (
              <ExpenseInvoicePage />
            ) : location.pathname.endsWith(
                "/finance/expense/list/new/payroll",
              ) ? (
              <SimpleExpenseForm type="payroll" />
            ) : location.pathname.endsWith("/finance/expense/list/new/tax") ? (
              <SimpleExpenseForm type="tax" />
            ) : location.pathname.endsWith(
                "/finance/expense/list/new/bank-expense",
              ) ? (
              <SimpleExpenseForm type="bank" />
            ) : location.pathname.endsWith(
                "/finance/expense/list/new/other",
              ) ? (
              <SimpleExpenseForm type="other" />
            ) : location.pathname.endsWith(
                "/finance/expense/list/new/accommodation",
              ) ? (
              <ExpenseInvoicePage accommodation />
            ) : location.pathname.endsWith("/finance/income/invoices") ? (
              <InvoiceListPage />
            ) : location.pathname.endsWith("/finance/income/customers/new") ? (
              <CustomerFormPage />
            ) : location.pathname.endsWith("/finance/income/customers") ? (
              <CustomerListPage />
            ) : location.pathname.endsWith(
                "/finance/income/collection-report",
              ) ? (
              <CollectionReportPage />
            ) : location.pathname.endsWith("/finance/expense/list") ? (
              <ExpenseListPage />
            ) : location.pathname.endsWith(
                "/finance/expense/incoming-invoices",
              ) ? (
              <IncomingInvoicesPage />
            ) : location.pathname.endsWith(
                "/finance/expense/income-expense-report",
              ) ? (
              <IncomeExpenseReportPage />
            ) : location.pathname.endsWith(
                "/finance/expense/payments-report",
              ) ? (
              <PaymentsReportPage />
            ) : location.pathname.endsWith("/finance/expense/vat-report") ? (
              <VatReportPage />
            ) : location.pathname.endsWith("/finance/cash/checks/new") ? (
              <CheckFormPage />
            ) : location.pathname.endsWith(
                "/finance/inventory/products/new",
              ) ? (
              <ProductFormPage />
            ) : location.pathname.endsWith("/finance/inventory/products") ? (
              <ProductsPage />
            ) : location.pathname.endsWith(
                "/finance/inventory/outgoing-dispatches/new",
              ) ? (
              <DispatchFormPage type="outgoing" />
            ) : location.pathname.endsWith(
                "/finance/inventory/outgoing-dispatches",
              ) ? (
              <DispatchesPage type="outgoing" />
            ) : location.pathname.endsWith(
                "/finance/inventory/incoming-dispatches/new",
              ) ? (
              <DispatchFormPage type="incoming" />
            ) : location.pathname.endsWith(
                "/finance/inventory/incoming-dispatches",
              ) ? (
              <DispatchesPage type="incoming" />
            ) : location.pathname.endsWith("/finance/inventory/history") ? (
              <StockHistoryPage />
            ) : location.pathname.endsWith("/finance/inventory/report") ? (
              <StockReportPage />
            ) : location.pathname.endsWith(
                "/finance/purchasing/suppliers/new",
              ) ? (
              <SupplierFormPage />
            ) : location.pathname.endsWith("/finance/purchasing/suppliers") ? (
              <SuppliersPage />
            ) : location.pathname.endsWith("/finance/purchasing/orders/new") ? (
              <OrderFormPage />
            ) : location.pathname.endsWith("/finance/purchasing/orders") ? (
              <OrdersPage />
            ) : location.pathname.endsWith("/finance/cash/accounts") ? (
              <CashAccountsPage />
            ) : location.pathname.endsWith("/finance/cash/checks") ? (
              <ChecksPage />
            ) : location.pathname.endsWith("/finance/cash/cash-bank-report") ? (
              <CashBankReportPage />
            ) : location.pathname.endsWith("/finance/cash/cash-flow-report") ? (
              <CashFlowReportPage />
            ) : (
              <FinanceOverview />
            )
          ) : (
            <div className="ebru-content">
              <section className="ebru-top-grid">
                <article
                  className={`ebru-card ebru-welcome ${hour >= 19 || hour < 6 ? "night" : "day"}`}
                >
                  <div className="ebru-welcome-content">
                    <div className="ebru-welcome-head">
                      <div>
                        <h1>
                          {greeting}, {displayName}!
                        </h1>
                        <div className="ebru-date">
                          {today} · {time}
                        </div>
                      </div>
                      <div className="ebru-weather">
                        <Sun color="#ffd33d" />
                        <div>
                          <strong>{previewMetrics.weather.temperature}</strong>
                          <small>{previewMetrics.weather.location}</small>
                        </div>
                      </div>
                    </div>
                    <div className="ebru-fx-grid">
                      {previewMetrics.exchange.map((item) => (
                        <div className="ebru-fx" key={item.label}>
                          <span>{item.label}</span>
                          <strong>{item.value}</strong>
                          <small
                            className={
                              item.trend === "up" ? "ebru-up" : "ebru-down"
                            }
                          >
                            {item.change}
                          </small>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
                <article className="ebru-card ebru-quick-panel">
                  <h2 className="ebru-section-title">Hızlı İşlemler</h2>
                  <div className="ebru-quick-grid">
                    {quickActions.map((item, index) => {
                      const Icon = quickIcons[index];
                      return (
                        <Link
                          className="ebru-quick-card"
                          to={item.route}
                          key={item.label}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </article>
              </section>

              <section className="ebru-grid ebru-kpis">
                {previewMetrics.kpis.map((item) => (
                  <article
                    className={`ebru-card ebru-kpi ${item.tone}`}
                    key={item.label}
                  >
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                    <small className={item.tone !== "green" ? "ebru-up" : ""}>
                      {item.detail}
                    </small>
                  </article>
                ))}
              </section>

              <section className="ebru-grid ebru-bottom">
                <DonutCard
                  title="Tahsilat Durumu"
                  data={previewMetrics.receivables}
                  color="blue"
                  normalLabel="Vadesi Geçmemiş"
                  overdueLabel="Gecikmiş Tahsilat"
                />
                <DonutCard
                  title="Ödeme Durumu"
                  data={previewMetrics.payables}
                  color="green"
                  normalLabel="Vadesi Geçmemiş"
                  overdueLabel="Gecikmiş Ödemeler"
                />
                <article className="ebru-card ebru-panel">
                  <div className="ebru-panel-head">
                    <h2 className="ebru-section-title">
                      Yaklaşan Ödeme ve Tahsilatlar
                    </h2>
                    <button onClick={() => setCalendarOpen(true)}>
                      Tümünü Gör
                    </button>
                  </div>
                  <div className="ebru-upcoming-list">
                    {upcomingItems.map((item) => (
                      <div className="ebru-upcoming-row" key={item.title}>
                        <div className="ebru-upcoming-date">
                          <strong>{item.day}</strong>
                          <small>{item.month}</small>
                        </div>
                        <div className="ebru-upcoming-copy">
                          <strong>{item.title}</strong>
                          <small>{item.note}</small>
                        </div>
                        <strong className={`ebru-amount ${item.kind}`}>
                          {item.amount}
                        </strong>
                      </div>
                    ))}
                  </div>
                </article>
                <div className="ebru-right-stack">
                  <article className="ebru-card ebru-panel">
                    <div className="ebru-panel-head">
                      <h2 className="ebru-section-title">Onay Bekleyenler</h2>
                      <button>Tümünü Gör</button>
                    </div>
                    <div className="ebru-approval-list">
                      {approvals.map((item) => (
                        <div className="ebru-approval" key={item.label}>
                          <span>{item.label}</span>
                          <b className="ebru-count">{item.count}</b>
                        </div>
                      ))}
                    </div>
                  </article>
                  <article className="ebru-card ebru-panel ebru-system">
                    <div className="ebru-panel-head">
                      <h2 className="ebru-section-title">
                        Sistem Bildirimleri
                      </h2>
                      <button>Tümünü Gör</button>
                    </div>
                    <div className="ebru-notification-list">
                      {systemNotifications.map((item) => (
                        <div className="ebru-notification" key={item.title}>
                          <Bell />
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.description}</p>
                          </div>
                          <time>{item.relativeTime}</time>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>
              </section>
            </div>
          )}
          <footer className="ebru-footer">
            © 2026 Eclipse Mühendislik. Tüm hakları saklıdır.
          </footer>
        </main>
      </div>

      {calendarOpen && (
        <div
          className="ebru-calendar-backdrop"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setCalendarOpen(false);
          }}
        >
          <section
            className="ebru-card ebru-calendar"
            role="dialog"
            aria-modal="true"
            aria-label="Ödeme ve tahsilat takvimi"
          >
            <div className="ebru-panel-head">
              <h2 className="ebru-section-title">Ödeme ve Tahsilat Takvimi</h2>
              <button
                className="ebru-icon-btn"
                onClick={() => setCalendarOpen(false)}
              >
                <X />
              </button>
            </div>
            <div className="ebru-calendar-grid">
              {Array.from({ length: 31 }, (_, index) => index + 1).map(
                (day) => (
                  <div className="ebru-calendar-day" key={day}>
                    <strong>{day}</strong>
                    {calendarEvents[day] && (
                      <small>{calendarEvents[day]}</small>
                    )}
                  </div>
                ),
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

type DonutData = {
  total: string;
  normal: string;
  normalPercent: number;
  overdue: string;
  overduePercent: number;
};
function DonutCard({
  title,
  data,
  color,
  normalLabel,
  overdueLabel,
}: {
  title: string;
  data: DonutData;
  color: "blue" | "green";
  normalLabel: string;
  overdueLabel: string;
}) {
  return (
    <article className="ebru-card ebru-panel ebru-chart">
      <div className="ebru-panel-head">
        <h2 className="ebru-section-title">{title}</h2>
        <span style={{ color: "#8fa2b7", fontSize: 11 }}>Bu Ay</span>
      </div>
      <div className="ebru-chart-body">
        <div
          className={`ebru-donut ${color === "green" ? "green" : ""}`}
          style={{ "--percent": data.normalPercent } as React.CSSProperties}
        >
          <div className="ebru-donut-center">
            <span>Toplam</span>
            <strong>{data.total}</strong>
          </div>
        </div>
        <div className="ebru-legend">
          <div className="ebru-legend-row">
            <i className={`ebru-dot ${color === "green" ? "green" : ""}`} />
            <div>
              <b>{normalLabel}</b>
              <small>
                {data.normal} ({data.normalPercent}%)
              </small>
            </div>
          </div>
          <div className="ebru-legend-row">
            <i className="ebru-dot red" />
            <div>
              <b>{overdueLabel}</b>
              <small>
                {data.overdue} ({data.overduePercent}%)
              </small>
            </div>
          </div>
        </div>
      </div>
      <div className="ebru-summary">
        {title === "Tahsilat Durumu" ? "Tahsilat" : "Ödeme"} oranı %
        {data.normalPercent}
      </div>
    </article>
  );
}
