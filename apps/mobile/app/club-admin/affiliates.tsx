/**
 * Società affiliate — entry point dell'hub Modifica profilo (REV-PROF-18).
 *
 * Non è una nuova gestione: è la rotta che mancava a quella che esisteva già.
 * Il flusso delle affiliate viveva dentro un modale aperto dal tab Profilo,
 * quindi dall'hub era raggiungibile solo tornando indietro e cercandolo. Qui
 * si monta lo stesso modale, con gli stessi dati e lo stesso salvataggio —
 * nessuna rubrica parallela, nessun secondo sistema di inviti.
 */
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "../../src/components/ui/screen";
import { useSession } from "../../src/features/auth/use-session";
import { fetchClubAffiliations } from "../../src/features/clubs/club-service";
import { EditClubAffiliationsModal } from "../../src/features/profiles/edit-modals/EditClubAffiliationsModal";

export default function ClubAffiliatesScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const { clubId: clubIdParam } = useLocalSearchParams<{ clubId?: string }>();
  // Il parametro vince sulla sessione: `club_id` e' popolato solo per
  // l'owner, e la rotta deve servire anche chi ci arriva da un'altra
  // superficie. Le RLS decidono comunque chi puo' scrivere.
  const clubId = clubIdParam ?? profile?.club_id ?? null;

  const affiliationsQuery = useQuery({
    enabled: Boolean(clubId),
    queryFn: () => fetchClubAffiliations(clubId as string),
    queryKey: ["club-affiliations", clubId ?? ""],
  });

  return (
    <Screen>
      {clubId ? (
        <EditClubAffiliationsModal
          clubId={clubId}
          /*
            Una lista vuota è recuperabile riprovando dentro il modale; una
            schermata di errore al posto del flusso no.
          */
          initialAffiliations={affiliationsQuery.data ?? []}
          onClose={() => router.back()}
          onSaved={() => router.back()}
          visible
        />
      ) : null}
    </Screen>
  );
}
