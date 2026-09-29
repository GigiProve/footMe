/**
 * REV-PROF-05 — l'editor è raggiungibile solo dal proprietario di un profilo
 * Allenatore.
 *
 * Stessa protezione a tre strati già adottata per il Calciatore e per la
 * gestione carriera:
 *  - le rotte non hanno un parametro `id`, quindi l'id arriva dalla sessione e
 *    non dalla navigazione: non si può aprire l'editor di un altro profilo;
 *  - le scritture passano sotto RLS `is_current_user`, quindi il backend
 *    rifiuta comunque un profilo altrui;
 *  - questo hook riporta indietro chi non è un Allenatore, invece di
 *    mostrargli un hub vuoto.
 */
import { useEffect } from "react";
import { router } from "expo-router";

import { useSession } from "../../auth/use-session";

export function useCoachEditorGuard(): { userId: string | null } {
  const { profile, session } = useSession();
  const userId = session?.user.id ?? null;
  const role = profile?.role ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }

    if (role && role !== "coach") {
      router.replace("/(tabs)/profile");
    }
  }, [role, session]);

  return { userId: role === "coach" || role === null ? userId : null };
}
