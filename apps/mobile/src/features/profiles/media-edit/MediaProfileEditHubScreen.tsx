/**
 * Hub "Modifica profilo" del Media/Creator (REV-PROF-22, Screen 1).
 *
 * Il comportamento vive in `edit/ProfileEditHubScreen`, lo stesso indice che
 * serve Allenatore, Staff tecnico, Dirigente, Procuratore e Tifoso: qui
 * restano la sorgente dei dati, il registro delle voci e la copy del
 * Media/Creator.
 *
 * L'hub non salva niente e non ha una CTA globale: ogni riga porta a un
 * modulo che possiede il proprio stato, la propria validazione e il proprio
 * "Salva modifiche".
 *
 * La testata è la **realtà editoriale**, non la persona che la amministra:
 * logo e nome arrivano da `media_profiles`, e il descrittore dalla tassonomia
 * canonica di REV-ONB-09. Non c'è nessun fallback sull'avatar, sul nome o
 * sulla residenza del proprietario — quello che manca si dichiara "Da
 * completare".
 *
 * Due query indipendenti: il profilo completo, che porta identità, tassonomie
 * e canali, e il conteggio reale dei contenuti Media. Se il conteggio fallisce
 * l'hub resta navigabile e quella riga non mostra un numero, invece di
 * mostrare uno zero mai verificato.
 */
import { useQuery } from "@tanstack/react-query";

import { formatMediaEntityType } from "../media/media-master-profile";
import { ProfileEditHubScreen } from "../edit/ProfileEditHubScreen";
import { MEDIA_EDIT_SECTION_GROUPS } from "./media-edit-sections";
import {
  MEDIA_INCOMPLETE_SUMMARY,
  buildMediaSectionSummary,
} from "./media-hub-summaries";
import {
  MEDIA_LOAD_ERROR_MESSAGE,
  countMediaProfileContents,
  readMediaChannelForm,
  useCompleteProfileQuery,
} from "./media-profile-edit-service";
import { useMediaEditorGuard } from "./use-media-editor-guard";

export function mediaContentCountQueryKey(profileId: string | null) {
  return ["media-profile-content-count", profileId] as const;
}

export function MediaProfileEditHubScreen() {
  const { userId } = useMediaEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);

  const contentCountQuery = useQuery({
    enabled: Boolean(userId),
    queryFn: () => countMediaProfileContents(userId as string),
    queryKey: mediaContentCountQueryKey(userId),
  });

  return (
    <ProfileEditHubScreen
      buildSummary={(sectionId, profile) =>
        buildMediaSectionSummary(sectionId, {
          channels: readMediaChannelForm(profile),
          contentCount: contentCountQuery.isSuccess
            ? contentCountQuery.data
            : null,
          profile,
        })
      }
      data={profileQuery.data}
      getIdentity={(profile) => {
        const entityName = profile.mediaProfile?.entity_name?.trim() ?? "";

        return {
          /*
            Il monogramma si ricava dal nome editoriale e basta: "Da
            completare" è un messaggio, non un nome, e non deve diventare
            delle iniziali.
          */
          avatarName: entityName,
          avatarUrl: profile.mediaProfile?.logo_url ?? null,
          name: entityName || MEDIA_INCOMPLETE_SUMMARY,
        };
      }}
      groups={MEDIA_EDIT_SECTION_GROUPS}
      isError={profileQuery.isError}
      isPending={profileQuery.isPending}
      loadErrorMessage={MEDIA_LOAD_ERROR_MESSAGE}
      onRetry={() => void profileQuery.refetch()}
      openedEvent="media_profile_edit_opened"
      profileType="media"
      /*
        Il descrittore è quello canonico della tassonomia, non un'etichetta
        fissa: "Media sportivo" non esiste nel modello e non si inventa qui.
      */
      roleLabel={
        formatMediaEntityType({
          affiliationType: profileQuery.data?.mediaProfile?.affiliation_type,
          creatorType: profileQuery.data?.mediaProfile?.creator_type,
          creatorTypeOther:
            profileQuery.data?.mediaProfile?.creator_type_other,
          editorialType: profileQuery.data?.mediaProfile?.editorial_type,
        }) ?? MEDIA_INCOMPLETE_SUMMARY
      }
      testIDPrefix="media"
    />
  );
}
