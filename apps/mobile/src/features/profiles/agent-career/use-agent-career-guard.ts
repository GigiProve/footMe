/**
 * La gestione carriera è raggiungibile solo dal proprietario di un profilo
 * Procuratore. Stessa protezione a tre strati degli altri editor:
 *  - la rotta non ha un parametro `id`, quindi l'id arriva dalla sessione;
 *  - le scritture passano sotto RLS `is_current_user` e sotto RPC che
 *    rifiutano un profilo altrui, quindi il backend non si fida del client;
 *  - questo hook riporta indietro chi non è un Procuratore, invece di
 *    mostrargli un modulo vuoto.
 */
import { useEffect } from "react";
import { router } from "expo-router";

import { useSession } from "../../auth/use-session";

export function useAgentCareerGuard(): { userId: string | null } {
  const { profile, session } = useSession();
  const userId = session?.user.id ?? null;
  const role = profile?.role ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }

    if (role && role !== "agent") {
      router.replace("/(tabs)/profile");
    }
  }, [role, session]);

  return { userId: role === "agent" || role === null ? userId : null };
}
