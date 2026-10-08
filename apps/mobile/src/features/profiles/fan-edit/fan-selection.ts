/**
 * Normalizzazione delle selezioni del Tifoso (REV-PROF-20).
 *
 * Funzioni pure, usate dai moduli Interessi, Categorie e Aree. Servono a tre
 * cose che altrimenti finirebbero duplicate in tre schermate:
 *
 *  - leggere dal database valori che non appartengono più alla tassonomia
 *    senza farli sparire né farli passare per validi;
 *  - calcolare il dirty state su un confronto normalizzato, così riaprire un
 *    selettore senza cambiare nulla non accende la CTA;
 *  - deduplicare prima di scrivere, perché un identificativo ripetuto non è
 *    una seconda scelta.
 */
import {
  isFanFootballType,
  type FanFootballType,
} from "../../onboarding/community/fan-taxonomy";
import {
  INTEREST_CATEGORY_GROUPS,
  INTEREST_CATEGORY_OPTIONS,
} from "../player-sports";

/**
 * Interessi calcistici riconosciuti, nell'ordine ufficiale della tassonomia.
 * Un valore che non è più un interesse valido viene scartato: non è una
 * selezione che l'utente possa vedere o togliere, e salvarlo lo
 * riproporrebbe all'infinito.
 */
export function normalizeFanInterests(
  values: readonly string[] | null | undefined,
): FanFootballType[] {
  if (!values || values.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: FanFootballType[] = [];

  for (const value of values) {
    const trimmed = typeof value === "string" ? value.trim() : "";

    if (!isFanFootballType(trimmed) || seen.has(trimmed)) {
      continue;
    }

    seen.add(trimmed);
    result.push(trimmed);
  }

  return result;
}

const CANONICAL_CATEGORIES = new Map<string, string>(
  INTEREST_CATEGORY_OPTIONS.map((option) => [
    option.value.toLowerCase(),
    option.value,
  ]),
);

export type FanCategorySelection = {
  /** Categorie ancora presenti nella tassonomia, nella grafia canonica. */
  known: string[];
  /**
   * Valori salvati che la tassonomia non riconosce più. Non vengono persi e
   * non vengono mostrati come selezionabili: la schermata chiede di
   * rivederli, e restano nel salvataggio finché l'utente non li toglie.
   */
  deprecated: string[];
};

export function normalizeFanCategories(
  values: readonly string[] | null | undefined,
): FanCategorySelection {
  const known: string[] = [];
  const deprecated: string[] = [];
  const seen = new Set<string>();

  for (const value of values ?? []) {
    const trimmed = typeof value === "string" ? value.trim() : "";
    const key = trimmed.toLowerCase();

    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);

    const canonical = CANONICAL_CATEGORIES.get(key);

    if (canonical) {
      known.push(canonical);
      continue;
    }

    deprecated.push(trimmed);
  }

  return { deprecated, known };
}

/**
 * Gruppi da mostrare, filtrati dalla ricerca. L'ordine dei gruppi e delle
 * categorie è quello della tassonomia: la query filtra, non riordina.
 */
export function filterFanCategoryGroups(query: string): {
  categories: string[];
  title: string;
}[] {
  const trimmed = query.trim().toLowerCase();

  return INTEREST_CATEGORY_GROUPS.map((group) => ({
    categories: group.categories.filter(
      (category) => !trimmed || category.toLowerCase().includes(trimmed),
    ),
    title: group.title,
  })).filter((group) => group.categories.length > 0);
}

/** Due selezioni contengono gli stessi identificativi, in qualunque ordine. */
export function sameIdSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  const seen = new Set(left);

  return right.every((value) => seen.has(value));
}
