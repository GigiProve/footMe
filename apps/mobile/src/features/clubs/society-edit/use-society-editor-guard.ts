/**
 * Accesso all'editor Società (REV-PROF-18 §"Accesso e permessi").
 *
 * Tre strati, uno solo dei quali vive qui:
 *
 *  - `fetch_society_profile_editor` è owner-only e risponde `null` a chi non
 *    può gestire la Società: non esiste una versione svuotata della pagina da
 *    nascondere lato client;
 *  - la policy di UPDATE di `clubs` passa da `can_manage_society`, quindi il
 *    database rifiuta comunque ogni scrittura altrui, deep link compreso;
 *  - questo hook riporta indietro chi arriva senza un club da gestire,
 *    invece di mostrargli un hub vuoto.
 *
 * Il club non arriva solo dalla sessione: un amministratore delegato non è
 * `club_admin` e non ha `club_id` in sessione, quindi apre l'editor dalla
 * rotta pubblica della Società passando l'id. Chi non ha il permesso non ci
 * fa niente lo stesso — la RPC risponde `null`.
 */
import { useEffect } from "react";
import { router, useLocalSearchParams } from "expo-router";

import { useSession } from "../../auth/use-session";

export function useSocietyEditorGuard(): {
  /**
   * Lo stack `/club-admin` e' gated sul ruolo `club_admin`: l'hub lo usa per
   * non offrire righe che rimbalzerebbero alla root.
   */
  canOpenClubAdmin: boolean;
  clubId: string | null;
} {
  const { profile, session } = useSession();
  const { clubId: clubIdParam } = useLocalSearchParams<{ clubId?: string }>();
  const clubId = clubIdParam ?? profile?.club_id ?? null;

  useEffect(() => {
    if (!session || !profile) {
      return;
    }

    if (!clubId) {
      router.replace("/(tabs)/profile");
    }
  }, [clubId, profile, session]);

  return { canOpenClubAdmin: profile?.role === "club_admin", clubId };
}

/**
 * Permesso revocato mentre la sessione è aperta: la RPC smette di restituire
 * il club. Non si resta su una schermata protetta con dati in memoria.
 */
export function useSocietyAccessRevokedGuard(input: {
  isLoaded: boolean;
  isAllowed: boolean;
}) {
  useEffect(() => {
    if (input.isLoaded && !input.isAllowed) {
      router.replace("/(tabs)/profile");
    }
  }, [input.isAllowed, input.isLoaded]);
}
