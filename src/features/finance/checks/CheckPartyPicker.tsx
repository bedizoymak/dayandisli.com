import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { searchCheckParties } from "./checksApi";
import { checkDirectionLabel } from "./checkDomain";
import type { CheckDirection, CheckPartyOption } from "./types";

export function CheckPartyPicker({
  direction,
  selectedId,
  selectedName,
  onSelect,
  onClear,
}: {
  direction: CheckDirection;
  selectedId: string;
  selectedName: string;
  onSelect: (party: CheckPartyOption) => void;
  onClear: () => void;
}) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CheckPartyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      searchCheckParties(direction, search).then((result) => {
        if (cancelled) return;
        if (result.ok === false) {
          setRows([]);
          setError(result.message);
        } else {
          setRows(result.data);
        }
        setLoading(false);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [direction, search]);

  const partyTypeLabel = direction === "received" ? "Müşteri" : "Tedarikçi";

  return (
    <div className="checks-party-picker">
      <span className="checks-field-label">{partyTypeLabel}</span>
      {selectedId ? (
        <div className="checks-party-selected">
          <div>
            <strong>{selectedName}</strong>
            <small>{checkDirectionLabel(direction)} için seçildi</small>
          </div>
          <button type="button" onClick={onClear}>Değiştir</button>
        </div>
      ) : (
        <>
          <label className="checks-search-field">
            <Search aria-hidden="true" />
            <input
              aria-label={`${partyTypeLabel} ara`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`${partyTypeLabel} ara`}
            />
          </label>
          <div className="checks-party-results" role="listbox" aria-label={`${partyTypeLabel} sonuçları`}>
            {loading && <p>Yükleniyor…</p>}
            {!loading && error && <p className="checks-inline-error">{error}</p>}
            {!loading && !error && !rows.length && <p>Gerçek {partyTypeLabel.toLocaleLowerCase("tr-TR")} kaydı bulunamadı.</p>}
            {!loading && !error && rows.map((party) => (
              <button
                type="button"
                role="option"
                aria-selected="false"
                key={party.parasutId}
                onClick={() => onSelect(party)}
              >
                <strong>{party.name}</strong>
                <small>Paraşüt #{party.parasutId}</small>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
