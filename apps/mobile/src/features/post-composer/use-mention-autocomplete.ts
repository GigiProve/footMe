/**
 * Autocomplete delle mention `@`, condiviso da composer Post e composer Commenti
 * (HOM-06.1 §110–§113; HOM-08 §102–§104: «riutilizzare identity search, non creare
 * un search engine specifico Commenti»).
 *
 * Estratto da `usePostComposer` senza cambiare comportamento: possiede la
 * selezione del cursore, riconosce il token `@parola` sotto il cursore
 * (`mentionQueryAt`), lo debounce e chiede i candidati a `searchTagCandidates`
 * (RPC `search_tag_targets`, soglia 2 caratteri). L'inserimento del token e
 * dell'intervallo resta del chiamante (`applyMention` dentro il suo reducer o
 * dentro il suo stato), perché cambia lo stato che lo possiede.
 */

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { composerKeys } from "./composer-keys";
import { mentionQueryAt } from "./composer-presentation";
import { searchTagCandidates } from "./composer-service";
import type { ComposerMention, ComposerMentionQuery, ComposerTaggedIdentity } from "./composer-types";

/** Tempo in ms: la ricerca segue la digitazione. */
export const SEARCH_DEBOUNCE_MS = 300;

/** Stessa soglia di `searchTagTargets` (§101): sotto i 2 caratteri non si cerca. */
export const MIN_SEARCH_LENGTH = 2;

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

export type MentionSelection = { start: number; end: number };

export type MentionAutocomplete = {
  /** Cursore corrente: il chiamante lo usa per trovare il token da sostituire. */
  selection: MentionSelection;
  setSelection: (selection: MentionSelection) => void;
  /** Il token `@parola` sotto il cursore, o `null`. */
  query: ComposerMentionQuery | null;
  candidates: ComposerTaggedIdentity[];
  loading: boolean;
};

export function useMentionAutocomplete({
  body,
  mentions,
  userId,
}: {
  body: string;
  mentions: readonly ComposerMention[];
  userId: string;
}): MentionAutocomplete {
  const [selection, setSelection] = useState<MentionSelection>({ end: 0, start: 0 });

  const query = selection.start === selection.end ? mentionQueryAt(body, selection.end, mentions) : null;
  const text = useDebouncedValue(query?.query ?? "", SEARCH_DEBOUNCE_MS);
  const enabled = query !== null && text.trim().length >= MIN_SEARCH_LENGTH;

  const search = useQuery({
    enabled,
    queryFn: () => searchTagCandidates(text),
    queryKey: composerKeys.tagSearch(userId, text),
    staleTime: 60_000,
  });

  const candidates = enabled ? (search.data ?? []) : [];
  const loading =
    query !== null && query.query.trim().length >= MIN_SEARCH_LENGTH
      ? search.isFetching || query.query !== text
      : false;

  return { candidates, loading, query, selection, setSelection };
}
