/**
 * Modello del Master Profile Tifoso (REV-PROF-19).
 *
 * Copre le regole che non devono poter cambiare per distrazione: la label
 * pubblica, le capabilities di Owner e Visitor, la separazione fra Tribuna e
 * Media, la deduplicazione per id e la normalizzazione delle tassonomie.
 */
import { describe, expect, it } from "vitest";

import {
  buildFanCapabilities,
  buildFanCategoryChips,
  buildFanInterestChips,
  dedupeFanContentById,
  FAN_ROLE_LABEL,
  formatFanRoleLabel,
  isFanMediaKind,
  isFanRoleId,
  isFanTribunaKind,
  sortFanTribunaPosts,
} from "./fan-master-profile";

describe("label del ruolo", () => {
  it("mappa gli identificativi tecnici sulla sola label pubblica Tifoso", () => {
    expect(FAN_ROLE_LABEL).toBe("Tifoso");
    expect(formatFanRoleLabel("fan")).toBe("Tifoso");
    expect(formatFanRoleLabel("supporter")).toBe("Tifoso");
    expect(formatFanRoleLabel("enthusiast")).toBe("Tifoso");
  });

  it("non etichetta Tifoso un profilo che non lo è", () => {
    expect(formatFanRoleLabel("media")).toBeNull();
    expect(formatFanRoleLabel("player")).toBeNull();
    expect(formatFanRoleLabel(null)).toBeNull();
    expect(isFanRoleId("media")).toBe(false);
  });

  it("non produce mai la parola Appassionato", () => {
    for (const role of ["fan", "supporter", "enthusiast"]) {
      expect(formatFanRoleLabel(role)).not.toMatch(/appassionat/i);
    }
  });
});

describe("capabilities", () => {
  it("dà all'Owner modifica e creazione, mai Segui o Messaggio verso sé stesso", () => {
    const owner = buildFanCapabilities({ isOwner: true });

    expect(owner.canEditProfile).toBe(true);
    expect(owner.canCreateContent).toBe(true);
    expect(owner.canFollow).toBe(false);
    expect(owner.canMessage).toBe(false);
    expect(owner.canBlockOrReport).toBe(false);
  });

  it("dà al Visitor le azioni sociali e nessuna azione Owner", () => {
    const visitor = buildFanCapabilities({ isOwner: false });

    expect(visitor.canEditProfile).toBe(false);
    expect(visitor.canCreateContent).toBe(false);
    expect(visitor.canFollow).toBe(true);
    expect(visitor.canMessage).toBe(true);
  });

  it("toglie le azioni sociali a un ospite non autenticato e in caso di blocco", () => {
    const guest = buildFanCapabilities({
      isOwner: false,
      isViewerAuthenticated: false,
    });
    const blocked = buildFanCapabilities({ isBlocked: true, isOwner: false });

    expect(guest.canFollow).toBe(false);
    expect(guest.canMessage).toBe(false);
    expect(blocked.canFollow).toBe(false);
    expect(blocked.canMessage).toBe(false);
    expect(blocked.canBlockOrReport).toBe(false);
  });

  it("non lascia creare contenuti a un account che non può pubblicare", () => {
    expect(
      buildFanCapabilities({ canPublish: false, isOwner: true })
        .canCreateContent,
    ).toBe(false);
  });
});

describe("separazione Tribuna / Media", () => {
  it("manda Opinione, Sondaggio e Formazione in Tribuna", () => {
    expect(isFanTribunaKind("opinion")).toBe(true);
    expect(isFanTribunaKind("poll")).toBe(true);
    expect(isFanTribunaKind("formation")).toBe(true);
  });

  it("tiene foto e video fuori dalla Tribuna", () => {
    expect(isFanTribunaKind("photo")).toBe(false);
  });

  it("manda solo foto e video in Media", () => {
    expect(isFanMediaKind("photo")).toBe(true);
    expect(isFanMediaKind("opinion")).toBe(false);
    expect(isFanMediaKind("poll")).toBe(false);
    expect(isFanMediaKind("formation")).toBe(false);
  });

  it("tiene la Proposta legacy in Tribuna e non in Media", () => {
    expect(isFanTribunaKind("proposal")).toBe(true);
    expect(isFanMediaKind("proposal")).toBe(false);
  });

  it("non classifica un contenuto senza tipo valido", () => {
    expect(isFanTribunaKind("articolo")).toBe(false);
    expect(isFanMediaKind("articolo")).toBe(false);
    expect(isFanTribunaKind(null)).toBe(false);
    expect(isFanMediaKind(undefined)).toBe(false);
  });
});

describe("deduplicazione e ordinamento", () => {
  it("mostra una sola volta un contenuto che torna in due pagine", () => {
    const deduped = dedupeFanContentById([
      { id: "a" },
      { id: "b" },
      { id: "a" },
    ]);

    expect(deduped.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("ordina dalla pubblicazione più recente alla meno recente", () => {
    const sorted = sortFanTribunaPosts([
      { created_at: "2026-01-01T00:00:00Z", id: "vecchio", published_at: "2026-01-01T00:00:00Z" },
      { created_at: "2026-03-01T00:00:00Z", id: "nuovo", published_at: "2026-03-01T00:00:00Z" },
      { created_at: "2026-02-01T00:00:00Z", id: "mezzo", published_at: null },
    ]);

    expect(sorted.map((post) => post.id)).toEqual(["nuovo", "mezzo", "vecchio"]);
  });
});

describe("tassonomie pubbliche", () => {
  it("mostra le label degli interessi, mai gli identificativi", () => {
    const chips = buildFanInterestChips(["amateur", "professional"]);

    expect(chips.map((chip) => chip.label)).toEqual([
      "Calcio professionistico",
      "Calcio dilettantistico",
    ]);
    expect(chips.map((chip) => chip.label).join(" ")).not.toContain(
      "professional",
    );
  });

  it("scarta un interesse che non appartiene più alla tassonomia", () => {
    expect(buildFanInterestChips(["futsal"])).toEqual([]);
  });

  it("deduplica gli interessi ripetuti", () => {
    expect(buildFanInterestChips(["youth", "youth"])).toHaveLength(1);
  });

  it("normalizza le categorie legacy e le ordina per livello", () => {
    const chips = buildFanCategoryChips([
      "juniores",
      "Serie B",
      "promozione",
      "Serie B",
    ]);

    expect(chips.map((chip) => chip.label)).toEqual([
      "Serie B",
      "Promozione",
      "Juniores",
    ]);
  });

  it("preserva un valore legacy non mappabile invece di farlo sparire", () => {
    const chips = buildFanCategoryChips(["Serie B", "Coppa Italia Dilettanti"]);

    expect(chips.map((chip) => chip.label)).toEqual([
      "Serie B",
      "Coppa Italia Dilettanti",
    ]);
  });

  it("non produce chip da un dato assente", () => {
    expect(buildFanInterestChips(null)).toEqual([]);
    expect(buildFanCategoryChips(undefined)).toEqual([]);
    expect(buildFanCategoryChips([" ", ""])).toEqual([]);
  });
});
