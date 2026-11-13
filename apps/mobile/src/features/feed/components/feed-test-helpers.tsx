import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { ToastProvider } from "../../../ui";
import type {
  FeedArticleItem,
  FeedEditorialPayload,
  FeedItem,
  FeedMediaItem,
  FeedPostItem,
  FeedPostPayload,
  FeedSuggestedClubRow,
  FeedSuggestedProfileRow,
  FeedVideoItem,
} from "../feed-types";
import type { FeedModulesState } from "./FeedItemRenderer";

/**
 * Utilità condivise dai test dei componenti del Feed. I costruttori tengono i
 * test leggibili: ogni test dichiara solo ciò che gli serve davvero.
 */

export function render(element: React.ReactElement) {
  let tree!: TestRenderer.ReactTestRenderer;
  act(() => {
    tree = TestRenderer.create(element);
  });
  return tree;
}

/** I componenti che mostrano un toast hanno bisogno del provider. */
export function renderWithToast(element: React.ReactElement) {
  return render(<ToastProvider>{element}</ToastProvider>);
}

/** Tutto il testo reso nell'albero, per asserire presenze e assenze. */
export function textOf(tree: TestRenderer.ReactTestRenderer): string {
  return JSON.stringify(tree.toJSON());
}

/**
 * Conta le occorrenze di un testID tra i soli nodi host: `findAll` restituisce
 * anche l'istanza del componente React, quindi conterebbe due volte.
 */
export function countTestId(
  tree: TestRenderer.ReactTestRenderer,
  testID: string,
): number {
  return tree.root.findAll(
    (node) => typeof node.type === "string" && node.props?.testID === testID,
  ).length;
}

export function press(tree: TestRenderer.ReactTestRenderer, accessibilityLabel: string) {
  const target = tree.root
    .findAll(
      (node) =>
        typeof node.type === "string" &&
        node.props?.accessibilityLabel === accessibilityLabel &&
        typeof node.props?.onPress === "function",
    )
    .at(0);

  if (!target) {
    throw new Error(`Nessun elemento premibile con label "${accessibilityLabel}"`);
  }

  act(() => {
    target.props.onPress();
  });
}

/**
 * Come `press`, ma per le etichette che contengono parti variabili (l'autore
 * del Post dice anche "pubblicato 2 ore fa"): si seleziona per espressione.
 */
export function pressMatching(tree: TestRenderer.ReactTestRenderer, pattern: RegExp) {
  const target = tree.root
    .findAll(
      (node) =>
        typeof node.type === "string" &&
        typeof node.props?.accessibilityLabel === "string" &&
        pattern.test(node.props.accessibilityLabel) &&
        typeof node.props?.onPress === "function",
    )
    .at(0);

  if (!target) {
    throw new Error(`Nessun elemento premibile con label che soddisfa ${pattern}`);
  }

  act(() => {
    target.props.onPress();
  });
}

/** Nodi host con un dato testID. */
export function hostByTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(
    (node) => typeof node.type === "string" && node.props?.testID === testID,
  );
}

/** Preme il primo nodo host con quel testID che abbia un `onPress`. */
export function pressTestId(tree: TestRenderer.ReactTestRenderer, testID: string) {
  const target = hostByTestId(tree, testID).find(
    (node) => typeof node.props.onPress === "function",
  );

  if (!target) {
    throw new Error(`Nessun elemento premibile con testID "${testID}"`);
  }

  act(() => {
    target.props.onPress();
  });
}

/** Nodi host con un dato accessibilityLabel esatto (per contare i controlli). */
export function findByLabel(tree: TestRenderer.ReactTestRenderer, label: string) {
  return tree.root.findAll(
    (node) => typeof node.type === "string" && node.props?.accessibilityLabel === label,
  );
}

let counter = 0;

function envelope(id: string) {
  counter += 1;
  return {
    id,
    rank: counter,
    version: 1,
    layoutHint: "standard" as const,
    publishedAt: "2026-07-31T10:00:00.000Z",
    reasonKey: null,
    reasonLabel: null,
    isSeen: false,
    isSaved: false,
    isFollowingAuthor: false,
    nav: null,
  };
}

const author = {
  kind: "club" as const,
  id: "club-1",
  name: "Como 1907",
  avatarUrl: null,
  sourceKind: "ufficiale",
  isVerified: true,
};

/** Un elemento della media collection (HOM-02 §24), pronto, con url e miniatura. */
export function makeMediaItem(
  position: number,
  overrides: Partial<FeedMediaItem> = {},
): FeedMediaItem {
  return {
    altText: null,
    aspectRatio: null,
    availability: "available",
    captions: [],
    createdAt: null,
    durationSeconds: null,
    height: null,
    id: `media-${position}`,
    position,
    processingState: "ready",
    thumbnailUrl: `https://cdn.test/${position}-thumb.jpg`,
    type: "image",
    url: `https://cdn.test/${position}.jpg`,
    variants: [],
    width: null,
    ...overrides,
  };
}

/** Un video pronto (HOM-03): url, miniatura e durata di 48 secondi. */
export function makeVideoMedia(
  position = 0,
  overrides: Partial<FeedMediaItem> = {},
): FeedMediaItem {
  return makeMediaItem(position, {
    durationSeconds: 48,
    id: `video-${position}`,
    type: "video",
    url: `https://cdn.test/${position}.mp4`,
    ...overrides,
  });
}

/**
 * Il payload di default è un Post di sola persona senza media né conteggi:
 * ogni test dichiara solo ciò che gli serve. `payloadOverrides` si fonde nel
 * payload invece di sostituirlo.
 */
export function makePostItem(
  overrides: Partial<FeedPostItem> = {},
  payloadOverrides: Partial<FeedPostPayload> = {},
): FeedPostItem {
  return {
    ...envelope("club_media:p1"),
    type: "post",
    author,
    title: "Buon lavoro, ragazzi!",
    payload: {
      authorIdentityType: "person",
      authorMeta: {
        clubCategory: null,
        clubName: null,
        mediaKind: null,
        primaryPosition: null,
        role: null,
        teamLabel: null,
      },
      body: "Testo del post.",
      capabilities: {
        canComment: true,
        canDelete: false,
        canEdit: false,
        canLike: true,
        canReport: true,
        canSave: true,
        canShare: true,
        canViewInsights: false,
      },
      commentsCount: 0,
      contentType: "club_media",
      isLiked: false,
      isTruncated: false,
      kindLabel: "Highlights",
      likesCount: 0,
      linkPreview: null,
      media: [],
      mentions: [],
      postId: "p1",
      tagged: [],
      text: "Testo del post.",
      ...payloadOverrides,
    },
    ...overrides,
  };
}

/** Payload editoriale (HOM-03): stessa forma per Articolo e Video, con like e capabilities. */
function makeEditorialPayload(
  overrides: Partial<FeedEditorialPayload> = {},
): FeedEditorialPayload {
  return {
    authorIdentityType: "media",
    authorMeta: {
      clubCategory: null,
      clubName: null,
      mediaKind: null,
      primaryPosition: null,
      role: null,
      teamLabel: null,
    },
    capabilities: {
      canComment: true,
      canDelete: false,
      canEdit: false,
      canLike: true,
      canReport: true,
      canSave: true,
      canShare: true,
      canViewInsights: false,
    },
    commentsCount: 0,
    contentType: "media_profile",
    durationSeconds: null,
    intro: null,
    isLiked: false,
    kindLabel: null,
    likesCount: 0,
    media: [],
    postId: "a1",
    summary: null,
    thumbnailUrl: null,
    ...overrides,
  };
}

export function makeArticleItem(
  overrides: Partial<FeedArticleItem> = {},
  payloadOverrides: Partial<FeedEditorialPayload> = {},
): FeedArticleItem {
  return {
    ...envelope("media_profile:a1"),
    type: "article",
    author,
    title: "Il calcio italiano e i giovani talenti",
    payload: makeEditorialPayload({
      intro: "Analisi sui protagonisti emergenti.",
      kindLabel: "Articolo",
      summary: "Analisi sui protagonisti emergenti.",
      ...payloadOverrides,
    }),
    ...overrides,
  };
}

export function makeVideoItem(
  overrides: Partial<FeedVideoItem> = {},
  payloadOverrides: Partial<FeedEditorialPayload> = {},
): FeedVideoItem {
  return {
    ...envelope("media_profile:v1"),
    type: "video",
    author,
    title: "Gli highlights della partita",
    payload: makeEditorialPayload({
      durationSeconds: 95,
      kindLabel: "Video",
      media: [makeVideoMedia(0, { durationSeconds: 95 })],
      postId: "v1",
      ...payloadOverrides,
    }),
    ...overrides,
  };
}

export function makePositionItem(): FeedItem {
  return {
    ...envelope("recruiting_ad:ad1"),
    type: "suggested_position",
    author,
    payload: {
      adId: "ad1",
      clubId: "club-1",
      clubName: "Parma",
      clubLogoUrl: null,
      teamName: "Prima squadra",
      teamType: "senior",
      roleRequired: "center_back",
      category: "Serie B",
      city: "Parma",
      province: "Parma",
      region: "Emilia-Romagna",
      targetRole: "player",
      isSecondaryMatch: false,
    },
  };
}

export function makeSuggestedProfilesItem(): FeedItem {
  return {
    ...envelope("module:suggested_profiles:0"),
    type: "suggested_profiles",
    author: null,
    payload: { moduleKey: "suggested_profiles", moduleLimit: 6 },
  };
}

export function makeSuggestedClubsItem(): FeedItem {
  return {
    ...envelope("module:suggested_clubs:0"),
    type: "suggested_clubs",
    author: null,
    payload: { moduleKey: "suggested_clubs", moduleLimit: 6 },
  };
}

export function makeProfileRow(
  overrides: Partial<FeedSuggestedProfileRow> = {},
): FeedSuggestedProfileRow {
  return {
    item_uid: "profile:p-1",
    entity_id: "p-1",
    full_name: "Lorenzo Colombo",
    avatar_url: null,
    role: "player",
    region: "Lombardia",
    city: "Monza",
    primary_position: "striker",
    current_club_name: "AC Monza",
    is_following: false,
    is_saved: false,
    suggestion_reason_key: "same_region",
    suggestion_reason_label: "Dalla tua zona",
    component_version: 1,
    ...overrides,
  };
}

export function makeClubRow(
  overrides: Partial<FeedSuggestedClubRow> = {},
): FeedSuggestedClubRow {
  return {
    item_uid: "club:c-1",
    entity_id: "c-1",
    name: "AC Milan",
    logo_url: null,
    city: "Milano",
    province: "Milano",
    region: "Lombardia",
    category: "Serie A",
    open_positions_count: 2,
    is_following: false,
    is_saved: false,
    suggestion_reason_key: "same_region",
    suggestion_reason_label: "Dalla tua zona",
    component_version: 1,
    ...overrides,
  };
}

export function makeModules(
  overrides: Partial<FeedModulesState> = {},
): FeedModulesState {
  return {
    clubs: { isError: false, isLoading: false, retry: () => {}, rows: [makeClubRow()] },
    onPressSuggestedClub: () => {},
    onPressSuggestedProfile: () => {},
    onSeeAllClubs: () => {},
    onSeeAllProfiles: () => {},
    onToggleFollowClub: () => {},
    onToggleFollowProfile: () => {},
    pendingFollowId: null,
    profiles: {
      isError: false,
      isLoading: false,
      retry: () => {},
      rows: [makeProfileRow()],
    },
    ...overrides,
  };
}
