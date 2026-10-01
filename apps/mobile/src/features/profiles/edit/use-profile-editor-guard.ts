/**
 * Protezione delle rotte "Modifica profilo" (REV-PROF-05, REV-PROF-08
 * §"Sicurezza delle route").
 *
 * Tre strati, uno solo dei quali vive qui:
 *  - le rotte non hanno un parametro `id`, quindi l'id arriva dalla sessione e
 *    non dalla navigazione: non si può aprire l'editor di un altro profilo;
 *  - le scritture passano sotto RLS `is_current_user`, quindi il backend
 *    rifiuta comunque un profilo altrui;
 *  - questo hook riporta indietro chi non ha il ruolo atteso, invece di
 *    mostrargli un hub vuoto.
 *
 * Il ruolo ancora sconosciuto (sessione in caricamento) non è un ruolo
 * sbagliato: si aspetta, non si rimbalza.
 */
import { useEffect } from "react";
import { router } from "expo-router";

import { useSession } from "../../auth/use-session";

export function useProfileEditorGuard(expectedRole: string): {
  userId: string | null;
} {
  const { profile, session } = useSession();
  const userId = session?.user.id ?? null;
  const role = profile?.role ?? null;

  useEffect(() => {
    if (!session) {
      return;
    }

    if (role && role !== expectedRole) {
      router.replace("/(tabs)/profile");
    }
  }, [expectedRole, role, session]);

  return { userId: role === expectedRole || role === null ? userId : null };
}
