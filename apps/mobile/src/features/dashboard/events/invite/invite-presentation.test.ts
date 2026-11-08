/**
 * DAS-REV-30 §13–§17: selezione, cambio sorgente, messaggio, esito del
 * batch ed errori dell'invio. Pura logica, senza schermata.
 */
import { describe, expect, it } from "vitest";

import { SelectionEventsError } from "../events-service";
import {
  EMPTY_SELECTION,
  INVITE_COPY,
  candidateMeta,
  inviteMessageError,
  normalizeInviteMessage,
  outcomeView,
  reconcileSelection,
  selectedCountLabel,
  sendErrorCopy,
  sourceChangeDecision,
  sourceLabel,
  toggleCandidate,
} from "./invite-presentation";
import { mapCandidatesPage, mapInvitableEvents, mapInviteResult, mapInviteSources } from "./invite-service";
import type { InviteCandidate, InviteSourceList } from "./invite-types";

const candidate = (patch: Partial<InviteCandidate> = {}): InviteCandidate => ({
  avatarUrl: null,
  fullName: "Mario Rossi",
  personId: "mario",
  primaryPosition: null,
  reason: null,
  relationStatus: null,
  role: "player",
  selectable: true,
  ...patch,
});

const list: InviteSourceList = {
  listType: "custom",
  name: "Talenti da seguire",
  scopeLabel: "Intera società",
  shortlistId: "l1",
};

describe("selezione (§15)", () => {
  it("una persona una volta; deselezione dell'ultima → zero", () => {
    let selection = toggleCandidate(EMPTY_SELECTION, candidate());

    selection = toggleCandidate(selection, candidate({ fullName: "Luca Bianchi", personId: "luca" }));
    expect(selection.size).toBe(2);
    expect(selectedCountLabel(selection.size)).toBe("2 selezionati");

    selection = toggleCandidate(selection, candidate());
    selection = toggleCandidate(selection, candidate({ personId: "luca" }));
    expect(selection.size).toBe(0);
  });

  it("non selezionabile: non entra mai (QA-022..024)", () => {
    const selection = toggleCandidate(
      EMPTY_SELECTION,
      candidate({ personId: "andrea", reason: "already_invited", selectable: false }),
    );

    expect(selection.size).toBe(0);
  });

  it("la selezione sopravvive a un'altra pagina della stessa sorgente (QA-029)", () => {
    const selection = toggleCandidate(EMPTY_SELECTION, candidate());

    expect(reconcileSelection(selection, [candidate({ personId: "altro" })])).toBe(selection);
  });

  it("una persona diventata non selezionabile esce dal contatore", () => {
    const selection = toggleCandidate(EMPTY_SELECTION, candidate());
    const next = reconcileSelection(selection, [candidate({ reason: "already_confirmed", selectable: false })]);

    expect(next.size).toBe(0);
  });

  it("righe non selezionabili dicono perché", () => {
    expect(candidateMeta(candidate({ reason: "already_invited", selectable: false }))).toBe("Già invitato");
    expect(candidateMeta(candidate({ reason: "already_confirmed", selectable: false }))).toBe("Già confermato");
    expect(candidateMeta(candidate({ reason: "pending_request", selectable: false }))).toBe("Richiesta in attesa");
    expect(candidateMeta(candidate())).toBe("Calciatore");
  });
});

describe("sorgenti (§14, §15)", () => {
  it("cambio con selezioni chiede conferma, senza è immediato, stesso elenco nessun cambio", () => {
    expect(sourceChangeDecision(null, list, 2)).toBe("confirm");
    expect(sourceChangeDecision(null, list, 0)).toBe("immediate");
    expect(sourceChangeDecision(list, { ...list }, 2)).toBe("none");
    expect(sourceChangeDecision(list, null, 1)).toBe("confirm");
  });

  it("etichette", () => {
    expect(sourceLabel(null)).toBe("Tutti i profili");
    expect(sourceLabel(list)).toBe("Talenti da seguire");
    expect(sourceLabel({ ...list, listType: "position", name: "Attaccante", scopeLabel: "Primavera" })).toBe(
      "Attaccante · Primavera",
    );
  });

  it("mappatura delle sorgenti autorizzate", () => {
    const sources = mapInviteSources({
      position_lists: [{ shortlist_id: "p1", name: "Attaccante", scope_label: "Primavera" }],
      custom_lists: [{ shortlist_id: "c1", name: "Talenti da seguire", scope_label: null }, { name: "senza id" }],
    });

    expect(sources.positionLists).toEqual([
      { listType: "position", name: "Attaccante", scopeLabel: "Primavera", shortlistId: "p1" },
    ]);
    expect(sources.customLists).toHaveLength(1);
  });
});

describe("messaggio (§15)", () => {
  it("solo spazi → null; oltre limite errore inline", () => {
    expect(normalizeInviteMessage("   ")).toBeNull();
    expect(normalizeInviteMessage("  Ciao  ")).toBe("Ciao");
    expect(inviteMessageError("x".repeat(500), 500)).toBeNull();
    expect(inviteMessageError("x".repeat(501), 500)).toBe(INVITE_COPY.messageTooLong(500));
  });
});

describe("esito del batch (§16, screen 20)", () => {
  const result = (patch: Record<string, unknown>) =>
    mapInviteResult({
      sent_count: 0,
      skipped_count: 0,
      items: [],
      confirmed_count: 32,
      pending_count: 8,
      invited_count: 14,
      ...patch,
    });

  it("successo completo", () => {
    expect(outcomeView(result({ sent_count: 2, items: [] }))).toEqual({ kind: "success", message: "Inviti inviati." });
    expect(outcomeView(result({ sent_count: 1 }))).toEqual({ kind: "success", message: "Invito inviato." });
  });

  it("parziale: copy della task e righe per destinatario", () => {
    const view = outcomeView(
      result({
        sent_count: 1,
        skipped_count: 1,
        items: [
          { person_id: "mario", full_name: "Mario Rossi", outcome: "sent" },
          { person_id: "luca", full_name: "Luca Bianchi", outcome: "already_confirmed" },
        ],
      }),
    );

    expect(view).toEqual({
      kind: "partial",
      lines: [
        { label: "Invito inviato", name: "Mario Rossi" },
        { label: "Già confermato", name: "Luca Bianchi" },
      ],
      summary: ["1 invito inviato.", "1 profilo non era più disponibile."],
    });
  });

  it("zero successi non è «Inviti inviati»; identità non più visibile resta generica", () => {
    const view = outcomeView(
      result({ sent_count: 0, skipped_count: 1, items: [{ person_id: null, full_name: null, outcome: "unavailable" }] }),
    );

    expect(view.kind).toBe("none");
    expect(view.kind !== "success" && view.summary[0]).toBe("Nessun invito inviato.");
    expect(view.kind !== "success" && view.lines[0]).toEqual({ label: "Profilo non più disponibile", name: "Profilo" });
  });

  it("esito sconosciuto ignorato, mai trasformato in inviato", () => {
    expect(result({ items: [{ person_id: "x", outcome: "teleported" }] }).items).toEqual([]);
  });
});

describe("errori dell'invio (§29)", () => {
  it("dominio, permesso, antispam e rete restano distinti", () => {
    expect(sendErrorCopy(new SelectionEventsError("SELECTION_EVENT_FULL")).message).toBe(INVITE_COPY.fullError);
    expect(sendErrorCopy(new SelectionEventsError("SELECTION_EVENT_NOT_AUTHORIZED")).message).toBe(
      INVITE_COPY.notAuthorized,
    );
    expect(sendErrorCopy(new SelectionEventsError("RATE_LIMIT")).message).toBe(INVITE_COPY.rateLimited);
    expect(sendErrorCopy(new SelectionEventsError("TIMEOUT")).uncertain).toBe(true);
    expect(sendErrorCopy(new SelectionEventsError("SELECTION_EVENT_INVALID", ["message_too_long"])).field).toBe(true);
    expect(sendErrorCopy(new Error("x")).message).toBe("Impossibile inviare gli inviti. Riprova.");
  });
});

describe("mappatura candidati ed eventi (§13, §17)", () => {
  it("candidato senza esito esplicito non è selezionabile", () => {
    const page = mapCandidatesPage({
      items: [
        { person_id: "a", full_name: "A", selectable: true, relation_status: null },
        { person_id: "b", full_name: "B", relation_status: "invited", reason: "already_invited" },
        { full_name: "senza id" },
      ],
      next_cursor: null,
    });

    expect(page.items.map((c) => [c.personId, c.selectable, c.reason])).toEqual([
      ["a", true, null],
      ["b", false, "already_invited"],
    ]);
  });

  it("eventi invitabili", () => {
    expect(
      mapInvitableEvents({
        items: [
          {
            event_id: "e1",
            title: "Open day Primavera",
            event_type: "open_day",
            team_name: "Primavera",
            start_date: "2026-09-30",
            start_time: "15:00:00",
            end_time: "18:00:00",
            participation_mode: "invite_only",
          },
        ],
      }),
    ).toEqual([
      {
        endTime: "18:00",
        eventId: "e1",
        eventType: "open_day",
        participationMode: "invite_only",
        startDate: "2026-09-30",
        startTime: "15:00",
        teamName: "Primavera",
        timezone: "Europe/Rome",
        title: "Open day Primavera",
      },
    ]);
  });
});
