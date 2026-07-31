import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { ToastProvider } from "../../../ui";
import type { FeedItem, FeedSuggestedClubRow, FeedSuggestedProfileRow } from "../feed-types";
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

export function makePostItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    ...envelope("club_media:p1"),
    type: "post",
    author,
    title: "Buon lavoro, ragazzi!",
    payload: {
      contentType: "club_media",
      postId: "p1",
      kindLabel: "Highlights",
      text: "Testo del post.",
      isTruncated: false,
      imageUrl: null,
      mediaType: null,
    },
    ...overrides,
  } as FeedItem;
}

export function makeArticleItem(): FeedItem {
  return {
    ...envelope("media_profile:a1"),
    type: "article",
    author,
    title: "Il calcio italiano e i giovani talenti",
    payload: {
      contentType: "media_profile",
      postId: "a1",
      kindLabel: "Articolo",
      intro: "Analisi sui protagonisti emergenti.",
      thumbnailUrl: null,
      durationSeconds: null,
    },
  };
}

export function makeVideoItem(): FeedItem {
  return {
    ...envelope("club_media:v1"),
    type: "video",
    author,
    title: "Gli highlights della partita",
    payload: {
      contentType: "club_media",
      postId: "v1",
      kindLabel: "Highlights",
      intro: null,
      thumbnailUrl: null,
      durationSeconds: 95,
    },
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
