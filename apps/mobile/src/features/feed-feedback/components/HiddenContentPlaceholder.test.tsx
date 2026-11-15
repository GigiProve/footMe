/**
 * Il segnaposto «Contenuto nascosto · Annulla», il foglio dei motivi server-driven e la
 * sostituzione del Post nella stessa posizione (HOM-11 §29–§36, §44–§50, §198–§199, §238–§239,
 * §243–§244, §292).
 */
import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ToastProvider } from "../../../ui";
import {
  countTestId,
  makePostItem,
  pressTestId,
  textOf,
} from "../../feed/components/feed-test-helpers";
import { hiddenContentStore, resetHiddenContentStore } from "../hidden-content-store";
import { HiddenContentPlaceholder } from "./HiddenContentPlaceholder";
import { HideableContent } from "./HideableContent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock("../../auth/use-session", () => ({ useSession: () => ({ profile: { id: "viewer-1" } }) }));

const TARGET = {
  contentId: "p1",
  contentType: "club_media" as const,
  origin: "HOME_PER_TE" as const,
  reposter: null,
};
const KEY = "club_media:p1";

const REASONS = [
  { label: "Non mi interessa questo argomento", reason_id: "topic_not_interested", sort_order: 1 },
  { label: "Vedo troppi contenuti simili", reason_id: "too_many_similar", sort_order: 2 },
  { label: "Altro", reason_id: "other", sort_order: 4 },
];

const trees: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  resetHiddenContentStore();
  mocks.rpc.mockReset();
  mocks.rpc.mockImplementation(async (name: string) => {
    switch (name) {
      case "fetch_feed_feedback_reasons":
        return { data: REASONS, error: null };
      case "set_not_interested_reason":
        return { data: { status: "updated" }, error: null };
      case "undo_not_interested":
        return { data: { status: "removed" }, error: null };
      default:
        return { data: null, error: null };
    }
  });
});

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
});

async function mount(element: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      <QueryClientProvider client={client}>
        <ToastProvider>{element}</ToastProvider>
      </QueryClientProvider>,
    );
  });
  trees.push(tree);
  return tree;
}

/** Lascia risolvere le promesse in volo (RPC simulate) e i render che ne seguono. */
async function flush() {
  for (let round = 0; round < 3; round += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
}

function hide(feedbackId: string | null = "f-1") {
  const attempt = hiddenContentStore.begin(KEY) as number;
  if (feedbackId) {
    hiddenContentStore.settle(KEY, attempt, feedbackId);
  }
}

describe("HiddenContentPlaceholder — §29–§33, §238", () => {
  it("riga compatta con «Contenuto nascosto · Annulla»: niente Post, niente altezza del Post (§30–§32)", async () => {
    hide();
    const tree = await mount(<HiddenContentPlaceholder target={TARGET} />);

    expect(countTestId(tree, "hidden-content-placeholder")).toBe(1);
    expect(textOf(tree)).toContain("Contenuto nascosto");
    expect(textOf(tree)).toContain("Annulla");
    expect(countTestId(tree, "feed-post")).toBe(0);
  });

  it("senza una cella nello store non disegna nulla (contenuto ripristinato)", async () => {
    const tree = await mount(<HiddenContentPlaceholder target={TARGET} />);

    expect(countTestId(tree, "hidden-content-placeholder")).toBe(0);
  });

  it("Annulla è un bottone con un'etichetta parlata per intero (§199, §206)", async () => {
    hide();
    const tree = await mount(<HiddenContentPlaceholder target={TARGET} />);
    const undo = tree.root.findAll(
      (node) => typeof node.type === "string" && node.props?.testID === "hidden-content-undo",
    )[0];

    expect(undo.props.accessibilityRole).toBe("button");
    expect(undo.props.accessibilityLabel).toBe("Annulla: mostra di nuovo il contenuto");
  });
});

describe("Annulla — §34, §53, §239", () => {
  it("ripristina il contenuto (la cella sparisce) e cancella il feedback sul server", async () => {
    hide();
    const tree = await mount(<HiddenContentPlaceholder target={TARGET} />);

    await act(async () => {
      pressTestId(tree, "hidden-content-undo");
    });
    await flush();

    expect(hiddenContentStore.has(KEY)).toBe(false);
    expect(mocks.rpc).toHaveBeenCalledWith("undo_not_interested", { p_feedback_id: "f-1" });
    expect(countTestId(tree, "hidden-content-placeholder")).toBe(0);
  });
});

describe("motivi facoltativi — §44–§50, §243–§244", () => {
  it("con l'hide ancora in volo il link non c'è: non c'è un feedback a cui associarlo (§45)", async () => {
    hide(null);
    const tree = await mount(<HiddenContentPlaceholder target={TARGET} />);

    expect(countTestId(tree, "hidden-content-reasons-link")).toBe(0);
  });

  it("a hide confermato il link «Aiutaci a migliorare i suggerimenti» compare (§44)", async () => {
    hide("f-1");
    const tree = await mount(<HiddenContentPlaceholder target={TARGET} />);

    expect(countTestId(tree, "hidden-content-reasons-link")).toBe(1);
    expect(textOf(tree)).toContain("Aiutaci a migliorare i suggerimenti");
  });

  it("il foglio mostra i motivi del server, nell'ordine, senza replicarli nel client (§48–§49)", async () => {
    hide();
    const tree = await mount(<HiddenContentPlaceholder target={TARGET} />);

    await act(async () => {
      pressTestId(tree, "hidden-content-reasons-link");
    });
    await flush();

    expect(mocks.rpc).toHaveBeenCalledWith("fetch_feed_feedback_reasons");
    const json = textOf(tree);
    expect(json).toContain("Facoltativo");
    expect(json).toContain("La tua scelta ci aiuta a proporti contenuti più rilevanti.");
    expect(json.indexOf("Non mi interessa questo argomento")).toBeLessThan(json.indexOf("Vedo troppi contenuti simili"));
    expect(json.indexOf("Vedo troppi contenuti simili")).toBeLessThan(json.indexOf('"Altro"'));
  });

  it("un tap su un motivo lo registra e chiude: nessun secondo passaggio (§50)", async () => {
    hide();
    const tree = await mount(<HiddenContentPlaceholder target={TARGET} />);
    await act(async () => {
      pressTestId(tree, "hidden-content-reasons-link");
    });
    await flush();

    await act(async () => {
      pressTestId(tree, "not-interested-reason-too_many_similar");
    });
    await flush();

    expect(mocks.rpc).toHaveBeenCalledWith("set_not_interested_reason", {
      p_feedback_id: "f-1",
      p_reason_id: "too_many_similar",
    });
    expect(hiddenContentStore.get(KEY)).toMatchObject({ phase: "hidden", reasonId: "too_many_similar" });
    // L'hide non è cambiato e il link non si ripropone.
    expect(countTestId(tree, "hidden-content-placeholder")).toBe(1);
    expect(countTestId(tree, "hidden-content-reasons-link")).toBe(0);
  });

  it("un errore nel caricare i motivi si dice e si può riprovare", async () => {
    hide();
    mocks.rpc.mockImplementation(async () => ({ data: null, error: new Error("offline") }));
    const tree = await mount(<HiddenContentPlaceholder target={TARGET} />);

    await act(async () => {
      pressTestId(tree, "hidden-content-reasons-link");
    });
    await flush();

    expect(textOf(tree)).toContain("Non è stato possibile caricare i motivi.");
    expect(textOf(tree)).toContain("Riprova");
  });
});

describe("HideableContent — stessa posizione, §29, §33–§35, §26", () => {
  const item = makePostItem();

  function Child() {
    return <View testID="post-content" />;
  }

  it("senza cella mostra il contenuto", async () => {
    const tree = await mount(
      <HideableContent item={item} origin="HOME_PER_TE">
        <Child />
      </HideableContent>,
    );

    expect(countTestId(tree, "post-content")).toBe(1);
    expect(countTestId(tree, "hidden-content-placeholder")).toBe(0);
  });

  it("con la cella lo sostituisce con il segnaposto; con Annulla torna", async () => {
    const tree = await mount(
      <HideableContent item={item} origin="HOME_PER_TE">
        <Child />
      </HideableContent>,
    );

    await act(async () => {
      hide("f-1");
    });
    expect(countTestId(tree, "post-content")).toBe(0);
    expect(countTestId(tree, "hidden-content-placeholder")).toBe(1);

    await act(async () => {
      pressTestId(tree, "hidden-content-undo");
    });
    await flush();
    expect(countTestId(tree, "post-content")).toBe(1);
    expect(countTestId(tree, "hidden-content-placeholder")).toBe(0);
  });

  it("in Seguiti (origin assente) un contenuto nascosto in Per te NON si sostituisce (§26)", async () => {
    hide("f-1");
    const tree = await mount(
      <HideableContent item={item} origin={null}>
        <Child />
      </HideableContent>,
    );

    expect(countTestId(tree, "post-content")).toBe(1);
    expect(countTestId(tree, "hidden-content-placeholder")).toBe(0);
  });

  it("la cella è per target: un altro Post nella lista non cambia", async () => {
    const other = makePostItem({ id: "club_media:p2" }, { postId: "p2" });
    const tree = await mount(
      <HideableContent item={other} origin="HOME_PER_TE">
        <Child />
      </HideableContent>,
    );

    await act(async () => {
      hide("f-1");
    });

    expect(countTestId(tree, "post-content")).toBe(1);
  });
});
