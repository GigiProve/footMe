/**
 * §E — l'editor è raggiungibile solo dal proprietario di un profilo Calciatore.
 *
 * La protezione non è soltanto visuale:
 *  - le rotte non hanno un parametro `id`, quindi si può aprire unicamente il
 *    proprio profilo: l'id arriva dalla sessione, non dalla navigazione;
 *  - le scritture passano da `updateCompleteProfessionalProfile`, sotto RLS
 *    `is_current_user`, quindi il backend rifiuta comunque un profilo altrui;
 *  - questo hook aggiunge il terzo strato: chi non è un Calciatore viene
 *    riportato indietro invece di vedere un editor vuoto.
 */
import { useEffect } from "react";
import { router } from "expo-router";

import { useSession } from "../../auth/use-session";

export function usePlayerEditorGuard(): { userId: string | null } {
  const { profile, session } = useSession();
  const userId = session?.user.id ?? null;
  const role = profile?.role ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }

    if (role && role !== "player") {
      router.replace("/(tabs)/profile");
    }
  }, [role, session]);

  return { userId: role === "player" || role === null ? userId : null };
}
