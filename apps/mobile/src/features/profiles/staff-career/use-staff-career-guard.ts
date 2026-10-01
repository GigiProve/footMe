/**
 * La gestione carriera è raggiungibile solo dal proprietario di un profilo
 * Staff tecnico. Stessa protezione a tre strati dell'editor Allenatore:
 *  - la rotta non ha un parametro `id`, quindi l'id arriva dalla sessione;
 *  - le scritture passano sotto RLS `is_current_user`, quindi il backend
 *    rifiuta comunque un profilo altrui;
 *  - questo hook riporta indietro chi non è dello Staff tecnico, invece di
 *    mostrargli un modulo vuoto.
 */
import { useEffect } from "react";
import { router } from "expo-router";

import { useSession } from "../../auth/use-session";

export function useStaffCareerGuard(): { userId: string | null } {
  const { profile, session } = useSession();
  const userId = session?.user.id ?? null;
  const role = profile?.role ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }

    if (role && role !== "staff") {
      router.replace("/(tabs)/profile");
    }
  }, [role, session]);

  return { userId: role === "staff" || role === null ? userId : null };
}
