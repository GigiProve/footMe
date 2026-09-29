/**
 * Situazione attuale (§K).
 *
 * Squadra, categoria e periodo NON si modificano qui: derivano dall'esperienza
 * corrente della Carriera, che resta l'unica source of truth. Un campo manuale
 * "squadra attuale" creerebbe un secondo dato destinato a divergere.
 *
 * L'unica cosa realmente modificabile in questa schermata è lo stato
 * contrattuale.
 */
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button, ChipGroup } from "../../../../ui";
import { buildPlayerCareerView } from "../../career/player-career-model";
import { trackProfileEvent } from "../../profile-analytics";
import { toPlayerExperienceForm } from "../../player-sports";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import {
  CONTRACT_STATUS_OPTIONS,
  PLAYER_CONDITION_OPTIONS,
} from "../player-situation-options";
import {
  useCompleteProfileQuery,
  usePlayerSectionSave,
} from "../player-profile-edit-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

const CAREER_ROUTE = "/profile/edit/career";
const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function CurrentSituationScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = usePlayerSectionSave(userId);
  const data = profileQuery.data;

  /*
    L'esperienza corrente arriva dalla logica di dominio già in uso nel Master
    Profile: non è "la più recente", è quella che copre la stagione in corso o
    ha un periodo ancora aperto.
  */
  const currentExperience = useMemo(() => {
    if (!data) {
      return null;
    }

    return (
      buildPlayerCareerView(
        data.playerCareerEntries.map((entry) => toPlayerExperienceForm(entry)),
      ).experiences.find((experience) => experience.isCurrent) ?? null
    );
  }, [data]);

  const initial = useMemo(
    () => ({
      contractStatus: data?.playerProfile?.contract_status ?? "",
      currentCondition: data?.playerProfile?.current_condition ?? "",
    }),
    [data],
  );

  const [draft, setDraft] = useState<typeof initial | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = draft ?? initial;

  const isDirty =
    form.contractStatus !== initial.contractStatus ||
    form.currentCondition !== initial.currentCondition;

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => router.back(),
  });

  const openCareer = useCallback(() => {
    trackProfileEvent("current_experience_manage_tapped", {
      profileType: "player",
      section: "situation",
    });
    router.push(CAREER_ROUTE);
  }, []);

  function handleSave() {
    if (!data) {
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          contractStatus: form.contractStatus,
          currentCondition: form.currentCondition,
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "player",
            section: "situation",
            success: false,
          });
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : GENERIC_SAVE_ERROR,
          );
        },
        onSuccess: () => {
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "player",
            section: "situation",
            success: true,
          });
          setDraft(null);
          router.back();
        },
      },
    );
  }

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={data && currentExperience ? handleSave : undefined}
      saving={save.isPending}
      testID="profile-edit-situation"
      title="Situazione attuale"
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

      {data && currentExperience ? (
        <>
          <View style={styles.card} testID="situation-current-experience">
            <View style={styles.clubRow}>
              {currentExperience.logoUrl ? (
                <Image
                  source={{ uri: currentExperience.logoUrl }}
                  style={styles.logo}
                />
              ) : (
                <View style={styles.logoPlaceholder} />
              )}
              <View style={styles.clubText}>
                <AppText variant="titleSm">{currentExperience.clubName}</AppText>
                <AppText color="secondary" variant="bodySm">
                  {currentExperience.seasons[0]?.category ?? "—"}
                </AppText>
                <AppText color="muted" variant="meta">
                  {currentExperience.periodLabel}
                </AppText>
              </View>
            </View>
            <Button
              label="Gestisci esperienza attuale"
              onPress={openCareer}
              size="sm"
              testID="situation-manage-experience"
              variant="outline"
            />
          </View>

          <AppText color="secondary" variant="bodySm">
            Squadra e categoria derivano dall&apos;esperienza attuale della tua
            carriera.
          </AppText>

          <View style={styles.field}>
            <AppText variant="titleSm">Stato contrattuale</AppText>
            <ChipGroup
              onChange={(value) =>
                setDraft({ ...form, contractStatus: value ?? "" })
              }
              options={CONTRACT_STATUS_OPTIONS}
              value={form.contractStatus || null}
            />
          </View>

          <View style={styles.field}>
            <AppText variant="titleSm">Condizione</AppText>
            <ChipGroup
              onChange={(value) =>
                setDraft({ ...form, currentCondition: value ?? "" })
              }
              options={PLAYER_CONDITION_OPTIONS}
              value={form.currentCondition || null}
            />
          </View>
        </>
      ) : null}

      {data && !currentExperience ? (
        /*
          Senza esperienza corrente lo stato contrattuale non ha a cosa
          riferirsi: viene nascosto invece di essere salvato nel vuoto (§K.5).
        */
        <View style={styles.card} testID="situation-empty">
          <AppText variant="titleSm">Nessuna esperienza attuale</AppText>
          <AppText color="secondary" variant="bodySm">
            Aggiungi o aggiorna la tua carriera per indicare la squadra in cui
            giochi.
          </AppText>
          <Button
            label="Gestisci carriera"
            onPress={openCareer}
            size="sm"
            testID="situation-manage-career"
          />
        </View>
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
  card: {
    gap: spacing[12],
    padding: spacing[16],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
  },
  clubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: radius[10],
  },
  logoPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: radius[10],
    backgroundColor: colors.surfacePlaceholder,
  },
  clubText: {
    flex: 1,
    gap: spacing[4],
  },
  field: {
    gap: spacing[8],
  },
});
