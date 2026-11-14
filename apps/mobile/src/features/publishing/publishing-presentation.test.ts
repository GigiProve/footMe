import { describe, expect, it } from "vitest";

import { shouldRestoreLocal } from "./draft-local-store";
import {
  civilToInstant,
  draftMenuActions,
  draftRowAccessibilityLabel,
  draftsEntryTab,
  draftRowTitle,
  draftTypeLabel,
  editedAgoLabel,
  failedMenuActions,
  formatScheduleAccessible,
  formatScheduleShort,
  itemMenu,
  launcherRows,
  listCountLabel,
  primaryCtaLabel,
  publicationRowLabel,
  resolveLauncherMode,
  scheduledMenuActions,
  submitSuccessCopy,
  validateScheduleChoice,
} from "./publishing-presentation";
import type { ContentLauncherState, Publication } from "./publishing-types";

// 20 agosto 2026 18:30 nel fuso del dispositivo di test.
const AUG20 = new Date(2026, 7, 20, 18, 30).toISOString();
const SCHEDULED: Publication = { mode: "scheduled", scheduledAt: AUG20, timezone: "Europe/Rome" };

describe("CTA (§77–§80, §92–§94, criterio 102)", () => {
  it("Ora → Pubblica, data futura → Programma, mai Programma con Ora", () => {
    expect(primaryCtaLabel({ mode: "now" })).toBe("Pubblica");
    expect(primaryCtaLabel(SCHEDULED)).toBe("Programma");
  });

  it("in modifica di un programmato o di un pubblicato la CTA è Salva", () => {
    expect(primaryCtaLabel(SCHEDULED, { editing: "scheduled" })).toBe("Salva");
    expect(primaryCtaLabel({ mode: "now" }, { editing: "published" })).toBe("Salva");
  });

  it("riga Pubblicazione", () => {
    expect(publicationRowLabel({ mode: "now" })).toBe("Pubblicazione · Ora");
    expect(publicationRowLabel(SCHEDULED)).toBe("Pubblicazione · 20 ago · 18:30");
  });

  it("feedback di successo (§209–§211)", () => {
    expect(submitSuccessCopy("article", { mode: "now" })).toBe("Articolo pubblicato");
    expect(submitSuccessCopy("article", SCHEDULED)).toBe("Articolo programmato per il 20 agosto alle 18:30");
    expect(submitSuccessCopy("post", SCHEDULED)).toBe("Post programmato per il 20 agosto alle 18:30");
  });

  it("annuncio accessibile (§253)", () => {
    expect(formatScheduleAccessible(AUG20)).toBe("Pubblicazione programmata per 20 agosto 2026 alle 18:30");
  });

  it("il fuso esplicito sposta solo la visualizzazione, non l'istante (§100–§102)", () => {
    const instant = "2026-08-20T16:30:00.000Z";
    expect(formatScheduleShort(instant, "Europe/Rome")).toBe("20 ago · 18:30");
    expect(formatScheduleShort(instant, "UTC")).toBe("20 ago · 16:30");
  });
});

describe("scelta di data e ora (§95–§98)", () => {
  const policy = { maxHorizonDays: 365, minLeadMinutes: 5 };
  const now = new Date(2026, 7, 20, 18, 0);

  it("accetta una data futura oltre il lead time e restituisce l'istante UTC", () => {
    const result = validateScheduleChoice({ date: "2026-08-20", time: "18:30" }, policy, now);
    expect(result).toEqual({ ok: true, scheduledAt: AUG20 });
  });

  it("rifiuta passato, troppo vicino, troppo lontano e date inesistenti", () => {
    expect(validateScheduleChoice({ date: "2026-08-20", time: "17:00" }, policy, now)).toEqual({ ok: false, reason: "past" });
    expect(validateScheduleChoice({ date: "2026-08-20", time: "18:03" }, policy, now)).toEqual({ ok: false, reason: "too_soon" });
    expect(validateScheduleChoice({ date: "2028-01-01", time: "10:00" }, policy, now)).toEqual({ ok: false, reason: "too_far" });
    expect(validateScheduleChoice({ date: "2026-02-31", time: "10:00" }, policy, now)).toEqual({ ok: false, reason: "invalid" });
    expect(civilToInstant({ date: "2026-8-1", time: "10:00" })).toBeNull();
  });

  it("una scelta valida può diventare passata: si rivalida alla conferma (§98)", () => {
    const later = new Date(2026, 7, 20, 18, 31);
    expect(validateScheduleChoice({ date: "2026-08-20", time: "18:30" }, policy, later)).toEqual({ ok: false, reason: "past" });
  });
});

describe("lista (§140–§146, §149, §162, §195)", () => {
  it("titoli di ripiego umani, mai id o null", () => {
    expect(draftRowTitle({ format: "article", previewText: "corpo", title: "  " })).toBe("Articolo senza titolo");
    expect(draftRowTitle({ format: "post", previewText: null, title: null })).toBe("Post senza testo");
    expect(draftRowTitle({ format: "post", previewText: "Allenamento di questa mattina", title: null })).toBe(
      "Allenamento di questa mattina",
    );
  });

  it("tipo sempre Post/Articolo, modalità come nota sobria (§7V)", () => {
    expect(draftTypeLabel({ creationMode: null, format: "post" })).toBe("Post");
    expect(draftTypeLabel({ creationMode: "native", format: "article" })).toBe("Articolo");
    expect(draftTypeLabel({ creationMode: "external_link", format: "article" })).toBe("Articolo · Da link");
  });

  it("ultima modifica", () => {
    const now = new Date(2026, 7, 20, 12, 0);
    expect(editedAgoLabel(new Date(2026, 7, 20, 11, 48).toISOString(), now)).toBe("Modificato 12 min fa");
    expect(editedAgoLabel(new Date(2026, 7, 19, 10, 0).toISOString(), now)).toBe("Modificato ieri");
    expect(editedAgoLabel(new Date(2026, 7, 18, 10, 0).toISOString(), now)).toBe("Modificato 2 giorni fa");
  });

  it("menu guidati dalle capability del server", () => {
    const all = { canDelete: true, canEdit: true, canSchedule: true };
    expect(draftMenuActions(all)).toEqual(["edit", "schedule", "delete"]);
    expect(draftMenuActions({ ...all, canSchedule: false })).toEqual(["edit", "delete"]);
    expect(scheduledMenuActions({ ...all, status: "scheduled" })).toEqual([
      "edit",
      "reschedule",
      "publish_now",
      "move_to_draft",
      "delete",
    ]);
    expect(scheduledMenuActions({ ...all, status: "publishing" })).toEqual([]);
    expect(failedMenuActions(all)).toEqual(["retry", "edit", "move_to_draft", "delete"]);
  });

  it("menu con etichette della spec e divisore prima dell'azione distruttiva (§149, §162, §195)", () => {
    const all = { canDelete: true, canEdit: true, canSchedule: true };
    const labels = (item: Parameters<typeof itemMenu>[0]) => itemMenu(item).map((entry) => entry.label);

    expect(labels({ ...all, status: "draft" })).toEqual(["Modifica", "Programma", "Elimina bozza"]);
    expect(labels({ ...all, status: "scheduled" })).toEqual([
      "Modifica contenuto",
      "Cambia data e ora",
      "Pubblica ora",
      "Sposta nelle bozze",
      "Elimina",
    ]);
    expect(labels({ ...all, status: "failed" })).toEqual(["Riprova", "Modifica", "Sposta nelle bozze", "Elimina"]);
    expect(itemMenu({ ...all, status: "publishing" })).toEqual([]);

    const entries = itemMenu({ ...all, status: "scheduled" });
    expect(entries.filter((entry) => entry.dividerBefore).map((entry) => entry.id)).toEqual(["delete"]);
    expect(entries.filter((entry) => entry.destructive).map((entry) => entry.id)).toEqual(["delete"]);
  });

  it("conteggio in fondo alla lista, singolare e plurale (mockup 6–7)", () => {
    expect(listCountLabel("drafts", 4)).toBe("4 bozze");
    expect(listCountLabel("drafts", 1)).toBe("1 bozza");
    expect(listCountLabel("scheduled", 3)).toBe("3 programmati");
    expect(listCountLabel("scheduled", 1)).toBe("1 programmato");
  });

  it("ogni riga si legge come un'unità: titolo, autore verificato, tipo, poi data o ultima modifica (§253–§254)", () => {
    const now = new Date(2026, 7, 20, 12, 0);
    const base = {
      creationMode: null,
      format: "post" as const,
      identity: { avatarUrl: null, id: "c1", isVerified: true, name: "AC Como", type: "society" as const },
      previewText: null,
      scheduledAt: null,
      status: "draft" as const,
      title: null,
      updatedAt: new Date(2026, 7, 20, 11, 48).toISOString(),
    };

    expect(draftRowAccessibilityLabel(base, now)).toBe(
      "Post senza testo. AC Como, profilo verificato. Post. Modificato 12 min fa",
    );
    expect(
      draftRowAccessibilityLabel(
        { ...base, scheduledAt: AUG20, status: "scheduled", title: "Nuova stagione" },
        now,
      ),
    ).toBe(
      "Nuova stagione. AC Como, profilo verificato. Post. Pubblicazione programmata per 20 agosto 2026 alle 18:30",
    );
    expect(draftRowAccessibilityLabel({ ...base, scheduledAt: AUG20, status: "failed" }, now)).toContain(
      "Pubblicazione non riuscita",
    );
  });
});

describe("launcher (§4–§10)", () => {
  const base: ContentLauncherState = {
    canPublishArticle: false,
    canPublishPost: true,
    canViewDrafts: true,
    draftsCount: 0,
    failedCount: 0,
    scheduledCount: 0,
  };

  it("solo Post e nulla in sospeso → composer diretto (§5)", () => {
    expect(resolveLauncherMode(base)).toBe("direct_post");
  });

  it("bozze o programmati raggiungibili anche senza Articolo (§9)", () => {
    expect(resolveLauncherMode({ ...base, draftsCount: 1 })).toBe("sheet");
    expect(resolveLauncherMode({ ...base, failedCount: 1 })).toBe("sheet");
  });

  it("Articolo o altre azioni → sheet Crea contenuto (§6)", () => {
    expect(resolveLauncherMode({ ...base, canPublishArticle: true })).toBe("sheet");
    expect(resolveLauncherMode(base, ["open_position"])).toBe("sheet");
    expect(resolveLauncherMode(null)).toBe("direct_post");
  });

  it("le righe seguono le capability: Articolo solo con can_publish_article (§8), Bozze indipendente da Articolo (§9)", () => {
    expect(launcherRows({ ...base, draftsCount: 2 })).toEqual({ primary: ["post"], secondary: ["drafts"] });
    expect(launcherRows({ ...base, canPublishArticle: true })).toEqual({
      primary: ["post", "article"],
      secondary: ["drafts"],
    });
    expect(launcherRows({ ...base, canViewDrafts: false })).toEqual({ primary: ["post"], secondary: [] });
  });

  it("senza can_publish_post il Post non è nel foglio; con stato ignoto resta solo il Post (§5)", () => {
    expect(launcherRows({ ...base, canPublishArticle: true, canPublishPost: false }).primary).toEqual(["article"]);
    expect(launcherRows(null)).toEqual({ primary: ["post"], secondary: [] });
  });

  it("«Bozze e programmati» si apre dove c'è qualcosa: Programmati se ci sono solo programmati o falliti", () => {
    expect(draftsEntryTab(base)).toBe("drafts");
    expect(draftsEntryTab({ ...base, draftsCount: 3, scheduledCount: 1 })).toBe("drafts");
    expect(draftsEntryTab({ ...base, scheduledCount: 2 })).toBe("scheduled");
    expect(draftsEntryTab({ ...base, failedCount: 1 })).toBe("scheduled");
    expect(draftsEntryTab(null)).toBe("drafts");
  });

  it("«Posizione aperta» resta sotto il divisore per chi ha quell'azione", () => {
    expect(launcherRows(base, ["open_position"]).secondary).toEqual(["drafts", "open_position"]);
    expect(launcherRows(null, ["open_position"])).toEqual({ primary: ["post"], secondary: ["open_position"] });
  });
});

describe("copia locale (§127–§128)", () => {
  it("vince solo con modifiche più recenti sulla stessa versione del server", () => {
    const server = { updatedAt: "2026-08-20T10:00:00Z", version: 3 };
    expect(shouldRestoreLocal({ baseVersion: 3, savedAt: "2026-08-20T10:05:00Z" }, server)).toBe(true);
    expect(shouldRestoreLocal({ baseVersion: 3, savedAt: "2026-08-20T09:00:00Z" }, server)).toBe(false);
    expect(shouldRestoreLocal({ baseVersion: 2, savedAt: "2026-08-20T10:05:00Z" }, server)).toBe(false);
    expect(shouldRestoreLocal({ baseVersion: null, savedAt: "2026-08-20T10:05:00Z" }, null)).toBe(true);
    expect(shouldRestoreLocal(null, server)).toBe(false);
  });
});
