/**
 * Lo stato Repost di un contenuto per il viewer (HOM-10 §2, §32–§44, §120–§123,
 * §236–§240, §289).
 *
 * Una query per contenuto e per profilo (`repost-keys.ts`). Serve al pannello
 * Condividi per decidere se mostrare «Repost» o «Repost ✓». `staleTime: 0` +
 * `refetchOnMount: "always"`: ogni apertura del pannello rilegge, così un Repost
 * fatto o rimosso da un altro device converge senza ricaricare il Feed (§236–§238,
 * §289) — mentre la cache, patchata dalle azioni, mostra subito il valore giusto.
 *
 * Un errore non rompe il pannello: senza stato la riga non c'è (§296), e
 * «Invia su PROLINK», «Copia link» e «Condividi tramite…» restano (§81 di HOM-09).
 */

import { useQuery } from "@tanstack/react-query";

import { useSession } from "../auth/use-session";
import { REPOST_QK } from "./repost-keys";
import { fetchRepostState } from "./repost-service";
import type { RepostContentRef } from "./repost-types";

export function useRepostState(ref: RepostContentRef | null) {
  const { profile } = useSession();
  const profileId = profile?.id ?? "";

  return useQuery({
    enabled: profileId.length > 0 && ref !== null,
    queryFn: () => fetchRepostState(ref as RepostContentRef),
    queryKey: ref ? REPOST_QK.state(profileId, ref.contentType, ref.contentId) : [...REPOST_QK.root, "none"],
    refetchOnMount: "always",
    staleTime: 0,
  });
}
