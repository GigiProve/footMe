import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApplicationUnavailableError,
  fetchMyApplicationDetail,
  operationKey,
  reapplyToPosition,
  withdrawApplication,
} from "./lifecycle-service";

/**
 * I comandi del lifecycle (DAS-REV-23 §11, §12, §13, §23).
 *
 * Due cose vanno dimostrate qui e non altrove: che la **precondizione**
 * viaggia con il comando — senza, un ritiro deciso su una schermata vecchia
 * ritirerebbe la submission successiva — e che un accesso negato non diventa
 * un errore tecnico da ritentare in loop.
 */

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: mocks.rpc },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    ad_id: "ad1",
    ad_status: "published",
    application_group: "active",
    application_id: "app1",
    blocked_reason: null,
    can_apply: false,
    can_withdraw: true,
    category_label: "Serie D",
    club_id: "club1",
    club_is_verified: true,
    club_logo_url: "logo.png",
    club_name: "AC Como",
    concluded_at: null,
    created_at: "2026-09-13T10:00:00Z",
    deadline_at: "2026-09-18T22:00:00Z",
    latest_submitted_at: "2026-09-13T10:00:00Z",
    outcome: null,
    person_avatar_url: null,
    person_id: "p1",
    person_name: "Mario Rossi",
    person_position: "midfielder",
    person_role: "player",
    person_situation: "Svincolato",
    position_scope: "team",
    receiving_open: true,
    role_label: "Centrocampista",
    role_required: "midfielder",
    server_now: "2026-09-14T08:30:00Z",
    state: "active",
    status: "submitted",
    submission_revision: 1,
    team_label: "Prima squadra",
    withdrawn_at: null,
    ...overrides,
  };
}

describe("fetchMyApplicationDetail", () => {
  it("mappa lo stato corrente e le capacità decise dal server", async () => {
    mocks.rpc.mockReturnValue({
      maybeSingle: () => Promise.resolve({ data: detailRow(), error: null }),
    });

    const detail = await fetchMyApplicationDetail("app1");

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_my_application_detail", {
      p_application_id: "app1",
    });
    expect(detail.state).toBe("active");
    expect(detail.canWithdraw).toBe(true);
    expect(detail.canApply).toBe(false);
    expect(detail.receivingOpen).toBe(true);
    expect(detail.latestSubmittedAt).toBe("2026-09-13T10:00:00Z");
  });

  it("porta il motivo del diniego, perché le copy di scadenza e chiusura differiscono", async () => {
    mocks.rpc.mockReturnValue({
      maybeSingle: () =>
        Promise.resolve({
          data: detailRow({
            blocked_reason: "closed",
            can_apply: false,
            receiving_open: false,
            state: "withdrawn",
            status: "withdrawn",
            withdrawn_at: "2026-09-14T08:05:00Z",
          }),
          error: null,
        }),
    });

    const detail = await fetchMyApplicationDetail("app1");

    expect(detail.state).toBe("withdrawn");
    expect(detail.blockedReason).toBe("closed");
    expect(detail.withdrawnAt).toBe("2026-09-14T08:05:00Z");
  });

  it("traduce il diniego in uno stato dedicato, non in un errore da ritentare", async () => {
    // §23: «Una risorsa non autorizzata non va rappresentata come zero
    // risultati o errore tecnico da ritentare all'infinito.»
    mocks.rpc.mockReturnValue({
      maybeSingle: () =>
        Promise.resolve({
          data: null,
          error: { message: "APPLICATION_NOT_AVAILABLE" },
        }),
    });

    await expect(fetchMyApplicationDetail("app1")).rejects.toBeInstanceOf(
      ApplicationUnavailableError,
    );
  });

  it("tratta una riga assente come indisponibilità, non come dettaglio vuoto", async () => {
    mocks.rpc.mockReturnValue({
      maybeSingle: () => Promise.resolve({ data: null, error: null }),
    });

    await expect(fetchMyApplicationDetail("app1")).rejects.toBeInstanceOf(
      ApplicationUnavailableError,
    );
  });
});

describe("withdrawApplication", () => {
  it("invia la revisione osservata e la chiave dell'operazione", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          latest_submitted_at: "2026-09-13T10:00:00Z",
          replayed: false,
          status: "withdrawn",
          submission_revision: 1,
          withdrawn_at: "2026-09-14T08:05:00Z",
        },
      ],
      error: null,
    });

    const result = await withdrawApplication({
      applicationId: "app1",
      expectedRevision: 1,
      operationKey: "withdraw:app1:1:abcd",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("withdraw_application", {
      p_application_id: "app1",
      p_expected_revision: 1,
      p_idempotency_key: "withdraw:app1:1:abcd",
    });
    expect(result.state).toBe("withdrawn");
    expect(result.replayed).toBe(false);
  });

  it("riconosce la riconciliazione di un ritiro già avvenuto", async () => {
    // §11: «Se lo stato è già WITHDRAWN, riconcilia senza produrre un altro
    // ritiro logico.»
    mocks.rpc.mockResolvedValue({
      data: [
        {
          latest_submitted_at: "2026-09-13T10:00:00Z",
          replayed: true,
          status: "withdrawn",
          submission_revision: 1,
          withdrawn_at: "2026-09-14T08:05:00Z",
        },
      ],
      error: null,
    });

    const result = await withdrawApplication({
      applicationId: "app1",
      expectedRevision: 1,
      operationKey: "k",
    });

    expect(result.replayed).toBe(true);
    expect(result.state).toBe("withdrawn");
  });

  it("non espone un ritiro altrui come errore tecnico", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "APPLICATION_WITHDRAW_NOT_OWNER" },
    });

    await expect(
      withdrawApplication({
        applicationId: "app1",
        expectedRevision: 1,
        operationKey: "k",
      }),
    ).rejects.toBeInstanceOf(ApplicationUnavailableError);
  });
});

describe("reapplyToPosition", () => {
  it("riusa la candidatura rapida con la revisione ritirata come precondizione", async () => {
    mocks.rpc.mockResolvedValue({
      data: [
        {
          latest_submitted_at: "2026-09-14T08:10:00Z",
          replayed: false,
          status: "submitted",
          submission_revision: 2,
        },
      ],
      error: null,
    });

    const result = await reapplyToPosition({
      adId: "ad1",
      expectedRevision: 1,
      operationKey: "apply:app1:1:abcd",
    });

    expect(mocks.rpc).toHaveBeenCalledWith("apply_to_position", {
      p_ad_id: "ad1",
      p_cover_message: null,
      p_expected_revision: 1,
      p_idempotency_key: "apply:app1:1:abcd",
    });
    expect(result.state).toBe("active");
    expect(result.submissionRevision).toBe(2);
  });

  it("riporta una proiezione ancora ritirata quando la ricevuta è vecchia", async () => {
    // §13: «vecchio reinvio ritardato dopo un successivo ritiro: non
    // riattivare una partecipazione senza intenzione corrente.»
    mocks.rpc.mockResolvedValue({
      data: [
        {
          latest_submitted_at: "2026-09-14T08:10:00Z",
          replayed: true,
          status: "withdrawn",
          submission_revision: 2,
          withdrawn_at: "2026-09-14T09:00:00Z",
        },
      ],
      error: null,
    });

    const result = await reapplyToPosition({
      adId: "ad1",
      expectedRevision: 1,
      operationKey: "k",
    });

    expect(result.replayed).toBe(true);
    expect(result.state).toBe("withdrawn");
  });
});

describe("operationKey", () => {
  it("lega l'intenzione alla candidatura e alla revisione osservata", () => {
    const key = operationKey("withdraw", "app1", 3);

    expect(key.startsWith("withdraw:app1:3:")).toBe(true);
  });

  it("due intenzioni successive sulla stessa revisione non si confondono", () => {
    expect(operationKey("apply", "app1", 1)).not.toBe(
      operationKey("apply", "app1", 1),
    );
  });
});
