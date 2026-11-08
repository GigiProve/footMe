/**
 * DAS-REV-30 §21–§23, §29: filtri, etichette, count contestuali, empty e
 * mappatura delle righe del centro Partecipanti.
 */
import { describe, expect, it } from "vitest";

import {
  PARTICIPANTS_FILTERS,
  PARTICIPANT_STATUS_LABELS,
  belongsToFilter,
  countLabel,
  emptyCopy,
  invitedOnLine,
  messageError,
  normalizeMessage,
  participantSubtitle,
} from "./participants-presentation";
import { mapParticipantRow, mapParticipantsPage, parseFilter } from "./participants-service";

const row = (patch: Record<string, unknown> = {}) => ({
  participation_id: "p1",
  person_id: "u1",
  full_name: "Andrea Galli",
  avatar_url: null,
  role: "player",
  primary_position: null,
  status: "confirmed",
  source: "registration",
  status_at: "2026-09-20T10:00:00Z",
  version: 3,
  invitation_generation: 0,
  actions: ["remove"],
  star: "empty",
  ...patch,
});

describe("filtri (§21)", () => {
  it("esattamente sette opzioni, nell'ordine della task", () => {
    expect(PARTICIPANTS_FILTERS.map((f) => f.label)).toEqual([
      "Confermati",
      "Richieste in attesa",
      "Inviti inviati",
      "Non accettate",
      "Inviti rifiutati",
      "Ritirati",
      "Tutti",
    ]);
  });

  it("filtro sconosciuto nell'URL → Confermati", () => {
    expect(parseFilter("bogus")).toBe("confirmed");
    expect(parseFilter("invited")).toBe("invited");
  });

  it("una riga che cambia stato esce dal filtro; Tutti la tiene", () => {
    expect(belongsToFilter("revoked", "invited")).toBe(false);
    expect(belongsToFilter("removed", "confirmed")).toBe(false);
    expect(belongsToFilter("revoked", "all")).toBe(true);
  });
});

describe("etichette (§22)", () => {
  it("Revocato ≠ Rifiutato, Rimosso ≠ Ritirato", () => {
    expect(PARTICIPANT_STATUS_LABELS).toEqual({
      confirmed: "Confermato",
      pending: "Richiesta in attesa",
      invited: "Invito inviato",
      rejected: "Non accettata",
      declined: "Invito rifiutato",
      withdrawn: "Ritirato",
      revoked: "Invito revocato",
      removed: "Rimosso dall’evento",
    });
  });

  it("count contestuali (§21)", () => {
    expect(countLabel("confirmed", 32)).toBe("32 partecipanti");
    expect(countLabel("pending", 8)).toBe("8 richieste");
    expect(countLabel("invited", 12)).toBe("12 inviti");
    expect(countLabel("confirmed", 1)).toBe("1 partecipante");
    expect(countLabel("confirmed", 0)).toBe("0 partecipanti");
  });

  it("empty per filtro, ricerca distinta (§29)", () => {
    expect(emptyCopy("confirmed", false).title).toBe("Nessun partecipante confermato");
    expect(emptyCopy("pending", false).title).toBe("Nessuna richiesta in attesa");
    expect(emptyCopy("invited", false).title).toBe("Nessun invito inviato");
    expect(emptyCopy("confirmed", true).title).toBe("Nessun partecipante trovato");
  });

  it("sottotitolo: posizione del Calciatore, altrimenti ruolo", () => {
    expect(participantSubtitle({ primaryPosition: null, role: "player" })).toBe("Calciatore");
    expect(participantSubtitle({ primaryPosition: null, role: null })).toBeNull();
  });

  it("data dell'invito", () => {
    expect(invitedOnLine("2026-09-24T10:00:00Z")).toBe("Invito inviato · 24 settembre 2026");
    expect(invitedOnLine(null)).toBeNull();
  });

  it("messaggio di rimozione: solo spazi → null, oltre limite errore", () => {
    expect(normalizeMessage("   ")).toBeNull();
    expect(messageError("x".repeat(501), 500)).toBe("Il messaggio può contenere al massimo 500 caratteri.");
    expect(messageError("ok", 500)).toBeNull();
  });
});

describe("mappatura (§27, QA-150)", () => {
  it("riga completa con azioni filtrate e stella", () => {
    const mapped = mapParticipantRow(row({ actions: ["remove", "teleport"], star: "filled" }));

    expect(mapped).toMatchObject({ actions: ["remove"], fullName: "Andrea Galli", star: "filled", status: "confirmed" });
  });

  it("stato sconosciuto: la riga cade, non diventa confermata", () => {
    expect(mapParticipantRow(row({ status: "present" }))).toBeNull();
  });

  it("stella sconosciuta → assente", () => {
    expect(mapParticipantRow(row({ star: "gold" }))?.star).toBe("hidden");
  });

  it("pagina: total dal server, non dalla pagina caricata", () => {
    const page = mapParticipantsPage({
      filter: "confirmed",
      total: 32,
      items: [row(), row({ participation_id: "p2", status: "nope" })],
      next_cursor: "abc",
      counts: { confirmed_count: 32, pending_count: 8, invited_count: 12 },
      capabilities: { manage: true, operational: true, is_full: false },
    });

    expect(page.total).toBe(32);
    expect(page.items).toHaveLength(1);
    expect(page.counts).toEqual({ confirmed: 32, invited: 12, pending: 8 });
    expect(page.nextCursor).toBe("abc");
  });

  it("risposta non valida: errore, mai zero partecipanti simulati (QA-090)", () => {
    expect(() => mapParticipantsPage(null)).toThrow();
  });
});
