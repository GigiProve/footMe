/**
 * La gestione carriera è raggiungibile solo dal proprietario di un profilo
 * Dirigente. Stessa protezione a tre strati degli editor Allenatore e Staff:
 *  - la rotta non ha un parametro `id`, quindi l'id arriva dalla sessione;
 *  - le scritture passano sotto RLS `is_current_user`, quindi il backend
 *    rifiuta comunque un profilo altrui;
 *  - questo hook riporta indietro chi non è un Dirigente, invece di mostrargli
 *    un modulo vuoto.
 */
import { useEffect } from "react";
import { router } from "expo-router";

import { useSession } from "../../auth/use-session";

export function useDirectorCareerGuard(): { userId: string | null } {
  const { profile, session } = useSession();
  const userId = session?.user.id ?? null;
  const role = profile?.role ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }

    if (role && role !== "director") {
      router.replace("/(tabs)/profile");
    }
  }, [role, session]);

  return { userId: role === "director" || role === null ? userId : null };
}
