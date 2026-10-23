/**
 * Contratto di trasporto del composer (DAS-REV-16 §25, §31, §39).
 *
 * Due rischi reali, nessuno dei due visibile a schermo:
 *
 *   * un errore del server che perde i suoi blockers per strada diventa un
 *     «Riprova» generico su una posizione che non sarà mai pubblicabile;
 *   * un set di publish ordinato diversamente dal server produce
 *     un'impronta idempotente diversa, e §25 chiede che «retry identico
 *     restituisca lo stesso risultato».
 */
import { describe, expect, it, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("../../../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

const {
  ComposeError,
  createPositionDrafts,
  fetchPositionDrafts,
  publishPositions,
  toComposeError,
  updatePositionDraft,
} = await import("./compose-service");

beforeEach(() => {
  rpc.mockReset();
});

function ok(data: unknown) {
  return Promise.resolve({ data, error: null });
}

describe("classificazione degli errori (§31)", () => {
  it("estrae i blockers e l'ID da POSITION_NOT_PUBLISHABLE", () => {
    const error = toComposeError(
      new Error(
        "POSITION_NOT_PUBLISHABLE:11111111-2222-3333-4444-555555555555:AGE_UNSET,TEAM_UNAVAILABLE",
      ),
    );

    expect(error.code).toBe("POSITION_NOT_PUBLISHABLE");
    expect(error.positionId).toBe("11111111-2222-3333-4444-555555555555");
    expect(error.blockers).toEqual(["AGE_UNSET", "TEAM_UNAVAILABLE"]);
  });

  it("non confonde il rifiuto di pubblicare con quello di leggere", () => {
    // I due codici condividono il prefisso: l'ordine del match conta.
    expect(
      toComposeError(new Error("POSITION_PUBLISH_NOT_AUTHORIZED:abc")).code,
    ).toBe("POSITION_PUBLISH_NOT_AUTHORIZED");
    expect(toComposeError(new Error("POSITION_NOT_AUTHORIZED")).code).toBe(
      "POSITION_NOT_AUTHORIZED",
    );
  });

  it("distingue conflitto di versione e conflitto di lifecycle", () => {
    expect(toComposeError(new Error("POSITION_VERSION_CONFLICT")).code).toBe(
      "POSITION_VERSION_CONFLICT",
    );
    expect(toComposeError(new Error("POSITION_LIFECYCLE_CONFLICT")).code).toBe(
      "POSITION_LIFECYCLE_CONFLICT",
    );
  });

  it("un messaggio sconosciuto non diventa un codice inventato", () => {
    const error = toComposeError(new Error("connection reset"));

    expect(error.code).toBe("UNKNOWN");
    expect(error.blockers).toEqual([]);
  });

  it("un ComposeError attraversa invariato", () => {
    const original = new ComposeError("POSITION_NOT_FOUND");

    expect(toComposeError(original)).toBe(original);
  });
});

describe("pubblicazione idempotente (§25)", () => {
  it("ordina gli ID come il server e tiene le versioni appaiate", async () => {
    rpc.mockReturnValue(ok([]));

    await publishPositions({
      expectedVersions: [7, 3],
      operationKey: "key-12345678",
      positionIds: [
        "bbbbbbbb-0000-0000-0000-000000000000",
        "aaaaaaaa-0000-0000-0000-000000000000",
      ],
    });

    const [name, params] = rpc.mock.calls[0];

    expect(name).toBe("publish_positions");
    expect(params.p_ad_ids).toEqual([
      "aaaaaaaa-0000-0000-0000-000000000000",
      "bbbbbbbb-0000-0000-0000-000000000000",
    ]);
    /* La versione 3 apparteneva all'id "aaaa…": riordinare gli ID senza
       riordinare le versioni pubblicherebbe la riga sbagliata. */
    expect(params.p_expected_versions).toEqual([3, 7]);
  });

  it("lo stesso set in ordine diverso produce lo stesso payload", async () => {
    rpc.mockReturnValue(ok([]));

    await publishPositions({
      expectedVersions: [1, 2],
      operationKey: "key-12345678",
      positionIds: ["a0000000-0000-0000-0000-000000000000", "b0000000-0000-0000-0000-000000000000"],
    });
    await publishPositions({
      expectedVersions: [2, 1],
      operationKey: "key-12345678",
      positionIds: ["b0000000-0000-0000-0000-000000000000", "a0000000-0000-0000-0000-000000000000"],
    });

    expect(rpc.mock.calls[0][1]).toEqual(rpc.mock.calls[1][1]);
  });

  it("riporta published_at di ogni riga pubblicata", async () => {
    rpc.mockReturnValue(
      ok([
        {
          position_id: "a0000000-0000-0000-0000-000000000000",
          published_at: "2026-09-12T10:00:00Z",
        },
      ]),
    );

    const rows = await publishPositions({
      expectedVersions: [1],
      operationKey: "key-12345678",
      positionIds: ["a0000000-0000-0000-0000-000000000000"],
    });

    expect(rows).toEqual([
      {
        positionId: "a0000000-0000-0000-0000-000000000000",
        publishedAt: "2026-09-12T10:00:00Z",
      },
    ]);
  });
});

describe("creazione del set (§10)", () => {
  it("un incarico SOCIETY non porta con sé nessuna squadra", async () => {
    rpc.mockReturnValue(ok([{ position_id: "p1", team_id: null }]));

    await createPositionDrafts({
      clubId: "club-1",
      customRoleName: null,
      operationKey: "key-12345678",
      profileType: "director",
      roleId: "sporting_director",
      scope: "society",
      /* Anche se il chiamante ne passasse, §10 vuole **una** Position
         senza Team: la lista viene scartata qui, non dal server soltanto. */
      teamIds: ["team-1"],
    });

    expect(rpc.mock.calls[0][1].p_team_ids).toEqual([]);
  });

  it("un batch TEAM manda tutte le squadre principali richieste", async () => {
    rpc.mockReturnValue(ok([]));

    await createPositionDrafts({
      clubId: "club-1",
      customRoleName: null,
      operationKey: "key-12345678",
      profileType: "player",
      roleId: "forward",
      scope: "team",
      teamIds: ["team-1", "team-2"],
    });

    expect(rpc.mock.calls[0][1].p_team_ids).toEqual(["team-1", "team-2"]);
  });
});

describe("lettura delle bozze (§12, §21)", () => {
  it("non chiama il server per una lista vuota", async () => {
    await expect(fetchPositionDrafts([])).resolves.toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("conserva i blockers del server senza ricalcolarli", async () => {
    rpc.mockReturnValue(
      ok([
        {
          age_mode: "unset",
          blockers: ["AGE_UNSET"],
          can_edit: true,
          can_publish: true,
          club_id: "club-1",
          club_name: "AC Como",
          details: { requirements: "x" },
          has_details: true,
          position_id: "p1",
          position_scope: "team",
          profile_type: "player",
          resource_version: 4,
          secondary_teams: [
            { isInactive: false, name: "Under 15", teamId: "t2" },
          ],
          status: "draft",
        },
      ]),
    );

    const [row] = await fetchPositionDrafts(["p1"]);

    expect(row.blockers).toEqual(["AGE_UNSET"]);
    expect(row.hasDetails).toBe(true);
    expect(row.resourceVersion).toBe(4);
    expect(row.secondaryTeams).toEqual([
      { isInactive: false, name: "Under 15", teamId: "t2" },
    ]);
  });

  it("un ambito sconosciuto ricade su TEAM, non su SOCIETY", () => {
    // §35: «Non interpretare ogni Team null come SOCIETY.»
    rpc.mockReturnValue(
      ok([{ position_id: "p1", position_scope: null, team_id: null }]),
    );

    return fetchPositionDrafts(["p1"]).then(([row]) => {
      expect(row.scope).toBe("team");
    });
  });
});

describe("patch parziale (§21)", () => {
  it("manda al server soltanto le chiavi che il chiamante ha nominato", async () => {
    rpc.mockReturnValue(ok([{ position_id: "p1", resource_version: 5 }]));

    await updatePositionDraft({
      expectedVersion: 4,
      patch: { details: { requirements: "Patente B" } },
      positionId: "p1",
    });

    const [, params] = rpc.mock.calls[0];

    expect(params.p_patch).toEqual({ details: { requirements: "Patente B" } });
    expect(params.p_expected_version).toBe(4);
    /* Nessuna chiave fantasma: una patch che nominasse `description: null`
       senza che l'utente l'abbia toccata la cancellerebbe. */
    expect(Object.keys(params.p_patch)).toEqual(["details"]);
  });
});
