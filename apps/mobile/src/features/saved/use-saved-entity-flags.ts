import { useEffect } from "react";
import { useQueries } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { SAVED_QK } from "./saved-keys";
import { fetchSavedClubIds, fetchSavedTeamIds } from "./saved-service";
import {
  getSavedEntry,
  resolveSaved,
  savedKey,
  seedSaved,
  useSavedStoreVersion,
} from "./saved-store";
import type { SavedTarget } from "./saved-types";
import { useSetSaved } from "./use-set-saved";

export type SavedEntityKind = "club" | "team";

function fetchSavedIds(
  entity: SavedEntityKind,
  ownerId: string,
  targetIds: string[],
): Promise<Set<string>> {
  return entity === "club"
    ? fetchSavedClubIds(ownerId, targetIds)
    : fetchSavedTeamIds(ownerId, targetIds);
}

/** `club` della ricerca = target `society` del dominio Salvati (§80, §132). */
function entityTarget(entity: SavedEntityKind, id: string): SavedTarget {
  return entity === "club" ? { id, type: "society" } : { id, type: "team" };
}

/**
 * HOM-07 §132, §134: i flag di Cerca > Società seminano lo store normalizzato
 * (una query per pagina di id, come `useSavedProfileFlags`); lo stato mostrato
 * è quello dello store. Le squadre salvate vivono dentro Società (§82), ma
 * restano un target proprio in scrittura.
 */
export function useSavedEntityFlags(entity: SavedEntityKind, pageIds: string[][]) {
  const { profile } = useSession();
  const ownerId = profile?.id ?? null;

  const results = useQueries({
    queries: pageIds.map((ids) => ({
      enabled: !!ownerId && ids.length > 0,
      // HOM-07 §141: l'istante prima della richiesta accompagna i flag.
      queryFn: async () => {
        const fetchedAt = Date.now();
        return { fetchedAt, ids: await fetchSavedIds(entity, ownerId as string, ids) };
      },
      queryKey: SAVED_QK.entityFlags(entity, ownerId, ids),
    })),
  });

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
      seedSaved(savedKey(entityTarget(entity, id)), seed.value, seed.at);
    }
  });

  const savedIds = new Set<string>();
  for (const ids of pageIds) {
    for (const id of ids) {
      const entry = getSavedEntry(savedKey(entityTarget(entity, id)));
      const seed = seeds.get(id);
      if (resolveSaved(entry, seed?.value, seed?.at ?? 0)) {
        savedIds.add(id);
      }
    }
  }

  return { savedIds };
}

type ToggleSavedEntityInput = {
  targetId: string;
  /** Lo stato mostrato adesso: il tap lo inverte. */
  saved: boolean;
};

/**
 * Salva/rimuove una Società o una Squadra dalle liste di Cerca, dalla mutation
 * unica `useSetSaved`. Non invalida `["search-clubs"]`: la lista di ricerca non
 * dipende dallo stato salvato.
 */
export function useToggleSavedEntity(entity: SavedEntityKind) {
  const setSaved = useSetSaved();

  return {
    isPending: setSaved.isPending,
    mutate: ({ targetId, saved }: ToggleSavedEntityInput) =>
      setSaved.mutate({
        saved: !saved,
        surface: "search",
        target: entityTarget(entity, targetId),
      }),
  };
}
