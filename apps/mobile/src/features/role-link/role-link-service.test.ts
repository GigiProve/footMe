/**
 * Test della traduzione riga → dominio (§53).
 *
 * I casi qui dentro sono quelli in cui una mappatura sbagliata produce un
 * comportamento **scorretto**, non solo brutto: uno stato sconosciuto che
 * diventa azionabile, un errore con destinazione che perde l'ID, un
 * conteggio assente che diventa zero.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  RoleLinkError,
  fetchMySocietyLink,
  fetchRoleLinkBlock,
  fetchSocietyPersonLink,
  toRoleLinkError,
} from "./role-link-service";

/* `vi.hoisted` risale sopra gli import insieme al `vi.mock` che lo usa:
   senza, il mock leggerebbe una variabile non ancora inizializzata. */
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

beforeEach(() => {
  rpc.mockReset();
});

function ok(data: unknown) {
  rpc.mockResolvedValue({ data, error: null });
}

describe("codici di errore (§16, §45)", () => {
  it("riconosce il codice più lungo quando uno è prefisso dell'altro", () => {
    const error = toRoleLinkError(
      new Error("ROLE_LINK_REMOVE_NOT_AUTHORIZED: nope"),
    );

    expect(error.code).toBe("ROLE_LINK_REMOVE_NOT_AUTHORIZED");
  });

  it("conserva l'ID del record da aprire invece dell'errore", () => {
    const error = toRoleLinkError(
      new Error(
        "ROLE_REQUEST_DUPLICATE:11111111-2222-3333-4444-555555555555",
      ),
    );

    expect(error.code).toBe("ROLE_REQUEST_DUPLICATE");
    expect(error.recordId).toBe("11111111-2222-3333-4444-555555555555");
  });

  it("un messaggio sconosciuto non diventa un codice di dominio", () => {
    expect(toRoleLinkError(new Error("boom")).code).toBe("UNKNOWN");
  });

  it("non riavvolge un errore già tradotto", () => {
    const original = new RoleLinkError("ROLE_LINK_NOT_ACTIVE");

    expect(toRoleLinkError(original)).toBe(original);
  });
});

describe("blocco contestuale (§11)", () => {
  it("uno stato sconosciuto non apre il form", async () => {
    ok([
      {
        active_count: 0,
        can_request: true,
        club_name: "AC Como",
        pending_count: 0,
        state: "qualcosa_di_nuovo",
      },
    ]);

    const block = await fetchRoleLinkBlock("club-1");

    /* §11: un client meno recente non deve inventare una CTA valida da uno
       stato che non conosce. `ineligible` non mostra nulla. */
    expect(block?.state).toBe("ineligible");
  });

  it("porta l'identità del club con sé, senza una seconda lettura", async () => {
    ok([
      {
        active_count: 2,
        active_summary: "Calciatore · Prima squadra",
        can_request: false,
        club_city: "Como",
        club_is_verified: true,
        club_name: "AC Como",
        club_region: "Lombardia",
        pending_count: 0,
        state: "active",
      },
    ]);

    const block = await fetchRoleLinkBlock("club-1");

    expect(block?.clubName).toBe("AC Como");
    expect(block?.clubIsVerified).toBe(true);
    expect(block?.canRequest).toBe(false);
  });
});

describe("rapporto personale (§27)", () => {
  it("il conteggio arriva dal backend, non da roles.length", async () => {
    /* La RPC pagina: il numero di righe non è il numero di incarichi, e §27
       vuole «3 ruoli attivi» derivato dai dati reali. */
    ok([
      {
        active_count: 3,
        aggregate_revision: 7,
        assignment_id: "a1",
        club_id: "club-1",
        club_name: "AC Como",
        context_label: "Prima squadra",
        lineage_id: "l1",
        revision: 2,
        role_label: "Allenatore",
        scope_type: "team",
      },
    ]);

    const link = await fetchMySocietyLink("club-1");

    expect(link?.activeCount).toBe(3);
    expect(link?.roles).toHaveLength(1);
    expect(link?.aggregateRevision).toBe(7);
  });
});

describe("rapporto lato Società (§32)", () => {
  it("una riga senza incarico consultabile non diventa un ruolo", async () => {
    /* Il LEFT JOIN della RPC produce comunque una riga quando l'actor non
       può leggere nessun incarico: §32 vieta di mostrare ruoli che non può
       consultare, e una riga vuota non è un ruolo. */
    ok([
      {
        aggregate_revision: 3,
        can_add: false,
        can_remove_all: false,
        club_id: "club-1",
        club_name: "AC Como",
        is_active: true,
        person_name: "Mario Rossi",
        person_profile_id: "p1",
        visible_count: 0,
      },
    ]);

    const link = await fetchSocietyPersonLink("club-1", "p1");

    expect(link?.roles).toEqual([]);
    expect(link?.visibleCount).toBe(0);
    expect(link?.isActive).toBe(true);
  });

  it("distingue modificare, rimuovere un ruolo e rimuovere la persona (§8)", async () => {
    ok([
      {
        aggregate_revision: 3,
        assignment_id: "a1",
        can_add: true,
        can_manage_row: true,
        can_remove_all: false,
        can_remove_row: false,
        club_id: "club-1",
        club_name: "AC Como",
        context_label: "Prima squadra",
        is_active: true,
        lineage_id: "l1",
        person_name: "Mario Rossi",
        person_profile_id: "p1",
        role_label: "Allenatore",
        scope_type: "team",
        visible_count: 1,
      },
    ]);

    const link = await fetchSocietyPersonLink("club-1", "p1");

    /* §8: «Rimuovi dalla società richiede la specifica autorità sulla
       relazione completa … Se non disponibile, nascondi l'azione globale e
       mantieni le azioni consentite sui singoli incarichi.» */
    expect(link?.canRemoveAll).toBe(false);
    expect(link?.roles[0]?.canManage).toBe(true);
    /* Chi può correggere un ruolo non può necessariamente toglierlo: la
       chiave è quella di DAS-REV-20, concessa separatamente. */
    expect(link?.roles[0]?.canRemove).toBe(false);
  });
});
