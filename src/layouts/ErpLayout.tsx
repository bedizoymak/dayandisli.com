import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  CircleHelp,
  Factory,
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
  Users,
  WalletCards,
  Wrench,
  X,
} from "lucide-react";
import { getInitials, resolveDisplayName, useErpIdentity } from "@/features/erp-shell/erpIdentity";
import { quickActions, searchRoutes, sidebarItems } from "@/features/erp-shell/shellNavigationData";
import { financeNavigation } from "@/features/finance/financeNavigation";
import { crmSubmenu } from "@/features/crm/crmCustomerData";
import { salesSubmenu } from "@/features/sales/salesData";
import { reportsNavigation } from "@/features/reports/reportsNavigationData";
import "@/features/crm/crm.css";
import "@/features/sales/sales.css";
import "@/features/erp-shell/erp-shell.css";

const navIcons = [Gauge, Star, WalletCards, HeartHandshake, BarChart3, ReceiptText, ShoppingCart, Factory, Wrench, Users, Globe2, Settings];

function sectionForPath(pathname: string): string | null {
  if (pathname.startsWith("/apps/finance")) return "finance";
  if (pathname.startsWith("/apps/crm")) return "crm";
  if (pathname.startsWith("/apps/sales")) return "sales";
  if (pathname.startsWith("/apps/reports")) return "reports";
  return null;
}

function financeGroupForPath(pathname: string): string | null {
  for (const group of financeNavigation) {
    if (group.pages.some((page) => page.route && pathname.startsWith(page.route))) return group.id;
  }
  return null;
}

export default function ErpLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { erpUser, roles, signOut, isLoading } = useErpIdentity();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(sectionForPath(location.pathname));
  const [expandedFinanceGroup, setExpandedFinanceGroup] = useState<string | null>(financeGroupForPath(location.pathname));
  const [now, setNow] = useState(() => new Date());
  const searchRef = useRef<HTMLInputElement>(null);
  const quickMenuRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const quickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeSection = sectionForPath(location.pathname);
  const displayName = resolveDisplayName(erpUser, isLoading);
  const roleLabel = roles[0] || "—";

  const matches = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("tr-TR");
    if (!value) return [];
    return searchRoutes.filter((item) => `${item.label} ${item.keywords || ""}`.toLocaleLowerCase("tr-TR").includes(value)).slice(0, 6);
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
        setNotificationsOpen(false);
        setCalendarOpen(false);
        setQuery("");
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!quickMenuRef.current?.contains(target)) setQuickOpen(false);
      if (!userMenuRef.current?.contains(target)) setUserMenuOpen(false);
      if (!notificationsRef.current?.contains(target)) setNotificationsOpen(false);
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
    if (quickOpen) quickTimerRef.current = setTimeout(() => setQuickOpen(false), 4_000);
    return () => {
      if (quickTimerRef.current) clearTimeout(quickTimerRef.current);
    };
  }, [quickOpen]);

  useEffect(() => {
    const section = sectionForPath(location.pathname);
    if (section) setOpenSection(section);
    const financeGroup = financeGroupForPath(location.pathname);
    if (financeGroup) setExpandedFinanceGroup(financeGroup);
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
    <div className="erp-dashboard">
      <div className={`erp-shell${collapsed ? " is-collapsed" : ""}${mobileOpen ? " mobile-open" : ""}`}>
        <aside className="erp-sidebar">
          <div className="erp-brand-row">
            <Link to="/apps" className="erp-brand" aria-label="ERP ana sayfası">
              <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Dayan Dişli" />
              <span className="erp-brand-copy">
                DAYAN<small>DİŞLİ</small>
              </span>
            </Link>
            <button className="erp-collapse" onClick={() => setCollapsed((value) => !value)} aria-label="Kenar çubuğunu daralt">
              {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </button>
          </div>
          <nav className="erp-nav" aria-label="ERP modülleri">
            {sidebarItems.map((item, index) => {
              const Icon = navIcons[index];
              if (item.label === "Muhasebe ve Finans")
                return (
                  <div className="erp-finance-module" key={item.label}>
                    <button
                      className={`erp-nav-link erp-finance-trigger${activeSection === "finance" ? " active" : ""}`}
                      onClick={() => {
                        const isOpen = openSection === "finance";
                        toggleSection("finance");
                        if (!isOpen) navigate("/apps/finance");
                        setMobileOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      <ChevronRight className="erp-chevron" style={{ transform: openSection === "finance" ? "rotate(90deg)" : undefined }} />
                    </button>
                    {openSection === "finance" && (
                      <div className="erp-finance-submenu">
                        <button
                          className={`erp-finance-overview-link${location.pathname === "/apps/finance" ? " active" : ""}`}
                          onClick={() => navigate("/apps/finance")}
                        >
                          Güncel Durum
                        </button>
                        {financeNavigation.map((group) => {
                          const isOpen = expandedFinanceGroup === group.id;
                          return (
                            <div key={group.id}>
                              <button className="erp-finance-group-trigger" onClick={() => setExpandedFinanceGroup(isOpen ? null : group.id)}>
                                <span>{group.label}</span>
                                <ChevronRight size={13} style={{ transform: isOpen ? "rotate(90deg)" : undefined }} />
                              </button>
                              {isOpen && (
                                <div className="erp-finance-pages">
                                  {group.pages.map((page) => (
                                    <button
                                      key={page.id}
                                      className={`erp-finance-page${page.route && location.pathname.startsWith(page.route) ? " active" : ""}`}
                                      onClick={() => page.route && navigate(page.route)}
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
                  <div className="erp-finance-module" key={item.label}>
                    <button
                      className={`erp-nav-link erp-finance-trigger${activeSection === "crm" ? " active" : ""}`}
                      onClick={() => {
                        toggleSection("crm");
                        setMobileOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      <ChevronRight className="erp-chevron" style={{ transform: openSection === "crm" ? "rotate(90deg)" : undefined }} />
                    </button>
                    {openSection === "crm" && (
                      <div className="erp-finance-submenu erp-crm-submenu">
                        {crmSubmenu.map((page) => (
                          <button
                            key={page.id}
                            className={`erp-finance-page${location.pathname.startsWith(page.route) ? " active" : ""}`}
                            onClick={() => navigate(page.route)}
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
                  <div className="erp-finance-module" key={item.label}>
                    <button
                      className={`erp-nav-link erp-finance-trigger${activeSection === "sales" ? " active" : ""}`}
                      onClick={() => {
                        const isOpen = openSection === "sales";
                        toggleSection("sales");
                        if (!isOpen) navigate("/apps/sales/quotes");
                        setMobileOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      <ChevronRight className="erp-chevron" style={{ transform: openSection === "sales" ? "rotate(90deg)" : undefined }} />
                    </button>
                    {openSection === "sales" && (
                      <div className="erp-finance-submenu">
                        {salesSubmenu.map((page) => (
                          <button
                            key={page.id}
                            className={`erp-finance-page${location.pathname.startsWith(page.route) ? " active" : ""}`}
                            onClick={() => navigate(page.route)}
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
                  <div className="erp-finance-module" key={item.label}>
                    <button
                      className={`erp-nav-link erp-finance-trigger${activeSection === "reports" ? " active" : ""}`}
                      onClick={() => {
                        const isOpen = openSection === "reports";
                        toggleSection("reports");
                        if (!isOpen) navigate("/apps/reports/collections");
                        setMobileOpen(false);
                      }}
                    >
                      <Icon />
                      <span>{item.label}</span>
                      <ChevronRight className="erp-chevron" style={{ transform: openSection === "reports" ? "rotate(90deg)" : undefined }} />
                    </button>
                    {openSection === "reports" && (
                      <div className="erp-finance-submenu">
                        {reportsNavigation.map((page) => (
                          <button
                            key={page.id}
                            className={`erp-finance-page${location.pathname === page.route ? " active" : ""}`}
                            onClick={() => navigate(page.route)}
                          >
                            {page.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              if (item.disabled)
                return (
                  <button
                    key={item.label}
                    type="button"
                    className="erp-nav-link erp-nav-link-disabled"
                    aria-disabled="true"
                    title="Bu modül henüz aktif değil"
                    onClick={(event) => event.preventDefault()}
                  >
                    <Icon />
                    <span>{item.label}</span>
                    <span className="erp-nav-soon-badge">Yakında</span>
                  </button>
                );
              return (
                <Link
                  key={item.label}
                  to={item.route}
                  className={`erp-nav-link${index === 0 && location.pathname === "/apps" ? " active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon />
                  <span>{item.label}</span>
                  {index > 1 && <ChevronRight className="erp-chevron" />}
                </Link>
              );
            })}
          </nav>
          <div className="erp-sidebar-bottom">
            <Link to="/" className="erp-footer-link">
              <CircleHelp />
              <span>Yardım &amp; Destek</span>
            </Link>
            <button className="erp-footer-link" onClick={logout} style={{ width: "100%", border: 0, background: "transparent" }}>
              <LogOut />
              <span>Çıkış Yap</span>
            </button>
            <div className="erp-profile">
              <span className="erp-avatar">{getInitials(displayName)}</span>
              <span className="erp-profile-copy">
                <strong>{displayName}</strong>
                <small>{roleLabel}</small>
              </span>
            </div>
          </div>
        </aside>

        <main className="erp-main">
          <header className="erp-topbar">
            <button className="erp-icon-btn" onClick={() => setMobileOpen((value) => !value)} aria-label="Menüyü aç">
              <Menu />
            </button>
            <form className="erp-search" onSubmit={submitSearch}>
              <div className="erp-search-box">
                <Search size={18} />
                <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Global arama" />
              </div>
              {query && (
                <div className="erp-search-results">
                  {matches.length ? (
                    matches.map((item) => (
                      <Link key={item.label} to={item.route} onClick={() => setQuery("")}>
                        {item.label}
                      </Link>
                    ))
                  ) : (
                    <div className="erp-empty-search">Eşleşen erişilebilir özellik bulunamadı.</div>
                  )}
                </div>
              )}
            </form>
            <div className="erp-top-actions">
              <div className="erp-quick-wrap" ref={quickMenuRef}>
                <button className="erp-action-btn" onClick={() => setQuickOpen((value) => !value)}>
                  ＋ Hızlı İşlem
                </button>
                {quickOpen && (
                  <div className="erp-popover">
                    {quickActions.map((item) => (
                      <Link key={item.label} to={item.route} onClick={() => setQuickOpen(false)}>
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
              <div className="erp-quick-wrap" ref={notificationsRef}>
                <button
                  className="erp-icon-btn"
                  onClick={() => setNotificationsOpen((value) => !value)}
                  aria-label="Bildirimler"
                  aria-expanded={notificationsOpen}
                >
                  <Bell />
                </button>
                {notificationsOpen && (
                  <div className="erp-popover erp-notifications-popover">
                    <div className="erp-empty-search">Henüz bildirim yok.</div>
                  </div>
                )}
              </div>
              <button className="erp-icon-btn" onClick={() => setCalendarOpen(true)} aria-label="Ödeme ve tahsilat takvimi">
                <CalendarDays />
              </button>
              <div className="erp-user-menu-wrap" ref={userMenuRef}>
                <button className="erp-avatar erp-topbar-avatar" onClick={() => setUserMenuOpen((value) => !value)} aria-label="Kullanıcı menüsü" aria-expanded={userMenuOpen}>
                  {getInitials(displayName)}
                </button>
                {userMenuOpen && (
                  <div className="erp-user-menu">
                    <div className="erp-user-menu-head">
                      <strong>{displayName}</strong>
                      <small>{roleLabel}</small>
                    </div>
                    <button onClick={() => setUserMenuOpen(false)}>Profil</button>
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

          <Outlet context={{ now }} />

          <footer className="erp-footer">© {now.getFullYear()} Eclipse Mühendislik. Tüm hakları saklıdır.</footer>
        </main>
      </div>

      {calendarOpen && <ErpCalendarDialog onClose={() => setCalendarOpen(false)} />}
    </div>
  );
}

function ErpCalendarDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="erp-calendar-backdrop"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section className="erp-card erp-calendar" role="dialog" aria-modal="true" aria-label="Ödeme ve tahsilat takvimi">
        <div className="erp-panel-head">
          <h2 className="erp-section-title">Ödeme ve Tahsilat Takvimi</h2>
          <button className="erp-icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="erp-calendar-grid">
          <div className="erp-empty-search">Henüz takvim kaydı yok.</div>
        </div>
      </section>
    </div>
  );
}
