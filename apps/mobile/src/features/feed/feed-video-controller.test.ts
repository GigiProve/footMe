import { describe, expect, it, vi } from "vitest";

import { createFeedVideoController, videoKey } from "./feed-video-controller";

const A = videoKey("post:a", "m-1");
const B = videoKey("post:b", "m-1");

describe("createFeedVideoController", () => {
  it("parte senza video corrente, fermo e con l'audio attivo", () => {
    expect(createFeedVideoController().getSnapshot()).toEqual({
      currentKey: null,
      isPlaying: false,
      muted: false,
    });
  });

  it("§18 play rende il video l'unico corrente in riproduzione", () => {
    const controller = createFeedVideoController();
    controller.play(A, "post:a");

    expect(controller.getSnapshot()).toMatchObject({ currentKey: A, isPlaying: true });
  });

  it("§18 un secondo play sostituisce il primo", () => {
    const controller = createFeedVideoController();
    controller.play(A, "post:a");
    controller.play(B, "post:b");

    expect(controller.getSnapshot()).toMatchObject({ currentKey: B, isPlaying: true });
  });

  it("due video dello stesso Post hanno chiavi diverse (§29)", () => {
    expect(videoKey("post:a", "m-1")).not.toBe(videoKey("post:a", "m-2"));
  });

  it.each(["user", "viewport", "tab", "blur", "background", "replaced"] as const)(
    "pause(%s) ferma senza perdere il corrente",
    (reason) => {
      const controller = createFeedVideoController();
      controller.play(A, "post:a");
      controller.pause(reason);

      expect(controller.getSnapshot()).toMatchObject({ currentKey: A, isPlaying: false });
    },
  );

  it("§19 il corrente fuori viewport va in pausa; un altro elemento che esce no", () => {
    const controller = createFeedVideoController();
    controller.play(A, "post:a");

    controller.reportVisibleItems(new Set(["post:a", "post:c"]));
    expect(controller.getSnapshot().isPlaying).toBe(true);

    controller.reportVisibleItems(new Set(["post:c"]));
    expect(controller.getSnapshot()).toMatchObject({ currentKey: A, isPlaying: false });
  });

  it("§20 rientrando nel viewport NON riprende da solo", () => {
    const controller = createFeedVideoController();
    controller.play(A, "post:a");
    controller.reportVisibleItems(new Set());
    controller.reportVisibleItems(new Set(["post:a"]));

    expect(controller.getSnapshot().isPlaying).toBe(false);
  });

  it("§78 nessuna operazione diversa da play rimette in riproduzione", () => {
    const controller = createFeedVideoController();
    controller.play(A, "post:a");
    controller.pause("tab");
    controller.setMuted(true);
    controller.reportVisibleItems(new Set(["post:a"]));
    controller.savePosition(A, 12);

    expect(controller.getSnapshot().isPlaying).toBe(false);
  });

  it("release del corrente lo libera; release di un altro non tocca nulla", () => {
    const controller = createFeedVideoController();
    controller.play(A, "post:a");

    controller.release(B);
    expect(controller.getSnapshot().currentKey).toBe(A);

    controller.release(A);
    expect(controller.getSnapshot()).toMatchObject({ currentKey: null, isPlaying: false });
  });

  it("dopo il release il viewport non agisce sul video liberato", () => {
    const controller = createFeedVideoController();
    controller.play(A, "post:a");
    controller.release(A);
    const listener = vi.fn();
    controller.subscribe(listener);

    controller.reportVisibleItems(new Set());

    expect(listener).not.toHaveBeenCalled();
  });

  it("§81 il mute è di sessione: un video nuovo lo eredita", () => {
    const controller = createFeedVideoController();
    controller.play(A, "post:a");
    controller.setMuted(true);
    controller.play(B, "post:b");

    expect(controller.getSnapshot().muted).toBe(true);
  });

  it("§21 conserva la posizione per chiave, 0 se ignota", () => {
    const controller = createFeedVideoController();
    controller.savePosition(A, 18.5);
    controller.savePosition(B, Number.NaN);
    controller.savePosition(B, -3);

    expect(controller.getPosition(A)).toBe(18.5);
    expect(controller.getPosition(B)).toBe(0);
  });

  it("notifica solo i cambi reali e lo snapshot cambia identità solo allora", () => {
    const controller = createFeedVideoController();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);

    const initial = controller.getSnapshot();
    controller.pause("user");
    controller.setMuted(false);
    controller.savePosition(A, 4);
    expect(listener).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toBe(initial);

    controller.play(A, "post:a");
    controller.play(A, "post:a");
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    controller.pause("user");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
