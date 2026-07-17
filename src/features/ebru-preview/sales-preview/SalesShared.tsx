import type { ReactNode } from "react";
import { Link } from "react-router-dom";
const root = "/apps/ebru-preview/sales";
export function SalesBreadcrumb({
  section,
  current,
}: {
  section: "Teklifler" | "Siparişler" | "Satış Faaliyetleri";
  current?: string;
}) {
  const route =
    section === "Teklifler"
      ? `${root}/quotes`
      : section === "Siparişler"
        ? `${root}/orders`
        : `${root}/activities`;
  return (
    <nav className="sales-breadcrumb">
      <Link to={`${root}/quotes`}>Satış</Link>
      <span>/</span>
      {current ? (
        <>
          <Link to={route}>{section}</Link>
          <span>/</span>
          <b aria-current="page">{current}</b>
        </>
      ) : (
        <b aria-current="page">{section}</b>
      )}
    </nav>
  );
}
export function SalesHeader({
  section,
  title,
  subtitle,
  current,
  children,
}: {
  section: "Teklifler" | "Siparişler" | "Satış Faaliyetleri";
  title: string;
  subtitle?: string;
  current?: string;
  children?: ReactNode;
}) {
  return (
    <header className="sales-head">
      <div>
        <SalesBreadcrumb section={section} current={current} />
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div>{children}</div>
    </header>
  );
}
export function SalesStatus({ children }: { children: ReactNode }) {
  const value = String(children);
  return (
    <span
      className={`sales-status ${value.includes("Redded") || value.includes("Doldu") || value.includes("İptal") ? "danger" : value.includes("Kabul") || value.includes("Tamam") || value.includes("Aktarıldı") || value.includes("Dönüştürüldü") ? "success" : "info"}`}
    >
      {children}
    </span>
  );
}
