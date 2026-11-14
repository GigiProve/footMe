import { useEffect } from "react";
import { useQueries } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { SAVED_QK } from "./saved-keys";
import { fetchSavedProfileIds } from "./saved-service";
import {
  getSavedEntry,
  resolveSaved,
  savedKey,
  seedSaved,
  useSavedStoreVersion,
} from "./saved-store";
import { useSetSaved } from "./use-set-saved";

/**
 * HOM-07 §130–§131, §134: i flag di Cerca > Profili sono il SEME dello store
 * normalizzato, non uno stato a parte. Una query per pagina di id (i risultati
 * si fondono man mano, senza un refetch gigante); lo stato mostrato è quello
 * dello store, quindi un salvataggio fatto altrove — dal profilo, dal Saved
 * Center — compare qui senza ricaricare la lista.
 */
export function useSavedProfileFlags(pageIds: string[][]) {
  const { profile } = useSession();
  const ownerId = profile?.id ?? null;

  const results = useQueries({
    queries: pageIds.map((ids) => ({
      enabled: !!ownerId && ids.length > 0,
      // HOM-07 §141: l'istante prima della richiesta accompagna i flag.
      queryFn: async () => {
        const fetchedAt = Date.now();
        return { fetchedAt, ids: await fetchSavedProfileIds(ownerId as string, ids) };
      },
      queryKey: SAVED_QK.profileFlags(ownerId, ids),
    })),
  });

  // Il contenuto dello store entra nel rendering: un toggle altrove ricalcola l'insieme.
  useSavedStoreVersion();

  const seeds = new Map<string, { value: boolean; at: number }>();
  pageIds.forEach((ids, index) => {
    const data = results[index]?.data;
    if (data) {
      for (const id of ids) {
        seeds.set(id, { at: data.fetchedAt, value: data.ids.has(id) });
      }
    }
  });

  useEffect(() => {
    for (const [id, seed] of seeds) {
      seedSaved(savedKey({ id, type: "profile" }), seed.value, seed.at);
    }
  });

  const savedIds = new Set<string>();
  for (const ids of pageIds) {
    for (const id of ids) {
      const entry = getSavedEntry(savedKey({ id, type: "profile" }));
      const seed = seeds.get(id);
      if (resolveSaved(entry, seed?.value, seed?.at ?? 0)) {
        savedIds.add(id);
      }
    }
  }

  return { savedIds };
}

type ToggleSavedProfileInput = {
  targetId: string;
  /** Lo stato mostrato adesso: il tap lo inverte. */
  saved: boolean;
};

/**
 * Salva/rimuove un profilo dalle liste di Cerca. Passa dalla mutation unica
 * `useSetSaved` (§133): ottimistica con rollback, nessuna invalidazione della
 * lista di ricerca, che non dipende dallo stato salvato.
 */
export function useToggleSavedProfile() {
  const setSaved = useSetSaved();

  return {
    isPending: setSaved.isPending,
    mutate: ({ targetId, saved }: ToggleSavedProfileInput) =>
      setSaved.mutate({
        saved: !saved,
        surface: "search",
        target: { id: targetId, type: "profile" },
      }),
  };
}
