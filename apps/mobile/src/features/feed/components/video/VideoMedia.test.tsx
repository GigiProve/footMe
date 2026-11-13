import React from "react";
import { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createFeedVideoController, videoKey } from "../../feed-video-controller";
import { FeedVideoProvider } from "../../use-feed-video";
import {
  countTestId,
  findByLabel,
  hostByTestId,
  makeVideoMedia,
  press,
  pressTestId,
  render,
  textOf,
} from "../feed-test-helpers";
import { videoMock } from "../../../../test/expo-video";
import { VideoMedia } from "./VideoMedia";

vi.mock("expo-video", () => import("../../../../test/expo-video"));
// `use-feed-video` aggancia il blur della schermata: qui non c'è navigazione.
vi.mock("expo-router", () => ({ useFocusEffect: () => undefined }));

const ITEM_ID = "club_media:p1";

beforeEach(() => {
  videoMock.reset();
});

function setup(media = makeVideoMedia(0), props: Partial<React.ComponentProps<typeof VideoMedia>> = {}) {
  return render(<VideoMedia itemId={ITEM_ID} media={media} {...props} />);
}

function frameRatio(tree: ReturnType<typeof render>): number | undefined {
  const style = hostByTestId(tree, "feed-video-media")[0].props.style as { aspectRatio?: number }[];

  return style.find((entry) => entry?.aspectRatio !== undefined)?.aspectRatio;
}

function emit(event: string, payload?: unknown) {
  act(() => {
    videoMock.last.emit(event, payload);
  });
}

describe("VideoMedia — pronto (§61, §9–11)", () => {
  it("mostra miniatura, Play e durata; nessun player e nessuno stream prima del tap (§16, §73)", () => {
    const tree = setup();
    const json = textOf(tree);

    expect(json).toContain("https://cdn.test/0-thumb.jpg");
    expect(findByLabel(tree, "Riproduci video, durata 48 secondi")).toHaveLength(1);
    expect(json).toContain('"0:48"');
    expect(json).toContain('"name":"play"');
    expect(countTestId(tree, "feed-video-player")).toBe(0);
    expect(videoMock.players).toHaveLength(0);
  });

  it("senza durata nota non mostra il badge", () => {
    const tree = setup(makeVideoMedia(0, { durationSeconds: null }));

    expect(countTestId(tree, "feed-post-media-duration")).toBe(0);
    expect(findByLabel(tree, "Riproduci video")).toHaveLength(1);
  });

  it("riserva lo spazio dai metadata del backend (§108): 9:16 limitato a 4:5, 16:9 di default", () => {
    expect(frameRatio(setup(makeVideoMedia(0, { height: 1920, width: 1080 })))).toBe(4 / 5);
    expect(frameRatio(setup())).toBe(16 / 9);
  });

  it("pronto senza miniatura né durata (video editoriali esistenti): placeholder con Play, niente badge, stesso spazio", () => {
    const tree = setup(makeVideoMedia(0, { durationSeconds: null, thumbnailUrl: null }));
    const json = textOf(tree);

    expect(countTestId(tree, "feed-video-play")).toBe(1);
    expect(json).toContain('"name":"play"');
    expect(countTestId(tree, "feed-post-media-duration")).toBe(0);
    expect(json).not.toContain("https://cdn.test/0-thumb.jpg");
    expect(frameRatio(tree)).toBe(16 / 9);
    // Nessuna immagine: la sorgente del video non viene mai usata come miniatura.
    expect(json).not.toContain("https://cdn.test/0.mp4");
  });

  it("senza miniatura il Play resta e lo spazio è lo stesso", () => {
    const tree = setup(makeVideoMedia(0, { thumbnailUrl: null }));

    expect(countTestId(tree, "feed-video-play")).toBe(1);
    expect(frameRatio(tree)).toBe(16 / 9);
  });
});

describe("VideoMedia — in elaborazione e non disponibile (§60–70, §113–114)", () => {
  it.each(["processing", "uploaded"])(
    "%s: «Video in elaborazione» con il suo helper, senza Play",
    (processingState) => {
      const tree = setup(
        makeVideoMedia(0, { processingState: processingState as never, thumbnailUrl: null, url: null }),
      );
      const json = textOf(tree);

      expect(json).toContain("Video in elaborazione");
      expect(json).toContain("Il video sarà disponibile a breve.");
      expect(countTestId(tree, "feed-video-play")).toBe(0);
      expect(json).not.toContain('"name":"play"');
      expect(json).not.toMatch(/uploaded|processing_|transcod|404|CDN/i);
    },
  );

  it.each([
    ["failed", { processingState: "failed" as const }],
    ["non disponibile", { availability: "unavailable" as const }],
    ["senza sorgente", { url: null }],
  ])("%s: «Video non disponibile» con il suo helper, senza Play", (_name, overrides) => {
    const tree = setup(makeVideoMedia(0, overrides));
    const json = textOf(tree);

    expect(json).toContain("Video non disponibile");
    expect(json).toContain("Il contenuto non è al momento accessibile.");
    expect(countTestId(tree, "feed-video-play")).toBe(0);
    expect(json).not.toContain('"name":"play"');
  });

  it("è una riga compatta senza proporzione video: niente rettangolo grande (§111)", () => {
    const tree = setup(makeVideoMedia(0, { processingState: "processing" }));

    expect(countTestId(tree, "feed-video-state")).toBe(1);
    expect(countTestId(tree, "feed-video-media")).toBe(0);
  });

  it("lo stato ha una sola etichetta parlata, titolo e helper", () => {
    const tree = setup(makeVideoMedia(0, { processingState: "processing" }));

    expect(findByLabel(tree, "Video in elaborazione. Il video sarà disponibile a breve.")).toHaveLength(1);
  });

  it("non crea mai un player", () => {
    setup(makeVideoMedia(0, { processingState: "processing" }));
    setup(makeVideoMedia(0, { processingState: "failed" }));

    expect(videoMock.players).toHaveLength(0);
  });
});

describe("VideoMedia — Play avvia inline (§12)", () => {
  it("il tap sostituisce la miniatura col player nella stessa area, senza fullscreen", () => {
    const tree = setup();
    const before = frameRatio(tree);

    pressTestId(tree, "feed-video-play");

    expect(countTestId(tree, "feed-video-play")).toBe(0);
    expect(countTestId(tree, "feed-video-player")).toBe(1);
    expect(frameRatio(tree)).toBe(before);
    expect(videoMock.players).toHaveLength(1);
    expect(videoMock.last.playing).toBe(true);
    expect(videoMock.fullscreenEnters).toBe(0);
  });

  it("il player riceve la sorgente giusta, con audio attivo dopo il tap esplicito (§17)", () => {
    const tree = setup();

    pressTestId(tree, "feed-video-play");

    expect(videoMock.last.source).toEqual({ contentType: "auto", uri: "https://cdn.test/0.mp4" });
    expect(videoMock.last.muted).toBe(false);
  });

  it("autoStart (dettaglio dal Feed) avvia una volta sola, senza tap", () => {
    const tree = setup(makeVideoMedia(0), { autoStart: true });

    expect(countTestId(tree, "feed-video-player")).toBe(1);
    expect(videoMock.players).toHaveLength(1);
    expect(videoMock.last.playing).toBe(true);
  });

  it("senza autoStart non parte nulla", () => {
    setup(makeVideoMedia(0), { autoStart: false });

    expect(videoMock.players).toHaveLength(0);
  });
});

describe("VideoMedia — controlli (§14, §83, §128)", () => {
  it("mostra pausa, avanzamento, tempo, audio e schermo intero con etichette parlate", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");

    expect(findByLabel(tree, "Metti in pausa")).toHaveLength(1);
    expect(findByLabel(tree, "Avanzamento video")).toHaveLength(1);
    expect(findByLabel(tree, "Disattiva audio")).toHaveLength(1);
    expect(findByLabel(tree, "Schermo intero")).toHaveLength(1);
    expect(textOf(tree)).toContain("0:00 / 0:48");
  });

  it("pausa e ripresa passano dal player e cambiano l'etichetta", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");

    press(tree, "Metti in pausa");

    expect(videoMock.last.playing).toBe(false);
    expect(findByLabel(tree, "Riprendi")).toHaveLength(1);

    press(tree, "Riprendi");

    expect(videoMock.last.playing).toBe(true);
    expect(findByLabel(tree, "Metti in pausa")).toHaveLength(1);
  });

  it("l'audio si attiva e disattiva sullo stesso player", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");

    press(tree, "Disattiva audio");

    expect(videoMock.last.muted).toBe(true);
    expect(findByLabel(tree, "Attiva audio")).toHaveLength(1);

    press(tree, "Attiva audio");

    expect(videoMock.last.muted).toBe(false);
  });

  it("lo schermo intero è quello dello stesso player e non ne crea un altro (§22)", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");

    press(tree, "Schermo intero");

    expect(videoMock.fullscreenEnters).toBe(1);
    expect(videoMock.players).toHaveLength(1);
  });

  it("il progresso arriva dagli eventi del player e resta locale (§105)", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");

    emit("timeUpdate", { currentTime: 18 });

    expect(textOf(tree)).toContain("0:18 / 0:48");
  });

  it("la durata del player sostituisce quella dei metadata appena nota", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");

    emit("sourceLoad", { duration: 51 });

    expect(textOf(tree)).toContain("0:00 / 0:51");
  });

  it("tap sulla barra porta il player al punto scelto", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");
    const [progress] = hostByTestId(tree, "feed-video-progress");

    act(() => {
      progress.props.onLayout({ nativeEvent: { layout: { width: 200 } } });
    });
    act(() => {
      hostByTestId(tree, "feed-video-progress")[0].props.onPress({ nativeEvent: { locationX: 100 } });
    });

    expect(videoMock.last.currentTime).toBe(24);
    expect(textOf(tree)).toContain("0:24 / 0:48");
  });

  it("la barra espone azioni di accessibilità avanti/indietro di 10 secondi", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");
    emit("timeUpdate", { currentTime: 20 });

    act(() => {
      hostByTestId(tree, "feed-video-progress")[0].props.onAccessibilityAction({
        nativeEvent: { actionName: "increment" },
      });
    });

    expect(videoMock.last.currentTime).toBe(30);
  });

  it("ogni controllo tappabile misura almeno 44pt (§128)", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");

    for (const id of ["feed-video-toggle", "feed-video-mute", "feed-video-fullscreen"]) {
      const style = hostByTestId(tree, id)[0].props.style as { height: number; width: number };

      expect(style.height).toBeGreaterThanOrEqual(44);
      expect(style.width).toBeGreaterThanOrEqual(44);
    }
  });

  it("i controlli restano montati quando si ritirano, solo trasparenti e senza tocchi (§15)", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");

    // Il tap sul video li nasconde, un altro tap li riporta.
    pressTestId(tree, "feed-video-surface");

    const [hidden] = hostByTestId(tree, "feed-video-controls");

    expect(hidden.props.pointerEvents).toBe("none");
    expect(findByLabel(tree, "Metti in pausa")).toHaveLength(1);

    pressTestId(tree, "feed-video-surface");

    expect(hostByTestId(tree, "feed-video-controls")[0].props.pointerEvents).toBe("box-none");
  });
});

describe("VideoMedia — errore del player (§115, §70)", () => {
  it("errore: messaggio e Riprova, mai «Video non disponibile»", () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");

    emit("statusChange", { status: "error" });
    const json = textOf(tree);

    expect(json).toContain("Non è stato possibile riprodurre il video.");
    expect(findByLabel(tree, "Riprova").length).toBeGreaterThan(0);
    expect(json).not.toContain("Video non disponibile");
    expect(countTestId(tree, "feed-video-error")).toBe(1);
  });

  it("Riprova ricarica la sorgente nello stesso player e riparte", async () => {
    const tree = setup();
    pressTestId(tree, "feed-video-play");
    emit("statusChange", { status: "error" });

    press(tree, "Riprova");
    // replaceAsync: la ripartenza arriva quando il caricamento è risolto.
    await act(async () => {
      await Promise.resolve();
    });

    expect(videoMock.players).toHaveLength(1);
    expect(videoMock.last.replaceCalls).toEqual([
      { contentType: "auto", uri: "https://cdn.test/0.mp4" },
    ]);
    expect(videoMock.last.playing).toBe(true);
    expect(countTestId(tree, "feed-video-error")).toBe(0);
  });
});

describe("VideoMedia — un solo video attivo, lifecycle (§18–21, §77–80)", () => {
  function renderTwo(controller = createFeedVideoController()) {
    const tree = render(
      <FeedVideoProvider controller={controller}>
        <VideoMedia itemId="club_media:a" media={makeVideoMedia(0, { id: "va" })} />
        <VideoMedia itemId="club_media:b" media={makeVideoMedia(1, { id: "vb" })} />
      </FeedVideoProvider>,
    );

    return { controller, tree };
  }

  function playNth(tree: ReturnType<typeof render>, index: number) {
    const target = hostByTestId(tree, "feed-video-play")[index];

    act(() => {
      target.props.onPress();
    });
  }

  it("avviare un secondo video smonta il primo, che torna alla miniatura (§18)", () => {
    const { tree } = renderTwo();

    playNth(tree, 0);
    expect(countTestId(tree, "feed-video-player")).toBe(1);

    playNth(tree, 0); // dopo il primo avvio resta un solo Play: quello del secondo

    expect(countTestId(tree, "feed-video-player")).toBe(1);
    expect(countTestId(tree, "feed-video-play")).toBe(1);
    expect(videoMock.players).toHaveLength(2);
    expect(videoMock.players[0].released).toBe(true);
  });

  it("fuori viewport va in pausa; il rientro non lo riavvia (§19–20)", () => {
    const { controller, tree } = renderTwo();
    playNth(tree, 0);

    act(() => controller.reportVisibleItems(new Set(["club_media:b"])));

    expect(videoMock.last.playing).toBe(false);
    // Il player resta con lo stato raggiunto: nessun ritorno alla miniatura.
    expect(countTestId(tree, "feed-video-player")).toBe(1);
    expect(findByLabel(tree, "Riprendi")).toHaveLength(1);

    act(() => controller.reportVisibleItems(new Set(["club_media:a", "club_media:b"])));

    expect(videoMock.last.playing).toBe(false);
  });

  it.each(["tab", "blur", "background"] as const)(
    "pausa per %s: non riprende da sola (§77–79)",
    (reason) => {
      const { controller, tree } = renderTwo();
      playNth(tree, 0);

      act(() => controller.pause(reason));

      expect(videoMock.last.playing).toBe(false);
      expect(controller.getSnapshot().isPlaying).toBe(false);
      expect(findByLabel(tree, "Riprendi")).toHaveLength(1);
    },
  );

  it("una pausa nata nel player (interruzione di sistema) la sa anche il controller (§80)", () => {
    const { controller, tree } = renderTwo();
    playNth(tree, 0);

    act(() => {
      videoMock.last.playing = false;
      videoMock.last.status = "readyToPlay";
      videoMock.last.emit("playingChange", { isPlaying: false });
    });

    expect(controller.getSnapshot().isPlaying).toBe(false);
    expect(findByLabel(tree, "Riprendi")).toHaveLength(1);
  });

  it("un rebuffer (playingChange false in loading) non mette in pausa il controller", () => {
    const { controller, tree } = renderTwo();
    playNth(tree, 0);

    act(() => {
      videoMock.last.status = "loading";
      videoMock.last.emit("playingChange", { isPlaying: false });
    });

    expect(controller.getSnapshot().isPlaying).toBe(true);
    expect(findByLabel(tree, "Metti in pausa")).toHaveLength(1);
  });

  it("la posizione di sessione si ricorda e si riprende dal punto raggiunto (§21)", () => {
    const { controller, tree } = renderTwo();
    playNth(tree, 0);
    emit("timeUpdate", { currentTime: 18 });

    // Il secondo video prende il posto: il primo salva la posizione.
    playNth(tree, 0);

    expect(controller.getPosition(videoKey("club_media:a", "va"))).toBe(18);

    // Ripremendo Play sul primo riparte da lì.
    playNth(tree, 0);

    expect(videoMock.last.currentTime).toBe(18);
  });

  it("smontando il componente il controller non ha più un video corrente", () => {
    const { controller, tree } = renderTwo();
    playNth(tree, 0);

    act(() => tree.unmount());

    expect(controller.getSnapshot().currentKey).toBeNull();
    expect(videoMock.players[0].released).toBe(true);
  });
});
