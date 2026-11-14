/**
 * Interazioni del dettaglio contenuto Media/Creator (REV-PROF-21; HOM-08).
 *
 * Il test fissa la riga della DoD che rischiava di regredire spostando le
 * azioni fuori dal profilo: Salva resta disponibile nel dettaglio, per entrambe
 * le superfici Media, e un salvataggio non riuscito non resta a schermo come se
 * fosse andato a buon fine. HOM-08: i commenti non sono più qui (dominio unico
 * in `features/comments`): nessun input e nessun invio.
 */
import React from "react";
import { Alert } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetSavedStore } from "../../saved/saved-store";
import { MediaContentInteractions } from "./MediaContentInteractions";

const mocks = vi.hoisted(() => ({
  setSavedRemote: vi.fn(),
}));

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    { glyphMap: { bookmark: 1, "bookmark-outline": 1 } },
  ),
}));

// HOM-07: il Salva passa dalla mutation unica `set_saved`, non più dai servizi per tabella.
vi.mock("../../saved/saved-service", () => ({
  setSavedRemote: mocks.setSavedRemote,
}));

function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;

  act(() => {
    tree = TestRenderer.create(element);
  });

  return tree;
}

function findByTestId(root: TestRenderer.ReactTestInstance, testID: string) {
  const node = root.findAll(
    (entry) =>
      entry.props.testID === testID && typeof entry.props.onPress === "function",
  )[0];

  if (!node) {
    throw new Error(`Pressable non trovato: ${testID}`);
  }

  return node;
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSavedStore();
  mocks.setSavedRemote.mockResolvedValue(true);
  vi.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

describe("MediaContentInteractions", () => {
  it("mostra Salva nel dettaglio di un articolo", () => {
    const tree = render(
      <MediaContentInteractions
        contentType="media_profile"
        initialIsSaved={false}
        postId="article-1"
        viewerProfileId="viewer-1"
      />,
    );

    const save = findByTestId(tree.root, "media-content-save");

    act(() => {
      save.props.onPress();
    });

    expect(mocks.setSavedRemote).toHaveBeenCalledWith(
      { contentType: "media_profile", id: "article-1", type: "content" },
      true,
    );
  });

  it("scrive il target della Tribuna per un contenuto Tribuna", () => {
    const tree = render(
      <MediaContentInteractions
        contentType="media_tribuna"
        initialIsSaved={true}
        postId="tribuna-1"
        viewerProfileId="viewer-1"
      />,
    );

    act(() => {
      findByTestId(tree.root, "media-content-save").props.onPress();
    });

    expect(mocks.setSavedRemote).toHaveBeenCalledWith(
      { contentType: "media_tribuna", id: "tribuna-1", type: "content" },
      false,
    );
    expect(mocks.setSavedRemote).toHaveBeenCalledTimes(1);
  });

  it("rimette lo stato precedente se il salvataggio non riesce", async () => {
    mocks.setSavedRemote.mockRejectedValue(new Error("rete"));

    const tree = render(
      <MediaContentInteractions
        contentType="media_profile"
        initialIsSaved={false}
        postId="article-1"
        viewerProfileId="viewer-1"
      />,
    );

    await act(async () => {
      findByTestId(tree.root, "media-content-save").props.onPress();
    });
    await vi.waitFor(() => expect(Alert.alert).toHaveBeenCalled());

    expect(
      findByTestId(tree.root, "media-content-save").props.accessibilityState
        .selected,
    ).toBe(false);
    // §97: il copy del salvataggio fallito.
    expect(Alert.alert).toHaveBeenCalledWith(
      "Errore",
      "Non è stato possibile salvare il contenuto. Riprova.",
    );
  });

  it("chiede di accedere invece di salvare a vuoto", () => {
    const tree = render(
      <MediaContentInteractions
        contentType="media_profile"
        initialIsSaved={false}
        postId="article-1"
        viewerProfileId={null}
      />,
    );

    act(() => {
      findByTestId(tree.root, "media-content-save").props.onPress();
    });

    expect(mocks.setSavedRemote).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      "Accesso richiesto",
      "Accedi per salvare questo contenuto.",
    );
  });

  it("non ha più un input di commento (HOM-08: dominio unico)", () => {
    const tree = render(
      <MediaContentInteractions
        contentType="media_profile"
        initialIsSaved={false}
        postId="article-1"
        viewerProfileId="viewer-1"
      />,
    );

    expect(
      tree.root.findAll((node) => typeof node.props.onChangeText === "function"),
    ).toHaveLength(0);
  });
});
