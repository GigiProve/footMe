/**
 * Il percorso personale 01 → 02 → 03 → 04 montato sui componenti reali
 * (DAS-REV-23 §36 — «I test UI/E2E coprono il percorso personale 01→02→03→04»).
 *
 * Si verifica ciò che la tavola rende osservabile e che la specifica rende
 * vincolante: una sola CTA per schermata e del tipo giusto, la conferma che
 * non muta niente finché non viene confermata, il fondo dello sheet 04 ancora
 * ritirato, la precondizione che viaggia col comando, e lo screen 12 senza
 * nessun dato della candidatura.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MyApplicationDetailScreen } from "../MyApplicationDetailScreen";
import type { MyApplicationDetail } from "./lifecycle-service";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  canGoBack: vi.fn(() => true),
  params: {} as Record<string, string>,
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("expo-router", () => ({
  router: routerMocks,
  useFocusEffect: () => {},
  useLocalSearchParams: () => routerMocks.params,
  useNavigation: () => ({ addListener: () => () => {}, dispatch: () => {} }),
  useRouter: () => routerMocks,
}));

const sessionMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../auth/use-session", () => ({
  useSession: sessionMocks.useSession,
}));

const toastMocks = vi.hoisted(() => ({ showToast: vi.fn() }));

const serviceMocks = vi.hoisted(() => ({
  fetchMyApplicationDetail: vi.fn(),
  reapplyToPosition: vi.fn(),
  withdrawApplication: vi.fn(),
}));

/* Si sostituiscono soltanto le chiamate di rete: mapper, tipi e classi
   d'errore restano quelli veri. */
vi.mock("./lifecycle-service", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, ...serviceMocks };
});

vi.mock("../../../ui", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, useToast: () => ({ showToast: toastMocks.showToast }) };
});

const APP = "app-1";

function detail(
  overrides: Partial<MyApplicationDetail> = {},
): MyApplicationDetail {
  return {
    adId: "ad-1",
    adStatus: "published",
    applicationGroup: "active",
    blockedReason: null,
    canApply: false,
    canWithdraw: true,
    categoryLabel: "Serie D",
    clubId: "club-1",
    clubIsVerified: true,
    clubLogoUrl: null,
    clubName: "AC Como",
    concludedAt: null,
    createdAt: "2026-09-13T10:00:00Z",
    deadlineAt: "2026-09-18T22:00:00Z",
    id: APP,
    latestSubmittedAt: "2026-09-13T10:00:00Z",
    outcome: null,
    personAvatarUrl: null,
    personId: "p-1",
    personName: "Mario Rossi",
    personPosition: "midfielder",
    personRole: "player",
    personSituation: "Svincolato",
    positionScope: "team",
    receivingOpen: true,
    roleLabel: "Centrocampista",
    roleRequired: "midfielder",
    serverNow: "2026-09-14T08:30:00Z",
    state: "active",
    status: "submitted",
    submissionRevision: 1,
    teamLabel: "Prima squadra",
    withdrawnAt: null,
    ...overrides,
  };
}

const withdrawnDetail = () =>
  detail({
    applicationGroup: "completed",
    canApply: true,
    canWithdraw: false,
    outcome: "status",
    state: "withdrawn",
    status: "withdrawn",
    withdrawnAt: "2026-09-14T08:05:00Z",
  });

const mounted: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  routerMocks.params = { id: APP };
  routerMocks.canGoBack.mockReturnValue(true);

  sessionMocks.useSession.mockReturnValue({
    isLoading: false,
    profile: { id: "p-1" },
    session: { user: { id: "p-1" } },
  });

  serviceMocks.fetchMyApplicationDetail.mockResolvedValue(detail());
});

afterEach(() => {
  mounted.splice(0).forEach((tree) => {
    act(() => tree.unmount());
  });
});

async function flush(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

async function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false, retryDelay: 0 } },
  });

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <MyApplicationDetailScreen />
      </QueryClientProvider>,
    );
  });

  mounted.push(tree);
  await flush();

  return tree;
}

function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => String(node.type) === "Text", { deep: true })
    .flatMap((node) =>
      node.props.children == null
        ? []
        : [
            Array.isArray(node.props.children)
              ? node.props.children
                  .filter((part: unknown) => typeof part === "string")
                  .join("")
              : String(node.props.children),
          ],
    )
    .filter(Boolean);
}

function hasTestID(tree: TestRenderer.ReactTestRenderer, id: string): boolean {
  return tree.root.findAll((node) => node.props?.testID === id).length > 0;
}

/** Il controllo vero, non il componente composito che lo avvolge. */
function host(tree: TestRenderer.ReactTestRenderer, id: string) {
  return tree.root.findAll(
    (node) => typeof node.type === "string" && node.props?.testID === id,
  )[0];
}

async function press(tree: TestRenderer.ReactTestRenderer, id: string) {
  const node = host(tree, id);

  await act(async () => {
    node.props.onPress?.();
  });
  await flush();
}

// ── Screen 01 ──────────────────────────────────────────────────────────────

describe("screen 01 — candidatura attiva", () => {
  it("distingue il destinatario dalla persona e mostra lo stato reale", async () => {
    const tree = await render();
    const seen = texts(tree);

    expect(seen).toContain("AC Como");
    expect(seen).toContain("Centrocampista");
    expect(seen).toContain("Prima squadra · Serie D");
    expect(seen).toContain("Candidatura inviata");
    expect(seen).toContain("Inviata il 13 settembre 2026");
    expect(seen).toContain("La tua candidatura");
    expect(seen).toContain("Mario Rossi");
  });

  it("offre il ritiro come azione secondaria, non come primaria", async () => {
    const tree = await render();

    expect(hasTestID(tree, "my-application-withdraw")).toBe(true);
    expect(hasTestID(tree, "my-application-reapply")).toBe(false);

    const button = tree.root.findAll(
      (node) =>
        typeof node.type === "function" &&
        node.props?.testID === "my-application-withdraw",
    )[0];

    // §29: «Ritira candidatura nel dettaglio 01 — secondaria outlined.»
    expect(button.props.variant).toBe("neutralOutline");
  });

  it("non espone una timeline degli eventi", async () => {
    // §39: «Non introdurre … timeline gigante degli eventi o audit log
    // visuale.»
    const tree = await render();

    expect(texts(tree)).not.toContain("Percorso");
  });
});

// ── Screen 02 ──────────────────────────────────────────────────────────────

describe("screen 02 — conferma del ritiro", () => {
  it("apre la conferma con la copy della ricezione ancora aperta", async () => {
    const tree = await render();
    await press(tree, "my-application-withdraw");

    const seen = texts(tree);

    expect(seen).toContain("Ritirare la candidatura?");
    expect(seen).toContain(
      "Non parteciperai più a questa posizione. Puoi candidarti di nuovo finché accetta candidature.",
    );
  });

  it("dice la verità quando la ricezione è già chiusa", async () => {
    // §10: «Non promettere sempre la ricandidatura e non cambiare il
    // significato di CLOSED.»
    serviceMocks.fetchMyApplicationDetail.mockResolvedValue(
      detail({ adStatus: "closed", receivingOpen: false }),
    );

    const tree = await render();
    await press(tree, "my-application-withdraw");

    expect(texts(tree)).toContain(
      "Non parteciperai più a questa posizione. Al momento non accetta nuove candidature.",
    );
  });

  it("Annulla non esegue il ritiro", async () => {
    const tree = await render();
    await press(tree, "my-application-withdraw");
    await press(tree, "withdraw-sheet-cancel");

    expect(serviceMocks.withdrawApplication).not.toHaveBeenCalled();
  });

  it("conferma il ritiro con la revisione osservata", async () => {
    serviceMocks.withdrawApplication.mockResolvedValue({
      latestSubmittedAt: "2026-09-13T10:00:00Z",
      replayed: false,
      state: "withdrawn",
      status: "withdrawn",
      submissionRevision: 1,
      withdrawnAt: "2026-09-14T08:05:00Z",
    });

    const tree = await render();
    await press(tree, "my-application-withdraw");
    await press(tree, "withdraw-sheet-confirm");

    expect(serviceMocks.withdrawApplication).toHaveBeenCalledTimes(1);
    expect(serviceMocks.withdrawApplication.mock.calls[0][0]).toMatchObject({
      applicationId: APP,
      expectedRevision: 1,
    });
    expect(toastMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Candidatura ritirata." }),
    );
  });

  it("un errore certo conserva lo stato e non dichiara il ritiro", async () => {
    serviceMocks.withdrawApplication.mockRejectedValue(new Error("boom"));

    const tree = await render();
    await press(tree, "my-application-withdraw");
    await press(tree, "withdraw-sheet-confirm");

    expect(toastMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Non è stato possibile ritirare la candidatura. Riprova.",
      }),
    );
    expect(texts(tree)).toContain("Candidatura inviata");
  });

  it("un esito incerto non si dichiara fallito", async () => {
    // §27: «Un timeout dopo l'invio è un esito potenzialmente incerto.»
    serviceMocks.withdrawApplication.mockRejectedValue(
      new Error("Network request failed"),
    );

    const tree = await render();
    await press(tree, "my-application-withdraw");
    await press(tree, "withdraw-sheet-confirm");

    expect(toastMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Stiamo verificando l'esito dell'operazione.",
      }),
    );
  });
});

// ── Screen 03 e 04 ─────────────────────────────────────────────────────────

describe("screen 03 e 04 — ritirata e nuovo invio", () => {
  beforeEach(() => {
    serviceMocks.fetchMyApplicationDetail.mockResolvedValue(withdrawnDetail());
  });

  it("mostra la data reale del ritiro e la CTA primaria", async () => {
    const tree = await render();
    const seen = texts(tree);

    expect(seen).toContain("Candidatura ritirata");
    expect(seen).toContain("Ritirata il 14 settembre 2026");
    expect(hasTestID(tree, "my-application-reapply")).toBe(true);
    expect(hasTestID(tree, "my-application-withdraw")).toBe(false);
  });

  it("sostituisce la CTA con lo stato quando il server nega il nuovo invio", async () => {
    // §11: «Se can_apply è falso per scadenza o chiusura, sostituisci la CTA
    // con lo stato informativo pertinente; non lasciarla attiva.»
    serviceMocks.fetchMyApplicationDetail.mockResolvedValue(
      detail({
        adStatus: "closed",
        blockedReason: "closed",
        canApply: false,
        canWithdraw: false,
        receivingOpen: false,
        state: "withdrawn",
        status: "withdrawn",
        withdrawnAt: "2026-09-14T08:05:00Z",
      }),
    );

    const tree = await render();

    expect(hasTestID(tree, "my-application-reapply")).toBe(false);
    expect(texts(tree)).toContain(
      "Questa posizione non accetta più nuove candidature.",
    );
  });

  it("lo sheet 04 lascia il fondo ritirato finché non si conferma", async () => {
    const tree = await render();
    await press(tree, "my-application-reapply");

    const seen = texts(tree);

    expect(seen).toContain("Inviare di nuovo la candidatura?");
    expect(seen).toContain(
      "La società potrà consultare il tuo profilo aggiornato.",
    );
    // §12: «Il nuovo invio non deve apparire già effettuato prima della
    // conferma.»
    expect(seen).toContain("Candidatura ritirata");
    expect(serviceMocks.reapplyToPosition).not.toHaveBeenCalled();
  });

  it("Annulla non crea nessuna submission", async () => {
    const tree = await render();
    await press(tree, "my-application-reapply");
    await press(tree, "reapply-sheet-cancel");

    expect(serviceMocks.reapplyToPosition).not.toHaveBeenCalled();
  });

  it("conferma il reinvio con la revisione ritirata come precondizione", async () => {
    serviceMocks.reapplyToPosition.mockResolvedValue({
      latestSubmittedAt: "2026-09-14T08:10:00Z",
      replayed: false,
      state: "active",
      status: "submitted",
      submissionRevision: 2,
      withdrawnAt: null,
    });

    const tree = await render();
    await press(tree, "my-application-reapply");
    await press(tree, "reapply-sheet-confirm");

    expect(serviceMocks.reapplyToPosition.mock.calls[0][0]).toMatchObject({
      adId: "ad-1",
      expectedRevision: 1,
    });
    expect(toastMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Candidatura inviata." }),
    );
    // §12: «Non navigare il candidato nel centro riservato alla società.»
    expect(routerMocks.push).not.toHaveBeenCalled();
  });

  it("una ricevuta vecchia non riporta la UI a uno stato superato", async () => {
    // §13: la proiezione corrente è ancora ritirata, e lo si dice.
    serviceMocks.reapplyToPosition.mockResolvedValue({
      latestSubmittedAt: "2026-09-14T08:10:00Z",
      replayed: true,
      state: "withdrawn",
      status: "withdrawn",
      submissionRevision: 2,
      withdrawnAt: "2026-09-14T09:00:00Z",
    });

    const tree = await render();
    await press(tree, "my-application-reapply");
    await press(tree, "reapply-sheet-confirm");

    expect(toastMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "La candidatura è cambiata. Controlla lo stato aggiornato.",
      }),
    );
  });

  it("il termine scaduto durante la conferma non invia", async () => {
    serviceMocks.reapplyToPosition.mockRejectedValue(
      new Error("POSITION_DEADLINE_PASSED"),
    );

    const tree = await render();
    await press(tree, "my-application-reapply");
    await press(tree, "reapply-sheet-confirm");

    expect(toastMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Il termine per candidarsi è scaduto.",
      }),
    );
    expect(texts(tree)).toContain("Candidatura ritirata");
  });
});

// ── Screen 12 ──────────────────────────────────────────────────────────────

describe("screen 12 — contenuto non disponibile", () => {
  it("non espone nessun dato della candidatura", async () => {
    const { ApplicationUnavailableError } = await import("./lifecycle-service");

    serviceMocks.fetchMyApplicationDetail.mockRejectedValue(
      new ApplicationUnavailableError(),
    );

    const tree = await render();
    const seen = texts(tree);

    expect(seen).toContain("Contenuto non disponibile");
    expect(seen).toContain(
      "Non hai accesso a questa candidatura oppure non è più disponibile.",
    );
    expect(seen).toContain("Torna alla Dashboard");

    for (const leak of [
      "Mario Rossi",
      "AC Como",
      "Centrocampista",
      "Prima squadra · Serie D",
      "Inviata il 13 settembre 2026",
    ]) {
      expect(seen).not.toContain(leak);
    }
  });
});
