/**
 * Interazioni del dettaglio contenuto Media/Creator (REV-PROF-21).
 *
 * Il test fissa la riga della DoD che rischiava di regredire spostando le
 * azioni fuori dal profilo: Salva e commenti restano disponibili nel
 * dettaglio, per entrambe le superfici Media, e un salvataggio non riuscito
 * non resta a schermo come se fosse andato a buon fine.
 */
import React from "react";
import { Alert } from "react-native";
import TestRenderer, { act } from "react-test-renderer";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { resetSavedStore } from "../../saved/saved-store";
import { MediaContentInteractions } from "./MediaContentInteractions";

const mocks = vi.hoisted(() => ({
  addMediaProfilePostComment: vi.fn(),
  addMediaTribunaComment: vi.fn(),
  setSavedRemote: vi.fn(),
}));

vi.mock("@expo/vector-icons/Ionicons", () => ({
  default: Object.assign(
    (props: Record<string, unknown>) => React.createElement("Ionicon", props),
    { glyphMap: { bookmark: 1, "bookmark-outline": 1, "chatbubble-outline": 1 } },
  ),
}));

vi.mock("../media-profile-post-service", () => ({
  addMediaProfilePostComment: mocks.addMediaProfilePostComment,
}));

vi.mock("../media-tribuna-service", () => ({
  addMediaTribunaComment: mocks.addMediaTribunaComment,
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

function collectText(children: unknown): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(collectText).join("");
  }

  if (children && typeof children === "object" && "props" in children) {
    return collectText(
      (children as { props?: { children?: unknown } }).props?.children,
    );
  }

  return "";
}

function hasText(root: TestRenderer.ReactTestInstance, value: string) {
  return (
    root.findAll((node) => collectText(node.props.children).includes(value))
      .length > 0
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  resetSavedStore();
  mocks.setSavedRemote.mockResolvedValue(true);
  mocks.addMediaProfilePostComment.mockResolvedValue({
    author_avatar_url: null,
    author_name: "Luigi",
    body: "Bell'articolo",
    created_at: "2026-06-19T09:00:00Z",
    id: "comment-new",
    profile_id: "viewer-1",
  });
  vi.spyOn(Alert, "alert").mockImplementation(() => undefined);
});

describe("MediaContentInteractions", () => {
  it("mostra Salva nel dettaglio di un articolo", () => {
    const tree = render(
      <MediaContentInteractions
        contentType="media_profile"
        initialComments={[]}
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
        initialComments={[]}
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
        initialComments={[]}
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
        initialComments={[]}
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

  it("mostra i commenti esistenti e pubblica il nuovo", async () => {
    const tree = render(
      <MediaContentInteractions
        contentType="media_profile"
        initialComments={[
          {
            author_avatar_url: null,
            author_name: "Sara",
            body: "Analisi interessante",
            created_at: "2026-06-19T08:30:00Z",
            id: "comment-1",
            profile_id: "profile-2",
          },
        ]}
        initialIsSaved={false}
        postId="article-1"
        viewerProfileId="viewer-1"
      />,
    );

    expect(hasText(tree.root, "Analisi interessante")).toBe(true);

    const input = tree.root.findAll(
      (node) => typeof node.props.onChangeText === "function",
    )[0];

    act(() => {
      input?.props.onChangeText("Bell'articolo");
    });

    await act(async () => {
      findByTestId(tree.root, "media-content-comment-submit").props.onPress();
      await Promise.resolve();
    });

    expect(mocks.addMediaProfilePostComment).toHaveBeenCalledWith({
      body: "Bell'articolo",
      postId: "article-1",
      profileId: "viewer-1",
    });
    expect(hasText(tree.root, "Bell'articolo")).toBe(true);
  });
});
