/**
 * Regole degli assistiti in evidenza (REV-PROF-16, schermata 7).
 *
 * Qui si prova il comportamento che la task descrive a parole: al massimo
 * tre, nessuna sostituzione automatica, ordine esplicito, e nessuno che
 * prende il posto di chi perde l'eleggibilità.
 */
import { describe, expect, it } from "vitest";

import type { AgentPublicAssistito } from "../../relationships/agent-representation-service";
import { selectHighlightedAssistiti } from "../career/AgentCareerTab";
import {
  moveFeaturedSelection,
  pruneFeaturedSelection,
  readFeaturedSelection,
  toggleFeaturedSelection,
} from "./agent-featured-assistiti";

function buildAssistito(
  overrides: Partial<AgentPublicAssistito> = {},
): AgentPublicAssistito {
  return {
    created_at: "2026-01-01T00:00:00Z",
    current_team: "ASD Prova",
    featured_rank: null,
    id: "rel-1",
    player_avatar_url: null,
    player_full_name: "Luca Bianchi",
    player_profile_id: "player-1",
    primary_position: "forward",
    relationship_type: "procuratore",
    ...overrides,
  };
}

describe("selezione iniziale", () => {
  it("legge chi è in evidenza nell'ordine salvato, non in quello di arrivo", () => {
    const selection = readFeaturedSelection([
      buildAssistito({ featured_rank: 2, id: "b" }),
      buildAssistito({ featured_rank: 1, id: "a" }),
      buildAssistito({ id: "c" }),
    ]);

    expect(selection).toEqual(["a", "b"]);
  });

  it("parte vuota per un profilo che non ha mai scelto", () => {
    // Il Master Profile ne mostra comunque tre, ma è l'assenza di scelta a
    // deciderlo: non c'è niente da confermare qui.
    expect(readFeaturedSelection([buildAssistito(), buildAssistito({ id: "b" })])).toEqual(
      [],
    );
  });
});

describe("limite di tre", () => {
  it("rifiuta la quarta selezione senza togliere niente", () => {
    const result = toggleFeaturedSelection(["a", "b", "c"], "d");

    expect(result.atLimit).toBe(true);
    expect(result.selection).toEqual(["a", "b", "c"]);
  });

  it("deselezionare resta sempre possibile, anche al limite", () => {
    const result = toggleFeaturedSelection(["a", "b", "c"], "b");

    expect(result.atLimit).toBe(false);
    expect(result.selection).toEqual(["a", "c"]);
  });

  it("aggiunge in coda, così l'ordine riflette la sequenza di scelta", () => {
    expect(toggleFeaturedSelection(["a"], "b").selection).toEqual(["a", "b"]);
  });
});

describe("ordinamento", () => {
  it("scambia con l'elemento adiacente", () => {
    expect(moveFeaturedSelection(["a", "b", "c"], "b", "up")).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(moveFeaturedSelection(["a", "b", "c"], "b", "down")).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("ai bordi non succede niente: non è un errore", () => {
    expect(moveFeaturedSelection(["a", "b"], "a", "up")).toEqual(["a", "b"]);
    expect(moveFeaturedSelection(["a", "b"], "b", "down")).toEqual(["a", "b"]);
  });

  it("ignora un id che non è in selezione", () => {
    expect(moveFeaturedSelection(["a", "b"], "z", "up")).toEqual(["a", "b"]);
  });
});

describe("perdita di eleggibilità", () => {
  it("toglie chi non è più nell'elenco pubblico e non lo sostituisce", () => {
    const pruned = pruneFeaturedSelection(
      ["a", "b", "c"],
      [buildAssistito({ id: "a" }), buildAssistito({ id: "c" }), buildAssistito({ id: "d" })],
    );

    // "d" era eleggibile ma non scelto: non prende il posto di "b".
    expect(pruned).toEqual(["a", "c"]);
  });

  it("preserva l'ordine dei rimanenti", () => {
    expect(
      pruneFeaturedSelection(
        ["c", "a"],
        [buildAssistito({ id: "a" }), buildAssistito({ id: "c" })],
      ),
    ).toEqual(["c", "a"]);
  });
});

describe("cosa mostra il Master Profile", () => {
  it("mostra gli assistiti scelti, nel loro ordine", () => {
    const highlighted = selectHighlightedAssistiti([
      buildAssistito({ featured_rank: 1, id: "a" }),
      buildAssistito({ featured_rank: 2, id: "b" }),
      buildAssistito({ id: "c" }),
      buildAssistito({ id: "d" }),
    ]);

    expect(highlighted.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("ricade sui primi tre quando nessuna scelta è stata fatta", () => {
    const highlighted = selectHighlightedAssistiti([
      buildAssistito({ id: "a" }),
      buildAssistito({ id: "b" }),
      buildAssistito({ id: "c" }),
      buildAssistito({ id: "d" }),
    ]);

    expect(highlighted.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("non mostra mai più di tre assistiti", () => {
    const highlighted = selectHighlightedAssistiti([
      buildAssistito({ featured_rank: 1, id: "a" }),
      buildAssistito({ featured_rank: 2, id: "b" }),
      buildAssistito({ featured_rank: 3, id: "c" }),
      buildAssistito({ featured_rank: 3, id: "d" }),
    ]);

    expect(highlighted).toHaveLength(3);
  });
});
