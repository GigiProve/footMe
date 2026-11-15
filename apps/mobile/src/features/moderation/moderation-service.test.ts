/**
 * Servizio di Segnala: nomi delle RPC e dei parametri del contratto, reporter dalla sessione
 * (mai dal client), identità solo come metadata, nessun finto successo (HOM-11 §75–§77,
 * §84, §100–§101, §155, §180–§183, §255).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createModerationReport,
  fetchReportCategories,
  fetchReportState,
  mapCategories,
  mapCreateResult,
  mapReportState,
} from "./moderation-service";
import type { CreateReportInput, ReportTarget } from "./moderation-types";

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));

beforeEach(() => mocks.rpc.mockReset());

const CONTENT: ReportTarget = {
  contentType: "profile_post",
  origin: "HOME_PER_TE",
  parentContentId: null,
  targetId: "p-1",
  targetType: "CONTENT",
};

const COMMENT: ReportTarget = {
  contentType: "profile_post",
  origin: "HOME_SEGUITI",
  parentContentId: "p-1",
  targetId: "c-1",
  targetType: "COMMENT",
};

function input(overrides: Partial<CreateReportInput> = {}): CreateReportInput {
  return {
    categoryId: "spam",
    contextualIdentity: null,
    details: null,
    operationKey: "op-1",
    subcategoryId: null,
    target: CONTENT,
    ...overrides,
  };
}

describe("mapCategories — §83–§84", () => {
  it("passa da snake_case a camelCase", () => {
    expect(
      mapCategories([
        {
          allows_free_text: true,
          category_id: "spam",
          description: null,
          label: "Spam o contenuto ingannevole",
          parent_id: null,
          requires_subcategory: true,
          sort_order: 1,
        },
        {
          allows_free_text: false,
          category_id: "spam.scam",
          description: "Tentativo di frode",
          label: "Truffa o tentativo di frode",
          parent_id: "spam",
          requires_subcategory: false,
          sort_order: 2,
        },
      ]),
    ).toEqual([
      {
        allowsFreeText: true,
        categoryId: "spam",
        description: null,
        label: "Spam o contenuto ingannevole",
        parentId: null,
        requiresSubcategory: true,
        sortOrder: 1,
      },
      {
        allowsFreeText: false,
        categoryId: "spam.scam",
        description: "Tentativo di frode",
        label: "Truffa o tentativo di frode",
        parentId: "spam",
        requiresSubcategory: false,
        sortOrder: 2,
      },
    ]);
  });

  it("scarta le righe senza id o etichetta; i flag assenti valgono falso", () => {
    const rows = mapCategories([
      { category_id: "ok", label: "Altro" },
      { category_id: "senza_label", label: " " },
      { label: "Senza id" },
      null,
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ allowsFreeText: false, categoryId: "ok", requiresSubcategory: false });
  });

  it("una risposta che non è un array vale «nessuna categoria»", () => {
    expect(mapCategories(null)).toEqual([]);
  });
});

describe("mapReportState — §126, §159", () => {
  it("legge i tre flag", () => {
    expect(mapReportState({ already_reported: true, available: true, reportable: false })).toEqual({
      alreadyReported: true,
      available: true,
      reportable: false,
    });
  });

  it("un flag assente vale «segnalabile e disponibile, non segnalato»", () => {
    expect(mapReportState({})).toEqual({ alreadyReported: false, available: true, reportable: true });
  });

  it("una risposta vuota solleva: il flow ignora lo stato e l'invio rivalida (§182)", () => {
    expect(() => mapReportState(null)).toThrow();
  });
});

describe("mapCreateResult — §155", () => {
  it("legge stato e report_id", () => {
    expect(mapCreateResult({ report_id: "r-1", status: "created" })).toEqual({
      reportId: "r-1",
      status: "created",
    });
    expect(mapCreateResult([{ report_id: "r-1", status: "already_reported" }])).toEqual({
      reportId: "r-1",
      status: "already_reported",
    });
  });

  it("gli altri esiti possono non avere un report_id", () => {
    for (const status of ["target_unavailable", "invalid_category", "not_allowed"] as const) {
      expect(mapCreateResult({ status })).toEqual({ reportId: null, status });
    }
  });

  it("uno stato ignoto o una risposta vuota solleva: nessun falso successo (§155)", () => {
    expect(() => mapCreateResult({ status: "boh" })).toThrow();
    expect(() => mapCreateResult(null)).toThrow();
  });
});

describe("RPC", () => {
  it("fetch_report_categories: il tipo di target; stesso engine per CONTENT e COMMENT (§87)", async () => {
    mocks.rpc.mockResolvedValue({ data: [{ category_id: "other", label: "Altro" }], error: null });

    await expect(fetchReportCategories("COMMENT")).resolves.toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_report_categories", { p_target_type: "COMMENT" });
  });

  it("fetch_report_state: tipo di target, tipo di contenuto e id", async () => {
    mocks.rpc.mockResolvedValue({
      data: { already_reported: false, available: true, reportable: true },
      error: null,
    });

    await fetchReportState(CONTENT);

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_report_state", {
      p_content_type: "profile_post",
      p_target_id: "p-1",
      p_target_type: "CONTENT",
    });
  });

  it("create_moderation_report: target, categoria, dettagli, origin e chiave (§100)", async () => {
    mocks.rpc.mockResolvedValue({ data: { report_id: "r-1", status: "created" }, error: null });

    const result = await createModerationReport(
      input({
        categoryId: "spam",
        details: "Link sospetto",
        subcategoryId: "spam.scam",
      }),
    );

    expect(result).toEqual({ reportId: "r-1", status: "created" });
    expect(mocks.rpc).toHaveBeenCalledWith("create_moderation_report", {
      p_category_id: "spam",
      p_content_type: "profile_post",
      p_contextual_identity_id: null,
      p_contextual_identity_type: null,
      p_details: "Link sospetto",
      p_operation_key: "op-1",
      p_origin: "HOME_PER_TE",
      p_subcategory_id: "spam.scam",
      p_target_id: "p-1",
      p_target_type: "CONTENT",
    });
  });

  it("COMMENT: stesso RPC con target_type = COMMENT, id del commento e tipo del contenuto padre (§132–§133, §264)", async () => {
    mocks.rpc.mockResolvedValue({ data: { report_id: "r-2", status: "created" }, error: null });

    await createModerationReport(input({ target: COMMENT }));

    expect(mocks.rpc.mock.calls).toHaveLength(1);
    expect(mocks.rpc.mock.calls[0][0]).toBe("create_moderation_report");
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_content_type: "profile_post",
      p_origin: "HOME_SEGUITI",
      p_target_id: "c-1",
      p_target_type: "COMMENT",
    });
  });

  it("senza origin noto parte «DEEP_LINK»: la provenienza non si inventa e non si lascia vuota", async () => {
    mocks.rpc.mockResolvedValue({ data: { report_id: "r-1", status: "created" }, error: null });

    await createModerationReport(input({ target: { ...CONTENT, origin: null } }));

    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_origin: "DEEP_LINK" });
  });

  it("l'identità di interazione viaggia SOLO come metadata contestuale (§75–§77)", async () => {
    mocks.rpc.mockResolvedValue({ data: { report_id: "r-1", status: "created" }, error: null });

    await createModerationReport(input({ contextualIdentity: { id: "club-1", type: "society" } }));

    const params = mocks.rpc.mock.calls[0][1];
    expect(params).toMatchObject({
      p_contextual_identity_id: "club-1",
      p_contextual_identity_type: "society",
    });
    // Nessun parametro per il reporter, per l'autore o per lo snapshot: li ricava il server (§180–§181, §183).
    for (const forbidden of [
      "p_reporter_profile_id",
      "p_reporter_account_id",
      "p_target_author_identity_id",
      "p_target_author_identity_type",
      "p_snapshot",
      "p_moderation_state",
    ]) {
      expect(Object.keys(params)).not.toContain(forbidden);
    }
  });

  it("un tipo di identità sconosciuto non parte nemmeno come metadata", async () => {
    mocks.rpc.mockResolvedValue({ data: { report_id: "r-1", status: "created" }, error: null });

    await createModerationReport(input({ contextualIdentity: { id: "x", type: "robot" as never } }));

    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({
      p_contextual_identity_id: null,
      p_contextual_identity_type: null,
    });
  });

  it("un errore di rete risale: nessun successo inventato (§155)", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("offline") });

    await expect(createModerationReport(input())).rejects.toThrow("offline");
  });

  it("nessun Follow, nessun Block, nessun «Non mi interessa» da una segnalazione (§150–§152, §253, §287)", async () => {
    mocks.rpc.mockResolvedValue({ data: { report_id: "r-1", status: "created" }, error: null });

    await createModerationReport(input());

    expect(mocks.rpc.mock.calls.map((call) => call[0])).toEqual(["create_moderation_report"]);
  });
});
