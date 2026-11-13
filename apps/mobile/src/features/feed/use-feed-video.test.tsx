import TestRenderer, { act } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";

import { createFeedVideoController, videoKey, type FeedVideoController } from "./feed-video-controller";
import {
  FeedVideoProvider,
  useFeedVideoController,
  useFeedVideoSlot,
  type FeedVideoSlot,
} from "./use-feed-video";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const trees: TestRenderer.ReactTestRenderer[] = [];

afterEach(() => {
  trees.splice(0).forEach((tree) => act(() => tree.unmount()));
});

function mountSlots(controller: FeedVideoController | null) {
  const renders = { a: 0, b: 0 };
  const slots: { a: FeedVideoSlot | null; b: FeedVideoSlot | null } = { a: null, b: null };

  function Slot({ name }: { name: "a" | "b" }) {
    renders[name] += 1;
    slots[name] = useFeedVideoSlot(videoKey(`post:${name}`, "m-1"), `post:${name}`);
    return null;
  }

  const content = (
    <>
      <Slot name="a" />
      <Slot name="b" />
    </>
  );
  act(() => {
    trees.push(
      TestRenderer.create(
        controller ? <FeedVideoProvider controller={controller}>{content}</FeedVideoProvider> : content,
      ),
    );
  });
  return { renders, slots };
}

describe("useFeedVideoSlot", () => {
  it("§18 play su uno slot ferma l'altro", () => {
    const { slots } = mountSlots(createFeedVideoController());

    act(() => slots.a?.play());
    expect(slots.a).toMatchObject({ isCurrent: true, isPlaying: true });

    act(() => slots.b?.play());
    expect(slots.a).toMatchObject({ isCurrent: false, isPlaying: false });
    expect(slots.b).toMatchObject({ isCurrent: true, isPlaying: true });
  });

  it("§105 il mute e la pausa del corrente non ri-renderizzano gli altri slot", () => {
    const controller = createFeedVideoController();
    const { renders, slots } = mountSlots(controller);
    act(() => slots.a?.play());
    const before = renders.b;

    act(() => slots.a?.setMuted(true));
    act(() => slots.a?.pause());
    act(() => controller.savePosition(videoKey("post:a", "m-1"), 12));

    expect(renders.b).toBe(before);
    expect(slots.a).toMatchObject({ isPlaying: false, muted: true });
  });

  it("§21 savePosition/startPosition e release", () => {
    const controller = createFeedVideoController();
    const { slots } = mountSlots(controller);
    act(() => slots.a?.play());
    act(() => {
      slots.a?.savePosition(18);
      slots.a?.release();
    });

    expect(controller.getSnapshot().currentKey).toBeNull();
    expect(slots.a?.startPosition).toBe(18);
  });

  it("fuori da un provider il controller locale resta lo stesso tra i render", () => {
    const seen: FeedVideoController[] = [];
    // `tick` cambia solo per forzare un secondo render.
    function Screen({ tick }: { tick: number }) {
      seen.push(useFeedVideoController());
      void tick;
      return null;
    }
    let tree: TestRenderer.ReactTestRenderer | null = null;
    act(() => {
      tree = TestRenderer.create(<Screen tick={0} />);
    });
    act(() => tree?.update(<Screen tick={1} />));
    if (tree) trees.push(tree);

    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
  });
});
