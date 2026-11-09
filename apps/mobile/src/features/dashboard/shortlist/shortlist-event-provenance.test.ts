/**
 * Provenienza EVENT nel dettaglio «Profilo in shortlist» (DAS-REV-31 §10,
 * §12 — screen 05, 06, 20).
 *
 * Il rischio non è il layout: è uno snapshot che inventa un link quando il
 * server non lo concede, una data spostata di un giorno dal fuso, o
 * un'origine EVENT che sparisce perché il mapping la tratta come sconosciuta.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { classifyShortlistError, fetchShortlistEntry, sourceEvent } = await import(
  "./shortlist-service"
);
const { SHORTLIST_COPY, entryEventOrigin, originAuditLabel, poolRowLines } = await import(
  "./shortlist-presentation"
);

const ok = (data: unknown) => Promise.resolve({ data, error: null });

beforeEach(() => rpc.mockReset());

const ENTRY = {
  created_at: "2026-09-12T10:00:00Z",
  entry_id: "e1",
  evaluation_status: "da_valutare",
  name: "Mario Rossi",
  person_id: "p1",
  shortlist_id: "s1",
};

describe("sourceEvent — mapping dello snapshot (§10, §12)", () => {
  it("null quando l'entry non ha provenienza evento", () => {
    expect(sourceEvent(null)).toBeNull();
    expect(sourceEvent(undefined)).toBeNull();
    expect(sourceEvent("x")).toBeNull();
  });

  it("senza titolo non c'è niente di storico da mostrare", () => {
    expect(sourceEvent({ date: "2026-09-30", event_id: "ev1" })).toBeNull();
  });

  it("con event_id: il link è concesso oggi", () => {
    expect(
      sourceEvent({
        date: "2026-09-30",
        event_id: "ev1",
        timezone: "Europe/Rome",
        title: "Open day Primavera",
      }),
    ).toEqual({
      date: "2026-09-30",
      eventId: "ev1",
      timezone: "Europe/Rome",
      title: "Open day Primavera",
    });
  });

  it("senza event_id: snapshot conservato, nessun accesso all'evento", () => {
    expect(
      sourceEvent({
        date: "2026-09-30",
        event_id: null,
        timezone: "Europe/Rome",
        title: "Open day Primavera",
      }),
    ).toEqual({
      date: "2026-09-30",
      eventId: null,
      timezone: "Europe/Rome",
      title: "Open day Primavera",
    });
  });
});

describe("fetchShortlistEntry — created_source e source_event", () => {
  it("riconosce l'origine event e mappa lo snapshot", async () => {
    rpc.mockReturnValueOnce(
      ok({
        ...ENTRY,
        created_source: "event",
        source_event: {
          date: "2026-09-30",
          event_id: "ev1",
          timezone: "Europe/Rome",
          title: "Open day Primavera",
        },
      }),
    );

    const entry = await fetchShortlistEntry({ entryId: "e1" });

    expect(entry.createdSource).toBe("event");
    expect(entry.sourceEvent?.eventId).toBe("ev1");
  });

  it("un'origine PROFILE non ha snapshot", async () => {
    rpc.mockReturnValueOnce(ok({ ...ENTRY, created_source: "profile", source_event: null }));

    const entry = await fetchShortlistEntry({ entryId: "e1" });

    expect(entry.createdSource).toBe("profile");
    expect(entry.sourceEvent).toBeNull();
  });

  it("un'origine non riconosciuta resta unknown", async () => {
    rpc.mockReturnValueOnce(ok({ ...ENTRY, created_source: "imported" }));

    expect((await fetchShortlistEntry({ entryId: "e1" })).createdSource).toBe("unknown");
  });
});

describe("classifyShortlistError — §11", () => {
  it("SHORTLIST_EVENT_SOURCE_UNAVAILABLE ha un kind proprio", () => {
    expect(
      classifyShortlistError({ message: "SHORTLIST_EVENT_SOURCE_UNAVAILABLE" }).kind,
    ).toBe("eventSourceUnavailable");
  });
});

describe("entryEventOrigin — screen 05, 06, 20", () => {
  const snapshot = {
    date: "2026-09-30",
    eventId: "ev1",
    timezone: "Europe/Rome",
    title: "Open day Primavera",
  };

  it("screen 05: titolo, data lunga e link Apri evento", () => {
    expect(entryEventOrigin({ createdSource: "event", sourceEvent: snapshot })).toEqual({
      dateLabel: "30 settembre 2026",
      eventId: "ev1",
      label: "Aggiunto da evento",
      title: "Open day Primavera",
      unavailableNote: null,
    });
  });

  it("screen 20: nessun link né chevron, nota «Dettaglio evento non disponibile.»", () => {
    const origin = entryEventOrigin({
      createdSource: "event",
      sourceEvent: { ...snapshot, eventId: null },
    });

    expect(origin?.eventId).toBeNull();
    expect(origin?.unavailableNote).toBe("Dettaglio evento non disponibile.");
    expect(origin?.title).toBe("Open day Primavera");
  });

  it("la data civile non si sposta col fuso (nessun new Date su YYYY-MM-DD)", () => {
    expect(
      entryEventOrigin({
        createdSource: "event",
        sourceEvent: { ...snapshot, date: "2026-01-01" },
      })?.dateLabel,
    ).toBe("1 gennaio 2026");
  });

  it("data mancante o illeggibile: si omette, non si inventa", () => {
    expect(
      entryEventOrigin({
        createdSource: "event",
        sourceEvent: { ...snapshot, date: null },
      })?.dateLabel,
    ).toBeNull();
  });

  it("screen 06: un'origine PROFILE non produce il metadato evento", () => {
    expect(entryEventOrigin({ createdSource: "profile", sourceEvent: null })).toBeNull();
    /* Anche con uno snapshot spurio l'origine resta quella canonica. */
    expect(entryEventOrigin({ createdSource: "profile", sourceEvent: snapshot })).toBeNull();
  });

  it("origine EVENT senza snapshot: nessun metadato, resta la label d'origine", () => {
    expect(entryEventOrigin({ createdSource: "event", sourceEvent: null })).toBeNull();
    expect(originAuditLabel("event")).toBe(SHORTLIST_COPY.fromEvent);
  });
});

describe("poolRowLines con origine EVENT", () => {
  const base = {
    applicationState: "none" as const,
    createdSource: "event" as const,
    evaluationStatus: "da_valutare" as const,
    notePreview: null,
    priority: null,
  };

  it("dice Aggiunto da evento", () => {
    expect(poolRowLines(base).origin).toBe("Aggiunto da evento");
  });

  it("una candidatura arrivata dopo si vede, l'origine non la nasconde (§10)", () => {
    expect(poolRowLines({ ...base, applicationState: "active" }).origin).toBe(
      SHORTLIST_COPY.entryApplicationReceived,
    );
  });
});
