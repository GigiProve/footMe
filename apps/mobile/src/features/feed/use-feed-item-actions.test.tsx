import TestRenderer, { act } from "react-test-renderer";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { contentSavedTarget, getSavedValue, resetSavedStore } from "../saved/saved-store";
import { useToggleSavedFeedItem } from "./use-feed-item-actions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  setSavedRemote: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("../../ui", () => ({ useToast: () => ({ showToast: mocks.showToast }) }));
vi.mock("../search/media/media-search-service", () => ({ toggleFollowSource: vi.fn() }));
vi.mock("../saved/saved-service", () => ({ setSavedRemote: mocks.setSavedRemote }));

const trees: TestRenderer.ReactTestRenderer[] = [];

beforeEach(() => {
  resetSavedStore();
});

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
  vi.clearAllMocks();
});

async function mount(client: QueryClient) {
  const ref: { current: ReturnType<typeof useToggleSavedFeedItem> | null } = { current: null };
  function Probe() {
    ref.current = useToggleSavedFeedItem({ profileId: "me", scope: "per_te" });
    return null;
  }
  await act(async () => {
    trees.push(
      TestRenderer.create(
        <QueryClientProvider client={client}>
          <Probe />
        </QueryClientProvider>,
      ),
    );
  });
  return ref;
}

async function tapAndSettle(ref: Awaited<ReturnType<typeof mount>>, input: Parameters<ReturnType<typeof useToggleSavedFeedItem>["mutate"]>[0]) {
  await act(async () => {
    ref.current?.mutate(input);
  });
  await vi.waitFor(() => expect(ref.current?.isPending).toBe(false));
}

const tap = { contentType: "media_profile" as const, isSaved: false, itemId: "media_profile:a-1", postId: "a-1" };
const target = contentSavedTarget("media_profile", "a-1");

describe("useToggleSavedFeedItem — HOM-07 §94–§97, §133", () => {
  it("salva dallo store con set_saved e invalida liste e contatori dei Salvati", async () => {
    mocks.setSavedRemote.mockResolvedValue(true);
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    const ref = await mount(client);
    await tapAndSettle(ref, tap);

    expect(mocks.setSavedRemote).toHaveBeenCalledWith(target, true);
    expect(getSavedValue(target, false)).toBe(true);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved-items"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved-counts"] });
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Contenuto salvato" }),
    );
  });

  it("il Post persona è salvabile come gli altri contenuti (§78)", async () => {
    mocks.setSavedRemote.mockResolvedValue(true);
    const ref = await mount(new QueryClient());

    await tapAndSettle(ref, {
      ...tap,
      contentType: "profile_post",
      itemId: "profile_post:p-1",
      postId: "p-1",
    });

    expect(mocks.setSavedRemote).toHaveBeenCalledWith(
      { contentType: "profile_post", id: "p-1", type: "content" },
      true,
    );
  });

  it("aggiorna lo store subito, prima della risposta del server (§94)", async () => {
    let resolve: (value: boolean) => void = () => undefined;
    mocks.setSavedRemote.mockReturnValue(new Promise<boolean>((done) => (resolve = done)));
    const ref = await mount(new QueryClient());

    await act(async () => {
      ref.current?.mutate(tap);
    });

    expect(getSavedValue(target, false)).toBe(true);

    await act(async () => {
      resolve(true);
    });
  });

  it("su errore torna allo stato precedente con il copy del §97", async () => {
    mocks.setSavedRemote.mockRejectedValue(new Error("offline"));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const ref = await mount(client);

    await tapAndSettle(ref, tap);

    expect(getSavedValue(target, false)).toBe(false);
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Non è stato possibile salvare il contenuto. Riprova." }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["saved-items"] });
  });

  it("la rimozione fallita ripristina il salvato e usa il copy del §98", async () => {
    mocks.setSavedRemote.mockRejectedValue(new Error("offline"));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    const ref = await mount(client);

    await tapAndSettle(ref, { ...tap, isSaved: true });

    expect(getSavedValue(target, true)).toBe(true);
    expect(mocks.showToast).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Non è stato possibile completare l'operazione." }),
    );
  });

  it("lo store, se ne sa più del payload, decide la direzione del tap (§133)", async () => {
    mocks.setSavedRemote.mockResolvedValue(true);
    const ref = await mount(new QueryClient());

    // Il payload del Feed dice sempre «non salvato»: il secondo tap rimuove.
    await tapAndSettle(ref, tap);
    await tapAndSettle(ref, tap);

    expect(mocks.setSavedRemote).toHaveBeenNthCalledWith(1, target, true);
    expect(mocks.setSavedRemote).toHaveBeenNthCalledWith(2, target, false);
  });
});
