/**
 * Dispatcher tipo -> componente (§26: "il client deve renderizzare il
 * componente corretto in base al tipo ricevuto").
 *
 * Qui NON esiste alcuna sequenza: nessun indice, nessuna posizione, nessuna
 * regola di alternanza. L'ordine arriva dal server (HOM-13 §220) e il client non lo
 * rifinisce; questo file sa solo disegnare un elemento alla volta.
 *
 * HOM-13 §225–§226: il renderer segue il tipo della unit con i componenti ESISTENTI —
 * CONTENT → Post/Articolo/Video (HOM-02/03), SIMPLE_REPOST → lo stesso componente
 * dell'originale con la riga del reposter (HOM-10), OPPORTUNITY → la card Posizione
 * (HOM-01.1), SUGGESTED_PROFILES → i moduli suggeriti. Nessun renderer nuovo.
 *
 * Si usa uno `switch` esaustivo e non una mappa a oggetti: la mappa perderebbe
 * il narrowing del payload e ogni componente riceverebbe una union. Il `default`
 * restituisce `null` così un tipo introdotto in futuro dal server degrada a
 * nulla invece di far crashare la Home su un client vecchio.
 */

import { HideableContent } from "../../feed-feedback/components/HideableContent";
import type { ContentManagement } from "../content-management-types";
import type { ContentOrigin } from "../content-routes";
import type {
  FeedContentType,
  FeedEditorialItem,
  FeedItem,
  FeedPostItem,
  FeedSuggestedClubRow,
  FeedSuggestedClubsItem,
  FeedSuggestedProfileRow,
  FeedSuggestedProfilesItem,
} from "../feed-types";
import type { FeedModuleRows } from "../use-feed-suggestions";
import { ArticleFeedPreview } from "./items/ArticleFeedPreview";
import { EditorialVideoFeedItem } from "./items/EditorialVideoFeedItem";
import { PostFeedItem } from "./items/PostFeedItem";
import { SuggestedClubsFeedItem } from "./items/SuggestedClubsFeedItem";
import { SuggestedPositionFeedItem } from "./items/SuggestedPositionFeedItem";
import { SuggestedProfilesFeedItem } from "./items/SuggestedProfilesFeedItem";

export type FeedModulesState = {
  /**
   * HOM-13 §4: le righe di OGNI modulo suggerito, per unit (un `module_index` ciascuno).
   * Funzioni di sola lettura: le query stanno in `useFeedModuleRows`, il renderer non fa fetch.
   */
  profiles: (item: FeedSuggestedProfilesItem) => FeedModuleRows<FeedSuggestedProfileRow>;
  clubs: (item: FeedSuggestedClubsItem) => FeedModuleRows<FeedSuggestedClubRow>;
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
  /** HOM-07 §24: il numero della cella Mi piace apre la lista di chi ha messo Mi piace. */
  onOpenLikes: (item: FeedInteractiveItem) => void;
  /** §35: il media apre il dettaglio contenuto con l’indice selezionato. */
  onOpenMedia: (item: FeedPostItem, index: number) => void;
  /** §19, §22: mention e tag aprono l’identità per id, mai per nome. */
  onOpenIdentity: (item: FeedPostItem, target: FeedIdentityTarget) => void;
  onOpenLink: (item: FeedPostItem) => void;
  onComment: (item: FeedInteractiveItem) => void;
  onShare: (item: FeedInteractiveItem) => void;
  /** HOM-04: azioni di gestione per il menu •••, dalle capability dell'elemento. */
  getManagement?: (item: FeedInteractiveItem) => ContentManagement | undefined;
  /** HOM-10 §111: il tap sulla card dell'originale incorporato in un Post lo apre. */
  onOpenReference?: (reference: { contentType: FeedContentType; contentId: string }) => void;
  /**
   * HOM-11 §29–§36: l'origin delle liste in cui «Non mi interessa» esiste (Per te, D2).
   * Dove è presente, un contenuto nascosto lascia il posto al segnaposto compatto, nella
   * stessa posizione. Assente (Seguiti) = i contenuti non si sostituiscono mai (§26).
   */
  hideOrigin?: ContentOrigin | null;
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
        <HideableContent item={item} origin={handlers.hideOrigin ?? null}>
          <PostFeedItem
            item={item}
            management={handlers.getManagement?.(item)}
            onPress={() => handlers.onOpenItem(item)}
            onPressAuthor={() => handlers.onOpenAuthor(item)}
            onToggleSaved={() => handlers.onToggleSaved(item)}
            onToggleLike={() => handlers.onToggleLike(item)}
            onOpenLikes={() => handlers.onOpenLikes(item)}
            onOpenMedia={(index) => handlers.onOpenMedia(item, index)}
            onOpenIdentity={(target) => handlers.onOpenIdentity(item, target)}
            onOpenLink={() => handlers.onOpenLink(item)}
            onOpenReference={handlers.onOpenReference}
            onComment={() => handlers.onComment(item)}
            onShare={() => handlers.onShare(item)}
          />
        </HideableContent>
      );

    // HOM-03 §39, §96: un solo Articolo nel Feed, e il video editoriale come
    // Post con una gerarchia in più. Nessun componente per variante.
    case "article":
      return (
        <HideableContent item={item} origin={handlers.hideOrigin ?? null}>
          <ArticleFeedPreview
            item={item}
            management={handlers.getManagement?.(item)}
            onComment={() => handlers.onComment(item)}
            onOpenLikes={() => handlers.onOpenLikes(item)}
            onPress={() => handlers.onOpenItem(item)}
            onPressAuthor={() => handlers.onOpenAuthor(item)}
            onShare={() => handlers.onShare(item)}
            onToggleLike={() => handlers.onToggleLike(item)}
            onToggleSaved={() => handlers.onToggleSaved(item)}
          />
        </HideableContent>
      );

    case "video":
      return (
        <HideableContent item={item} origin={handlers.hideOrigin ?? null}>
          <EditorialVideoFeedItem
            item={item}
            management={handlers.getManagement?.(item)}
            onComment={() => handlers.onComment(item)}
            onOpenLikes={() => handlers.onOpenLikes(item)}
            onPress={() => handlers.onOpenItem(item)}
            onPressAuthor={() => handlers.onOpenAuthor(item)}
            onShare={() => handlers.onShare(item)}
            onToggleLike={() => handlers.onToggleLike(item)}
            onToggleSaved={() => handlers.onToggleSaved(item)}
          />
        </HideableContent>
      );

    case "suggested_position":
      return (
        <SuggestedPositionFeedItem item={item} onPress={() => handlers.onOpenItem(item)} />
      );

    case "suggested_profiles": {
      const state = modules.profiles(item);
      return (
        <SuggestedProfilesFeedItem
          isError={state.isError}
          isLoading={state.isLoading}
          onPressProfile={modules.onPressSuggestedProfile}
          onSeeAll={modules.onSeeAllProfiles}
          onToggleFollow={modules.onToggleFollowProfile}
          pendingId={modules.pendingFollowId}
          rows={state.rows}
        />
      );
    }

    // HOM-13: il carosello Società è un'unit SUGGESTED_PROFILES con `item_type`
    // `suggested_clubs` (§222): stesso componente di sempre, riempito dalla stessa RPC.
    case "suggested_clubs": {
      const state = modules.clubs(item);
      return (
        <SuggestedClubsFeedItem
          isError={state.isError}
          isLoading={state.isLoading}
          onPressClub={modules.onPressSuggestedClub}
          onSeeAll={modules.onSeeAllClubs}
          onToggleFollow={modules.onToggleFollowClub}
          pendingId={modules.pendingFollowId}
          rows={state.rows}
        />
      );
    }

    default: {
      // Tipo non riconosciuto: si degrada in silenzio invece di crashare.
      return null;
    }
  }
}
