/**
 * Il flow Segnala montato sui componenti reali: scelta della categoria, secondo livello,
 * dettagli, invio, successo, già segnalato, target sparito ed errore con retry (HOM-11 §79–§122,
 * §127, §155–§160, §202–§204, §211–§216, §256–§272, §288–§290).
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { countTestId, hostByTestId, pressTestId, textOf } from "../../feed/components/feed-test-helpers";
import type { ReportTarget } from "../moderation-types";
import { reportDraftStore, resetReportDraftStore } from "../report-draft-store";
import { reportedStore, resetReportedStore } from "../reported-store";
import { ReportFlowScreen } from "./ReportFlowScreen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  replace: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: mocks.back, canGoBack: mocks.canGoBack, replace: mocks.replace }),
}));
vi.mock("../../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("../../auth/use-session", () => ({ useSession: () => ({ profile: { id: "viewer-1" } }) }));

const CATEGORY_ROWS = [
  {
    allows_free_text: true,
    category_id: "spam_misleading",
    description: null,
    label: "Spam o contenuto ingannevole",
    parent_id: null,
    requires_subcategory: true,
    sort_order: 1,
  },
  {
    allows_free_text: true,
    category_id: "spam_misleading.scam",
    description: null,
    label: "Truffa o tentativo di frode",
    parent_id: "spam_misleading",
    requires_subcategory: false,
    sort_order: 1,
  },
  {
    allows_free_text: true,
    category_id: "spam_misleading.link",
    description: null,
    label: "Link sospetto",
    parent_id: "spam_misleading",
    requires_subcategory: false,
    sort_order: 2,
  },
  {
    allows_free_text: true,
    category_id: "other",
    description: null,
    label: "Altro",
    parent_id: null,
    requires_subcategory: false,
    sort_order: 8,
  },
];

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

type Rpc = (name: string, params?: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;

let state = { already_reported: false, available: true, reportable: true };
let create: Rpc = async () => ({ data: { report_id: "r-1", status: "created" }, error: null });

const trees: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  resetReportDraftStore();
  resetReportedStore();
  mocks.back.mockReset();
  mocks.replace.mockReset();
  mocks.canGoBack.mockReset();
  mocks.canGoBack.mockReturnValue(true);
  state = { already_reported: false, available: true, reportable: true };
  create = async () => ({ data: { report_id: "r-1", status: "created" }, error: null });
  mocks.rpc.mockReset();
  mocks.rpc.mockImplementation(async (name: string, params?: Record<string, unknown>) => {
    switch (name) {
      case "fetch_report_categories":
        return { data: CATEGORY_ROWS, error: null };
      case "fetch_report_state":
        return { data: state, error: null };
      case "create_moderation_report":
        return create(name, params);
      default:
        return { data: null, error: null };
    }
  });
});

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
});

async function flush() {
  for (let round = 0; round < 3; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function mount(target: ReportTarget | null) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <ReportFlowScreen target={target} />
      </QueryClientProvider>,
    );
  });
  trees.push(tree);
  await flush();
  return tree;
}

/** Solo i testi che l'utente legge (non testID né label parlate). */
function visibleTexts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => String(node.type) === "Text")
    .flatMap((node) => {
      const { children } = node.props;
      return typeof children === "string" ? [children] : Array.isArray(children) ? children.filter((c): c is string => typeof c === "string") : [];
    });
}

async function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  await act(async () => {
    pressTestId(tree, testID);
  });
  await flush();
}

function submitDisabled(tree: TestRenderer.ReactTestRenderer): boolean {
  return hostByTestId(tree, "report-submit")[0].props.disabled === true;
}

async function typeDetails(tree: TestRenderer.ReactTestRenderer, value: string) {
  const input = hostByTestId(tree, "report-details-input")[0];
  await act(async () => {
    input.props.onChangeText(value);
  });
}

function createCalls() {
  return mocks.rpc.mock.calls.filter((call) => call[0] === "create_moderation_report");
}

describe("Screen 5 — scelta categoria (§80–§90, §212–§213)", () => {
  it("titolo, sottotitolo di riservatezza e categorie del server in una lista semplice", async () => {
    const tree = await mount(CONTENT);
    const texts = visibleTexts(tree);

    expect(texts).toContain("Segnala contenuto");
    expect(texts).toContain("Perché vuoi segnalare questo contenuto?");
    expect(texts).toContain("La tua segnalazione è riservata e ci aiuta a mantenere PROLINK un ambiente sicuro.");
    // Solo il primo livello, nell'ordine del server.
    expect(texts).toContain("Spam o contenuto ingannevole");
    expect(texts).toContain("Altro");
    expect(texts).not.toContain("Truffa o tentativo di frode");
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_report_categories", { p_target_type: "CONTENT" });
  });

  it("§86: nessun id di categoria, enum o stato tecnico a schermo", async () => {
    const tree = await mount(CONTENT);
    const texts = visibleTexts(tree).join(" ");

    for (const technical of ["spam_misleading", "CONTENT", "RECEIVED", "category_id", "other"]) {
      expect(texts).not.toContain(technical);
    }
  });

  it("COMMENT: stesso engine, titolo per il commento e categorie per COMMENT (§81, §87, §264)", async () => {
    const tree = await mount(COMMENT);

    expect(visibleTexts(tree)).toContain("Perché vuoi segnalare questo commento?");
    expect(mocks.rpc).toHaveBeenCalledWith("fetch_report_categories", { p_target_type: "COMMENT" });
  });

  it("header con × al primo passo; nessuna bottom navigation (§80, D7)", async () => {
    const tree = await mount(CONTENT);

    expect(countTestId(tree, "report-close")).toBe(1);
    expect(countTestId(tree, "report-back")).toBe(0);
  });

  it("categorie in caricamento o in errore: stato dedicato con «Riprova» (§256)", async () => {
    mocks.rpc.mockImplementation(async (name: string) =>
      name === "fetch_report_categories"
        ? { data: null, error: new Error("offline") }
        : { data: state, error: null },
    );
    const tree = await mount(CONTENT);

    expect(visibleTexts(tree)).toContain("Non è stato possibile caricare le categorie.");
    expect(visibleTexts(tree)).toContain("Riprova");
  });
});

describe("Screen 6 — categoria semplice e sottocategoria (§88–§97, §258–§260)", () => {
  it("§90 categoria semplice: dritta ai dettagli, senza sottocategorie né schermate in mezzo", async () => {
    const tree = await mount(CONTENT);

    await press(tree, "report-category-other");
    const texts = visibleTexts(tree);

    expect(countTestId(tree, "report-details-step")).toBe(1);
    expect(texts).toContain("Categoria selezionata");
    expect(texts).toContain("Altro");
    expect(texts).toContain("Modifica");
    expect(texts).not.toContain("In cosa consiste il problema?");
    expect(texts).toContain("Invia segnalazione");
    // Header: ← al secondo passo (§93).
    expect(countTestId(tree, "report-back")).toBe(1);
    expect(submitDisabled(tree)).toBe(false);
  });

  it("§89 con sottocategoria: secondo livello come radio; CTA disabilitata finché manca (§95)", async () => {
    const tree = await mount(CONTENT);

    await press(tree, "report-category-spam_misleading");

    expect(visibleTexts(tree)).toContain("In cosa consiste il problema?");
    expect(visibleTexts(tree)).toContain("Truffa o tentativo di frode");
    expect(visibleTexts(tree)).toContain("Link sospetto");
    expect(submitDisabled(tree)).toBe(true);

    await press(tree, "report-subcategory-spam_misleading.scam");

    expect(submitDisabled(tree)).toBe(false);
  });

  it("§202: lo stato selezionato è semantico (radio checked), non solo visivo", async () => {
    const tree = await mount(CONTENT);
    await press(tree, "report-category-spam_misleading");
    await press(tree, "report-subcategory-spam_misleading.link");

    const checked = hostByTestId(tree, "report-subcategory-spam_misleading.link")[0];
    const other = hostByTestId(tree, "report-subcategory-spam_misleading.scam")[0];

    expect(checked.props.accessibilityRole).toBe("radio");
    expect(checked.props.accessibilityState).toMatchObject({ checked: true });
    expect(other.props.accessibilityState).toMatchObject({ checked: false });
  });

  it("§203: la textarea ha la label parlata «Aggiungi dettagli, facoltativo» e il contatore 0/500", async () => {
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");

    const input = hostByTestId(tree, "report-details-input")[0];
    expect(input.props.accessibilityLabel).toBe("Aggiungi dettagli, facoltativo");
    expect(input.props.maxLength).toBe(500);
    expect(visibleTexts(tree)).toContain("Aggiungi dettagli");
    expect(visibleTexts(tree)).toContain("(facoltativo)");
    expect(visibleTexts(tree)).toContain("0/500");

    await typeDetails(tree, "Vedi il link");
    expect(visibleTexts(tree)).toContain("12/500");
  });

  it("§98 «Modifica»: si torna alla scelta e il testo scritto resta", async () => {
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");
    await typeDetails(tree, "Ho scritto qualcosa");

    await press(tree, "report-edit-category");

    expect(countTestId(tree, "report-category-step")).toBe(1);
    expect(reportDraftStore.get("CONTENT:club_media:p-1")).toMatchObject({
      categoryId: null,
      details: "Ho scritto qualcosa",
    });

    await press(tree, "report-category-other");
    expect(hostByTestId(tree, "report-details-input")[0].props.value).toBe("Ho scritto qualcosa");
  });

  it("la freccia indietro fa lo stesso di «Modifica»", async () => {
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");

    await press(tree, "report-back");

    expect(countTestId(tree, "report-category-step")).toBe(1);
  });
});

describe("invio e Screen 7 — successo (§94–§97, §114–§122, §263–§272)", () => {
  it("invia con target, categoria, sottocategoria, dettagli e chiave; mostra «Segnalazione inviata» e «Fine»", async () => {
    const tree = await mount(CONTENT);
    await press(tree, "report-category-spam_misleading");
    await press(tree, "report-subcategory-spam_misleading.scam");
    await typeDetails(tree, "Link sospetto nel post");

    await press(tree, "report-submit");

    expect(createCalls()).toHaveLength(1);
    expect(createCalls()[0][1]).toMatchObject({
      p_category_id: "spam_misleading",
      p_content_type: "club_media",
      p_details: "Link sospetto nel post",
      p_origin: "HOME_PER_TE",
      p_subcategory_id: "spam_misleading.scam",
      p_target_id: "p-1",
      p_target_type: "CONTENT",
    });
    expect(typeof createCalls()[0][1].p_operation_key).toBe("string");

    const texts = visibleTexts(tree);
    expect(countTestId(tree, "report-terminal-success")).toBe(1);
    expect(texts).toContain("Segnalazione inviata");
    expect(texts).toContain("Valuteremo il contenuto secondo le regole di PROLINK.");
    expect(texts).toContain("Fine");
  });

  it("§122: nessun Annulla dopo la segnalazione; nessuna promessa di provvedimento (§120–§121)", async () => {
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");
    await press(tree, "report-submit");

    const json = textOf(tree).toLowerCase();
    expect(json).not.toContain("annulla");
    expect(json).not.toContain("eliminat");
    expect(json).not.toContain("sospes");
    expect(json).not.toContain("torna al feed");
  });

  it("§117, §272: «Fine» torna all'origine nello stack, senza forzare la Home", async () => {
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");
    await press(tree, "report-submit");

    await press(tree, "report-done");

    expect(mocks.back).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("D7: senza stack (deep link) «Fine» costruisce la Home", async () => {
    mocks.canGoBack.mockReturnValue(false);
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");
    await press(tree, "report-submit");

    await press(tree, "report-done");

    expect(mocks.replace).toHaveBeenCalledWith("/(tabs)");
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it("§123, §125: il contenuto segnalato esce dalla superficie del reporter e la bozza sparisce", async () => {
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");

    await press(tree, "report-submit");

    expect(reportedStore.has("CONTENT:club_media:p-1")).toBe(true);
    expect(reportDraftStore.has("CONTENT:club_media:p-1")).toBe(false);
  });

  it("COMMENT: il commento segnalato entra nello store, per ripiegarsi (§134, §264–§265)", async () => {
    const tree = await mount(COMMENT);
    await press(tree, "report-category-other");

    await press(tree, "report-submit");

    expect(createCalls()[0][1]).toMatchObject({
      p_content_type: "profile_post",
      p_origin: "HOME_SEGUITI",
      p_target_id: "c-1",
      p_target_type: "COMMENT",
    });
    expect(reportedStore.has("COMMENT:c-1")).toBe(true);
  });
});

describe("§96–§97, §261 — doppio tap e loading", () => {
  it("un solo report: durante l'invio la CTA è in loading e disabilitata, il secondo tap non parte", async () => {
    let resolve!: () => void;
    create = () =>
      new Promise((done) => {
        resolve = () => done({ data: { report_id: "r-1", status: "created" }, error: null });
      });
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");

    await act(async () => {
      pressTestId(tree, "report-submit");
    });
    // Loading leggero nel bottone, non uno spinner a tutto schermo (§97).
    expect(submitDisabled(tree)).toBe(true);
    expect(countTestId(tree, "report-submit-spinner")).toBe(1);

    await act(async () => {
      pressTestId(tree, "report-submit");
    });
    expect(createCalls()).toHaveLength(1);

    await act(async () => {
      resolve();
    });
    await flush();
    expect(countTestId(tree, "report-terminal-success")).toBe(1);
  });
});

describe("doppio tap nello stesso frame — §96–§97", () => {
  it("il secondo tap con la closure ancora «abilitata» non azzera il loading né crea un secondo invio", async () => {
    let resolve!: () => void;
    create = () =>
      new Promise((done) => {
        resolve = () => done({ data: { report_id: "r-1", status: "created" }, error: null });
      });
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");
    // La stessa closure (canSubmit vero) invocata due volte prima che React ri-renderizzi.
    const onPress = hostByTestId(tree, "report-submit")[0].props.onPress as () => void;

    await act(async () => {
      onPress();
      onPress();
    });

    expect(createCalls()).toHaveLength(1);
    // Il loading resta fino alla risposta: la fase non è tornata a «form».
    expect(submitDisabled(tree)).toBe(true);
    expect(countTestId(tree, "report-submit-spinner")).toBe(1);

    await act(async () => {
      resolve();
    });
    await flush();
    expect(countTestId(tree, "report-terminal-success")).toBe(1);
  });
});

describe("categorie vecchie (invalid_category) — §155–§156, §204", () => {
  it("si torna alla scelta CON il messaggio d'errore generico, senza perdere il testo", async () => {
    create = async () => ({ data: { report_id: null, status: "invalid_category" }, error: null });
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");
    await typeDetails(tree, "Testo da non perdere");

    await press(tree, "report-submit");

    expect(countTestId(tree, "report-category-step")).toBe(1);
    expect(visibleTexts(tree)).toContain("Non è stato possibile inviare la segnalazione. Riprova.");
    expect(
      tree.root.findAll((node) => typeof node.type === "string" && node.props?.accessibilityRole === "alert"),
    ).not.toHaveLength(0);
    expect(countTestId(tree, "report-terminal-success")).toBe(0);
    expect(reportDraftStore.get("CONTENT:club_media:p-1").details).toBe("Testo da non perdere");
    // Le categorie si rileggono dal server.
    expect(mocks.rpc.mock.calls.filter((call) => call[0] === "fetch_report_categories")).toHaveLength(2);
  });

  it("l'errore di rete NON segue chi torna a scegliere di sua volontà con «Modifica»", async () => {
    create = async () => ({ data: null, error: new Error("offline") });
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");
    await press(tree, "report-submit");
    expect(visibleTexts(tree)).toContain("Non è stato possibile inviare la segnalazione. Riprova.");

    await press(tree, "report-edit-category");

    expect(countTestId(tree, "report-category-step")).toBe(1);
    expect(visibleTexts(tree)).not.toContain("Non è stato possibile inviare la segnalazione. Riprova.");
  });
});

describe("errore e retry — §155–§158, §204, §262, §288–§289", () => {
  it("errore: nessun falso successo, messaggio annunciato, selezioni e testo intatti", async () => {
    create = async () => ({ data: null, error: new Error("offline") });
    const tree = await mount(CONTENT);
    await press(tree, "report-category-spam_misleading");
    await press(tree, "report-subcategory-spam_misleading.link");
    await typeDetails(tree, "Link sospetto");

    await press(tree, "report-submit");

    expect(countTestId(tree, "report-terminal-success")).toBe(0);
    expect(visibleTexts(tree)).toContain("Non è stato possibile inviare la segnalazione. Riprova.");
    const alert = tree.root.findAll(
      (node) => typeof node.type === "string" && node.props?.accessibilityRole === "alert",
    );
    expect(alert.length).toBeGreaterThan(0);
    expect(reportedStore.has("CONTENT:club_media:p-1")).toBe(false);
    expect(reportDraftStore.get("CONTENT:club_media:p-1")).toMatchObject({
      categoryId: "spam_misleading",
      details: "Link sospetto",
      subcategoryId: "spam_misleading.link",
    });
    // Non costringe a ricominciare: la CTA è di nuovo premibile (§99).
    expect(submitDisabled(tree)).toBe(false);
  });

  it("retry: stessi dati e STESSA chiave di idempotenza, nessun duplicato (§157–§158, §262)", async () => {
    let attempts = 0;
    create = async () => {
      attempts += 1;
      return attempts === 1
        ? { data: null, error: new Error("timeout") }
        : { data: { report_id: "r-1", status: "created" }, error: null };
    };
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");
    await typeDetails(tree, "Dettaglio");

    await press(tree, "report-submit");
    await press(tree, "report-submit");

    expect(createCalls()).toHaveLength(2);
    expect(createCalls()[0][1].p_operation_key).toBe(createCalls()[1][1].p_operation_key);
    expect(createCalls()[1][1]).toMatchObject({ p_category_id: "other", p_details: "Dettaglio" });
    expect(countTestId(tree, "report-terminal-success")).toBe(1);
  });
});

describe("stati terminali — §127, §159–§160, §276–§277, §290", () => {
  it("già segnalato (stato del server all'apertura): «Hai già segnalato questo contenuto»", async () => {
    state = { already_reported: true, available: true, reportable: true };
    const tree = await mount(CONTENT);

    expect(countTestId(tree, "report-terminal-duplicate")).toBe(1);
    expect(visibleTexts(tree)).toContain("Hai già segnalato questo contenuto");
    expect(visibleTexts(tree)).toContain("Fine");
    // §295: lo stesso stato di un altro device vale anche qui.
    expect(reportedStore.has("CONTENT:club_media:p-1")).toBe(true);
  });

  it("già segnalato, commento: copy per il commento", async () => {
    state = { already_reported: true, available: true, reportable: true };
    const tree = await mount(COMMENT);

    expect(visibleTexts(tree)).toContain("Hai già segnalato questo commento");
  });

  it("duplicato scoperto all'invio (altra chiave): lo stesso stato (§128, §276)", async () => {
    create = async () => ({ data: { report_id: "r-0", status: "already_reported" }, error: null });
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");

    await press(tree, "report-submit");

    expect(visibleTexts(tree)).toContain("Hai già segnalato questo contenuto");
  });

  it("target sparito all'apertura: «Il contenuto non è più disponibile» (§159)", async () => {
    state = { already_reported: false, available: false, reportable: true };
    const tree = await mount(CONTENT);

    expect(countTestId(tree, "report-terminal-unavailable")).toBe(1);
    expect(visibleTexts(tree)).toContain("Il contenuto non è più disponibile");
  });

  it("target sparito prima dell'invio: copy del commento «Il commento non è più disponibile» (§160, §290)", async () => {
    create = async () => ({ data: { report_id: null, status: "target_unavailable" }, error: null });
    const tree = await mount(COMMENT);
    await press(tree, "report-category-other");

    await press(tree, "report-submit");

    expect(visibleTexts(tree)).toContain("Il commento non è più disponibile");
    expect(reportedStore.has("COMMENT:c-1")).toBe(false);
  });

  it("non segnalabile (proprio o gestito, D5): stato dedicato, senza categorie", async () => {
    state = { already_reported: false, available: true, reportable: false };
    const tree = await mount(CONTENT);

    expect(countTestId(tree, "report-terminal-not_allowed")).toBe(1);
    expect(countTestId(tree, "report-category-step")).toBe(0);
  });

  it("parametri della route non validi: «non più disponibile», nessuna richiesta di categoria", async () => {
    const tree = await mount(null);

    expect(countTestId(tree, "report-terminal-unavailable")).toBe(1);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("uno stato che non si riesce a leggere non blocca il flow: l'invio rivalida sul server (§182)", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "fetch_report_state") {
        return { data: null, error: new Error("offline") };
      }
      return name === "fetch_report_categories"
        ? { data: CATEGORY_ROWS, error: null }
        : { data: { report_id: "r-1", status: "created" }, error: null };
    });
    const tree = await mount(CONTENT);

    expect(countTestId(tree, "report-category-step")).toBe(1);
  });
});

describe("account-scoped — D1, §75–§77, §255", () => {
  it("nessun selettore «Segnala come» in nessun passo", async () => {
    const tree = await mount(CONTENT);
    await press(tree, "report-category-other");

    expect(textOf(tree)).not.toMatch(/segnala come/i);
  });
});
