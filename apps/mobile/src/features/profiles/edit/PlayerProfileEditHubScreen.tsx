/**
 * Hub "Modifica profilo" del Calciatore (§F).
 *
 * L'hub non salva niente: è un indice. Ogni riga porta a una sezione che
 * possiede il proprio stato, la propria validazione e la propria unica CTA.
 * Per questo qui non esiste — e non deve esistere — un pulsante "Salva".
 */
import { useCallback } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, Divider } from "../../../ui";
import { usePlayerEditorGuard } from "./use-player-editor-guard";
import { trackProfileEvent } from "../profile-analytics";
import { ProfileEditIdentityHeader } from "./ProfileEditIdentityHeader";
import { ProfileEditScaffold } from "./ProfileEditScaffold";
import { ProfileEditSectionRow } from "./ProfileEditSectionRow";
import { PLAYER_EDIT_SECTION_GROUPS } from "./player-edit-sections";
import { buildSectionSummary } from "./player-hub-summaries";
import { useCompleteProfileQuery } from "./player-profile-edit-service";

export function PlayerProfileEditHubScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const data = profileQuery.data;

  return (
    <ProfileEditScaffold
      onBack={handleBack}
      testID="player-profile-edit-hub"
      title="Modifica profilo"
    >
      {profileQuery.isPending ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : null}

      {profileQuery.isError ? (
        <View style={styles.centered}>
          <AppText color="secondary" variant="bodySm">
            Non è stato possibile caricare questa sezione.
          </AppText>
          <Button
            label="Riprova"
            onPress={() => profileQuery.refetch()}
            size="sm"
            variant="outline"
          />
        </View>
      ) : null}

      {data ? (
        <>
          <ProfileEditIdentityHeader
            avatarUrl={data.profile.avatar_url}
            fullName={data.profile.full_name}
            /*
              L'hub si apre solo dal Master Profile: tornare indietro ci
              riporta esattamente lì, mentre un push ne impilerebbe una
              seconda copia sopra la prima.
            */
            onViewProfile={handleBack}
            roleLabel="Calciatore"
          />

          {PLAYER_EDIT_SECTION_GROUPS.map((group) => (
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
                          profileType: "player",
                          section: section.id,
                        });
                        router.push(section.route);
                      }}
                      summary={buildSectionSummary(section.id, data)}
                      testID={`profile-edit-row-${section.id}`}
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
  centered: {
    alignItems: "center",
    gap: spacing[12],
    paddingVertical: spacing[32],
  },
  group: {
    gap: spacing[8],
  },
  groupTitle: {
    paddingHorizontal: spacing[4],
  },
  /*
    Lo Screen Master mostra una lista piatta: righe a tutta larghezza separate
    da hairline, senza cornice attorno al gruppo. L'eyebrow sopra basta a
    delimitare la macroarea.
  */
  groupRows: {
    backgroundColor: colors.surface,
  },
});
