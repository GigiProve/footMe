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

import type { ContentManagement } from "../content-management-types";
import type {
  FeedEditorialItem,
  FeedItem,
  FeedPostItem,
  FeedSuggestedClubRow,
  FeedSuggestedProfileRow,
} from "../feed-types";
import { ArticleFeedPreview } from "./items/ArticleFeedPreview";
import { EditorialVideoFeedItem } from "./items/EditorialVideoFeedItem";
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

export type FeedIdentityTarget = {
  identityType: "profile" | "club" | "team";
  identityId: string;
};

/**
 * HOM-03 §52, §104: Mi piace, Commenta e Condividi sono la stessa riga per il
 * Post e per gli elementi editoriali: stessi handler, stessa entity.
 */
export type FeedInteractiveItem = FeedPostItem | FeedEditorialItem;

export type FeedItemHandlers = {
  onOpenItem: (item: FeedItem) => void;
  onOpenAuthor: (item: FeedItem) => void;
  onToggleSaved: (item: FeedItem) => void;
  // HOM-02: i punti d’ingresso del Post. Navigazione, scrittura e analytics
  // stanno in FeedPane; il componente chiama e basta.
  onToggleLike: (item: FeedInteractiveItem) => void;
  /** §35: il media apre il dettaglio contenuto con l’indice selezionato. */
  onOpenMedia: (item: FeedPostItem, index: number) => void;
  /** §19, §22: mention e tag aprono l’identità per id, mai per nome. */
  onOpenIdentity: (item: FeedPostItem, target: FeedIdentityTarget) => void;
  onOpenLink: (item: FeedPostItem) => void;
  onComment: (item: FeedInteractiveItem) => void;
  onShare: (item: FeedInteractiveItem) => void;
  /** HOM-04: azioni di gestione per il menu •••, dalle capability dell'elemento. */
  getManagement?: (item: FeedInteractiveItem) => ContentManagement | undefined;
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
          management={handlers.getManagement?.(item)}
          onPress={() => handlers.onOpenItem(item)}
          onPressAuthor={() => handlers.onOpenAuthor(item)}
          onToggleSaved={() => handlers.onToggleSaved(item)}
          onToggleLike={() => handlers.onToggleLike(item)}
          onOpenMedia={(index) => handlers.onOpenMedia(item, index)}
          onOpenIdentity={(target) => handlers.onOpenIdentity(item, target)}
          onOpenLink={() => handlers.onOpenLink(item)}
          onComment={() => handlers.onComment(item)}
          onShare={() => handlers.onShare(item)}
        />
      );

    // HOM-03 §39, §96: un solo Articolo nel Feed, e il video editoriale come
    // Post con una gerarchia in più. Nessun componente per variante.
    case "article":
      return (
        <ArticleFeedPreview
          item={item}
          management={handlers.getManagement?.(item)}
          onComment={() => handlers.onComment(item)}
          onPress={() => handlers.onOpenItem(item)}
          onPressAuthor={() => handlers.onOpenAuthor(item)}
          onShare={() => handlers.onShare(item)}
          onToggleLike={() => handlers.onToggleLike(item)}
          onToggleSaved={() => handlers.onToggleSaved(item)}
        />
      );

    case "video":
      return (
        <EditorialVideoFeedItem
          item={item}
          management={handlers.getManagement?.(item)}
          onComment={() => handlers.onComment(item)}
          onPress={() => handlers.onOpenItem(item)}
          onPressAuthor={() => handlers.onOpenAuthor(item)}
          onShare={() => handlers.onShare(item)}
          onToggleLike={() => handlers.onToggleLike(item)}
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
