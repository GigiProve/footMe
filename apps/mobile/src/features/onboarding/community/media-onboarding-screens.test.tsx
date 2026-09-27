import React from "react";
import TestRenderer, { act } from "react-test-renderer";
import { describe, expect, it, vi } from "vitest";

import { isMediaMasterStep } from "./MediaOnboardingFlow";
import { MediaChannelsStep } from "./MediaChannelsStep";
import { MediaChipSelectionStep } from "./MediaChipSelectionStep";
import { MediaCreatorTypeStep } from "./MediaCreatorTypeStep";
import { MediaProjectImageStep } from "./MediaProjectImageStep";
import { validateMediaChannel } from "./media-channels";
import {
  MEDIA_SCOPE_OPTIONS,
  coerceMediaCreatorType,
  mediaKindFromCreatorType,
  normalizeMediaScopes,
} from "./media-taxonomy";

vi.mock("@expo/vector-icons/Ionicons", () => {
  function Ionicons(props: Record<string, unknown>) {
    return React.createElement("Ionicon", props);
  }

  Ionicons.glyphMap = {};

  return { default: Ionicons };
});

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

function findPressable(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const match = tree.root
    .findAllByProps({ testID })
    .find(
      (instance) =>
        typeof instance.type === "string" &&
        typeof instance.props.onPress === "function",
    );

  if (!match) {
    throw new Error(`Nessun elemento premibile con testID "${testID}"`);
  }

  return match;
}

function press(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = findPressable(tree, testID);

  act(() => {
    target.props.onPress();
  });
}

function texts(tree: TestRenderer.ReactTestRenderer) {
  return tree.root
    .findAll((node) => typeof node.type === "string")
    .flatMap((node) =>
      React.Children.toArray(node.props.children).filter(
        (child): child is string => typeof child === "string",
      ),
    );
}

function queryTestID(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAllByProps({ testID }).length > 0;
}

describe("isMediaMasterStep", () => {
  it("copre i soli passi propri del Media / Creator", () => {
    for (const step of [
      "media_entity",
      "media_type",
      "media_logo",
      "media_content",
      "media_focus",
      "media_channels",
    ] as const) {
      expect(isMediaMasterStep(step, "media")).toBe(true);
    }

    // §7, §8: identità e foto restano sulle pagine comuni del Master.
    expect(isMediaMasterStep("base", "media")).toBe(false);
    expect(isMediaMasterStep("photo", "media")).toBe(false);
    expect(isMediaMasterStep("media_entity", "fan")).toBe(false);
  });
});

describe("MediaCreatorTypeStep (§11–§14)", () => {
  function renderStep(
    props: Partial<React.ComponentProps<typeof MediaCreatorTypeStep>> = {},
  ) {
    return render(
      <MediaCreatorTypeStep
        currentStep={5}
        isBusy={false}
        onBack={vi.fn()}
        onContinue={vi.fn()}
        onOtherLabelChange={vi.fn()}
        onSelect={vi.fn()}
        otherLabel=""
        selectedValue=""
        stepLabel="Tipologia"
        totalSteps={9}
        {...props}
      />,
    );
  }

  it("mostra le sei tipologie con la loro microcopy", () => {
    const rendered = texts(renderStep());

    expect(rendered).toContain("Che tipo di realtà rappresenti?");
    expect(rendered).toContain("Pagina social");
    expect(rendered).toContain("Testata giornalistica");
    expect(rendered).toContain("Progetto editoriale");
    expect(rendered).toContain("Creator indipendente");
    expect(rendered).toContain("Podcast / format");
    expect(rendered).toContain("Altro");
    expect(rendered).toContain(
      "Crei contenuti con il tuo nome o con un brand personale.",
    );
  });

  /** §13: scelta singola — ogni card è un radio, non una checkbox. */
  it("tratta la tipologia come scelta singola", () => {
    const onSelect = vi.fn();
    const tree = renderStep({ onSelect });

    press(tree, "media-creator-type-news_outlet");

    expect(onSelect).toHaveBeenCalledWith("news_outlet");
    expect(
      findPressable(tree, "media-creator-type-news_outlet").props
        .accessibilityRole,
    ).toBe("radio");
  });

  /** §14: il campo libero esiste solo finché "Altro" è la scelta attiva. */
  it("apre il campo libero solo su Altro", () => {
    expect(
      queryTestID(
        renderStep({ selectedValue: "other" }),
        "media-creator-type-other-label",
      ),
    ).toBe(true);
    expect(
      queryTestID(
        renderStep({ selectedValue: "podcast_format" }),
        "media-creator-type-other-label",
      ),
    ).toBe(false);
  });
});

describe("MediaChipSelectionStep (§17–§20)", () => {
  /** §19: Calciomercato è tra gli ambiti, e la selezione è multipla. */
  it("propone gli ambiti a chip e ne accumula più di uno", () => {
    const onChange = vi.fn();
    const tree = render(
      <MediaChipSelectionStep
        currentStep={8}
        isBusy={false}
        onBack={vi.fn()}
        onChange={onChange}
        onContinue={vi.fn()}
        options={MEDIA_SCOPE_OPTIONS}
        stepLabel="Ambito"
        subtitle="Quali aree del calcio racconti principalmente?"
        testID="media-scopes-step"
        title="Ambito principale"
        totalSteps={9}
        values={["Calcio giovanile"]}
      />,
    );

    const rendered = texts(tree);
    expect(rendered).toContain("Calciomercato");
    expect(rendered).toContain("Calcio professionistico");

    press(tree, "media-scopes-step-chips-Calciomercato");

    expect(onChange).toHaveBeenCalledWith([
      "Calcio giovanile",
      "Calciomercato",
    ]);
  });
});

describe("MediaProjectImageStep (§15, §16)", () => {
  it("dà allo screen il solo scopo di caricare l'immagine del progetto", () => {
    const rendered = texts(
      render(
        <MediaProjectImageStep
          currentStep={6}
          isUploading={false}
          logoUrl={null}
          onBack={vi.fn()}
          onContinue={vi.fn()}
          onPickFromLibrary={vi.fn()}
          onTakePhoto={vi.fn()}
          stepLabel="Immagine"
          totalSteps={9}
        />,
      ),
    );

    expect(rendered).toContain("Aggiungi un'immagine al tuo progetto");
    expect(rendered).toContain("Aggiungi immagine");
    expect(
      rendered.some((entry) => entry.includes("foto profilo personale")),
    ).toBe(true);
  });
});

describe("MediaChannelsStep (§21–§23)", () => {
  it("mostra cinque canali facoltativi e l'errore inline del singolo campo", () => {
    const tree = render(
      <MediaChannelsStep
        currentStep={9}
        errors={{ website: "Inserisci un link valido." }}
        isBusy={false}
        onBack={vi.fn()}
        onBlurChannel={vi.fn()}
        onChangeChannel={vi.fn()}
        onContinue={vi.fn()}
        stepLabel="Canali"
        totalSteps={9}
        values={{
          facebook: "",
          instagram: "",
          tiktok: "",
          website: "non un sito",
          youtube: "",
        }}
      />,
    );

    const rendered = texts(tree);

    for (const label of [
      "Instagram",
      "TikTok",
      "YouTube",
      "Facebook",
      "Sito web",
    ]) {
      expect(rendered).toContain(label);
    }

    expect(rendered).toContain("Inserisci un link valido.");
  });
});

describe("validateMediaChannel (§22, §23)", () => {
  it("accetta username e URL completi per Instagram e TikTok", () => {
    expect(validateMediaChannel("instagram", "@tuttodilettanti")).toEqual({
      isValid: true,
      normalized: "https://instagram.com/tuttodilettanti",
    });
    expect(
      validateMediaChannel("instagram", "https://www.instagram.com/zonacalcio"),
    ).toEqual({
      isValid: true,
      normalized: "https://instagram.com/zonacalcio",
    });
    expect(validateMediaChannel("tiktok", "zonacalcio")).toEqual({
      isValid: true,
      normalized: "https://tiktok.com/@zonacalcio",
    });
  });

  it("accetta l'handle e l'URL del canale YouTube", () => {
    expect(validateMediaChannel("youtube", "@sportsicilia")).toEqual({
      isValid: true,
      normalized: "https://youtube.com/@sportsicilia",
    });
    expect(
      validateMediaChannel("youtube", "https://youtube.com/channel/UC12345"),
    ).toEqual({
      isValid: true,
      normalized: "https://youtube.com/channel/UC12345",
    });
  });

  /** §44: un sito senza protocollo è valido, il protocollo lo mettiamo noi. */
  it("completa il sito web senza protocollo", () => {
    expect(validateMediaChannel("website", "tuttodilettanti.it")).toEqual({
      isValid: true,
      normalized: "https://tuttodilettanti.it",
    });
  });

  /** §23: vuoto non è un errore; scritto male sì, e non viene cancellato. */
  it("distingue il campo vuoto dal valore non valido", () => {
    expect(validateMediaChannel("website", "   ")).toEqual({
      isValid: true,
      normalized: "",
    });
    expect(validateMediaChannel("website", "non un sito").isValid).toBe(false);
    expect(validateMediaChannel("instagram", "nome con spazi").isValid).toBe(
      false,
    );
  });
});

describe("media-taxonomy (§13, §30)", () => {
  it("mappa la tipologia sul vocabolario di ricerca", () => {
    expect(mediaKindFromCreatorType("news_outlet")).toBe("testata");
    expect(mediaKindFromCreatorType("editorial_project")).toBe("testata");
    expect(mediaKindFromCreatorType("independent_creator")).toBe("creator");
    expect(mediaKindFromCreatorType("podcast_format")).toBe("creator");
    expect(mediaKindFromCreatorType("social_page")).toBe("pagina");
  });

  it("recupera le tipologie e gli ambiti del vecchio vocabolario", () => {
    expect(coerceMediaCreatorType("Testata o sito")).toBe("news_outlet");
    expect(coerceMediaCreatorType("Pagina o progetto media")).toBe(
      "editorial_project",
    );
    expect(coerceMediaCreatorType("Nessuna")).toBe("");

    expect(
      normalizeMediaScopes(["Mercato", "Settore giovanile", "Sconosciuto"]),
    ).toEqual(["Calciomercato", "Calcio giovanile"]);
  });
});
