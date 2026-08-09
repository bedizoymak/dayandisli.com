import { useState } from "react";
import { Bell, FilePlus2, ReceiptText, Sun, UserRound, BarChart3 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { approvals, calendarEvents, previewMetrics, upcomingItems, systemNotifications } from "@/features/dashboard/dashboardData";
import { quickActions } from "@/features/erp-shell/shellNavigationData";
import { useErpIdentity } from "@/features/erp-shell/erpIdentity";

const quickIcons = [FilePlus2, ReceiptText, UserRound, BarChart3];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { erpUser } = useErpIdentity();
  const [now] = useState(() => new Date());
  const istanbulParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const time = `${istanbulParts.find((part) => part.type === "hour")?.value}:${istanbulParts.find((part) => part.type === "minute")?.value}`;
  const hour = Number(istanbulParts.find((part) => part.type === "hour")?.value || 12);
  const greeting = hour < 12 ? "Günaydın" : hour < 18 ? "İyi günler" : "İyi akşamlar";
  const today = new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    day: "numeric",
    month: "long",
    year: "numeric",
    weekday: "long",
  })
    .format(now)
    .replace(",", "");
  const userLabel = erpUser?.email?.split("@")[0]?.replace(/[._-]+/g, " ") || "Ekip Üyesi";
  const displayName = userLabel.replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("tr-TR"));

  return (
    <div className="erp-content">
      <section className="erp-top-grid">
        <article className={`erp-card erp-welcome ${hour >= 19 || hour < 6 ? "night" : "day"}`}>
          <div className="erp-welcome-content">
            <div className="erp-welcome-head">
              <div>
                <h1>
                  {greeting}, {displayName}!
                </h1>
                <div className="erp-date">
                  {today} · {time}
                </div>
              </div>
              <div className="erp-weather">
                <Sun color="#ffd33d" />
                <div>
                  <strong>{previewMetrics.weather.temperature}</strong>
                  <small>{previewMetrics.weather.location}</small>
                </div>
              </div>
            </div>
            <div className="erp-fx-grid">
              {previewMetrics.exchange.map((item) => (
                <div className="erp-fx" key={item.label}>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  <small className={item.trend === "up" ? "erp-up" : "erp-down"}>{item.change}</small>
                </div>
              ))}
            </div>
          </div>
        </article>
        <article className="erp-card erp-quick-panel">
          <h2 className="erp-section-title">Hızlı İşlemler</h2>
          <div className="erp-quick-grid">
            {quickActions.map((item, index) => {
              const Icon = quickIcons[index];
              return (
                <Link className="erp-quick-card" to={item.route} key={item.label}>
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </article>
      </section>

      <section className="erp-grid erp-kpis">
        {previewMetrics.kpis.map((item) => (
          <article className={`erp-card erp-kpi ${item.tone}`} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small className={item.tone !== "green" ? "erp-up" : ""}>{item.detail}</small>
          </article>
        ))}
      </section>

      <section className="erp-grid erp-bottom">
        <DonutCard title="Tahsilat Durumu" data={previewMetrics.receivables} color="blue" normalLabel="Vadesi Geçmemiş" overdueLabel="Gecikmiş Tahsilat" />
        <DonutCard title="Ödeme Durumu" data={previewMetrics.payables} color="green" normalLabel="Vadesi Geçmemiş" overdueLabel="Gecikmiş Ödemeler" />
        <article className="erp-card erp-panel">
          <div className="erp-panel-head">
            <h2 className="erp-section-title">Yaklaşan Ödeme ve Tahsilatlar</h2>
            <button type="button" onClick={() => navigate("/apps/finance/income/collection-report")}>
              Tümünü Gör
            </button>
          </div>
          <div className="erp-upcoming-list">
            {upcomingItems.map((item) => (
              <div className="erp-upcoming-row" key={item.title}>
                <div className="erp-upcoming-date">
                  <strong>{item.day}</strong>
                  <small>{item.month}</small>
                </div>
                <div className="erp-upcoming-copy">
                  <strong>{item.title}</strong>
                  <small>{item.note}</small>
                </div>
                <strong className={`erp-amount ${item.kind}`}>{item.amount}</strong>
              </div>
            ))}
          </div>
        </article>
        <div className="erp-right-stack">
          <article className="erp-card erp-panel">
            <div className="erp-panel-head">
              <h2 className="erp-section-title">Onay Bekleyenler</h2>
              <button type="button" disabled title="Onay merkezi henüz aktif değil">
                Tümünü Gör
              </button>
            </div>
            <div className="erp-approval-list">
              {approvals.map((item) => (
                <div className="erp-approval" key={item.label}>
                  <span>{item.label}</span>
                  <b className="erp-count">{item.count}</b>
                </div>
              ))}
            </div>
          </article>
          <article className="erp-card erp-panel erp-system">
            <div className="erp-panel-head">
              <h2 className="erp-section-title">Sistem Bildirimleri</h2>
              <button type="button" disabled title="Bildirim merkezi henüz aktif değil">
                Tümünü Gör
              </button>
            </div>
            <div className="erp-notification-list">
              {systemNotifications.map((item) =>
                item.route ? (
                  <Link className="erp-notification erp-notification-link" to={item.route} key={item.title}>
                    <Bell />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <time>{item.relativeTime}</time>
                  </Link>
                ) : (
                  <div className="erp-notification" key={item.title} title="Bu bildirim için henüz ilgili bir sayfa yok">
                    <Bell />
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                    <time>{item.relativeTime}</time>
                  </div>
                ),
              )}
            </div>
          </article>
        </div>
      </section>
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
    <article className="erp-card erp-panel erp-chart">
      <div className="erp-panel-head">
        <h2 className="erp-section-title">{title}</h2>
        <span style={{ color: "#8fa2b7", fontSize: 11 }}>Bu Ay</span>
      </div>
      <div className="erp-chart-body">
        <div className={`erp-donut ${color === "green" ? "green" : ""}`} style={{ "--percent": data.normalPercent } as React.CSSProperties}>
          <div className="erp-donut-center">
            <span>Toplam</span>
            <strong>{data.total}</strong>
          </div>
        </div>
        <div className="erp-legend">
          <div className="erp-legend-row">
            <i className={`erp-dot ${color === "green" ? "green" : ""}`} />
            <div>
              <b>{normalLabel}</b>
              <small>
                {data.normal} ({data.normalPercent}%)
              </small>
            </div>
          </div>
          <div className="erp-legend-row">
            <i className="erp-dot red" />
            <div>
              <b>{overdueLabel}</b>
              <small>
                {data.overdue} ({data.overduePercent}%)
              </small>
            </div>
          </div>
        </div>
      </div>
      <div className="erp-summary">
        {title === "Tahsilat Durumu" ? "Tahsilat" : "Ödeme"} oranı %{data.normalPercent}
      </div>
    </article>
  );
}
