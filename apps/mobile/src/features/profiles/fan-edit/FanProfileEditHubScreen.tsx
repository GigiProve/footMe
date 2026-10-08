/**
 * Hub "Modifica profilo" del Tifoso (REV-PROF-20, schermata 1).
 *
 * Il comportamento vive in `edit/ProfileEditHubScreen`, lo stesso indice che
 * serve Allenatore, Staff tecnico e Dirigente: qui restano la sorgente dei
 * dati, il registro delle voci e la copy del Tifoso.
 *
 * L'hub non salva niente e non ha una CTA globale: ogni riga porta a un
 * modulo che possiede il proprio stato, la propria validazione e il proprio
 * "Salva modifiche".
 *
 * Tre query indipendenti, perché tre riepiloghi arrivano da tre posti
 * diversi e nessuno dei tre deve far aspettare gli altri: il profilo
 * completo, la denominazione della squadra del cuore letta dall'entità
 * canonica, e il conteggio reale dei contenuti Media. Se una delle due
 * secondarie fallisce, l'hub resta navigabile e quella riga mostra un
 * fallback neutro invece di un valore inventato.
 */
import { useQuery } from "@tanstack/react-query";

import { ProfileEditHubScreen } from "../edit/ProfileEditHubScreen";
import { FAN_ROLE_LABEL } from "../fan/fan-master-profile";
import { countFanMediaContents } from "../fan/fan-media-tab-service";
import { FAN_EDIT_SECTION_GROUPS } from "./fan-edit-sections";
import { fetchFanFavoriteClub } from "./fan-favorite-club-service";
import { buildFanSectionSummary } from "./fan-hub-summaries";
import {
  FAN_LOAD_ERROR_MESSAGE,
  useCompleteProfileQuery,
} from "./fan-profile-edit-service";
import { useFanEditorGuard } from "./use-fan-editor-guard";

export function fanFavoriteClubQueryKey(clubId: string | null) {
  return ["fan-favorite-club", clubId] as const;
}

export function fanMediaCountQueryKey(profileId: string | null) {
  return ["fan-media-count", profileId] as const;
}

export function FanProfileEditHubScreen() {
  const { userId } = useFanEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);

  const favoriteClubId = profileQuery.data?.fanProfile?.favorite_club_id ?? null;

  const favoriteClubQuery = useQuery({
    enabled: Boolean(favoriteClubId),
    queryFn: () => fetchFanFavoriteClub(favoriteClubId as string),
    queryKey: fanFavoriteClubQueryKey(favoriteClubId),
  });

  const mediaCountQuery = useQuery({
    enabled: Boolean(userId),
    queryFn: () => countFanMediaContents(userId as string),
    queryKey: fanMediaCountQueryKey(userId),
  });

  return (
    <ProfileEditHubScreen
      buildSummary={(sectionId, profile) =>
        buildFanSectionSummary(sectionId, {
          /*
            Il nome arriva dall'entità canonica, mai dalla stringa storica
            `favorite_team_name`: una squadra non risolta è "Non impostata" e
            il modulo chiede di sceglierla di nuovo.
          */
          favoriteClubName: favoriteClubQuery.data?.name ?? null,
          mediaCount: mediaCountQuery.isSuccess ? mediaCountQuery.data : null,
          profile,
        })
      }
      data={profileQuery.data}
      getIdentity={(profile) => ({
        avatarUrl: profile.profile.avatar_url,
        name: profile.profile.full_name,
      })}
      groups={FAN_EDIT_SECTION_GROUPS}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      loadErrorMessage={FAN_LOAD_ERROR_MESSAGE}
      onRetry={() => void profileQuery.refetch()}
      openedEvent="fan_profile_edit_opened"
      profileType="fan"
      roleLabel={FAN_ROLE_LABEL}
      testIDPrefix="fan"
    />
  );
}
