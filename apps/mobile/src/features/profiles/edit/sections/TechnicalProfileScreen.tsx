/**
 * Profilo tecnico (§I): ruoli sul campo, piede, altezza e peso.
 *
 * Il campo da calcio è quello dell'onboarding — stessa geometria, stessi
 * marker, stesse abbreviazioni. In `features/profiles/football-position-picker`
 * ne esiste ancora uno legacy con una tassonomia diversa (CEN/DIF invece di
 * CC/DC): non va usato qui, altrimenti lo stesso ruolo avrebbe due sigle a
 * seconda della schermata.
 */
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import {
  FieldShell,
  OnboardingSelectField,
  SegmentedSelector,
} from "../../../onboarding/ui";
import { FootballPitchRoleSelector } from "../../../onboarding/player/FootballPitchRoleSelector";
import { PlayerMeasureField } from "../../../onboarding/player/PlayerMeasureField";
import {
  getSecondaryPositionOptions,
  revalidateSecondaryPosition,
} from "../../../onboarding/player/player-pitch-positions";
import { trackProfileEvent } from "../../profile-analytics";
import {
  getPlayerPositionLabel,
  PREFERRED_FOOT_OPTIONS,
  type PlayerPosition,
  type PreferredFoot,
} from "../../player-sports";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import { ProfileEditFieldsSkeleton } from "../ProfileEditStates";
import {
  useCompleteProfileQuery,
  usePlayerSectionSave,
} from "../player-profile-edit-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

type TechnicalForm = {
  heightCm: string;
  preferredFoot: PreferredFoot | "";
  primaryPosition: PlayerPosition | "";
  secondaryPosition: PlayerPosition | "";
  weightKg: string;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function TechnicalProfileScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = usePlayerSectionSave(userId);
  const data = profileQuery.data;

  const initialForm = useMemo<TechnicalForm | null>(() => {
    if (!data) {
      return null;
    }

    const player = data.playerProfile;

    return {
      heightCm: player?.height_cm ? String(player.height_cm) : "",
      preferredFoot: player?.preferred_foot ?? "",
      primaryPosition: player?.primary_position ?? "",
      secondaryPosition: player?.secondary_positions?.[0] ?? "",
      weightKg: player?.weight_kg ? String(player.weight_kg) : "",
    };
  }, [data]);

  const [draft, setDraft] = useState<TechnicalForm | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const form = draft ?? initialForm;

  const isDirty = Boolean(
    form && initialForm && JSON.stringify(form) !== JSON.stringify(initialForm),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => router.back(),
  });

  const patch = useCallback((changes: Partial<TechnicalForm>) => {
    setErrorMessage(null);
    setDraft((current) => {
      const base = current ?? initialForm;

      return base ? { ...base, ...changes } : base;
    });
  }, [initialForm]);

  /*
    Il tap su un marker cambia sempre il ruolo principale. Se il nuovo
    principale coincide con il secondario, il secondario decade: la regola vive
    già in `revalidateSecondaryPosition`, non viene riscritta qui.
  */
  const handleSelectPrimary = useCallback(
    (position: PlayerPosition) => {
      patch({
        primaryPosition: position,
        secondaryPosition:
          revalidateSecondaryPosition(
            (draft ?? initialForm)?.secondaryPosition ?? "",
            position,
          ) || "",
      });
    },
    [draft, initialForm, patch],
  );

  function handleSave() {
    if (!data || !form) {
      return;
    }

    if (!form.primaryPosition) {
      setErrorMessage("Seleziona il ruolo principale.");
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          heightCm: form.heightCm,
          preferredFoot: form.preferredFoot,
          primaryPosition: form.primaryPosition,
          secondaryPositions: form.secondaryPosition
            ? [form.secondaryPosition]
            : [],
          weightKg: form.weightKg,
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "player",
            section: "technical",
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
            section: "technical",
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
      onSave={form ? handleSave : undefined}
      saveDisabled={!form?.primaryPosition}
      saving={save.isPending}
      testID="profile-edit-technical"
      title="Profilo tecnico"
    >
      {profileQuery.isPending ? (
        <ProfileEditFieldsSkeleton />
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

      {form ? (
        <>
          <FieldShell label="Ruolo principale">
            <FootballPitchRoleSelector
              onSelectPrimary={handleSelectPrimary}
              primaryPosition={form.primaryPosition}
              secondaryPosition={form.secondaryPosition}
              testID="technical-pitch"
              tone="light"
            />
          </FieldShell>

          <OnboardingSelectField
            allowClear
            label="Ruolo secondario"
            onChange={(value) =>
              patch({ secondaryPosition: (value as PlayerPosition) || "" })
            }
            optional
            options={getSecondaryPositionOptions(form.primaryPosition)}
            placeholder="Seleziona un ruolo"
            sheetTitle="Ruolo secondario"
            testID="technical-secondary-position"
            value={form.secondaryPosition}
          />

          {/* Riepilogo testuale: i marker non devono restare l'unica lettura. */}
          <View style={styles.recap}>
            <View style={styles.recapRow}>
              <AppText variant="titleSm">Ruolo principale</AppText>
              <AppText color="secondary" variant="bodySm">
                {getPlayerPositionLabel(form.primaryPosition || null, "—")}
              </AppText>
            </View>
            <View style={styles.recapDivider} />
            <View style={styles.recapRow}>
              <AppText variant="titleSm">Ruolo secondario</AppText>
              <AppText color="secondary" variant="bodySm">
                {getPlayerPositionLabel(form.secondaryPosition || null, "—")}
              </AppText>
            </View>
          </View>

          <SegmentedSelector
            label="Piede"
            onChange={(value) => patch({ preferredFoot: value })}
            options={PREFERRED_FOOT_OPTIONS}
            testID="technical-foot"
            value={form.preferredFoot}
          />

          {/*
            Altezza e peso restano vuoti quando non sono noti: trasformare
            "mai inserito" in 0 sarebbe un dato inventato (§X).
          */}
          {/* Affiancati, come nello Screen Master: sono due misure brevi. */}
          <View style={styles.measures}>
            <View style={styles.measure}>
              <PlayerMeasureField
                label="Altezza"
                max={220}
                min={140}
                onChange={(value) => patch({ heightCm: value })}
                unit="cm"
                value={form.heightCm}
              />
            </View>
            <View style={styles.measure}>
              <PlayerMeasureField
                label="Peso"
                max={130}
                min={40}
                onChange={(value) => patch({ weightKg: value })}
                unit="kg"
                value={form.weightKg}
              />
            </View>
          </View>
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
  recap: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[16],
  },
  recapRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  recapDivider: {
    height: 1,
    backgroundColor: colors.divider,
  },
  measures: {
    flexDirection: "row",
    gap: spacing[12],
  },
  measure: {
    flex: 1,
  },
});
