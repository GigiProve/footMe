/**
 * Editor focalizzato "Dove sei disponibile?" (DAS-REV-06 §12, §15–§20).
 *
 * Copre quello che distingue questa schermata da un form qualunque:
 *
 *  - un profilo senza aree non arriva con Tutta Italia già scelta;
 *  - il cambio di modalità non perde le selezioni e non le persiste;
 *  - la patch inviata contiene **solo** i dati geografici;
 *  - il segnale si risolve sulla configurazione confermata dal backend, non
 *    sull'intenzione dell'utente;
 *  - un errore tiene l'editor aperto con le selezioni intatte.
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const routerMocks = vi.hoisted(() => ({
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("expo-router", () => ({
  router: routerMocks,
  useNavigation: () => ({ addListener: () => () => {}, dispatch: () => {} }),
}));

const sessionMocks = vi.hoisted(() => ({ useSession: vi.fn() }));

vi.mock("../../auth/use-session", () => ({
  useSession: sessionMocks.useSession,
}));

const toastMocks = vi.hoisted(() => ({ showToast: vi.fn() }));

vi.mock("../../../ui", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();

  return { ...actual, useToast: () => ({ showToast: toastMocks.showToast }) };
});

/*
  Si mocka il client, non il servizio: le due RPC, la traduzione della riga in
  configurazione, la regola «senza `configured_at` la modalità non vale» e gli
  hook di query restano quelli veri. Mockare il modulo del servizio non
  basterebbe comunque — gli hook chiudono sulle funzioni locali, non sugli
  export.
*/
const supabaseMocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({
  supabase: { rpc: supabaseMocks.rpc },
}));

const { AvailabilityAreasScreen } = await import("./AvailabilityAreasScreen");

type Row = {
  availability_mode?: string | null;
  can_edit?: boolean;
  configured_at?: string | null;
  provinces?: string[];
  regions?: string[];
  revision?: number;
  unknown_areas?: string[];
};

/** Una riga come la restituisce `fetch_profile_availability_areas`. */
function row(partial: Row = {}) {
  return {
    availability_mode: partial.availability_mode ?? null,
    can_edit: partial.can_edit ?? true,
    configured_at: partial.configured_at ?? null,
    provinces: partial.provinces ?? [],
    regions: partial.regions ?? [],
    revision: partial.revision ?? 3,
    unknown_areas: partial.unknown_areas ?? [],
  };
}

/** Le due RPC, instradate per nome come fa PostgREST. */
function mockRpc(handlers: {
  fetch: () => { data: unknown; error: unknown };
  save?: (args: Record<string, unknown>) => { data: unknown; error: unknown };
}) {
  supabaseMocks.rpc.mockImplementation(
    (name: string, args: Record<string, unknown>) => ({
      maybeSingle: async () =>
        name === "fetch_profile_availability_areas"
          ? handlers.fetch()
          : (handlers.save?.(args) ?? { data: null, error: null }),
    }),
  );
}

function lastSaveArgs(): Record<string, unknown> {
  const call = supabaseMocks.rpc.mock.calls.find(
    ([name]) => name === "save_profile_availability_areas",
  );

  return (call?.[1] ?? {}) as Record<string, unknown>;
}

async function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { gcTime: 0, retry: false } },
  });

  let tree!: TestRenderer.ReactTestRenderer;

  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <AvailabilityAreasScreen />
      </QueryClientProvider>,
    );
  });

  /*
    La query risolve dopo più salti di microtask. Si aspetta finché lo
    scheletro non ha lasciato il posto al selector o allo stato di errore,
    invece di contare i flush: sotto carico dieci non bastavano e il test
    falliva per tempismo, non per comportamento.
  */
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const settled =
      tree.root.findAllByProps({ testID: "availability-areas-skeleton" })
        .length === 0 &&
      (tree.root.findAllByProps({ testID: "availability-areas-mode-ITALY" })
        .length > 0 ||
        tree.root.findAllByProps({ testID: "availability-areas-error" })
          .length > 0);

    if (settled) {
      break;
    }

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  return tree;
}

function texts(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll((node) => (node.type as unknown as string) === "Text")
    .flatMap((node) =>
      React.Children.toArray(node.props.children).filter(
        (child): child is string => typeof child === "string",
      ),
    );
}

async function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  await act(async () => {
    tree.root.findByProps({ testID }).props.onPress();
  });
}

async function check(tree: TestRenderer.ReactTestRenderer, testID: string) {
  await act(async () => {
    tree.root.findByProps({ testID }).props.onValueChange(true);
  });
}

function isChecked(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return Boolean(tree.root.findByProps({ testID }).props.checked);
}

beforeEach(() => {
  vi.clearAllMocks();
  sessionMocks.useSession.mockReturnValue({
    profile: { role: "player" },
    session: { user: { id: "player-1" } },
  });
  mockRpc({
    fetch: () => ({ data: row(), error: null }),
    save: (args) => ({
      data: row({
        availability_mode: args.p_mode as string,
        configured_at: "2026-10-09T10:00:00Z",
        provinces: args.p_provinces as string[],
        regions: args.p_regions as string[],
        revision: 4,
      }),
      error: null,
    }),
  });
});

describe("apertura", () => {
  it("usa titolo e sottotitolo del master, senza chevron sulle modalità", async () => {
    const tree = await render();
    const labels = texts(tree);

    expect(labels).toContain("Dove sei disponibile?");
    expect(labels).toContain("Indica dove valuteresti nuove opportunità.");
    expect(labels).toContain("Province specifiche");
    expect(labels).toContain("Una o più regioni");
    expect(labels).toContain("Tutta Italia");
    // §12: nessuna tab Province / Regioni / Italia.
    expect(labels).not.toContain("Province");
  });

  it("non preseleziona nessuna modalità su un profilo senza aree", async () => {
    // §15: «Non preselezionare Tutta Italia per completare automaticamente un
    // profilo privo di aree.»
    const tree = await render();

    for (const mode of ["PROVINCES", "REGIONS", "ITALY"]) {
      expect(
        tree.root.findByProps({ testID: `availability-areas-mode-${mode}` })
          .props.checked,
      ).toBe(false);
    }
  });

  it("precarica una configurazione esistente e la espande", async () => {
    mockRpc({
      fetch: () => ({
        data: row({
          availability_mode: "PROVINCES",
          configured_at: "2026-09-01T10:00:00Z",
          provinces: ["Milano", "Como"],
        }),
        error: null,
      }),
    });

    const tree = await render();

    expect(
      tree.root.findByProps({ testID: "availability-areas-mode-PROVINCES" })
        .props.checked,
    ).toBe(true);
    expect(texts(tree)).toContain("Milano");
    expect(texts(tree)).toContain("Como");
    expect(texts(tree)).toContain(
      "Le società potranno trovarti nelle province selezionate.",
    );
  });

  it("tiene l'editor utilizzabile e segnala le aree non più disponibili", async () => {
    mockRpc({
      fetch: () => ({
        data: row({
          availability_mode: "PROVINCES",
          configured_at: "2026-09-01T10:00:00Z",
          provinces: ["Milano"],
          unknown_areas: ["Atlantide"],
        }),
        error: null,
      }),
    });

    expect(texts(await render())).toContain(
      "Alcune aree non sono più disponibili. Controlla la selezione.",
    );
  });

  it("mostra l'errore di caricamento senza spacciare un vuoto per dato reale", async () => {
    mockRpc({
      fetch: () => ({ data: null, error: { message: "boom" } }),
    });

    const tree = await render();

    expect(texts(tree)).toContain(
      "Non è stato possibile caricare le aree. Riprova.",
    );
    expect(
      tree.root.findAllByProps({ testID: "availability-areas-mode-ITALY" }),
    ).toHaveLength(0);
  });
});

describe("draft", () => {
  it("non salva un tap: la CTA resta disabilitata finché nulla è cambiato", async () => {
    mockRpc({
      fetch: () => ({
        data: row({
          availability_mode: "ITALY",
          configured_at: "2026-09-01T10:00:00Z",
        }),
        error: null,
      }),
    });

    const tree = await render();

    expect(
      tree.root.findByProps({ testID: "profile-edit-save" }).props.disabled,
    ).toBe(true);
    expect(
      supabaseMocks.rpc.mock.calls.some(
        ([name]) => name === "save_profile_availability_areas",
      ),
    ).toBe(false);
  });

  it("il checkbox di una provincia già scelta risulta selezionato", async () => {
    mockRpc({
      fetch: () => ({
        data: row({
          availability_mode: "PROVINCES",
          configured_at: "2026-09-01T10:00:00Z",
          provinces: ["Como"],
        }),
        error: null,
      }),
    });

    const tree = await render();

    expect(isChecked(tree, "availability-areas-option-Como")).toBe(true);
    expect(isChecked(tree, "availability-areas-option-Bergamo")).toBe(false);
  });

  it("rimuovere il chip deseleziona lo stesso checkbox", async () => {
    mockRpc({
      fetch: () => ({
        data: row({
          availability_mode: "PROVINCES",
          configured_at: "2026-09-01T10:00:00Z",
          provinces: ["Como"],
        }),
        error: null,
      }),
    });

    const tree = await render();

    await press(tree, "availability-areas-chip-Como");

    expect(isChecked(tree, "availability-areas-option-Como")).toBe(false);
  });

  it("cambiando modalità conserva le selezioni e ne persiste una sola", async () => {
    const tree = await render();

    await press(tree, "availability-areas-mode-PROVINCES");
    await check(tree, "availability-areas-option-Milano");
    await press(tree, "availability-areas-mode-REGIONS");
    await check(tree, "availability-areas-option-Lombardia");

    // §16: tornando indietro la selezione precedente è ancora lì.
    await press(tree, "availability-areas-mode-PROVINCES");
    expect(isChecked(tree, "availability-areas-option-Milano")).toBe(true);

    await press(tree, "availability-areas-mode-REGIONS");
    await press(tree, "profile-edit-save");

    const args = lastSaveArgs();

    expect(args.p_mode).toBe("REGIONS");
    expect(args.p_regions).toEqual(["Lombardia"]);
    // Il draft le conserva, il payload le scarta: è `resolveActiveAreas` a
    // decidere cosa viene persistito (§16).
    expect(args.p_provinces).toEqual([]);
  });
});

describe("salvataggio", () => {
  it("invia la revisione letta all'apertura, per il controllo di concorrenza", async () => {
    const tree = await render();

    await press(tree, "availability-areas-mode-ITALY");
    await press(tree, "profile-edit-save");

    expect(lastSaveArgs()).toMatchObject({
      p_expected_revision: 3,
      p_mode: "ITALY",
      p_provinces: [],
      p_regions: [],
    });
  });

  it("non invia una modifica invalida e spiega il requisito", async () => {
    const tree = await render();

    await press(tree, "availability-areas-mode-PROVINCES");
    await press(tree, "profile-edit-save");

    expect(
      supabaseMocks.rpc.mock.calls.some(
        ([name]) => name === "save_profile_availability_areas",
      ),
    ).toBe(false);
    expect(texts(tree)).toContain("Seleziona almeno una provincia.");
  });

  it("conferma con il feedback discreto e torna all'origine", async () => {
    const tree = await render();

    await press(tree, "availability-areas-mode-ITALY");
    await press(tree, "profile-edit-save");

    expect(toastMocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Modifiche salvate." }),
    );
    expect(routerMocks.back).toHaveBeenCalled();
    // §20: nessuna pagina celebrativa, nessuna percentuale.
    expect(texts(tree)).not.toContain("Profilo completo");
  });

  it("su errore tiene l'editor aperto con le selezioni intatte", async () => {
    mockRpc({
      fetch: () => ({ data: row(), error: null }),
      save: () => ({ data: null, error: { message: "boom" } }),
    });

    const tree = await render();

    await press(tree, "availability-areas-mode-PROVINCES");
    await check(tree, "availability-areas-option-Milano");
    await press(tree, "profile-edit-save");

    expect(texts(tree)).toContain(
      "Non è stato possibile salvare le modifiche. Riprova.",
    );
    expect(isChecked(tree, "availability-areas-option-Milano")).toBe(true);
    expect(routerMocks.back).not.toHaveBeenCalled();
  });

  it("distingue un conflitto da un guasto generico", async () => {
    mockRpc({
      fetch: () => ({ data: row(), error: null }),
      save: () => ({
        data: null,
        error: { message: "availability_areas_conflict" },
      }),
    });

    const tree = await render();

    await press(tree, "availability-areas-mode-ITALY");
    await press(tree, "profile-edit-save");

    expect(texts(tree)).toContain(
      "Le aree sono state modificate da un altro dispositivo. Ricarica e riprova.",
    );
    expect(routerMocks.back).not.toHaveBeenCalled();
  });
});
