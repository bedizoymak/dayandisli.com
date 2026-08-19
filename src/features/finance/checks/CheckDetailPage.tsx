import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatMoney } from "@/lib/finance/financeLabels";
import { FinanceBackLink, FinanceBreadcrumb } from "../FinanceNavigationTools";
import { CheckPartyPicker } from "./CheckPartyPicker";
import { checkDirectionLabel, checkPartyLabel, effectiveStatusLabel } from "./checkDomain";
import {
  getCheckDetail,
  linkCheckParty,
  setCheckStatus,
  unlinkCheckParty,
} from "./checksApi";
import type {
  CheckDetailResponse,
  CheckListRow,
  CheckPartyOption,
  CheckTerminalStatus,
} from "./types";
import "./checks.css";

const checksBase = "/apps/finance/cash/checks";

function displayDate(value: string | null, includeTime = false): string {
  if (!value) return "—";
  const date = new Date(includeTime ? value : `${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return includeTime
    ? new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(date)
    : date.toLocaleDateString("tr-TR");
}

function displayAmount(row: CheckListRow, value: number | null): string {
  if (value === null || row.currency === null) return "—";
  try {
    return formatMoney(value, row.currency);
  } catch {
    return `${value.toLocaleString("tr-TR")} ${row.currency}`;
  }
}

export function CheckDetailPage({ checkId }: { checkId?: string }) {
  const [detail, setDetail] = useState<CheckDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [action, setAction] = useState<CheckTerminalStatus | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedParty, setSelectedParty] = useState<CheckPartyOption | null>(null);

  useEffect(() => {
    if (!checkId) {
      setLoading(false);
      setError("Çek kimliği eksik.");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCheckDetail(checkId).then((result) => {
      if (cancelled) return;
      if (result.ok === false) {
        setDetail(null);
        setError(result.message);
      } else {
        setDetail(result.data);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [checkId, reloadKey]);

  const runStatusAction = async () => {
    if (!checkId || !action) return;
    if ((action === "cancelled" || action === "returned") && !actionNote.trim()) {
      setError(action === "cancelled" ? "İptal için açıklama zorunludur." : "İade için açıklama zorunludur.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await setCheckStatus(checkId, action, actionNote);
    if (result.ok === false) setError(result.message);
    else {
      setNotice("Çek durumu güncellendi.");
      setAction(null);
      setActionNote("");
      setReloadKey((value) => value + 1);
    }
    setSaving(false);
  };

  const assignParty = async () => {
    if (!checkId || !selectedParty) return;
    setSaving(true);
    setError(null);
    const result = await linkCheckParty(checkId, selectedParty.parasutId);
    if (result.ok === false) setError(result.message);
    else {
      setNotice("Gerçek taraf ilişkisi kaydedildi.");
      setSelectedParty(null);
      setReloadKey((value) => value + 1);
    }
    setSaving(false);
  };

  const removeParty = async () => {
    if (!checkId) return;
    setSaving(true);
    setError(null);
    const result = await unlinkCheckParty(checkId);
    if (result.ok === false) setError(result.message);
    else {
      setNotice("Taraf ilişkisi kaldırıldı; yerine tahmini taraf atanmadı.");
      setReloadKey((value) => value + 1);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="checks-page"><div className="checks-state" role="status">Çek detayı yükleniyor…</div></div>;
  }

  if (!detail) {
    return (
      <div className="checks-page">
        <FinanceBreadcrumb value="Muhasebe ve Finans / Kasa / Çekler / Çek Detayı" />
        <h1>Çek Bulunamadı</h1>
        <FinanceBackLink to={checksBase}>Çeklere Dön</FinanceBackLink>
        <div className="checks-error" role="alert">{error ?? "Çek kaydı bulunamadı."}</div>
      </div>
    );
  }

  const row = detail.record;

  return (
    <div className="checks-page">
      <header className="checks-page-head">
        <div>
          <FinanceBreadcrumb value={`Muhasebe ve Finans / Kasa / Çekler / ${row.checkNumber ?? row.id}`} />
          <h1>{row.checkNumber ?? "Çek Detayı"}</h1>
          <p>{checkDirectionLabel(row.direction)} · {row.sourceLabel}</p>
        </div>
        <div className="checks-head-actions">
          {row.source === "erp" && row.editable && (
            <Link className="checks-primary-link" to={`${checksBase}/${encodeURIComponent(row.id)}/edit`}>Çeki Düzenle</Link>
          )}
        </div>
      </header>
      <FinanceBackLink to={checksBase}>Çeklere Dön</FinanceBackLink>

      {notice && <div className="checks-notice" role="status">{notice}</div>}
      {error && <div className="checks-error" role="alert">{error}</div>}

      <section className="checks-detail-grid">
        <article className="erp-card checks-detail-card">
          <header>
            <span className={`checks-source-badge ${row.source}`}>{row.sourceLabel}</span>
            <span className={`checks-direction-badge ${row.direction ?? "unknown"}`}>{checkDirectionLabel(row.direction)}</span>
            <span className={`checks-status-badge ${row.effectiveStatus}`}>{effectiveStatusLabel(row.effectiveStatus)}</span>
          </header>
          <dl>
            <div><dt>Müşteri / Tedarikçi</dt><dd>{checkPartyLabel(row.party)}</dd></div>
            <div><dt>Banka</dt><dd>{row.bankName ?? "—"}</dd></div>
            <div><dt>Çek No</dt><dd>{row.checkNumber ?? "—"}</dd></div>
            <div><dt>Düzenleme Tarihi</dt><dd>{displayDate(row.issueDate)}</dd></div>
            <div><dt>Vade Tarihi</dt><dd>{displayDate(row.dueDate)}</dd></div>
            <div><dt>Para Birimi</dt><dd>{row.currency ?? "—"}</dd></div>
            <div><dt>Orijinal Tutar</dt><dd>{displayAmount(row, row.originalAmount)}</dd></div>
            <div><dt>Kalan Tutar</dt><dd>{displayAmount(row, row.remainingAmount)}</dd></div>
            <div><dt>Ödeme Tarihi</dt><dd>{displayDate(row.paidAt, true)}</dd></div>
            <div><dt>Senkron Tarihi</dt><dd>{displayDate(row.syncedAt, true)}</dd></div>
          </dl>
          <div className="checks-notes"><strong>Notlar</strong><p>{row.notes ?? "—"}</p></div>
        </article>

        <aside className="checks-detail-side">
          {row.source === "erp" && row.statusEditable && (
            <section className="erp-card checks-action-card">
              <h2>Durum İşlemleri</h2>
              <p>Bu işlemler yalnız ERP kaydını etkiler; Paraşüt'e yazmaz.</p>
              <div className="checks-status-actions">
                <button type="button" onClick={() => setAction("paid")}>Ödendi İşaretle</button>
                <button type="button" onClick={() => setAction("cancelled")}>İptal Et</button>
                <button type="button" onClick={() => setAction("returned")}>Karşılıksız / İade</button>
              </div>
              {action && (
                <div className="checks-action-confirm">
                  <label>
                    Açıklama {action !== "paid" && "*"}
                    <textarea value={actionNote} onChange={(event) => setActionNote(event.target.value)} />
                  </label>
                  <div>
                    <button type="button" onClick={() => { setAction(null); setActionNote(""); }}>Vazgeç</button>
                    <button type="button" className="danger" disabled={saving} onClick={runStatusAction}>Onayla</button>
                  </div>
                </div>
              )}
            </section>
          )}

          {row.source === "parasut" && (
            <section className="erp-card checks-action-card">
              <h2>Taraf İlişkisi</h2>
              <p>Paraşüt finansal alanları salt okunurdur. Yalnız doğrulanmış müşteri/tedarikçi ilişkisi ERP'de kaydedilir.</p>
              {!row.partyLinkEditable ? (
                <p>Bu kaydın taraf ilişkisi düzenlenemez.</p>
              ) : !row.direction ? (
                <p>Yön bilinmediği için taraf bağlanamaz.</p>
              ) : row.party.assigned ? (
                <div className="checks-party-selected">
                  <div><strong>{row.party.name ?? "Atanmış taraf"}</strong><small>Gerçek ilişki</small></div>
                  <button type="button" disabled={saving} onClick={removeParty}>Bağlantıyı Kaldır</button>
                </div>
              ) : (
                <>
                  <CheckPartyPicker
                    direction={row.direction}
                    selectedId={selectedParty?.parasutId ?? ""}
                    selectedName={selectedParty?.name ?? ""}
                    onSelect={setSelectedParty}
                    onClear={() => setSelectedParty(null)}
                  />
                  <button type="button" className="checks-wide-button" disabled={!selectedParty || saving} onClick={assignParty}>Gerçek Tarafı Bağla</button>
                </>
              )}
            </section>
          )}

          <section className="erp-card checks-history-card">
            <h2>Geçmiş</h2>
            {!detail.history.length ? <p>Geçmiş hareketi bulunmuyor.</p> : (
              <ol>
                {detail.history.map((entry) => (
                  <li key={entry.id}>
                    <strong>{entry.eventType}</strong>
                    <span>{[entry.fromStatus, entry.toStatus].filter(Boolean).join(" → ")}</span>
                    {entry.note && <p>{entry.note}</p>}
                    <small>{displayDate(entry.createdAt, true)}</small>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}
