/**
 * Bozza storica condivisa fra il form del periodo (screen 05) e il riepilogo
 * (screen 06).
 *
 * Vive nel layout di `app/team-seasons/`, cioè nello Stack dei flussi
 * focalizzati: §21 chiede che «Aggiungi un altro periodo torna al form e
 * conserva quelli già preparati», e §33 che il passaggio interno fra
 * riepilogo e form «preserva la stessa bozza e non equivale a uscire». Un
 * provider sopra entrambe le route è ciò che rende vere tutte e due senza
 * passare l'array nei parametri di navigazione.
 *
 * L'ambito è account + Società + Team (§21). Quando cambia, la bozza viene
 * abbandonata invece di seguire la nuova identità: è lo stesso motivo per
 * cui le query key includono l'actor.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  addPeriod,
  draftScopeKey,
  removePeriod,
  updatePeriod,
  type HistoryDraftPeriod,
} from "./history-draft";

type DraftContextValue = {
  /** Periodo in modifica, letto dal form e poi azzerato. */
  editing: HistoryDraftPeriod | null;
  periods: HistoryDraftPeriod[];
  add: (period: Omit<HistoryDraftPeriod, "id">) => void;
  beginEdit: (id: string) => void;
  cancelEdit: () => void;
  clear: () => void;
  remove: (id: string) => void;
  /** Allinea la bozza all'ambito corrente; la svuota se è cambiato. */
  scopeTo: (actorId: string, clubId: string, teamId: string) => void;
  update: (period: HistoryDraftPeriod) => void;
};

const HistoryDraftContext = createContext<DraftContextValue | null>(null);

let periodSeq = 0;

function nextPeriodId(): string {
  periodSeq += 1;

  return `period-${periodSeq}`;
}

export function HistoryDraftProvider({ children }: { children: ReactNode }) {
  const [periods, setPeriods] = useState<HistoryDraftPeriod[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const scopeRef = useRef<string | null>(null);

  const scopeTo = useCallback(
    (actorId: string, clubId: string, teamId: string) => {
      const key = draftScopeKey(actorId, clubId, teamId);

      if (scopeRef.current === key) {
        return;
      }

      scopeRef.current = key;
      setPeriods([]);
      setEditingId(null);
    },
    [],
  );

  const value = useMemo<DraftContextValue>(
    () => ({
      add: (period) =>
        setPeriods((current) => addPeriod(current, { ...period, id: nextPeriodId() })),
      beginEdit: (id) => setEditingId(id),
      cancelEdit: () => setEditingId(null),
      clear: () => {
        setPeriods([]);
        setEditingId(null);
      },
      editing: periods.find((period) => period.id === editingId) ?? null,
      periods,
      remove: (id) => setPeriods((current) => removePeriod(current, id)),
      scopeTo,
      update: (period) => {
        setPeriods((current) => updatePeriod(current, period));
        setEditingId(null);
      },
    }),
    [editingId, periods, scopeTo],
  );

  return (
    <HistoryDraftContext.Provider value={value}>
      {children}
    </HistoryDraftContext.Provider>
  );
}

export function useHistoryDraft(): DraftContextValue {
  const value = useContext(HistoryDraftContext);

  if (!value) {
    throw new Error("useHistoryDraft richiede HistoryDraftProvider");
  }

  return value;
}
