/**
 * Hub "Modifica profilo" dell'Allenatore (REV-PROF-05, schermata 1).
 *
 * L'hub non salva niente: è un indice. Ogni riga porta a un modulo che possiede
 * il proprio stato, la propria validazione e la propria unica CTA. Per questo
 * qui non esiste — e non deve esistere — un pulsante "Salva".
 *
 * I conteggi arrivano dalla stessa query del Master Profile: tornando da un
 * modulo che ha salvato, la cache è già aggiornata e la riga mostra il numero
 * nuovo senza un refetch dedicato.
 */
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { router, useFocusEffect } from "expo-router";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Divider } from "../../../ui";
import { trackProfileEvent } from "../profile-analytics";
import { ProfileEditIdentityHeader } from "../edit/ProfileEditIdentityHeader";
import { ProfileEditScaffold } from "../edit/ProfileEditScaffold";
import { ProfileEditSectionRow } from "../edit/ProfileEditSectionRow";
import {
  CoachEditErrorState,
  CoachEditHubSkeleton,
} from "./CoachEditStates";
import { COACH_EDIT_SECTION_GROUPS } from "./coach-edit-sections";
import { buildCoachSectionSummary } from "./coach-hub-summaries";
import { useCompleteProfileQuery } from "./coach-profile-edit-service";
import { useCoachEditorGuard } from "./use-coach-editor-guard";

export function CoachProfileEditHubScreen() {
  const { userId } = useCoachEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const data = profileQuery.data;
  const { isError, refetch } = profileQuery;

  useFocusEffect(
    useCallback(() => {
      trackProfileEvent("coach_profile_edit_opened", {
        profileType: "coach",
        viewerMode: "owner",
      });
    }, []),
  );

  useFocusEffect(
    useCallback(() => {
      if (isError) {
        trackProfileEvent("profile_edit_section_load_failed", {
          profileType: "coach",
          success: false,
        });
      }
    }, [isError]),
  );

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  return (
    <ProfileEditScaffold
      onBack={handleBack}
      testID="coach-profile-edit-hub"
      title="Modifica profilo"
    >
      {profileQuery.isPending ? <CoachEditHubSkeleton /> : null}

      {profileQuery.isError ? (
        <CoachEditErrorState
          message="Non è stato possibile caricare il profilo."
          onRetry={() => void refetch()}
        />
      ) : null}

      {data ? (
        <>
          <ProfileEditIdentityHeader
            avatarUrl={data.profile.avatar_url}
            fullName={data.profile.full_name}
            /*
              L'hub si apre solo dal Master Profile: tornare indietro ci riporta
              esattamente lì, in modalità owner, mentre un push ne impilerebbe
              una seconda copia sopra la prima.
            */
            onViewProfile={() => {
              trackProfileEvent("profile_edit_view_profile_tapped", {
                profileType: "coach",
                viewerMode: "owner",
              });
              handleBack();
            }}
            roleLabel="Allenatore"
          />

          {COACH_EDIT_SECTION_GROUPS.map((group) => (
            <View key={group.title} style={styles.group}>
              <AppText style={styles.groupTitle} variant="eyebrow">
                {group.title}
              </AppText>
              <View style={styles.groupRows}>
                {group.sections.map((section, index) => (
                  <View key={section.id}>
                    {index > 0 ? <Divider /> : null}
                    <ProfileEditSectionRow
                      icon={section.icon}
                      onPress={() => {
                        trackProfileEvent("profile_edit_section_opened", {
                          profileType: "coach",
                          section: section.id,
                        });
                        router.push(section.route);
                      }}
                      summary={
                        section.subtitle ??
                        buildCoachSectionSummary(section.id, data) ??
                        ""
                      }
                      testID={`coach-profile-edit-row-${section.id}`}
                      title={section.title}
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing[8],
  },
  /*
    Lista piatta: righe a tutta larghezza separate da hairline, senza cornice
    attorno al gruppo. L'eyebrow sopra basta a delimitare la macroarea.
  */
  groupRows: {
    backgroundColor: colors.surface,
  },
  groupTitle: {
    paddingHorizontal: spacing[4],
  },
});
