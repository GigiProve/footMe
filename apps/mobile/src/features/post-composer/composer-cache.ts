/**
 * Cache dopo pubblicazione e modifica di un Post (HOM-06.1 §131–133, §162, §165).
 *
 * Stesso schema di `features/feed/content-lifecycle-cache.ts` (HOM-04): funzioni
 * pure sulle pagine già caricate, nessun refetch che sposti scroll o tab (§123,
 * §127), poi invalidazione per prefisso delle superfici che mostrano il contenuto
 * fuori dal Feed.
 *
 *  • Pubblicazione: nessuna riga ottimistica. Il Post nuovo è identificato dal
 *    `content_id` del server (§132), quindi quando il Feed lo restituisce non c'è
 *    nulla da riconciliare e non può comparire due volte (§133). Le query del
 *    Feed si marcano stale SENZA refetch (`refetchType: "none"`): si aggiornano
 *    alla prossima lettura/refresh, la Home aperta non salta. Il proprietario lo
 *    trova subito dal profilo e da «Visualizza» (§131): il dettaglio legge dal
 *    server.
 *  • Modifica: si PATCHA il Post già in cache (testo, mention, tag, anteprima,
 *    versione) in entrambe le tab e nel dettaglio, così la Home mostra il testo
 *    nuovo senza ricaricare. Il `content_id` non cambia, quindi le statistiche
 *    HOM-05 restano (§165): le chiavi insights NON si invalidano.
 */

import type { InfiniteData, QueryClient } from "@tanstack/react-query";

import { INSIGHTS_ROOT_KEY } from "../content-insights/insights-keys";
import { CONTENT_DELETE_INVALIDATIONS } from "../feed/content-lifecycle-cache";
import { FEED_QK } from "../feed/feed-keys";
import type {
  FeedItem,
  FeedLinkPreview,
  FeedMention,
  FeedPage,
  FeedPageParam,
  FeedPostItem,
  FeedScope,
  FeedTaggedIdentity,
} from "../feed/feed-types";
import { firstEligibleUrl, isUrlDismissed } from "./composer-presentation";
import type { ComposerState } from "./composer-reducer";

type FeedData = InfiniteData<FeedPage, FeedPageParam>;

const SCOPES: readonly FeedScope[] = ["per_te", "seguiti"];

/**
 * Salvati, contenuti taggati nel Profilo e Cerca → Media (stesso elenco della
 * cancellazione HOM-04), senza le statistiche: un Post nuovo non ne ha, uno
 * modificato conserva le sue (§165).
 */
export const POST_CHANGE_INVALIDATIONS: readonly (readonly string[])[] = CONTENT_DELETE_INVALIDATIONS.filter(
  (queryKey) => queryKey[0] !== INSIGHTS_ROOT_KEY,
);

/** Ciò che una modifica cambia sul Post nel Feed (§155). */
export type PostEditPatch = {
  body: string;
  mentions: FeedMention[];
  tagged: FeedTaggedIdentity[];
  linkPreview: FeedLinkPreview | null;
  version: string;
};

/** Lo stato del composer a salvataggio riuscito → ciò che il Feed deve mostrare. */
export function editPatchFromState(state: ComposerState, version: string): PostEditPatch {
  const body = state.body.trimEnd();
  const link = state.link;
  const first = firstEligibleUrl(body);
  // L'anteprima che resta sul Post: pronta, sull'URL del testo, non rimossa. Può
  // essere quella già salvata (snapshot `null` nel payload, il server la conserva).
  const kept =
    link.status === "ready" && first !== null && link.url === first.normalized && !isUrlDismissed(state, first.normalized);

  return {
    body,
    // §95: con media il server non conserva l'anteprima visuale; il Feed non deve mostrarne una.
    linkPreview:
      kept && link.status === "ready" && state.media.length === 0
        ? {
            description: link.description,
            domain: link.domain,
            thumbnailUrl: link.imageUrl,
            title: link.title,
            url: link.finalUrl,
          }
        : null,
    mentions: state.mentions.map((mention) => ({
      displayName: mention.displayName,
      end: mention.end,
      identityId: mention.identityId,
      identityType: mention.identityType,
      start: mention.start,
    })),
    tagged: state.tagged.map((identity) => ({
      avatarUrl: identity.avatarUrl,
      displayName: identity.displayName,
      identityId: identity.identityId,
      identityType: identity.identityType,
    })),
    version,
  };
}

/** Un Post con la modifica applicata; gli altri campi (conteggi, media, capability) restano. */
export function applyPostEdit(item: FeedPostItem, patch: PostEditPatch): FeedPostItem {
  return {
    ...item,
    payload: {
      ...item.payload,
      body: patch.body,
      linkPreview: patch.linkPreview,
      mentions: patch.mentions,
      tagged: patch.tagged,
      version: patch.version,
    },
  };
}

/** Patcha UN Post in tutte le pagine caricate. Stessa identità se non c'è. */
export function patchPostAfterEdit(
  data: FeedData | undefined,
  itemId: string,
  patch: PostEditPatch,
): FeedData | undefined {
  if (!data || !data.pages.some((page) => page.items.some((item) => item.id === itemId))) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item): FeedItem =>
        item.id === itemId && item.type === "post" ? applyPostEdit(item, patch) : item,
      ),
    })),
  };
}

/** §131–133: stale senza refetch (vedi testata), più le superfici fuori dal Feed. */
export function applyPublishToCaches(queryClient: QueryClient, input: { profileId: string }): void {
  for (const scope of SCOPES) {
    void queryClient.invalidateQueries({
      queryKey: FEED_QK.feed(scope, input.profileId),
      refetchType: "none",
    });
  }

  for (const queryKey of POST_CHANGE_INVALIDATIONS) {
    void queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
}

/** §162: Feed (entrambe le tab), dettaglio, Salvati/Profilo/Cerca. Il `content_id` non cambia (§165). */
export function applyEditToCaches(
  queryClient: QueryClient,
  input: { profileId: string; itemId: string; contentId: string; patch: PostEditPatch },
): void {
  for (const scope of SCOPES) {
    queryClient.setQueryData<FeedData>(FEED_QK.feed(scope, input.profileId), (data) =>
      patchPostAfterEdit(data, input.itemId, input.patch),
    );
  }

  queryClient.setQueryData<FeedPostItem | null>(FEED_QK.postDetail(input.contentId), (detail) =>
    detail && detail.id === input.itemId ? applyPostEdit(detail, input.patch) : detail,
  );
  void queryClient.invalidateQueries({ queryKey: FEED_QK.postDetail(input.contentId) });

  for (const queryKey of POST_CHANGE_INVALIDATIONS) {
    void queryClient.invalidateQueries({ queryKey: [...queryKey] });
  }
}
