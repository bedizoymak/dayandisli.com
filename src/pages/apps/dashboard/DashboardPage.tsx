import { useEffect, useState } from "react";
import { FilePlus2, ReceiptText, Sun, UserRound, BarChart3 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { quickActions } from "@/features/erp-shell/shellNavigationData";
import { useErpIdentity } from "@/features/erp-shell/erpIdentity";
import { listAllChecks } from "@/features/finance/checks/checksApi";
import { buildCheckReminder, checkDirectionLabel, checkPartyLabel, formatCheckMoney, istanbulTodayIso } from "@/features/finance/checks/checkDomain";
import type { CheckListRow } from "@/features/finance/checks/types";

const quickIcons = [FilePlus2, ReceiptText, UserRound, BarChart3];

export default function DashboardPage() {
  const navigate = useNavigate();
  const { erpUser, hasPermission } = useErpIdentity();
  const canViewChecks = hasPermission("finance.view");
  const [now] = useState(() => new Date());
  const [checks, setChecks] = useState<CheckListRow[]>([]);
  const [checksStatus, setChecksStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!canViewChecks) {
      setChecks([]);
      setChecksStatus("ready");
      return;
    }
    let cancelled = false;
    listAllChecks({ filters: { openOnly: true } })
      .then((result) => {
        if (cancelled) return;
        if (result.ok === false) {
          setChecks([]);
          setChecksStatus("error");
          return;
        }
        setChecks(result.data);
        setChecksStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setChecks([]);
          setChecksStatus("error");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canViewChecks]);
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
  const todayIso = istanbulTodayIso(now);
  const reminders = checks
    .map((check) => ({ check, reminder: buildCheckReminder(check, todayIso) }))
    .filter((item): item is { check: CheckListRow; reminder: NonNullable<typeof item.reminder> } => item.reminder !== null)
    .sort((left, right) => left.reminder.dueDate.localeCompare(right.reminder.dueDate))
    .slice(0, 6);

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
            <button type="button" onClick={() => navigate("/apps/finance/cash/checks")}>
              Tümünü Gör
            </button>
          </div>
          <div className="erp-upcoming-list">
            {checksStatus === "loading" && <div className="erp-empty-search">Çek vadeleri yükleniyor…</div>}
            {checksStatus === "error" && (
              <div className="erp-empty-search" role="alert">Çek vade verisi yüklenemedi.</div>
            )}
            {checksStatus === "ready" && reminders.length === 0 && (
              <div className="erp-empty-search">Yaklaşan veya gecikmiş açık çek bulunmuyor.</div>
            )}
            {reminders.map(({ check, reminder }) => {
              const [, month = ""] = reminder.dueDate.split("-");
              const day = reminder.dueDate.slice(8, 10);
              return (
                <Link className="erp-upcoming-row" to={`/apps/finance/cash/checks/${encodeURIComponent(check.id)}`} key={check.id}>
                  <span className="erp-upcoming-date">
                    <strong>{day}</strong>
                    <small>{month}</small>
                  </span>
                  <span className="erp-upcoming-copy">
                    <strong>{reminder.title} · {checkDirectionLabel(check.direction)}</strong>
                    <small>{check.checkNumber || "Çek no —"} · {checkPartyLabel(check.party)}</small>
                  </span>
                  <strong className={`erp-amount ${check.direction === "issued" ? "expense" : ""}`}>
                    {formatCheckMoney(check.remainingAmount, check.currency)}
                  </strong>
                </Link>
              );
            })}
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
