import { useState } from "react";
import { FilePlus2, ReceiptText, Sun, UserRound, BarChart3 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
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
  const hour = Number(istanbulParts.find((part) => part.type === "hour")?.value);
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
  const userLabel = erpUser?.email?.split("@")[0]?.replace(/[._-]+/g, " ") ?? "";
  const displayName = userLabel
    ? userLabel.replace(/(^|\s)\S/g, (letter) => letter.toLocaleUpperCase("tr-TR"))
    : "—";

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
                  <strong>—</strong>
                  <small>—</small>
                </div>
              </div>
            </div>
            <div className="erp-fx-grid">
              <div className="erp-fx">
                <span>Dolar / TL</span>
                <strong>—</strong>
                <small>—</small>
              </div>
              <div className="erp-fx">
                <span>Euro / TL</span>
                <strong>—</strong>
                <small>—</small>
              </div>
              <div className="erp-fx">
                <span>Altın / TL (Gr)</span>
                <strong>—</strong>
                <small>—</small>
              </div>
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
        <article className="erp-card erp-kpi">
          <span>Toplam Tahsil Edilecek</span>
          <strong>—</strong>
          <small>—</small>
        </article>
        <article className="erp-card erp-kpi green">
          <span>Üretimdeki İş Emri</span>
          <strong>—</strong>
          <small>—</small>
        </article>
        <article className="erp-card erp-kpi purple">
          <span>Bu Ay Oluşan KDV</span>
          <strong>—</strong>
          <small>—</small>
        </article>
      </section>

      <section className="erp-grid erp-bottom">
        <DonutCard title="Tahsilat Durumu" />
        <DonutCard title="Ödeme Durumu" />
        <article className="erp-card erp-panel">
          <div className="erp-panel-head">
            <h2 className="erp-section-title">Yaklaşan Ödeme ve Tahsilatlar</h2>
            <button type="button" onClick={() => navigate("/apps/finance/income/collection-report")}>
              Tümünü Gör
            </button>
          </div>
          <div className="erp-upcoming-list">
            <div className="erp-empty-search">Gösterilecek ödeme veya tahsilat bulunmuyor.</div>
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
              <div className="erp-empty-search">Gösterilecek onay kaydı bulunmuyor.</div>
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
              <div className="erp-empty-search">Gösterilecek bildirim bulunmuyor.</div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

function DonutCard({ title }: { title: string }) {
  return (
    <article className="erp-card erp-panel erp-chart">
      <div className="erp-panel-head">
        <h2 className="erp-section-title">{title}</h2>
        <span style={{ color: "#8fa2b7", fontSize: 11 }}>Bu Ay</span>
      </div>
      <div className="erp-chart-body">
        <div className="erp-empty-search">Gösterilecek veri bulunmuyor.</div>
      </div>
    </article>
  );
}
