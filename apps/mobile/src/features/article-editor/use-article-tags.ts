/**
 * Tagga persone o società nell'Articolo (HOM-06.2 §56–§58): il selettore è QUELLO
 * di HOM-06.1 (`TagPeopleSheet`) e la ricerca è `searchTagCandidates`; qui solo lo
 * stato del foglio. La selezione è una bozza locale finché non si preme «Fine»
 * (§104–§106 di HOM-06.1), poi diventa `tagged` dell'articolo nello store, come
 * riferimenti a identity e non stringhe (§58).
 */

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { composerKeys } from "../post-composer/composer-keys";
import { searchTagCandidates } from "../post-composer/composer-service";
import type { ComposerTaggedIdentity } from "../post-composer/composer-types";
import { articleStore } from "./article-store";
import { useArticleStoreState } from "./use-article-store";

const SEARCH_DEBOUNCE_MS = 300;
/** Stessa soglia di `searchTagTargets`: sotto i 2 caratteri non si cerca. */
const MIN_SEARCH_LENGTH = 2;
export const ARTICLE_TAG_SEARCH_ERROR_COPY = "Ricerca non disponibile. Riprova.";

function tagKey(identity: Pick<ComposerTaggedIdentity, "identityType" | "identityId">): string {
  return `${identity.identityType}:${identity.identityId}`;
}

/** La ricerca segue la digitazione con un ritardo (stesso comportamento del composer Post). */
function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export function useArticleTags(userId: string) {
  const state = useArticleStoreState();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<ComposerTaggedIdentity[]>([]);
  // Con la ricerca vuota i già taggati sono la lista: si possono togliere e rimettere (§108).
  const [initial, setInitial] = useState<ComposerTaggedIdentity[]>([]);

  const text = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const enabled = open && text.trim().length >= MIN_SEARCH_LENGTH;

  const search = useQuery({
    enabled,
    queryFn: () => searchTagCandidates(text),
    queryKey: composerKeys.tagSearch(userId, text),
    staleTime: 60_000,
  });

  const maxTags = state.limits.maxTags;

  function openSheet() {
    const tagged = articleStore.getState().tagged;
    setDraft(tagged);
    setInitial(tagged);
    setQuery("");
    setOpen(true);
  }

  function toggle(identity: ComposerTaggedIdentity) {
    const key = tagKey(identity);
    if (draft.some((candidate) => tagKey(candidate) === key)) {
      setDraft(draft.filter((candidate) => tagKey(candidate) !== key));
    } else if (draft.length < maxTags) {
      setDraft([...draft, identity]);
    }
  }

  function confirm() {
    articleStore.dispatch({ tagged: draft, type: "taggedChanged" });
    setOpen(false);
  }

  return {
    close: () => setOpen(false),
    confirm,
    openSheet,
    sheet: {
      errorMessage: search.isError ? ARTICLE_TAG_SEARCH_ERROR_COPY : null,
      isSelected: (identity: ComposerTaggedIdentity) =>
        draft.some((candidate) => candidate.identityType === identity.identityType && candidate.identityId === identity.identityId),
      limitReached: draft.length >= maxTags,
      loading: enabled && (search.isFetching || query !== text),
      onClose: () => setOpen(false),
      onDone: confirm,
      onQueryChange: setQuery,
      onToggle: toggle,
      query,
      results: enabled ? (search.data ?? []) : query.trim().length === 0 ? initial : [],
      selectedCount: draft.length,
      visible: open,
    },
    tagged: state.tagged,
  };
}

export type ArticleTags = ReturnType<typeof useArticleTags>;
