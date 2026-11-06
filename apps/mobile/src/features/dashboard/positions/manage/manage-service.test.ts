/**
 * Contratto di trasporto del dettaglio gestionale (DAS-REV-17 §23, §35).
 *
 * Tre rischi che non si vedono a schermo:
 *
 *   * un conteggio protetto che arriva `0` invece che assente diventa «0
 *     candidature» per chi non ha il permesso di vederle (§5);
 *   * una patch dell'attiva che nomina un identificativo deve essere
 *     respinta **per intero**, e il client deve saperlo distinguere da un
 *     errore generico (§21);
 *   * un errore di autorizzazione e una risorsa inesistente devono
 *     produrre lo stesso esito, perché §23 vieta di rivelare l'esistenza
 *     di una Position altrui.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();

vi.mock("../../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const { closePosition, fetchPositionManageDetail, updatePublishedPosition } =
  await import("./manage-service");
const { setPositionDeadline, toComposeError } = await import(
  "../compose/compose-service"
);

beforeEach(() => {
  rpc.mockReset();
});

function ok(data: unknown) {
  return Promise.resolve({ data, error: null });
}

function fail(message: string) {
  return Promise.resolve({ data: null, error: { message } });
}

const ROW = {
  access_verified_at: "2026-09-12T09:00:00Z",
  age_mode: "unset",
  blockers: [],
  can_close: false,
  can_edit: true,
  can_publish: true,
  club_id: "club-1",
  club_is_verified: true,
  club_name: "AC Como",
  context_label: "Settore giovanile",
  counts_available: false,
  details: { responsibilities: "Scouting del settore giovanile" },
  group_key: "drafts",
  has_details: true,
  position_id: "pos-a",
  position_scope: "team",
  profile_type: "director",
  resource_version: 4,
  role_id: "other_executive",
  role_is_custom: true,
  role_label: "Altro",
  custom_role_name: "Responsabile scouting",
  secondary_teams: [],
  status: "draft",
  team_id: "team-primavera",
  team_name: "Primavera",
  title: "Responsabile scouting",
};

describe("lettura gestionale (§5, §23)", () => {
  it("porta schema, versione e valutazione della bozza nello stesso payload", async () => {
    rpc.mockReturnValue(ok([ROW]));

    const detail = await fetchPositionManageDetail("pos-a");

    expect(rpc).toHaveBeenCalledWith("fetch_society_position_detail", {
      p_ad_id: "pos-a",
    });
    expect(detail.profileType).toBe("director");
    expect(detail.resourceVersion).toBe(4);
    expect(detail.lifecycle).toBe("draft");
    expect(detail.hasDetails).toBe(true);
    expect(detail.blockers).toEqual([]);
    expect(detail.details.responsibilities).toBe(
      "Scouting del settore giovanile",
    );
  });

  it("un conteggio non autorizzato resta assente, anche se il server mandasse zero", async () => {
    rpc.mockReturnValue(
      ok([
        {
          ...ROW,
          applications_new: 0,
          applications_total: 0,
          counts_available: false,
        },
      ]),
    );

    const detail = await fetchPositionManageDetail("pos-a");

    expect(detail.countsAvailable).toBe(false);
    expect(detail.applicationsTotal).toBeNull();
    expect(detail.applicationsNew).toBeNull();
  });

  it("i conteggi autorizzati passano come sono", async () => {
    rpc.mockReturnValue(
      ok([
        {
          ...ROW,
          applications_new: 3,
          applications_total: 12,
          counts_available: true,
        },
      ]),
    );

    const detail = await fetchPositionManageDetail("pos-a");

    expect(detail.applicationsTotal).toBe(12);
    expect(detail.applicationsNew).toBe(3);
  });

  it("un'età legacy nulla non diventa «Nessun limite di età»", async () => {
    rpc.mockReturnValue(
      ok([{ ...ROW, age_max: null, age_min: null, age_mode: null }]),
    );

    const detail = await fetchPositionManageDetail("pos-a");

    expect(detail.ageMode).toBe("unset");
  });

  it("una risposta vuota non diventa una posizione modificabile senza titolo", async () => {
    rpc.mockReturnValue(ok([]));

    await expect(fetchPositionManageDetail("pos-a")).rejects.toMatchObject({
      code: "POSITION_NOT_FOUND",
    });
  });

  it("negata e inesistente producono lo stesso codice", async () => {
    rpc.mockReturnValue(fail("POSITION_NOT_AVAILABLE"));

    await expect(fetchPositionManageDetail("pos-a")).rejects.toMatchObject({
      code: "POSITION_NOT_AVAILABLE",
    });
  });
});

describe("modifica della posizione attiva (§21)", () => {
  it("invia la patch con la versione attesa, sullo stesso ID", async () => {
    rpc.mockReturnValue(ok([{ position_id: "pos-c", resource_version: 9 }]));

    const result = await updatePublishedPosition({
      expectedVersion: 8,
      patch: { details: { availability: { mode: "immediate" } } },
      positionId: "pos-c",
    });

    expect(rpc).toHaveBeenCalledWith("update_published_position", {
      p_ad_id: "pos-c",
      p_expected_version: 8,
      p_patch: { details: { availability: { mode: "immediate" } } },
    });
    expect(result.resourceVersion).toBe(9);
  });

  it("riconosce il rifiuto degli identificativi bloccati", async () => {
    rpc.mockReturnValue(fail("POSITION_IDENTITY_LOCKED"));

    await expect(
      updatePublishedPosition({
        expectedVersion: 8,
        patch: { description: "x" },
        positionId: "pos-c",
      }),
    ).rejects.toMatchObject({ code: "POSITION_IDENTITY_LOCKED" });
  });

  it("distingue un campo fuori whitelist da un identificativo bloccato", () => {
    expect(toComposeError(new Error("POSITION_FIELD_NOT_EDITABLE")).code).toBe(
      "POSITION_FIELD_NOT_EDITABLE",
    );
    expect(
      toComposeError(new Error("POSITION_AGE_UNSET_NOT_ALLOWED")).code,
    ).toBe("POSITION_AGE_UNSET_NOT_ALLOWED");
  });

  it("un conflitto di versione non viene confuso con un rifiuto di lifecycle", async () => {
    rpc.mockReturnValue(fail("POSITION_VERSION_CONFLICT"));

    await expect(
      updatePublishedPosition({
        expectedVersion: 1,
        patch: { description: "x" },
        positionId: "pos-c",
      }),
    ).rejects.toMatchObject({ code: "POSITION_VERSION_CONFLICT" });
  });
});

/**
 * Il comando di chiusura (DAS-REV-18 §22).
 *
 * Due rischi di trasporto che non si vedono a schermo: una data di chiusura
 * costruita dal client invece che letta dal server, e un motivo che sopravvive
 * al viaggio in una forma che il server non riconosce.
 */
describe("closePosition", () => {
  it("manda ID, versione, motivo e chiave idempotente, e nient'altro", async () => {
    rpc.mockReturnValueOnce(
      ok([
        {
          close_reason: "filled",
          close_reason_text: null,
          closed_at: "2026-09-24T10:00:00Z",
          position_id: "pos-c",
          resource_version: 8,
          status: "closed",
        },
      ]),
    );

    const result = await closePosition({
      expectedVersion: 7,
      operationKey: "nonce:close:pos-c:7",
      positionId: "pos-c",
      reason: "filled",
      reasonText: null,
    });

    expect(rpc).toHaveBeenCalledWith("close_position", {
      p_ad_id: "pos-c",
      p_expected_version: 7,
      p_operation_key: "nonce:close:pos-c:7",
      p_reason: "filled",
      p_reason_text: null,
    });

    /* §35: «Le date di chiusura e di prima pubblicazione sono server-owned.»
       Il mapper le trasporta, non le calcola. */
    expect(result).toEqual({
      closeReason: "filled",
      closeReasonText: null,
      closedAt: "2026-09-24T10:00:00Z",
      lifecycle: "closed",
      positionId: "pos-c",
      resourceVersion: 8,
    });
  });

  it("non inventa una data di chiusura quando il server non la manda", async () => {
    rpc.mockReturnValueOnce(
      ok([
        {
          closed_at: null,
          position_id: "pos-c",
          resource_version: 8,
          status: "closed",
        },
      ]),
    );

    const result = await closePosition({
      expectedVersion: 7,
      operationKey: "nonce:close:pos-c:7",
      positionId: "pos-c",
      reason: null,
      reasonText: null,
    });

    expect(result.closedAt).toBeNull();
    expect(result.closeReason).toBeNull();
  });

  it("scarta un motivo fuori dai quattro canonici", async () => {
    /* §26: un codice sconosciuto si omette. Mostrarlo come stringa grezza
       nello storico sarebbe peggio di non mostrarlo. */
    rpc.mockReturnValueOnce(
      ok([
        {
          close_reason: "merged_with_other_team",
          position_id: "pos-c",
          resource_version: 8,
          status: "closed",
        },
      ]),
    );

    const result = await closePosition({
      expectedVersion: 7,
      operationKey: "nonce:close:pos-c:7",
      positionId: "pos-c",
      reason: null,
      reasonText: null,
    });

    expect(result.closeReason).toBeNull();
  });

  it("classifica i codici d'errore della chiusura", async () => {
    for (const code of [
      "POSITION_LIFECYCLE_CONFLICT",
      "POSITION_VERSION_CONFLICT",
      "POSITION_CLOSE_REASON_TEXT_TOO_LONG",
      "POSITION_OPERATION_CONFLICT",
    ] as const) {
      rpc.mockReturnValueOnce(fail(`PostgREST: ${code}`));

      const error = await closePosition({
        expectedVersion: 7,
        operationKey: "nonce:close:pos-c:7",
        positionId: "pos-c",
        reason: null,
        reasonText: null,
      }).catch((caught: unknown) => caught);

      expect(toComposeError(error).code).toBe(code);
    }
  });
});

/**
 * La scadenza su una Position attiva (§13).
 *
 * `set_position_deadline` è **lo stesso** comando della bozza: §3 vieta una
 * seconda implementazione, e il test fissa il contratto che le due superfici
 * condividono.
 */
describe("setPositionDeadline", () => {
  it("riporta il giorno civile del server, non un istante da riconvertire", async () => {
    rpc.mockReturnValueOnce(
      ok([
        {
          deadline_at: "2026-10-15T22:00:00.000Z",
          deadline_date: "2026-10-15",
          deadline_timezone: "Europe/Rome",
          position_id: "pos-c",
          receiving_closed: false,
          resource_version: 9,
          server_now: "2026-09-24T08:00:00Z",
          status: "published",
        },
      ]),
    );

    const result = await setPositionDeadline({
      deadlineDate: "2026-10-15",
      expectedVersion: 8,
      positionId: "pos-c",
    });

    expect(rpc).toHaveBeenCalledWith("set_position_deadline", {
      p_ad_id: "pos-c",
      p_deadline_date: "2026-10-15",
      p_expected_version: 8,
    });

    /* §8: il cutoff memorizzato è l'inizio del giorno **successivo**. Il
       client non lo riconverte mai: usa `deadline_date`. */
    expect(result.deadlineDate).toBe("2026-10-15");
    expect(result.receivingClosed).toBe(false);
    expect(result.resourceVersion).toBe(9);
  });

  it("manda null per «Nessuna scadenza», mai una data sentinella", async () => {
    rpc.mockReturnValueOnce(
      ok([
        {
          deadline_at: null,
          deadline_date: null,
          deadline_timezone: null,
          position_id: "pos-c",
          receiving_closed: false,
          resource_version: 10,
          status: "published",
        },
      ]),
    );

    await setPositionDeadline({
      deadlineDate: null,
      expectedVersion: 9,
      positionId: "pos-c",
    });

    expect(rpc.mock.calls.at(-1)?.[1]).toMatchObject({ p_deadline_date: null });
  });

  it("distingue una data trascorsa da un conflitto di versione", async () => {
    rpc.mockReturnValueOnce(fail("PostgREST: POSITION_DEADLINE_PAST"));

    const error = await setPositionDeadline({
      deadlineDate: "2020-01-01",
      expectedVersion: 8,
      positionId: "pos-c",
    }).catch((caught: unknown) => caught);

    expect(toComposeError(error).code).toBe("POSITION_DEADLINE_PAST");
  });
});
