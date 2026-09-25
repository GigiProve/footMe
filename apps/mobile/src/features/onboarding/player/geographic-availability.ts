/**
 * Logica definitiva della disponibilità geografica (REV-ONB-02 §S–§X).
 *
 * Tre modalità mutuamente esclusive che condividono un solo campo di stato,
 * `availabilityType`, già presente nel modello onboarding:
 *
 * - `ITALY`      → selezione immediata, nessun livello successivo;
 * - `REGIONS`    → apre la selezione delle regioni;
 * - `PROVINCES`  → apre la selezione delle province.
 *
 * Il dato finale non può mai essere contraddittorio (§T): "tutta Italia" e un
 * elenco di regioni non coesistono. §T permette anche di conservare nella
 * bozza le selezioni della modalità abbandonata, ma qui non lo facciamo: il
 * form è l'unica fonte, e cambiare modalità azzera il livello che non è più
 * attivo. Costa una riselezione a chi torna indietro, evita due stati che
 * possono divergere.
 */
import type { AvailabilityType } from "../onboarding-form";

export type GeographicAvailabilityDraft = {
  mode: AvailabilityType;
  provinces: string[];
  regions: string[];
};

/**
 * Selezioni effettivamente attive per la modalità corrente. È questa la
 * forma che va salvata: la bozza può contenere di più (§T).
 */
export function resolveActiveAvailability(
  draft: GeographicAvailabilityDraft,
): { provinces: string[]; regions: string[] } {
  if (draft.mode === "REGIONS") {
    return { provinces: [], regions: draft.regions };
  }

  if (draft.mode === "PROVINCES") {
    return { provinces: draft.provinces, regions: [] };
  }

  return { provinces: [], regions: [] };
}

/** La modalità scelta è completa e può passare allo step successivo. */
export function isAvailabilityComplete(
  draft: GeographicAvailabilityDraft,
): boolean {
  if (draft.mode === "REGIONS") {
    return draft.regions.length > 0;
  }

  if (draft.mode === "PROVINCES") {
    return draft.provinces.length > 0;
  }

  return true;
}

/** Errore contestuale quando la modalità è scelta ma il dettaglio manca (§CC). */
export function getAvailabilityErrorMessage(
  draft: GeographicAvailabilityDraft,
): string | undefined {
  if (draft.mode === "REGIONS" && draft.regions.length === 0) {
    return "Seleziona almeno una regione.";
  }

  if (draft.mode === "PROVINCES" && draft.provinces.length === 0) {
    return "Seleziona almeno una provincia.";
  }

  return undefined;
}

/**
 * Riepilogo leggero sotto la card della modalità: "3 regioni selezionate".
 * Su `ITALY` non c'è nulla da riassumere: la card parla già da sola (§T).
 */
export function buildAvailabilitySummary(
  count: number,
  unit: "regione" | "provincia",
): string | undefined {
  if (count === 0) {
    return undefined;
  }

  const plural = unit === "regione" ? "regioni" : "province";

  return count === 1
    ? `1 ${unit} selezionata`
    : `${count} ${plural} selezionate`;
}

/** Riepilogo finale dello step (§X): cambia forma in base alla modalità. */
export function buildAvailabilityRecap(draft: GeographicAvailabilityDraft): {
  title: string;
  detail?: string;
} {
  const active = resolveActiveAvailability(draft);

  if (draft.mode === "REGIONS") {
    return { detail: active.regions.join(", "), title: "Disponibile in:" };
  }

  if (draft.mode === "PROVINCES") {
    return { detail: active.provinces.join(", "), title: "Disponibile in:" };
  }

  return { title: "Disponibile in tutta Italia" };
}

/** Intestazione della lista di selezione: "Hai selezionato 3 regioni" (§U, §V). */
export function buildSelectionCountLabel(
  count: number,
  unit: "regione" | "provincia",
): string {
  const plural = unit === "regione" ? "regioni" : "province";

  return count === 1
    ? `Hai selezionato 1 ${unit}`
    : `Hai selezionato ${count} ${plural}`;
}
