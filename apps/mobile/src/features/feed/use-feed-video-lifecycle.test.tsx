import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createFeedVideoController, videoKey } from "./feed-video-controller";
import { useFeedVideoLifecycle } from "./use-feed-video-lifecycle";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  appStateListener: null as ((state: string) => void) | null,
  focusCleanup: null as (() => void) | null,
}));

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mocks.appStateListener = listener;
      return { remove: () => (mocks.appStateListener = null) };
    },
  },
}));

// Il focus della route: l'effetto parte al montaggio, la pulizia è il blur.
vi.mock("expo-router", () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) => {
    mocks.focusCleanup = effect() ?? null;
  },
}));

const trees: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
});

function mount() {
  const controller = createFeedVideoController();
  function Screen() {
    useFeedVideoLifecycle(controller);
    return null;
  }
  act(() => {
    trees.push(TestRenderer.create(<Screen />));
  });
  controller.play(videoKey("post:a", "m-1"), "post:a");
  return controller;
}

describe("useFeedVideoLifecycle", () => {
  it("§77 l'app in background mette in pausa e il ritorno non riprende", () => {
    const controller = mount();

    act(() => mocks.appStateListener?.("background"));
    expect(controller.getSnapshot().isPlaying).toBe(false);

    act(() => mocks.appStateListener?.("active"));
    expect(controller.getSnapshot().isPlaying).toBe(false);
  });

  it("§80 un'interruzione di sistema (inactive) mette in pausa", () => {
    const controller = mount();

    act(() => mocks.appStateListener?.("inactive"));

    expect(controller.getSnapshot().isPlaying).toBe(false);
  });

  it("§79 il blur della route mette in pausa", () => {
    const controller = mount();

    act(() => mocks.focusCleanup?.());

    expect(controller.getSnapshot()).toMatchObject({ currentKey: videoKey("post:a", "m-1"), isPlaying: false });
  });
});
