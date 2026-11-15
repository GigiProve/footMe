/**
 * L'invio di Segnala: idempotenza (doppio tap, retry, timeout ambiguo), successo, duplicato,
 * target sparito, errori senza falso successo, nessuna cascata, nessun testo libero negli
 * eventi (HOM-11 §94–§101, §114, §123–§127, §155–§160, §189, §253, §261–§265, §273–§277, §286–§289).
 *
 * Si prova `createReportSubmitter` con le dipendenze iniettate: nessun React, nessuna rete.
 */
import { describe, expect, it, vi } from "vitest";

import {
  chooseCategory,
  chooseSubcategory,
  setDetails,
} from "./moderation-presentation";
import type { ReportAnalyticsEvent } from "./moderation-analytics";
import type { CreateReportInput, ReportCategory, ReportTarget } from "./moderation-types";
import { createReportDraftStore } from "./report-draft-store";
import { createReportedStore } from "./reported-store";
import { createReportSubmitter } from "./use-report-flow";

vi.mock("../../lib/supabase", () => ({ supabase: { rpc: vi.fn() } }));
vi.mock("../auth/use-session", () => ({ useSession: () => ({ profile: { id: "viewer-1" } }) }));

const CONTENT: ReportTarget = {
  contentType: "club_media",
  origin: "HOME_PER_TE",
  parentContentId: null,
  targetId: "p-1",
  targetType: "CONTENT",
};
const COMMENT: ReportTarget = {
  contentType: "profile_post",
  origin: "HOME_SEGUITI",
  parentContentId: "p-9",
  targetId: "c-1",
  targetType: "COMMENT",
};
const CONTENT_KEY = "CONTENT:club_media:p-1";
const COMMENT_KEY = "COMMENT:c-1";

const CATEGORIES: ReportCategory[] = [
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
    allowsFreeText: true,
    categoryId: "spam.scam",
    description: null,
    label: "Truffa o tentativo di frode",
    parentId: "spam",
    requiresSubcategory: false,
    sortOrder: 1,
  },
  {
    allowsFreeText: true,
    categoryId: "other",
    description: null,
    label: "Altro",
    parentId: null,
    requiresSubcategory: false,
    sortOrder: 2,
  },
];

type CreateResult = Awaited<ReturnType<typeof import("./moderation-service").createModerationReport>>;

function setup(create: (input: CreateReportInput) => Promise<CreateResult> = async () => ({ reportId: "r-1", status: "created" })) {
  const drafts = createReportDraftStore();
  const reported = createReportedStore();
  const created = vi.fn(create);
  const onReported = vi.fn();
  const events: ReportAnalyticsEvent[] = [];
  let keys = 0;
  const submitter = createReportSubmitter({
    create: created,
    drafts,
    identity: () => ({ id: "club-1", type: "society" }),
    newKey: () => `key-${(keys += 1)}`,
    onReported,
    reported,
    track: (event) => events.push(event),
  });

  return { created, drafts, events, onReported, reported, submitter };
}

describe("invio — §94, §100, §263–§265", () => {
  it("categoria semplice: un solo invio con la chiave della bozza, l'identità come metadata (§77)", async () => {
    const { created, drafts, submitter } = setup();
    drafts.update(CONTENT_KEY, (draft) => chooseCategory(draft, "other"));

    const outcome = await submitter.submit(CONTENT, CATEGORIES);

    expect(outcome).toEqual({ phase: "success", staleCategories: false });
    expect(created).toHaveBeenCalledTimes(1);
    expect(created).toHaveBeenCalledWith({
      categoryId: "other",
      contextualIdentity: { id: "club-1", type: "society" },
      details: null,
      operationKey: "key-1",
      subcategoryId: null,
      target: CONTENT,
    });
  });

  it("con sottocategoria e dettagli: partono entrambi, il testo già pulito (§89, §184)", async () => {
    const { created, drafts, submitter } = setup();
    drafts.update(CONTENT_KEY, (draft) =>
      setDetails(chooseSubcategory(chooseCategory(draft, "spam"), "spam.scam"), "  Link sospetto  "),
    );

    await submitter.submit(CONTENT, CATEGORIES);

    expect(created.mock.calls[0][0]).toMatchObject({
      categoryId: "spam",
      details: "Link sospetto",
      subcategoryId: "spam.scam",
    });
  });

  it("COMMENT: stesso submitter, target_type COMMENT (§132–§133, §264–§265)", async () => {
    const { created, drafts, submitter } = setup();
    drafts.update(COMMENT_KEY, (draft) => chooseCategory(draft, "other"));

    await submitter.submit(COMMENT, CATEGORIES);

    expect(created.mock.calls[0][0].target).toEqual(COMMENT);
  });

  it("senza selezione valida non parte nulla (§95)", async () => {
    const { created, submitter } = setup();

    expect(await submitter.submit(CONTENT, CATEGORIES)).toBeNull();
    expect(created).not.toHaveBeenCalled();
  });
});

describe("doppio tap e retry — §96, §100–§101, §158, §261–§262", () => {
  it("doppio tap: un solo report", async () => {
    let resolve!: (value: CreateResult) => void;
    const { created, drafts, submitter } = setup(
      () => new Promise<CreateResult>((done) => (resolve = done)),
    );
    drafts.update(CONTENT_KEY, (draft) => chooseCategory(draft, "other"));

    const first = submitter.submit(CONTENT, CATEGORIES);
    const second = await submitter.submit(CONTENT, CATEGORIES);
    resolve({ reportId: "r-1", status: "created" });
    await first;

    expect(second).toBeNull();
    expect(created).toHaveBeenCalledTimes(1);
  });

  it("timeout ambiguo: il retry riusa la STESSA chiave e il server risponde con lo stesso report", async () => {
    const results: (CreateResult | Error)[] = [
      new Error("timeout"),
      { reportId: "r-1", status: "created" },
    ];
    const { created, drafts, submitter } = setup(async () => {
      const next = results.shift() as CreateResult | Error;
      if (next instanceof Error) {
        throw next;
      }
      return next;
    });
    drafts.update(CONTENT_KEY, (draft) => chooseCategory(draft, "other"));

    const first = await submitter.submit(CONTENT, CATEGORIES);
    const retry = await submitter.submit(CONTENT, CATEGORIES);

    expect(first).toEqual({ phase: "error", staleCategories: false });
    expect(retry).toEqual({ phase: "success", staleCategories: false });
    expect(created.mock.calls[0][0].operationKey).toBe("key-1");
    expect(created.mock.calls[1][0].operationKey).toBe("key-1");
  });

  it("l'analytics distingue il primo invio dal retry", async () => {
    const { drafts, events, submitter } = setup(async () => {
      throw new Error("offline");
    });
    drafts.update(CONTENT_KEY, (draft) => chooseCategory(draft, "other"));

    await submitter.submit(CONTENT, CATEGORIES);
    await submitter.submit(CONTENT, CATEGORIES);

    const attempts = events.filter((event) => event.name === "report_submit_attempt");
    expect(attempts).toHaveLength(2);
    expect(attempts[0]).toMatchObject({ isRetry: false });
    expect(attempts[1]).toMatchObject({ isRetry: true });
  });

  it("contenuto modificato dopo un errore: chiave nuova", async () => {
    const { created, drafts, submitter } = setup(async () => {
      throw new Error("offline");
    });
    drafts.update(CONTENT_KEY, (draft) => chooseCategory(draft, "other"));
    await submitter.submit(CONTENT, CATEGORIES);

    drafts.update(CONTENT_KEY, (draft) => setDetails(draft, "ho aggiunto un dettaglio"));
    await submitter.submit(CONTENT, CATEGORIES);

    expect(created.mock.calls[0][0].operationKey).toBe("key-1");
    expect(created.mock.calls[1][0].operationKey).toBe("key-2");
  });
});

describe("errore — §155–§158, §288–§289", () => {
  it("rete: nessun falso successo, dati e chiave intatti per il retry", async () => {
    const { drafts, events, onReported, reported, submitter } = setup(async () => {
      throw new Error("offline");
    });
    drafts.update(CONTENT_KEY, (draft) => setDetails(chooseCategory(draft, "other"), "testo"));

    const outcome = await submitter.submit(CONTENT, CATEGORIES);

    expect(outcome).toEqual({ phase: "error", staleCategories: false });
    expect(drafts.get(CONTENT_KEY)).toMatchObject({ categoryId: "other", details: "testo", operationKey: "key-1" });
    // Non segnalato: il contenuto non sparisce, nessuna cache toccata (§155).
    expect(reported.has(CONTENT_KEY)).toBe(false);
    expect(onReported).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({ name: "report_submit_failure", reason: "network" });
  });

  it("invalid_category: errore, categorie da rileggere, bozza intatta", async () => {
    const { drafts, events, submitter } = setup(async () => ({ reportId: null, status: "invalid_category" }));
    drafts.update(CONTENT_KEY, (draft) => chooseCategory(draft, "other"));

    const outcome = await submitter.submit(CONTENT, CATEGORIES);

    expect(outcome).toEqual({ phase: "error", staleCategories: true });
    expect(drafts.has(CONTENT_KEY)).toBe(true);
    expect(events.at(-1)).toMatchObject({ name: "report_submit_failure", reason: "invalid_category" });
  });
});

describe("esiti definitivi — §114, §123–§127, §159, §276", () => {
  it("successo: il target entra fra i segnalati, la cache si ripulisce, la bozza sparisce", async () => {
    const { drafts, onReported, reported, submitter } = setup();
    drafts.update(CONTENT_KEY, (draft) => chooseCategory(draft, "other"));

    await submitter.submit(CONTENT, CATEGORIES);

    expect(reported.has(CONTENT_KEY)).toBe(true);
    expect(onReported).toHaveBeenCalledWith(CONTENT);
    expect(drafts.has(CONTENT_KEY)).toBe(false);
  });

  it("duplicato (altra chiave, già segnalato): «già segnalato», e il target resta segnalato (§127, §295)", async () => {
    const { drafts, events, reported, submitter } = setup(async () => ({ reportId: "r-0", status: "already_reported" }));
    drafts.update(COMMENT_KEY, (draft) => chooseCategory(draft, "other"));

    const outcome = await submitter.submit(COMMENT, CATEGORIES);

    expect(outcome).toEqual({ phase: "duplicate", staleCategories: false });
    expect(reported.has(COMMENT_KEY)).toBe(true);
    expect(events.map((event) => event.name)).toContain("report_duplicate_detected");
  });

  it("target sparito prima dell'invio: «non più disponibile», nessun segnalato (§159–§160)", async () => {
    const { drafts, onReported, reported, submitter } = setup(async () => ({ reportId: null, status: "target_unavailable" }));
    drafts.update(COMMENT_KEY, (draft) => chooseCategory(draft, "other"));

    const outcome = await submitter.submit(COMMENT, CATEGORIES);

    expect(outcome).toEqual({ phase: "unavailable", staleCategories: false });
    expect(reported.has(COMMENT_KEY)).toBe(false);
    expect(onReported).not.toHaveBeenCalled();
    expect(drafts.has(COMMENT_KEY)).toBe(false);
  });

  it("not_allowed (target proprio o gestito, D5): fase dedicata, nessun segnalato", async () => {
    const { drafts, events, reported, submitter } = setup(async () => ({ reportId: null, status: "not_allowed" }));
    drafts.update(CONTENT_KEY, (draft) => chooseCategory(draft, "other"));

    const outcome = await submitter.submit(CONTENT, CATEGORIES);

    expect(outcome?.phase).toBe("not_allowed");
    expect(reported.has(CONTENT_KEY)).toBe(false);
    expect(events.at(-1)).toMatchObject({ name: "report_submit_failure", reason: "not_allowed" });
  });
});

describe("analytics — §188–§191, §298", () => {
  it("successo: attempt e success con l'id interno della categoria; mai il testo libero", async () => {
    const { drafts, events, submitter } = setup();
    drafts.update(CONTENT_KEY, (draft) => setDetails(chooseCategory(draft, "other"), "testo molto privato"));

    await submitter.submit(CONTENT, CATEGORIES);

    expect(events.map((event) => event.name)).toEqual(["report_submit_attempt", "report_submit_success"]);
    expect(events[0]).toMatchObject({ categoryId: "other", hasDetails: true, targetType: "CONTENT" });

    for (const event of events) {
      expect(JSON.stringify(event)).not.toContain("testo molto privato");
      for (const forbidden of ["details", "text", "body", "reporterId", "authorId"]) {
        expect(Object.keys(event)).not.toContain(forbidden);
      }
    }
  });
});

describe("nessuna cascata — §150–§152, §167, §286–§287", () => {
  it("il submitter dipende solo dal create: nessun Follow, nessun Block, nessun «Non mi interessa»", () => {
    const { submitter } = setup();

    expect(Object.keys(submitter)).toEqual(["submit"]);
  });
});
