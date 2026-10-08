/**
 * Normalizzazione delle selezioni del Tifoso (REV-PROF-20).
 *
 * Coprono le regole di dominio che la task dichiara non negoziabili:
 * deduplicazione, distinzione fra interessi e categorie, gestione dei valori
 * deprecati senza perderli, e il raggruppamento delle categorie che deve
 * arrivare dalla tassonomia centralizzata e coprirla tutta.
 */
import { describe, expect, it } from "vitest";

import { FAN_FOOTBALL_TYPE_OPTIONS } from "../../onboarding/community/fan-taxonomy";
import {
  INTEREST_CATEGORY_GROUPS,
  INTEREST_CATEGORY_OPTIONS,
} from "../player-sports";
import {
  filterFanCategoryGroups,
  normalizeFanCategories,
  normalizeFanInterests,
  sameIdSet,
} from "./fan-selection";

describe("interessi calcistici", () => {
  it("deduplica e conserva l'ordine di selezione", () => {
    expect(
      normalizeFanInterests(["amateur", "professional", "amateur"]),
    ).toEqual(["amateur", "professional"]);
  });

  it("scarta un valore che non è più un interesse valido", () => {
    expect(normalizeFanInterests(["amateur", "Serie B", ""])).toEqual([
      "amateur",
    ]);
  });

  it("accetta tutti i valori della tassonomia e nessun altro", () => {
    const all = FAN_FOOTBALL_TYPE_OPTIONS.map((option) => option.value);

    expect(normalizeFanInterests(all)).toEqual(all);
    expect(normalizeFanInterests(["Calcio dilettantistico"])).toEqual([]);
  });
});

describe("categorie seguite", () => {
  it("riconosce le categorie della tassonomia nella grafia canonica", () => {
    expect(normalizeFanCategories(["serie b", "PROMOZIONE"])).toEqual({
      deprecated: [],
      known: ["Serie B", "Promozione"],
    });
  });

  it("deduplica senza distinguere maiuscole", () => {
    expect(normalizeFanCategories(["Serie B", "serie b"]).known).toEqual([
      "Serie B",
    ]);
  });

  it("conserva un valore deprecato invece di perderlo", () => {
    const result = normalizeFanCategories(["Serie B", "Categoria Unica"]);

    expect(result.known).toEqual(["Serie B"]);
    expect(result.deprecated).toEqual(["Categoria Unica"]);
  });

  it("non confonde un interesse calcistico con una categoria", () => {
    expect(normalizeFanCategories(["amateur"]).known).toEqual([]);
  });
});

describe("gruppi delle categorie", () => {
  it("copre ogni categoria della tassonomia una volta sola", () => {
    const grouped = INTEREST_CATEGORY_GROUPS.flatMap(
      (group) => group.categories,
    );

    expect([...grouped].sort()).toEqual(
      INTEREST_CATEGORY_OPTIONS.map((option) => option.value).sort(),
    );
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it("filtra senza riordinare né duplicare i gruppi", () => {
    const groups = filterFanCategoryGroups("serie");

    expect(groups.map((group) => group.title)).toEqual([
      "Professionistico",
      "Dilettantistico",
    ]);
    expect(groups[0].categories).toEqual(["Serie A", "Serie B", "Serie C"]);
  });

  it("restituisce l'elenco intero senza query", () => {
    expect(filterFanCategoryGroups("  ")).toHaveLength(
      INTEREST_CATEGORY_GROUPS.length,
    );
  });

  it("non restituisce nessun gruppo quando la ricerca non trova nulla", () => {
    expect(filterFanCategoryGroups("Premier League")).toEqual([]);
  });
});

describe("dirty state", () => {
  it("ignora l'ordine", () => {
    expect(sameIdSet(["a", "b"], ["b", "a"])).toBe(true);
  });

  it("distingue selezioni diverse", () => {
    expect(sameIdSet(["a"], ["a", "b"])).toBe(false);
    expect(sameIdSet(["a"], ["b"])).toBe(false);
  });
});
