/**
 * Il rapporto con una persona, lato Società (master 21, 23, 24).
 *
 * Figlia della tab Dashboard: nel PNG lo screen 21 mostra la bottom
 * navigation con Dashboard selezionata (DAS-REV-21 §6).
 */
import { useLocalSearchParams, useRouter } from "expo-router";

import { DashboardGlobalError } from "../../../../src/features/dashboard/components/DashboardStates";
import { SocietyPersonLinkScreen } from "../../../../src/features/role-link/society/SocietyPersonLinkScreen";

export default function SocietyPersonRoute() {
  const router = useRouter();
  const { clubId, from, profileId, teamId } = useLocalSearchParams<{
    clubId?: string;
    from?: string;
    profileId?: string;
    teamId?: string;
  }>();

  if (
    typeof clubId !== "string" ||
    clubId.length === 0 ||
    typeof profileId !== "string" ||
    profileId.length === 0
  ) {
    return (
      <DashboardGlobalError
        body="Riapri la persona dall'organico della squadra."
        onRetry={() => router.back()}
        title="Persona non disponibile"
      />
    );
  }

  /*
   * §32: «Il contesto di ritorno resta il Team di ingresso anche quando il
   * dettaglio espone altri incarichi autorizzati.» L'origine viaggia nella
   * route e non viene dedotta dallo stack, che una notifica o un deep link
   * potrebbero non avere.
   */
  const returnHref =
    from === "team" && typeof teamId === "string" && teamId.length > 0
      ? `/club-admin/roster?teamId=${encodeURIComponent(teamId)}`
      : from === "structure"
        ? "/(tabs)/dashboard/structure"
        : null;

  return (
    <SocietyPersonLinkScreen
      clubId={clubId}
      profileId={profileId}
      returnHref={returnHref}
    />
  );
}
