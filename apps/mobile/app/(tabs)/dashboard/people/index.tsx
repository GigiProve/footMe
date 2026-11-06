/**
 * Persone con un incarico societario (DAS-REV-21 §32).
 *
 * Figlia della tab Dashboard, come l'Organico e gli altri centri gestionali:
 * la bottom navigation resta visibile con Dashboard selezionata.
 */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../../../src/features/dashboard/components/DashboardStates";
import { SocietyWideMembersScreen } from "../../../../src/features/role-link/society/SocietyWideMembersScreen";

export default function SocietyWideMembersRoute() {
  const router = useRouter();
  const { clubId } = useLocalSearchParams<{ clubId?: string }>();

  if (typeof clubId !== "string" || clubId.length === 0) {
    return (
      <DashboardGlobalError
        body="Riapri l'elenco dalla struttura societaria."
        onRetry={() => router.back()}
        title="Ruoli societari non disponibili"
      />
    );
  }

  return <SocietyWideMembersScreen clubId={clubId} />;
}
