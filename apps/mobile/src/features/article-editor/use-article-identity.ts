/**
 * Selezione dell'identity che pubblica (HOM-06.2 §16–§27), condivisa da editor,
 * «Collega da un link» e «Incolla un articolo».
 *
 *  • il selector compare solo se c'è davvero una scelta (§17–§18) e solo per un
 *    articolo non ancora programmato o pubblicato: un programmato non cambia
 *    identity senza tornare in bozza, un pubblicato ha un autore fisso;
 *  • il foglio «Pubblica come» mostra solo le identity che usano la modalità
 *    corrente (§7B, §20);
 *  • il cambio non tocca il contenuto (§24); dopo il cambio si rilegge il
 *    contesto dal server, che è l'autorità sulle capability (§25).
 */

import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { ComposerIdentity } from "../post-composer/composer-types";
import { articleKeys } from "./article-keys";
import { identitiesForMode } from "./article-presentation";
import { fetchArticleComposerContext } from "./article-service";
import { articleStore, currentIdentity } from "./article-store";
import { trackArticle } from "./article-analytics";
import { useArticleStoreState } from "./use-article-store";

/** Senza rete si resta sull'ultima lista nota: il server rivaluta comunque all'invio (§30). */
export async function refreshArticleContext(queryClient: QueryClient, userId: string): Promise<void> {
  try {
    const context = await queryClient.fetchQuery({
      gcTime: 0,
      queryFn: fetchArticleComposerContext,
      queryKey: articleKeys.context(userId),
      staleTime: 0,
    });
    articleStore.dispatch({
      identities: context.identities,
      limits: context.limits,
      schedulePolicy: context.schedule,
      type: "contextRefreshed",
    });
  } catch {
    // vedi sopra
  }
}

export function useArticleIdentityPicker(userId: string) {
  const queryClient = useQueryClient();
  const state = useArticleStoreState();
  const [open, setOpen] = useState(false);

  const identity = currentIdentity(state);
  const options = identitiesForMode(state.identities, state.mode);
  // §171 di HOM-06.1: dopo una revoca la lista può contenere solo un'altra identity, e il selector serve per passarci.
  const hasChoice = options.length > 1 || (options.length === 1 && options[0].id !== state.identityId);
  const selectable = hasChoice && state.session?.editing === null && state.publish.status === "idle";

  function select(next: ComposerIdentity) {
    const previous = currentIdentity(articleStore.getState());
    articleStore.dispatch({ identityId: next.id, type: "identityChanged" });
    const after = currentIdentity(articleStore.getState());
    if (previous && after && previous.id !== after.id) {
      trackArticle({ from: previous.type, name: "article_identity_changed", to: after.type });
    }
    setOpen(false);
    void refreshArticleContext(queryClient, userId);
  }

  return {
    close: () => setOpen(false),
    identity,
    open,
    openSheet: () => setOpen(true),
    options,
    select,
    selectable,
  };
}

export type ArticleIdentityPicker = ReturnType<typeof useArticleIdentityPicker>;
