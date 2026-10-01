/**
 * Hub "Modifica profilo" (REV-PROF-05 schermata 1, REV-PROF-08 schermata 1).
 *
 * L'hub non salva niente: è un indice. Ogni riga porta a un modulo che possiede
 * il proprio stato, la propria validazione e la propria unica CTA. Per questo
 * qui non esiste — e non deve esistere — un pulsante "Salva".
 *
 * I conteggi arrivano dalla stessa query del Master Profile: tornando da un
 * modulo che ha salvato, la cache è già aggiornata e la riga mostra il numero
 * nuovo senza un refetch dedicato.
 *
 * Allenatore e Staff tecnico non sono due hub: sono lo stesso indice con un
 * registro di voci diverso. Quello che cambia sta tutto nei props.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { router, useFocusEffect, type Href } from "expo-router";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Divider } from "../../../ui";
import {
  trackProfileEvent,
  type ProfileAnalyticsEvent,
  type ProfileEditSectionKey,
} from "../profile-analytics";
import { ProfileEditIdentityHeader } from "./ProfileEditIdentityHeader";
import { ProfileEditScaffold } from "./ProfileEditScaffold";
import { ProfileEditSectionRow } from "./ProfileEditSectionRow";
import {
  ProfileEditErrorState,
  ProfileEditHubSkeleton,
} from "./ProfileEditStates";
import type { CompleteProfessionalProfile } from "../profile-service";

export type ProfileEditHubSection = {
  icon: keyof typeof Ionicons.glyphMap;
  id: ProfileEditSectionKey;
  route: Href;
  /** Sottotitolo fisso. Le voci a conteggio lo calcolano dai dati. */
  subtitle?: string;
  title: string;
};

export type ProfileEditHubGroup = {
  sections: readonly ProfileEditHubSection[];
  title: string;
};

type ProfileEditHubScreenProps = {
  /** Sottotitolo dinamico di una voce. `undefined` lascia quello fisso. */
  buildSummary: (
    sectionId: ProfileEditSectionKey,
    data: CompleteProfessionalProfile,
  ) => string | undefined;
  groups: readonly ProfileEditHubGroup[];
  isError: boolean;
  isPending: boolean;
  /** Evento di apertura dell'hub, specifico del ruolo. */
  openedEvent: ProfileAnalyticsEvent;
  data: CompleteProfessionalProfile | undefined;
  onRetry: () => void;
  profileType: string;
  roleLabel: string;
  testIDPrefix: string;
};

export function ProfileEditHubScreen({
  buildSummary,
  data,
  groups,
  isError,
  isPending,
  onRetry,
  openedEvent,
  profileType,
  roleLabel,
  testIDPrefix,
}: ProfileEditHubScreenProps) {
  useFocusEffect(
    useCallback(() => {
      trackProfileEvent(openedEvent, { profileType, viewerMode: "owner" });
    }, [openedEvent, profileType]),
  );

  useFocusEffect(
    useCallback(() => {
      if (isError) {
        trackProfileEvent("profile_edit_section_load_failed", {
          profileType,
          success: false,
        });
      }
    }, [isError, profileType]),
  );

  const handleBack = useCallback(() => {
    router.back();
  }, []);

  const rowCount = groups.reduce(
    (total, group) => total + group.sections.length,
    0,
  );

  return (
    <ProfileEditScaffold
      onBack={handleBack}
      testID={`${testIDPrefix}-profile-edit-hub`}
      title="Modifica profilo"
    >
      {isPending ? (
        <ProfileEditHubSkeleton
          rows={rowCount}
          testID={`${testIDPrefix}-edit-hub-skeleton`}
        />
      ) : null}

      {isError ? (
        <ProfileEditErrorState
          message="Non è stato possibile caricare il profilo."
          onRetry={onRetry}
          testID={`${testIDPrefix}-edit-error`}
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
                profileType,
                viewerMode: "owner",
              });
              handleBack();
            }}
            roleLabel={roleLabel}
          />

          {groups.map((group) => (
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
                          profileType,
                          section: section.id,
                        });
                        router.push(section.route);
                      }}
                      summary={
                        section.subtitle ?? buildSummary(section.id, data) ?? ""
                      }
                      testID={`${testIDPrefix}-profile-edit-row-${section.id}`}
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
