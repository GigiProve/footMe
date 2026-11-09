/**
 * Contesto EVENT del flusso stella (DAS-REV-31 §8, §9, §11).
 *
 * Tre cose che non devono rompersi: l'add da evento e quello dal profilo
 * sono intenti distinti (chiavi idempotenti diverse), il contesto vive solo
 * nel percorso esplicito partecipanti → profilo di quella persona, e un
 * contesto rifiutato non diventa mai un add PROFILE.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { addProfileToShortlist, createCustomShortlist } = await import(
  "./profile-shortlist-service"
);
const {
  PROFILE_SHORTLIST_COPY,
  addFailureCopy,
  addIntent,
  createErrorFields,
  eventProfileHref,
  eventSourceFromRoute,
  isDefinitiveFailure,
} = await import("./profile-shortlist-presentation");

const ok = (data: unknown) => Promise.resolve({ data, error: null });
const fail = (message: string) => Promise.resolve({ data: null, error: { message } });

beforeEach(() => rpc.mockReset());

describe("addIntent — §11, impronta idempotente", () => {
  it("EVENT e PROFILE verso la stessa destinazione sono intenti diversi", () => {
    expect(addIntent("p:pos1", "ev1")).not.toBe(addIntent("p:pos1", null));
  });

  it("due eventi diversi sono intenti diversi", () => {
    expect(addIntent("p:pos1", "ev1")).not.toBe(addIntent("p:pos1", "ev2"));
  });

  it("lo stesso add ripetuto rigenera lo stesso intento (retry = verifica)", () => {
    expect(addIntent("c:s1", "ev1")).toBe(addIntent("c:s1", "ev1"));
  });

  it("l'add dal profilo conserva un intento stabile", () => {
    expect(addIntent("c:s1", null)).toBe("add:profile:c:s1");
    expect(addIntent("c:s1", "ev1")).toBe("add:event:ev1:c:s1");
  });
});

describe("eventProfileHref — §8", () => {
  it("lega evento, Società e persona alla route del profilo", () => {
    expect(eventProfileHref({ clubId: "club1", eventId: "ev1", personId: "p1" })).toBe(
      "/profile/p1?sourceEventId=ev1&sourceClubId=club1&sourcePersonId=p1",
    );
  });
});

describe("eventSourceFromRoute — §8, nessun lastEvent globale", () => {
  const params = { sourceClubId: "club1", sourceEventId: "ev1", sourcePersonId: "p1" };
  const valid = { params, routePersonId: "p1", societyId: "club1", viewedPersonId: "p1" };

  it("percorso esplicito intatto: l'evento è la provenienza", () => {
    expect(eventSourceFromRoute(valid)).toBe("ev1");
  });

  it("ingresso da Cerca (nessun parametro): nessun contesto", () => {
    expect(eventSourceFromRoute({ ...valid, params: {} })).toBeNull();
  });

  it("un'altra persona non eredita il contesto", () => {
    expect(eventSourceFromRoute({ ...valid, routePersonId: "p2", viewedPersonId: "p2" })).toBeNull();
    expect(eventSourceFromRoute({ ...valid, viewedPersonId: "p2" })).toBeNull();
  });

  it("cambio di Società operativa: il contesto si spegne", () => {
    expect(eventSourceFromRoute({ ...valid, societyId: "club2" })).toBeNull();
    expect(eventSourceFromRoute({ ...valid, societyId: null })).toBeNull();
  });

  it("profilo non ancora caricato: nessun contesto finché non è la stessa persona", () => {
    expect(eventSourceFromRoute({ ...valid, viewedPersonId: null })).toBeNull();
  });

  it("parametri ripetuti: vale il primo", () => {
    expect(
      eventSourceFromRoute({ ...valid, params: { ...params, sourceEventId: ["ev1", "ev9"] } }),
    ).toBe("ev1");
  });
});

describe("copy e classificazione — §11, §28", () => {
  it("contesto evento rifiutato: copy controllata ed esito definitivo", () => {
    expect(addFailureCopy("eventSourceUnavailable")).toBe(
      "L’evento non è più disponibile come provenienza.",
    );
    expect(isDefinitiveFailure("eventSourceUnavailable")).toBe(true);
  });

  it("errore generico di un add da evento: copy della 31", () => {
    expect(addFailureCopy("network", { fromEvent: true })).toBe(
      "Non è stato possibile aggiungere il profilo alla shortlist. Riprova.",
    );
  });

  it("errore generico dal profilo: copy della 26 invariata", () => {
    expect(addFailureCopy("network")).toBe(PROFILE_SHORTLIST_COPY.addError);
  });

  it("Crea e aggiungi rifiutato per contesto: banner, nessun campo in errore", () => {
    expect(createErrorFields("eventSourceUnavailable")).toEqual({
      banner: "L’evento non è più disponibile come provenienza.",
    });
  });
});

describe("servizi — p_source_event_id", () => {
  it("add da evento passa l'evento come contesto", async () => {
    rpc.mockReturnValueOnce(ok({ shortlist_id: "s1" }));

    await addProfileToShortlist({
      clubId: "club1",
      idempotencyKey: "k1",
      personId: "p1",
      sourceEventId: "ev1",
      target: { positionId: "pos1" },
    });

    expect(rpc).toHaveBeenCalledWith(
      "add_profile_to_shortlist",
      expect.objectContaining({ p_position_id: "pos1", p_source_event_id: "ev1" }),
    );
  });

  it("add dal profilo manda null esplicito", async () => {
    rpc.mockReturnValueOnce(ok({ shortlist_id: "s1" }));

    await addProfileToShortlist({
      clubId: "club1",
      idempotencyKey: "k1",
      personId: "p1",
      target: { shortlistId: "s1" },
    });

    expect(rpc.mock.calls[0][1]).toMatchObject({ p_source_event_id: null });
  });

  it("SOURCE_UNAVAILABLE arriva come kind proprio, non come notFound", async () => {
    rpc.mockReturnValueOnce(fail("SHORTLIST_EVENT_SOURCE_UNAVAILABLE"));

    await expect(
      addProfileToShortlist({
        clubId: "club1",
        idempotencyKey: "k1",
        personId: "p1",
        sourceEventId: "ev1",
        target: { shortlistId: "s1" },
      }),
    ).rejects.toMatchObject({ kind: "eventSourceUnavailable" });
  });

  it("Crea e aggiungi da evento passa il contesto con la persona", async () => {
    rpc.mockReturnValueOnce(ok({ entry_active: true, shortlist_id: "s1" }));

    await createCustomShortlist({
      clubId: "club1",
      description: "",
      idempotencyKey: "k1",
      name: "Talenti",
      personId: "p1",
      sourceEventId: "ev1",
      teamId: null,
    });

    expect(rpc).toHaveBeenCalledWith(
      "create_custom_shortlist",
      expect.objectContaining({ p_person_id: "p1", p_source_event_id: "ev1" }),
    );
  });

  it("creazione dal centro (senza persona) non porta mai un evento", async () => {
    rpc.mockReturnValueOnce(ok({ shortlist_id: "s1" }));

    await createCustomShortlist({
      clubId: "club1",
      description: "",
      idempotencyKey: "k1",
      name: "Talenti",
      personId: null,
      sourceEventId: "ev1",
      teamId: null,
    });

    expect(rpc.mock.calls[0][1]).toMatchObject({ p_source_event_id: null });
  });
});
