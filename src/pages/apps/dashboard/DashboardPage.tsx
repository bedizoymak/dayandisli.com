import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FilePlus2,
  ReceiptText,
  UserRound,
  BarChart3,
  Sun,
  Moon,
  CloudSun,
  Cloud,
  CloudFog,
  CloudDrizzle,
  CloudRain,
  CloudRainWind,
  Snowflake,
  CloudLightning,
  type LucideIcon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { quickActions } from "@/features/erp-shell/shellNavigationData";
import { resolveDisplayName, useErpIdentity } from "@/features/erp-shell/erpIdentity";
import { listAllChecks } from "@/features/finance/checks/checksApi";
import { buildCheckReminder, checkDirectionLabel, checkPartyLabel, formatCheckMoney, istanbulTodayIso } from "@/features/finance/checks/checkDomain";
import type { CheckListRow } from "@/features/finance/checks/types";
import { useMarketData } from "@/features/market-data/useMarketData";
import { formatTryAmount, formatTemperature, formatChangeIndicator, CHANGE_DIRECTION_COLOR, getWeatherIconKey, type WeatherIconKey } from "@/features/market-data/format";

const quickIcons = [FilePlus2, ReceiptText, UserRound, BarChart3];

const weatherIcons: Record<WeatherIconKey, LucideIcon> = {
  sun: Sun,
  moon: Moon,
  "cloud-sun": CloudSun,
  cloud: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  showers: CloudRainWind,
  snow: Snowflake,
  thunder: CloudLightning,
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { erpUser, hasPermission, isLoading } = useErpIdentity();
  const canViewChecks = hasPermission("finance.view");
  const [now] = useState(() => new Date());
  const { data: marketData } = useMarketData();

  // PHASE 5B: open-check reminders migrated from ad-hoc useEffect state to
  // TanStack Query — same fetch, same derived UI states (loading / error /
  // ready), plus request deduplication and cross-mount caching. Read-only;
  // no mutation or financial-write semantics involved.
  const checksQuery = useQuery({
    queryKey: ["dashboard", "open-checks", canViewChecks],
    enabled: canViewChecks,
    queryFn: () => listAllChecks({ filters: { openOnly: true } }),
  });
  const checks: CheckListRow[] =
    !canViewChecks || checksQuery.isError || !checksQuery.data?.ok
      ? []
      : checksQuery.data.data;
  const checksStatus: "loading" | "ready" | "error" = !canViewChecks
    ? "ready"
    : checksQuery.isPending
      ? "loading"
      : checksQuery.isError || !checksQuery.data?.ok
        ? "error"
        : "ready";
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
  const displayName = resolveDisplayName(erpUser, isLoading);
  const todayIso = istanbulTodayIso(now);
  const reminders = checks
    .map((check) => ({ check, reminder: buildCheckReminder(check, todayIso) }))
    .filter((item): item is { check: CheckListRow; reminder: NonNullable<typeof item.reminder> } => item.reminder !== null)
    .sort((left, right) => left.reminder.dueDate.localeCompare(right.reminder.dueDate))
    .slice(0, 6);

  const weather = marketData?.weather ?? null;
  const WeatherIcon = weather ? weatherIcons[getWeatherIconKey(weather.weatherCode, weather.isDay)] : Sun;
  const currency = marketData?.currency ?? null;
  const gold = marketData?.gold ?? null;
  const usdChange = currency ? formatChangeIndicator(currency.usdTry, currency.usdTryPreviousClose) : null;
  const eurChange = currency ? formatChangeIndicator(currency.eurTry, currency.eurTryPreviousClose) : null;
  const goldChange = gold?.gramTry != null ? formatChangeIndicator(gold.gramTry, gold.gramTryPreviousClose) : null;

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
                <WeatherIcon color="#ffd33d" />
                <div>
                  <strong>{weather ? formatTemperature(weather.temperatureC) : "—"}</strong>
                  <small>{weather ? weather.condition : "—"}</small>
                </div>
              </div>
            </div>
            <div className="erp-fx-grid">
              <div className="erp-fx">
                <span>Dolar / TL</span>
                <strong>{currency ? formatTryAmount(currency.usdTry) : "—"}</strong>
                <small style={usdChange ? { color: CHANGE_DIRECTION_COLOR[usdChange.direction] } : undefined}>
                  {usdChange ? usdChange.label : "—"}
                </small>
              </div>
              <div className="erp-fx">
                <span>Euro / TL</span>
                <strong>{currency ? formatTryAmount(currency.eurTry) : "—"}</strong>
                <small style={eurChange ? { color: CHANGE_DIRECTION_COLOR[eurChange.direction] } : undefined}>
                  {eurChange ? eurChange.label : "—"}
                </small>
              </div>
              <div className="erp-fx">
                <span>Altın / TL (Gr)</span>
                <strong>{gold?.gramTry != null ? formatTryAmount(gold.gramTry) : "—"}</strong>
                <small style={goldChange ? { color: CHANGE_DIRECTION_COLOR[goldChange.direction] } : undefined}>
                  {goldChange ? goldChange.label : "—"}
                </small>
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
