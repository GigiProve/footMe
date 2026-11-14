import TestRenderer, { act } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  beginSavedMutation,
  contentSavedTarget,
  endSavedMutation,
  getSavedEntry,
  getSavedValue,
  resetSavedStore,
  resolveSaved,
  savedKey,
  seedSaved,
  useIsSaved,
} from "./saved-store";
import type { SavedTarget } from "./saved-types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const post = contentSavedTarget("club_media", "p1");
const profile: SavedTarget = { id: "u1", type: "profile" };

beforeEach(() => {
  resetSavedStore();
});

describe("savedKey", () => {
  it("distingue target_type, content_type e id (§167)", () => {
    expect(savedKey(post)).toBe("content:club_media:p1");
    expect(savedKey(profile)).toBe("profile:-:u1");
    expect(savedKey({ id: "p1", type: "position" })).toBe("position:-:p1");
    expect(savedKey(contentSavedTarget("media_profile", "p1"))).not.toBe(savedKey(post));
  });
});

describe("resolveSaved", () => {
  it("senza cella vale il seme, o falso", () => {
    expect(resolveSaved(undefined, true)).toBe(true);
    expect(resolveSaved(undefined, undefined)).toBe(false);
  });
});

describe("store — vince il dato server più recente (§19, §141–§143)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function at(ms: number) {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(ms);
  }

  it("il primo seme entra nello store e la cella vale per le superfici senza istante", () => {
    seedSaved(savedKey(post), true, 100);

    expect(getSavedValue(post, false)).toBe(true);
  });

  it("una pagina più vecchia del tap non cancella il salvataggio", () => {
    const key = savedKey(post);
    seedSaved(key, false, 100);
    at(200);
    const seq = beginSavedMutation(key, true);
    endSavedMutation(key, seq, { ok: true, value: true });

    // La pagina di Feed in cache (richiesta a 100) dice ancora «non salvato».
    seedSaved(key, false, 100);
    expect(getSavedValue(post, false, 100)).toBe(true);
  });

  it("un fetch partito DOPO il tap ma prima della risposta non annulla il salvataggio (§141)", () => {
    const key = savedKey(post);
    seedSaved(key, false, 100);
    at(200);
    const seq = beginSavedMutation(key, true);
    // Refetch partito a 250, mentre la scrittura era in volo: dice «non salvato».
    seedSaved(key, false, 250);
    at(300);
    endSavedMutation(key, seq, { ok: true, value: true });

    seedSaved(key, false, 250);
    expect(getSavedValue(post)).toBe(true);
    expect(getSavedEntry(key)?.at).toBe(300);
  });

  it("dopo il Saved Center, il Feed in cache non riporta indietro lo stato", () => {
    const key = savedKey(post);
    seedSaved(key, false, 100); // Feed
    at(200);
    const seq = beginSavedMutation(key, true); // salvato da Cerca
    endSavedMutation(key, seq, { ok: true, value: true });
    seedSaved(key, true, 300); // Saved Center

    // Il Feed torna in primo piano e rilegge la sua pagina vecchia.
    seedSaved(key, false, 100);
    expect(getSavedValue(post, false, 100)).toBe(true);
  });

  it("la pagina 1 rimasta in cache quando si carica la 2 non sovrascrive", () => {
    const key = savedKey(post);
    seedSaved(key, false, 100); // pagina 1
    at(200);
    const seq = beginSavedMutation(key, true);
    endSavedMutation(key, seq, { ok: true, value: true });

    // fetchNextPage a 300: la pagina 1 conserva il proprio istante (100).
    seedSaved(key, false, 100);
    expect(getSavedValue(post)).toBe(true);
  });

  it("un dato richiesto dopo il tap prevale (refetch, altro device)", () => {
    const key = savedKey(post);
    seedSaved(key, false, 100);
    at(200);
    const seq = beginSavedMutation(key, true);
    endSavedMutation(key, seq, { ok: true, value: true });

    seedSaved(key, false, 300);
    expect(getSavedValue(post)).toBe(false);
  });

  it("in lettura, un seme più nuovo della cella prevale anche prima dell'effetto", () => {
    seedSaved(savedKey(post), false, 100);

    expect(getSavedValue(post, true, 300)).toBe(true);
    expect(getSavedValue(post, true, 50)).toBe(false);
  });

  it("un seme senza istante riempie solo una cella mancante", () => {
    const key = savedKey(post);
    seedSaved(key, true);
    seedSaved(key, false);

    expect(getSavedValue(post)).toBe(true);
  });

  it("durante una mutazione il seme non tocca il valore mostrato ma aggiorna il rollback", () => {
    const key = savedKey(post);
    seedSaved(key, false, 100);
    at(200);
    const seq = beginSavedMutation(key, true);

    seedSaved(key, true, 300);
    expect(getSavedValue(post, false, 300)).toBe(true);

    // Il tap fallisce: si torna all'ultimo dato server (300, salvato), non a 100.
    endSavedMutation(key, seq, { ok: false, rollbackTo: false });
    expect(getSavedValue(post)).toBe(true);
  });

  it("senza seme precedente, una superficie con un seme vecchio vede comunque il tap", () => {
    const key = savedKey(profile);
    at(200);
    const seq = beginSavedMutation(key, true);
    endSavedMutation(key, seq, { ok: true, value: true });

    expect(getSavedValue(profile, false, 100)).toBe(true);
  });
});

describe("store — rollback (§97–§98, §170)", () => {
  it("l'errore riporta all'ultimo stato confermato", () => {
    const key = savedKey(post);
    seedSaved(key, true);
    const seq = beginSavedMutation(key, false);
    expect(getSavedValue(post, true)).toBe(false);

    endSavedMutation(key, seq, { ok: false, rollbackTo: true });

    expect(getSavedValue(post, true)).toBe(true);
    expect(getSavedEntry(key)?.pending).toBe(0);
  });

  it("senza stato confermato usa lo stato prima del tap", () => {
    const key = savedKey(post);
    const seq = beginSavedMutation(key, true);

    endSavedMutation(key, seq, { ok: false, rollbackTo: false });

    expect(getSavedValue(post)).toBe(false);
  });

  it("con due tap ravvicinati, il fallimento del primo non cancella il secondo", () => {
    const key = savedKey(post);
    seedSaved(key, false);
    const first = beginSavedMutation(key, true);
    const second = beginSavedMutation(key, false);

    endSavedMutation(key, first, { ok: false, rollbackTo: false });
    expect(getSavedValue(post, false)).toBe(false);
    expect(getSavedEntry(key)?.pending).toBe(1);

    endSavedMutation(key, second, { ok: true, value: false });
    expect(getSavedEntry(key)?.pending).toBe(0);
  });

  it("se il secondo tap fallisce torna all'ultimo valore confermato, non a quello mai scritto", () => {
    const key = savedKey(post);
    seedSaved(key, false);
    const first = beginSavedMutation(key, true);
    const second = beginSavedMutation(key, false);

    endSavedMutation(key, first, { ok: true, value: true });
    endSavedMutation(key, second, { ok: false, rollbackTo: true });

    expect(getSavedValue(post, false)).toBe(true);
  });
});

describe("useIsSaved — granularità per cella (§136–§137)", () => {
  const renders = { a: 0, b: 0 };
  const trees: TestRenderer.ReactTestRenderer[] = [];

  afterEach(() => {
    trees.splice(0).forEach((tree) => act(() => tree.unmount()));
    renders.a = 0;
    renders.b = 0;
  });

  function Cell({ id, slot, seed }: { id: string; slot: "a" | "b"; seed: boolean }) {
    const saved = useIsSaved({ id, type: "profile" }, seed);
    renders[slot] += 1;
    return <>{saved ? "saved" : "not-saved"}</>;
  }

  function text(tree: TestRenderer.ReactTestRenderer) {
    return JSON.stringify(tree.toJSON());
  }

  function mountCell(props: { id: string; slot: "a" | "b"; seed: boolean }) {
    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(<Cell {...props} />);
    });
    trees.push(tree);
    return tree;
  }

  it("un toggle rirenderizza solo la cella abbonata", () => {
    const treeA = mountCell({ id: "a", seed: false, slot: "a" });
    const treeB = mountCell({ id: "b", seed: false, slot: "b" });

    const beforeB = renders.b;

    act(() => {
      const seq = beginSavedMutation(savedKey({ id: "a", type: "profile" }), true);
      endSavedMutation(savedKey({ id: "a", type: "profile" }), seq, { ok: true, value: true });
    });

    expect(text(treeA)).toContain("saved");
    expect(text(treeA)).not.toContain("not-saved");
    expect(text(treeB)).toContain("not-saved");
    expect(renders.b).toBe(beforeB);
  });

  it("due superfici dello stesso target restano allineate (§133)", () => {
    const first = mountCell({ id: "x", seed: false, slot: "a" });
    const second = mountCell({ id: "x", seed: false, slot: "b" });

    act(() => {
      const seq = beginSavedMutation(savedKey({ id: "x", type: "profile" }), true);
      endSavedMutation(savedKey({ id: "x", type: "profile" }), seq, { ok: true, value: true });
    });

    expect(text(first)).toBe(text(second));
    expect(text(first)).not.toContain("not-saved");
  });

  it("il rollback si propaga a tutte le superfici", () => {
    const tree = mountCell({ id: "y", seed: false, slot: "a" });
    const key = savedKey({ id: "y", type: "profile" });

    let seq = 0;
    act(() => {
      seq = beginSavedMutation(key, true);
    });
    expect(text(tree)).not.toContain("not-saved");

    act(() => {
      endSavedMutation(key, seq, { ok: false, rollbackTo: false });
    });
    expect(text(tree)).toContain("not-saved");
  });
});
