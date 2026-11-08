import { describe, expect, it } from "vitest";

import {
  LIST_NAME_MAX_LENGTH,
  PROFILE_SHORTLIST_COPY,
  addFailureCopy,
  afterRemove,
  createErrorFields,
  destinationLines,
  formIntentLine,
  groupMemberships,
  isDefinitiveFailure,
  listFormSubmittable,
  membershipActions,
  membershipLines,
  removeBody,
  selectorPresentation,
  starPresentation,
  summaryTitle,
  validateListForm,
} from "./profile-shortlist-presentation";
import type { ProfileDestination, ProfileMembership } from "./profile-shortlist-types";

const membership = (patch: Partial<ProfileMembership> = {}): ProfileMembership => ({
  canEditNote: true,
  canEditStatus: true,
  canRemove: true,
  entryId: "e1",
  evaluationStatus: "da_valutare",
  generation: 1,
  isClosed: false,
  isDraft: false,
  kind: "position",
  positionId: "p1",
  priority: null,
  revision: 1,
  scopeLabel: "Prima squadra",
  shortlistId: "s1",
  title: "Centrocampista",
  ...patch,
});

const destination = (patch: Partial<ProfileDestination> = {}): ProfileDestination => ({
  isClosed: false,
  isDraft: false,
  kind: "position",
  positionId: "p1",
  scopeLabel: "Prima squadra",
  shortlistId: null,
  title: "Centrocampista",
  ...patch,
});

describe("starPresentation (§9)", () => {
  it("QA011: stato non ancora noto o in errore non diventa ☆", () => {
    expect(starPresentation({ state: undefined })).toBe("hidden");
  });

  it("QA001: nessuna membership e add consentito → ☆", () => {
    expect(
      starPresentation({
        state: { available: true, canAdd: true, canCreate: true, inAnyList: false, verifiedAt: null },
      }),
    ).toBe("empty");
  });

  it("QA007: membership leggibile senza add → ★ consultabile", () => {
    expect(
      starPresentation({
        state: { available: true, canAdd: false, canCreate: false, inAnyList: true, verifiedAt: null },
      }),
    ).toBe("filled");
  });

  it("QA008: nessuna membership e nessun add → nessuna stella disabilitata", () => {
    expect(
      starPresentation({
        state: { available: true, canAdd: false, canCreate: false, inAnyList: false, verifiedAt: null },
      }),
    ).toBe("hidden");
    expect(starPresentation({ state: { available: false, verifiedAt: null } })).toBe("hidden");
  });
});

describe("righe del selector e del riepilogo (§11, §14)", () => {
  it("QA023/QA025: Bozza e Posizione chiusa sono testo, accanto all'ambito", () => {
    expect(destinationLines(destination({ isDraft: true, scopeLabel: "Primavera" })).meta).toBe(
      "Primavera · Bozza",
    );
    expect(destinationLines(destination({ isClosed: true })).meta).toBe(
      "Prima squadra · Posizione chiusa",
    );
    expect(destinationLines(destination()).meta).toBe("Prima squadra");
  });

  it("QA049: priorità nulla omessa, nessun warning", () => {
    expect(membershipLines(membership()).evaluation).toBe("Da valutare");
    expect(
      membershipLines(membership({ evaluationStatus: "interessante", priority: "alta" })).evaluation,
    ).toBe("Alta · Interessante");
  });

  it("QA048: Position e CUSTOM in due gruppi dello stesso componente", () => {
    const groups = groupMemberships([
      membership(),
      membership({ entryId: "e2", kind: "custom", positionId: null, title: "Under 21 Lombardia" }),
    ]);
    expect(groups.positions.map((item) => item.entryId)).toEqual(["e1"]);
    expect(groups.custom.map((item) => item.entryId)).toEqual(["e2"]);
  });

  it("QA055: sola lettura → nessuna modifica né rimozione", () => {
    expect(
      membershipActions(membership({ canEditNote: false, canEditStatus: false, canRemove: false })),
    ).toEqual({ canEdit: false, canRemove: false });
    expect(membershipActions(membership({ canEditStatus: false })).canEdit).toBe(true);
  });
});

describe("copy canonica (§31)", () => {
  it("usa le stringhe della task", () => {
    expect(summaryTitle("Mario Rossi")).toBe("Mario Rossi è in shortlist");
    expect(formIntentLine("Mario Rossi")).toBe("Aggiungerai Mario Rossi alla nuova lista.");
    expect(PROFILE_SHORTLIST_COPY.emptyBody).toBe(
      "Non ci sono altre liste disponibili per questo profilo.",
    );
  });

  it("QA092: la conferma nomina persona e destinazione, senza duplicare l'ambito", () => {
    expect(removeBody({ name: "Mario Rossi", scopeLabel: "Prima squadra", title: "Centrocampista" })).toBe(
      "Mario Rossi verrà rimosso da Centrocampista · Prima squadra.",
    );
    expect(
      removeBody({ name: "Mario Rossi", scopeLabel: "Primavera", title: "Osservati Primavera" }),
    ).toBe("Mario Rossi verrà rimosso da Osservati Primavera.");
  });
});

describe("rimozione (§21)", () => {
  it("QA094/QA095: la destinazione la decide l'esito del comando", () => {
    expect(afterRemove(true)).toBe("summary");
    expect(afterRemove(false)).toBe("profile");
  });
});

describe("form CUSTOM (§16, §17)", () => {
  it("QA059: nome vuoto o soli spazi → non inviabile", () => {
    expect(listFormSubmittable({ description: "", name: "   ", scopeChosen: true })).toBe(false);
  });

  it("QA063: ambito mancante → non inviabile, nessun fallback", () => {
    expect(listFormSubmittable({ description: "", name: "Osservati", scopeChosen: false })).toBe(false);
    expect(listFormSubmittable({ description: "", name: "Osservati", scopeChosen: true })).toBe(true);
  });

  it("QA060: oltre il limite il testo resta e il campo segnala l'errore", () => {
    const long = "x".repeat(LIST_NAME_MAX_LENGTH + 1);
    expect(validateListForm({ description: "", name: long, scopeChosen: true }).name).toMatch(/80/);
    expect(listFormSubmittable({ description: "", name: long, scopeChosen: true })).toBe(false);
  });

  it("errori del server sul campo che li causa", () => {
    expect(createErrorFields("scopeInvalid").scope).toBe(PROFILE_SHORTLIST_COPY.scopeInvalid);
    expect(createErrorFields("nameRequired").name).toBe(PROFILE_SHORTLIST_COPY.nameRequired);
    expect(createErrorFields("network").banner).toBe(PROFILE_SHORTLIST_COPY.createError);
  });
});

describe("errori e retry (§25, §27)", () => {
  it("QA045: dopo un errore di rete la chiave resta (esito incerto)", () => {
    expect(isDefinitiveFailure("network")).toBe(false);
    expect(isDefinitiveFailure("notFound")).toBe(true);
  });

  it("destinazione non più disponibile senza rivelare il motivo", () => {
    expect(addFailureCopy("notFound")).toBe(PROFILE_SHORTLIST_COPY.unavailable);
    expect(addFailureCopy("notAuthorized")).toBe(PROFILE_SHORTLIST_COPY.unavailable);
    expect(addFailureCopy("network")).toBe(PROFILE_SHORTLIST_COPY.addError);
  });
});

describe("selectorPresentation (§11)", () => {
  const ok = { error: false, items: 2, loading: false };

  it("QA028: vuoto soltanto dopo due risposte valide vuote", () => {
    expect(
      selectorPresentation({
        custom: { ...ok, items: 0 },
        position: { ...ok, items: 0 },
      }),
    ).toBe("empty");
  });

  it("QA029: un gruppo in errore non è un vuoto", () => {
    expect(
      selectorPresentation({
        custom: ok,
        position: { error: true, items: 0, loading: false },
      }),
    ).toBe("content");
    expect(
      selectorPresentation({
        custom: { ...ok, items: 0 },
        position: { error: true, items: 0, loading: false },
      }),
    ).toBe("content");
  });

  it("errore di entrambi → errore totale", () => {
    expect(
      selectorPresentation({
        custom: { error: true, items: 0, loading: false },
        position: { error: true, items: 0, loading: false },
      }),
    ).toBe("totalError");
  });
});
