/**
 * DAS-REV-31 §13–§20, §28 (screen 07–12, 18, 19): menu «Gestisci evento»
 * dalle sole capability server, pillole di stato, banner di aggiornamento,
 * mapping del dettaglio e dei comandi lifecycle, copy degli errori.
 */
import { describe, expect, it, vi } from "vitest";

import { SelectionEventsError } from "../events-service";
import { mapDetail, mapLifecycleCommand } from "./event-detail-service";
import {
  LIFECYCLE_COPY,
  cancellationMessageError,
  isTerminal,
  lifecycleErrorCopy,
  lifecycleOutcomeNotice,
  lifecyclePill,
  lifecycleSignature,
  manageMenuActions,
  normalizeCancellationMessage,
  notOperationalCopy,
  parseUpdatedParam,
  showUpdatedBanner,
} from "./event-lifecycle-presentation";

vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn() }));

/** Riga grezza del server (fixture §7: Open day Primavera, AC Como). */
function raw(patch: Record<string, unknown> = {}, management: Record<string, unknown> | null = {}) {
  return {
    state: "available",
    public_id: "pubOpenDay2026AA",
    event_id: "e1",
    version: 4,
    club: { name: "AC Como", logo_url: null, is_verified: true },
    event_type: "open_day",
    title: "Open day Primavera",
    team_name: "Primavera",
    timezone: "Europe/Rome",
    start_date: "2026-09-30",
    start_time: "15:00:00",
    end_time: "18:00:00",
    status: "published",
    club_id: "c1",
    team_id: "t1",
    landing_visible: true,
    availability: { lifecycle: "published", public_state: "open", started: false },
    lifecycle: {
      status: "published",
      is_started: false,
      completion_due_at: "2026-09-30T16:00:00Z",
      completed_at: null,
      cancelled_at: null,
    },
    management:
      management === null
        ? null
        : {
            can_edit: true,
            can_complete: false,
            can_cancel: true,
            can_delete_draft: false,
            confirmed_count: 32,
            participants: { confirmed_count: 32, pending_count: 8, invited_count: 12 },
            ...management,
          },
    personal: { participation: null, capabilities: {} },
    ...patch,
  };
}

const started = {
  lifecycle: { status: "published", is_started: true, completion_due_at: "2026-09-30T16:00:00Z" },
};

describe("mapping del dettaglio (§13, §17–§19)", () => {
  it("lifecycle, capability gestionali e campi personali", () => {
    const detail = mapDetail(
      raw(
        {
          status: "cancelled",
          lifecycle: { status: "cancelled", is_started: false, cancelled_at: "2026-09-20T10:00:00Z" },
          personal: {
            participation: null,
            capabilities: {},
            event_status: "cancelled",
            cancellation_message: "Struttura non disponibile.",
          },
        },
        {
          can_edit: false,
          can_cancel: false,
          cancellation_message: "Struttura non disponibile.",
          final_confirmed_count: 32,
        },
      ),
    );

    expect(detail.lifecycle).toEqual({
      cancelledAt: "2026-09-20T10:00:00Z",
      completedAt: null,
      completionDueAt: null,
      isStarted: false,
      status: "cancelled",
    });
    expect(detail.management).toMatchObject({
      canCancel: false,
      canComplete: false,
      canDeleteDraft: false,
      cancellationMessage: "Struttura non disponibile.",
      finalConfirmedCount: 32,
    });
    expect(detail.personal.eventStatus).toBe("cancelled");
    expect(detail.personal.cancellationMessage).toBe("Struttura non disponibile.");
  });

  it("server senza blocco lifecycle: «iniziato» ricade sulla disponibilità, mai sull'orologio", () => {
    const detail = mapDetail(raw({ lifecycle: undefined, availability: { started: true } }));

    expect(detail.lifecycle.isStarted).toBe(true);
    expect(detail.lifecycle.status).toBe("published");
  });

  it("esito dei comandi: outcome sconosciuto non diventa un successo", () => {
    expect(
      mapLifecycleCommand({ event_id: "e1", outcome: "completed", status: "completed", replayed: true }),
    ).toEqual({ eventId: "e1", outcome: "completed", replayed: true, status: "completed" });
    expect(mapLifecycleCommand({ outcome: "reopened" }).outcome).toBeNull();
    expect(mapLifecycleCommand({ outcome: "deleted" }).status).toBeNull();
  });
});

describe("menu «Gestisci evento» (screen 07–08)", () => {
  it("screen 07: evento futuro → Modifica e Annulla, Concludi assente", () => {
    const actions = manageMenuActions(mapDetail(raw()));

    expect(actions.map((action) => action.kind)).toEqual(["edit", "cancel"]);
    expect(actions.map((action) => action.label)).toEqual(["Modifica evento", "Annulla evento"]);
  });

  it("screen 08: evento iniziato → Concludi e Annulla; Concludi blu, mai rosso", () => {
    const actions = manageMenuActions(
      mapDetail(raw(started, { can_edit: false, can_complete: true, can_cancel: true })),
    );

    expect(actions).toEqual([
      { kind: "complete", label: "Concludi evento", tone: "accent" },
      { kind: "cancel", label: "Annulla evento", tone: "destructive" },
    ]);
  });

  it("§15: nessuna voce dedotta da ruolo o stato; vista personale senza menu", () => {
    expect(
      manageMenuActions(mapDetail(raw(started, { can_edit: false, can_complete: false, can_cancel: false }))),
    ).toEqual([]);
    expect(manageMenuActions(mapDetail(raw({}, null)))).toEqual([]);
  });
});

describe("pillole, storico e banner (screen 08, 10, 12, 18)", () => {
  it("«Evento iniziato» solo per la Società e solo su PUBLISHED iniziato", () => {
    const detail = mapDetail(raw(started));

    expect(lifecyclePill(detail, { society: true })).toBe(LIFECYCLE_COPY.started);
    expect(lifecyclePill(detail, { society: false })).toBeNull();
    expect(lifecyclePill(mapDetail(raw()), { society: true })).toBeNull();
  });

  it("concluso e annullato hanno la pillola in entrambe le viste", () => {
    const completed = mapDetail(raw({ status: "completed", lifecycle: { status: "completed" } }));
    const cancelled = mapDetail(raw({ status: "cancelled", lifecycle: { status: "cancelled" } }));

    expect(lifecyclePill(completed, { society: false })).toBe("Evento concluso");
    expect(lifecyclePill(cancelled, { society: true })).toBe("Evento annullato");
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("published")).toBe(false);
    expect(isTerminal("draft")).toBe(false);
  });

  it("screen 18: banner solo dalla notifica e solo su evento operativo", () => {
    expect(showUpdatedBanner({ status: "published" }, true)).toBe(true);
    expect(showUpdatedBanner({ status: "published" }, false)).toBe(false);
    /* §24: un annullamento successivo prevale sull'aggiornamento. */
    expect(showUpdatedBanner({ status: "cancelled" }, true)).toBe(false);
    expect(parseUpdatedParam("1")).toBe(true);
    expect(parseUpdatedParam(undefined)).toBe(false);
    expect(parseUpdatedParam(["1"])).toBe(false);
  });
});

describe("messaggio di annullamento e chiave (§18, §28)", () => {
  it("facoltativo, solo spazi = null, limite 500", () => {
    expect(normalizeCancellationMessage("   ")).toBeNull();
    expect(normalizeCancellationMessage("  Struttura chiusa. ")).toBe("Struttura chiusa.");
    expect(cancellationMessageError("a".repeat(500))).toBeNull();
    expect(cancellationMessageError("a".repeat(501))).toBe(
      "Il messaggio può contenere al massimo 500 caratteri.",
    );
  });

  it("stesso intento → stessa impronta; messaggio o versione diversi → intento nuovo", () => {
    expect(lifecycleSignature("cancel", "e1", 4, "A")).toBe(lifecycleSignature("cancel", "e1", 4, "A"));
    expect(lifecycleSignature("cancel", "e1", 4, "A")).not.toBe(lifecycleSignature("cancel", "e1", 4, "B"));
    expect(lifecycleSignature("complete", "e1", 4)).not.toBe(lifecycleSignature("complete", "e1", 5));
    expect(lifecycleSignature("delete", "e1", 4)).not.toBe(lifecycleSignature("complete", "e1", 4));
  });
});

describe("esiti ed errori (§15, §17, §18, §28)", () => {
  it("annullamento oltre la scadenza: il server conclude e la UI lo dice", () => {
    expect(lifecycleOutcomeNotice("cancel", { outcome: "completed" })).toBe("L’evento è concluso.");
    expect(lifecycleOutcomeNotice("cancel", { outcome: "cancelled" })).toBeNull();
    expect(lifecycleOutcomeNotice("complete", { outcome: "already_completed" })).toBeNull();
  });

  it("copy di dominio per i guard temporali e di stato, con riconciliazione", () => {
    const of = (code: ConstructorParameters<typeof SelectionEventsError>[0], kind: "complete" | "cancel" | "delete") =>
      lifecycleErrorCopy(new SelectionEventsError(code), kind);

    expect(of("SELECTION_EVENT_NOT_STARTED", "complete")).toEqual({
      message: "L’evento è già iniziato. Questa operazione non è più disponibile.",
      refresh: true,
      uncertain: false,
    });
    expect(of("SELECTION_EVENT_COMPLETED", "cancel").message).toBe("L’evento è concluso.");
    expect(of("SELECTION_EVENT_CANCELLED", "complete").message).toBe("L’evento è stato annullato.");
    expect(of("SELECTION_EVENT_LIFECYCLE_CONFLICT", "delete")).toMatchObject({ refresh: true });
    expect(of("SELECTION_EVENT_MESSAGE_TOO_LONG", "cancel")).toMatchObject({ refresh: false });
  });

  it("generici e rete: copy della spec, testo conservato per il retry", () => {
    expect(lifecycleErrorCopy(new Error("boom"), "cancel")).toEqual({
      message: "Impossibile annullare l’evento. Riprova.",
      refresh: false,
      uncertain: false,
    });
    expect(lifecycleErrorCopy(new Error("boom"), "complete").message).toBe(
      "Impossibile concludere l’evento. Riprova.",
    );
    expect(lifecycleErrorCopy(new SelectionEventsError("NETWORK"), "cancel").uncertain).toBe(true);
    expect(lifecycleErrorCopy(new SelectionEventsError("TIMEOUT"), "complete")).toMatchObject({
      refresh: true,
      uncertain: true,
    });
  });

  it("i codici nuovi si leggono dal messaggio del server", async () => {
    const { toSelectionEventsError } = await import("../events-service");

    expect(toSelectionEventsError({ message: "SELECTION_EVENT_NOT_STARTED" }).code).toBe(
      "SELECTION_EVENT_NOT_STARTED",
    );
    expect(toSelectionEventsError({ message: "SELECTION_EVENT_STARTED" }).code).toBe("SELECTION_EVENT_STARTED");
    expect(toSelectionEventsError({ message: "SELECTION_EVENT_MESSAGE_TOO_LONG" }).code).toBe(
      "SELECTION_EVENT_MESSAGE_TOO_LONG",
    );
  });
});

describe("notOperationalCopy (DAS-REV-31 §15)", () => {
  const at = (status: "published" | "completed" | "cancelled", isStarted: boolean) => ({
    lifecycle: { cancelledAt: null, completedAt: null, completionDueAt: null, isStarted, status },
  });

  it("sceglie il copy dallo stato reale riletto", () => {
    expect(notOperationalCopy(at("cancelled", false))).toBe("L’evento è stato annullato.");
    expect(notOperationalCopy(at("completed", true))).toBe("L’evento è concluso.");
    expect(notOperationalCopy(at("published", true))).toBe(
      "L’evento è già iniziato. Questa operazione non è più disponibile.",
    );
  });

  it("evento ancora operativo o dettaglio assente: nessun copy temporale", () => {
    expect(notOperationalCopy(at("published", false))).toBeNull();
    expect(notOperationalCopy(null)).toBeNull();
  });
});
