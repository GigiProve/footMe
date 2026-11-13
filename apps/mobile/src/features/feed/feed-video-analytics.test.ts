import { afterEach, describe, expect, it } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../lib/analytics";
import { createVideoAnalyticsSession } from "./feed-video-analytics";

afterEach(() => {
  setAnalyticsSink(null);
});

function collect() {
  const events: AnalyticsEvent[] = [];
  setAnalyticsSink((event) => events.push(event));
  return events;
}

function session(durationSeconds: number | null = 40) {
  return createVideoAnalyticsSession({
    durationSeconds,
    itemId: "post:a",
    mediaId: "m-1",
    surface: "feed",
  });
}

/** Simula la riproduzione da `from` a `to` con letture ogni secondo. */
function playThrough(target: ReturnType<typeof session>, from: number, to: number) {
  for (let time = from; time <= to; time += 1) {
    target.onTime(time);
  }
}

const names = (events: AnalyticsEvent[]) => events.map((event) => event.name);

describe("createVideoAnalyticsSession", () => {
  it("§99 senza riproduzione reale non registra nulla", () => {
    const events = collect();
    const target = session();

    target.onTime(0);
    target.onPaused(0);

    expect(events).toEqual([]);
  });

  it("§100 feed_video_play una sola volta per sessione, con la superficie", () => {
    const events = collect();
    const target = session();

    target.onPlaying();
    target.onPaused(0);
    target.onPlaying();

    expect(names(events)).toEqual(["feed_video_play"]);
    expect(events[0].props).toEqual({ itemId: "post:a", mediaId: "m-1", surface: "feed" });
  });

  it("i quartili partono una volta sola ciascuno, anche rivedendo", () => {
    const events = collect();
    const target = session(40);

    target.onPlaying();
    playThrough(target, 0, 31);
    target.onPaused(31);
    target.onPlaying();
    target.onTime(0);
    playThrough(target, 0, 31);

    const progress = events.filter((event) => event.name === "feed_video_progress");
    expect(progress.map((event) => event.props.percent)).toEqual([25, 50, 75]);
  });

  it("senza durata dal server usa quella del player", () => {
    const events = collect();
    const target = session(null);

    target.onPlaying();
    for (let time = 0; time <= 6; time += 1) {
      target.onTime(time, 20);
    }

    expect(events.filter((event) => event.name === "feed_video_progress")).toHaveLength(1);
  });

  it("il tempo di visione si scrive alla pausa e riparte da zero", () => {
    const events = collect();
    const target = session();

    target.onPlaying();
    playThrough(target, 0, 6);
    target.onPaused(6);
    target.onPlaying();
    playThrough(target, 6, 9);
    target.onPaused(9);

    const watch = events.filter((event) => event.name === "feed_video_watch");
    expect(watch.map((event) => event.props.seconds)).toEqual([6, 3]);
  });

  it("un seek che scavalca i quartili li consuma senza emetterli", () => {
    const events = collect();
    const target = session(100);

    target.onPlaying();
    playThrough(target, 0, 2);
    target.onTime(80);
    playThrough(target, 81, 90);

    expect(events.filter((event) => event.name === "feed_video_progress")).toEqual([]);
  });

  it("un seek non conta come visione", () => {
    const events = collect();
    const target = session(100);

    target.onPlaying();
    playThrough(target, 0, 2);
    target.onTime(60);
    playThrough(target, 61, 62);
    target.onPaused(62);

    const watch = events.find((event) => event.name === "feed_video_watch");
    expect(watch?.props.seconds).toBe(4);
  });

  it("alla fine: tempo di visione e completamento, una volta sola", () => {
    const events = collect();
    const target = session(4);

    target.onPlaying();
    playThrough(target, 0, 4);
    target.onEnd();
    target.onEnd();
    target.onPaused(4);

    expect(names(events)).toEqual([
      "feed_video_play",
      "feed_video_progress",
      "feed_video_progress",
      "feed_video_progress",
      "feed_video_watch",
      "feed_video_complete",
    ]);
  });

  it("smontaggio durante la riproduzione (onPaused) scrive il tempo visto", () => {
    const events = collect();
    const target = session();

    target.onPlaying();
    playThrough(target, 0, 3);
    target.onPaused(3);

    expect(events.at(-1)).toMatchObject({ name: "feed_video_watch", props: { seconds: 3 } });
  });

  it("errore e Riprova sono eventi distinti", () => {
    const events = collect();
    const target = session();

    target.onError();
    target.onRetry();

    expect(names(events)).toEqual(["feed_video_error", "feed_video_retry"]);
  });
});
