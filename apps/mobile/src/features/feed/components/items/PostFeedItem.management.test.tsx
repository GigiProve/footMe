/**
 * HOM-04: menu ••• capability-driven del Post, conferma di eliminazione e
 * composizione senza duplicati (§14–17, §28–32, §39–46, §110, §130–138).
 */

import React from "react";
import type TestRenderer from "react-test-renderer";
import { act } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";

import { setAnalyticsSink, type AnalyticsEvent } from "../../../../lib/analytics";
import { buildManageTarget } from "../../content-actions-presentation";
import type { ContentManagement } from "../../content-management-types";
import type { FeedContentItem, FeedPostCapabilities } from "../../feed-types";
import type { DeleteContentOutcome } from "../../use-delete-content";
import {
  countTestId,
  hostByTestId,
  makePostItem,
  press,
  pressTestId,
  renderWithToast,
  textOf,
} from "../feed-test-helpers";
import { PostFeedItem } from "./PostFeedItem";

vi.mock("expo-video", () => import("../../../../test/expo-video"));
vi.mock("expo-router", () => ({ useFocusEffect: () => undefined }));

afterEach(() => {
  setAnalyticsSink(null);
});

const BASE: FeedPostCapabilities = {
  canComment: true,
  canDelete: false,
  canEdit: false,
  canLike: true,
  canReport: true,
  canSave: false,
  canShare: true,
  canViewInsights: false,
};

function setup(
  caps: Partial<FeedPostCapabilities>,
  onDelete: () => Promise<DeleteContentOutcome | null> = async () => "removed",
) {
  const capabilities = { ...BASE, ...caps };
  const item = makePostItem({}, { capabilities });
  const management: ContentManagement = {
    capabilities: {
      canDelete: capabilities.canDelete,
      canEdit: capabilities.canEdit,
      canViewInsights: capabilities.canViewInsights,
    },
    onDelete: vi.fn(onDelete),
    onEdit: vi.fn(),
    onInsights: vi.fn(),
    target: buildManageTarget(item as FeedContentItem, "HOME_PER_TE"),
  };
  const props = {
    onComment: vi.fn(),
    onOpenIdentity: vi.fn(),
    onOpenLink: vi.fn(),
    onOpenMedia: vi.fn(),
    onPress: vi.fn(),
    onPressAuthor: vi.fn(),
    onShare: vi.fn(),
    onToggleLike: vi.fn(),
    onToggleSaved: vi.fn(),
  };
  const tree = renderWithToast(<PostFeedItem item={item} management={management} {...props} />);

  return { management, tree };
}

/** Gli id delle righe del foglio azioni, nell'ordine in cui sono disegnate. */
function actionIds(tree: TestRenderer.ReactTestRenderer): string[] {
  return tree.root
    .findAll(
      (node) =>
        typeof node.type === "string" &&
        typeof node.props?.testID === "string" &&
        node.props.testID.startsWith("action-sheet-") &&
        node.props.testID !== "action-sheet-divider" &&
        node.props.testID !== "action-sheet-grabber",
    )
    .map((node) => (node.props.testID as string).replace("action-sheet-", ""));
}

/** Il Modal che contiene il dialogo di conferma. */
function confirmModal(tree: TestRenderer.ReactTestRenderer) {
  return tree.root.find(
    (node) =>
      String(node.type) === "Modal" &&
      node.findAll((child) => child.props?.testID === "confirm-modal-confirm").length > 0,
  );
}

describe("menu ••• capability-driven", () => {
  it("tre capability: Modifica, Dettagli e statistiche, divisore, Elimina (§14–15, §136)", () => {
    const { tree } = setup({ canDelete: true, canEdit: true, canViewInsights: true });

    expect(actionIds(tree)).toEqual(["EDIT_CONTENT", "VIEW_INSIGHTS", "DELETE_CONTENT"]);
    expect(countTestId(tree, "action-sheet-divider")).toBe(1);

    const json = textOf(tree);
    expect(json).toContain('"Modifica post"');
    expect(json).toContain('"Dettagli e statistiche"');
    expect(json).toContain('"Elimina post"');
  });

  it("senza can_delete: Elimina assente e nessun divisore orfano (§137, §29)", () => {
    const { tree } = setup({ canEdit: true, canViewInsights: true });

    expect(actionIds(tree)).toEqual(["EDIT_CONTENT", "VIEW_INSIGHTS"]);
    expect(countTestId(tree, "action-sheet-divider")).toBe(0);
    expect(textOf(tree)).not.toContain("Elimina post");
  });

  it("solo can_view_insights: una sola riga (§138)", () => {
    const { tree } = setup({ canViewInsights: true });

    expect(actionIds(tree)).toEqual(["VIEW_INSIGHTS"]);
  });

  it("solo Elimina: il divisore non si disegna in testa alla lista", () => {
    const { tree } = setup({ canDelete: true });

    expect(actionIds(tree)).toEqual(["DELETE_CONTENT"]);
    expect(countTestId(tree, "action-sheet-divider")).toBe(0);
  });

  it("sul proprio contenuto non compaiono le voci «per contenuti altrui» (§131)", () => {
    const { tree } = setup({ canEdit: true });
    const json = textOf(tree);

    expect(json).not.toContain("Segnala");
    expect(json).not.toContain("Non mi interessa");
  });

  it("con azioni gestionali il foglio mostra solo quelle, anche se can_save è vero (§26–27, mockup 2)", () => {
    const { tree } = setup({ canDelete: true, canEdit: true, canSave: true });

    expect(actionIds(tree)).toEqual(["EDIT_CONTENT", "DELETE_CONTENT"]);
  });

  it("senza capability di gestione il menu resta quello degli altri contenuti (§130)", () => {
    const { tree } = setup({});

    expect(actionIds(tree).filter((id) => id.endsWith("_CONTENT") || id === "VIEW_INSIGHTS")).toEqual([]);
    expect(textOf(tree)).toContain("Segnala");
    expect(() => press(tree, "Altre azioni")).not.toThrow();
  });

  it("il foglio annuncia «Azioni contenuto» e l'azione distruttiva lo dichiara (§111–112)", () => {
    const { tree } = setup({ canDelete: true, canEdit: true });
    const sheet = tree.root.find(
      (node) => typeof node.type === "string" && node.props?.accessibilityLabel === "Azioni contenuto",
    );
    const [remove] = hostByTestId(tree, "action-sheet-DELETE_CONTENT");

    expect(sheet).toBeTruthy();
    expect(remove.props.accessibilityHint).toBe("Azione distruttiva");
  });

  it("Modifica e Dettagli chiamano gli handler con i loro eventi (§34, §37, §134)", () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    const { management, tree } = setup({ canEdit: true, canViewInsights: true });

    pressTestId(tree, "action-sheet-EDIT_CONTENT");
    pressTestId(tree, "action-sheet-VIEW_INSIGHTS");

    expect(management.onEdit).toHaveBeenCalledTimes(1);
    expect(management.onInsights).toHaveBeenCalledTimes(1);
    expect(events.map((event) => event.name)).toEqual(["edit_selected", "insights_selected"]);
    expect(events[0].props).toEqual({
      authorIdentityType: "person",
      contentId: "p1",
      contentType: "club_media",
      origin: "HOME_PER_TE",
    });
  });

  it("aprire il menu registra content_menu_open", () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    const { tree } = setup({ canEdit: true });

    press(tree, "Altre azioni");

    expect(events.some((event) => event.name === "content_menu_open")).toBe(true);
  });
});

describe("conferma di eliminazione", () => {
  it("Elimina apre la conferma e NON elimina subito (§39)", () => {
    const { management, tree } = setup({ canDelete: true });

    expect(confirmModal(tree).props.visible).toBe(false);
    pressTestId(tree, "action-sheet-DELETE_CONTENT");

    expect(confirmModal(tree).props.visible).toBe(true);
    expect(management.onDelete).not.toHaveBeenCalled();
    expect(textOf(tree)).toContain("Eliminare questo post?");
    expect(textOf(tree)).toContain("Il post non sarà più visibile su PROLINK. Questa azione non può essere annullata.");
  });

  it("Annulla chiude senza modifiche (§44, §142)", () => {
    const events: AnalyticsEvent[] = [];
    setAnalyticsSink((event) => events.push(event));
    const { management, tree } = setup({ canDelete: true });

    pressTestId(tree, "action-sheet-DELETE_CONTENT");
    pressTestId(tree, "confirm-modal-cancel");

    expect(confirmModal(tree).props.visible).toBe(false);
    expect(management.onDelete).not.toHaveBeenCalled();
    expect(events.map((event) => event.name)).toEqual(["delete_selected", "delete_cancelled"]);
  });

  it("Elimina conferma: una chiamata, poi il dialogo si chiude (§45, §47)", async () => {
    const { management, tree } = setup({ canDelete: true });

    pressTestId(tree, "action-sheet-DELETE_CONTENT");
    await act(async () => {
      pressTestId(tree, "confirm-modal-confirm");
    });

    expect(management.onDelete).toHaveBeenCalledTimes(1);
    expect(confirmModal(tree).props.visible).toBe(false);
  });

  it("durante la richiesta: loading, secondo tap ignorato, dismiss ignorato (§45, §110)", async () => {
    let finish!: (outcome: DeleteContentOutcome) => void;
    const { management, tree } = setup(
      { canDelete: true },
      () =>
        new Promise<DeleteContentOutcome>((resolve) => {
          finish = resolve;
        }),
    );

    pressTestId(tree, "action-sheet-DELETE_CONTENT");
    await act(async () => {
      pressTestId(tree, "confirm-modal-confirm");
    });
    await act(async () => {
      pressTestId(tree, "confirm-modal-confirm");
    });

    expect(management.onDelete).toHaveBeenCalledTimes(1);
    expect(countTestId(tree, "confirm-modal-confirm-spinner")).toBe(1);
    expect(confirmModal(tree).props.onRequestClose).toBeUndefined();

    await act(async () => {
      finish("removed");
    });

    expect(confirmModal(tree).props.visible).toBe(false);
  });

  it("fallimento: il dialogo resta aperto per riprovare, senza loading (§69, §144)", async () => {
    const { tree } = setup({ canDelete: true }, async () => "failed");

    pressTestId(tree, "action-sheet-DELETE_CONTENT");
    await act(async () => {
      pressTestId(tree, "confirm-modal-confirm");
    });

    expect(confirmModal(tree).props.visible).toBe(true);
    expect(countTestId(tree, "confirm-modal-confirm-spinner")).toBe(0);
    // Il copy di errore sta nel dialogo: un Toast resterebbe sotto il Modal nativo.
    expect(textOf(tree)).toContain("Non è stato possibile eliminare il post. Riprova.");
  });

  it("permesso revocato: il dialogo si chiude (§71)", async () => {
    const { tree } = setup({ canDelete: true }, async () => "permission_denied");

    pressTestId(tree, "action-sheet-DELETE_CONTENT");
    await act(async () => {
      pressTestId(tree, "confirm-modal-confirm");
    });

    expect(confirmModal(tree).props.visible).toBe(false);
  });
});
