/**
 * Dispatcher tipo -> componente (§26: "il client deve renderizzare il
 * componente corretto in base al tipo ricevuto").
 *
 * Qui NON esiste alcuna sequenza: nessun indice, nessuna posizione, nessuna
 * regola di alternanza. L'ordine arriva dalla spina e viene rifinito da
 * `arrangeFeedItems`; questo file sa solo disegnare un elemento alla volta.
 *
 * Si usa uno `switch` esaustivo e non una mappa a oggetti: la mappa perderebbe
 * il narrowing del payload e ogni componente riceverebbe una union. Il `default`
 * restituisce `null` così un tipo introdotto in futuro dal server degrada a
 * nulla invece di far crashare la Home su un client vecchio.
 */

import type {
  FeedItem,
  FeedSuggestedClubRow,
  FeedSuggestedProfileRow,
} from "../feed-types";
import { EditorialFeedItem } from "./items/EditorialFeedItem";
import { PostFeedItem } from "./items/PostFeedItem";
import { SuggestedClubsFeedItem } from "./items/SuggestedClubsFeedItem";
import { SuggestedPositionFeedItem } from "./items/SuggestedPositionFeedItem";
import { SuggestedProfilesFeedItem } from "./items/SuggestedProfilesFeedItem";

export type FeedModulesState = {
  profiles: {
    rows: FeedSuggestedProfileRow[] | undefined;
    isLoading: boolean;
    isError: boolean;
    retry: () => void;
  };
  clubs: {
    rows: FeedSuggestedClubRow[] | undefined;
    isLoading: boolean;
    isError: boolean;
    retry: () => void;
  };
  pendingFollowId: string | null;
  onSeeAllProfiles: () => void;
  onSeeAllClubs: () => void;
  onPressSuggestedProfile: (row: FeedSuggestedProfileRow) => void;
  onPressSuggestedClub: (row: FeedSuggestedClubRow) => void;
  onToggleFollowProfile: (row: FeedSuggestedProfileRow) => void;
  onToggleFollowClub: (row: FeedSuggestedClubRow) => void;
};

export type FeedItemHandlers = {
  onOpenItem: (item: FeedItem) => void;
  onOpenAuthor: (item: FeedItem) => void;
  onToggleSaved: (item: FeedItem) => void;
};

type FeedItemRendererProps = {
  item: FeedItem;
  handlers: FeedItemHandlers;
  modules: FeedModulesState;
};

export function FeedItemRenderer({ item, handlers, modules }: FeedItemRendererProps) {
  switch (item.type) {
    case "post":
      return (
        <PostFeedItem
          item={item}
          onPress={() => handlers.onOpenItem(item)}
          onPressAuthor={() => handlers.onOpenAuthor(item)}
          onToggleSaved={() => handlers.onToggleSaved(item)}
        />
      );

    case "article":
    case "video":
      return (
        <EditorialFeedItem
          item={item}
          onPress={() => handlers.onOpenItem(item)}
          onPressAuthor={() => handlers.onOpenAuthor(item)}
          onToggleSaved={() => handlers.onToggleSaved(item)}
        />
      );

    case "suggested_position":
      return (
        <SuggestedPositionFeedItem item={item} onPress={() => handlers.onOpenItem(item)} />
      );

    case "suggested_profiles":
      return (
        <SuggestedProfilesFeedItem
          isError={modules.profiles.isError}
          isLoading={modules.profiles.isLoading}
          onPressProfile={modules.onPressSuggestedProfile}
          onRetry={modules.profiles.retry}
          onSeeAll={modules.onSeeAllProfiles}
          onToggleFollow={modules.onToggleFollowProfile}
          pendingId={modules.pendingFollowId}
          rows={modules.profiles.rows}
        />
      );

    case "suggested_clubs":
      return (
        <SuggestedClubsFeedItem
          isError={modules.clubs.isError}
          isLoading={modules.clubs.isLoading}
          onPressClub={modules.onPressSuggestedClub}
          onRetry={modules.clubs.retry}
          onSeeAll={modules.onSeeAllClubs}
          onToggleFollow={modules.onToggleFollowClub}
          pendingId={modules.pendingFollowId}
          rows={modules.clubs.rows}
        />
      );

    default: {
      // Tipo non riconosciuto: si degrada in silenzio invece di crashare.
      return null;
    }
  }
}
