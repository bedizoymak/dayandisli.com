import type { ReactNode } from "react";
import { Link } from "react-router-dom";
const root = "/apps/ebru-preview/crm/customers";
export function CrmBreadcrumb({ current }: { current?: string }) {
  return (
    <nav className="crm-breadcrumb" aria-label="Sayfa yolu">
      <Link to={root}>Müşteri İlişkileri</Link>
      <span>/</span>
      {current ? (
        <>
          <Link to={root}>Müşteriler</Link>
          <span>/</span>
          <b aria-current="page">{current}</b>
        </>
      ) : (
        <b aria-current="page">Müşteriler</b>
      )}
    </nav>
  );
}
export function CrmPageHeader({
  title,
  subtitle,
  current,
  children,
}: {
  title: string;
  subtitle?: string;
  current?: string;
  children?: ReactNode;
}) {
  return (
    <header className="crm-page-header">
      <div>
        <CrmBreadcrumb current={current} />
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="crm-head-actions">{children}</div>}
    </header>
  );
}
export function StatusBadge({ children }: { children: ReactNode }) {
  const value = String(children);
  return (
    <span
      className={`crm-status ${value.includes("Gecik") || value.includes("Redded") || value.includes("Doldu") ? "danger" : value.includes("Gerçek") || value.includes("Kabul") || value.includes("Ödendi") || value.includes("Kapandı") ? "success" : "info"}`}
    >
      {children}
    </span>
  );
}
