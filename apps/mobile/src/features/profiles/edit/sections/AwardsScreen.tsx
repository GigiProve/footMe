/**
 * Palmarès (§M): lista compatta, aggiunta, modifica ed eliminazione.
 *
 * Lista ed editor vivono sulla stessa rotta come due schermate interne: il
 * riconoscimento in lavorazione è uno stato locale, e non ha senso farlo
 * viaggiare in un parametro di navigazione.
 *
 * La lista non ha una CTA "Salva": si salva un riconoscimento alla volta,
 * dall'editor.
 */
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Button, ConfirmModal, Divider } from "../../../../ui";
import { getPlayerSeasonSelectOptions } from "../../../onboarding/career/player-career-utils";
import {
  OnboardingSelectField,
  OnboardingTextField,
  SegmentedSelector,
} from "../../../onboarding/ui";
import { trackProfileEvent } from "../../profile-analytics";
import type { PlayerPalmaresInput, PlayerPalmaresRecord } from "../../profile-service";
import {
  buildAwardTitle,
  getAwardIcon,
  PLAYER_AWARD_OPTIONS,
  sortAwardsByRecency,
  type PlayerAwardType,
} from "../player-awards";
import { ProfileEditScaffold } from "../ProfileEditScaffold";
import { ProfileEditFieldsSkeleton } from "../ProfileEditStates";
import {
  useCompleteProfileQuery,
  usePlayerSectionSave,
} from "../player-profile-edit-service";
import { usePlayerEditorGuard } from "../use-player-editor-guard";
import { useUnsavedChangesGuard } from "../use-unsaved-changes-guard";

type AwardDraft = {
  clubName: string;
  competitionName: string;
  index: number | null;
  palmaresType: PlayerAwardType;
  seasonLabel: string;
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

function toInput(
  record: PlayerPalmaresRecord,
  sortOrder: number,
): PlayerPalmaresInput {
  return {
    club_name: record.club_name,
    competition_name: record.competition_name,
    id: record.id,
    palmares_type: record.palmares_type,
    season_label: record.season_label,
    sort_order: sortOrder,
  };
}

export function AwardsScreen() {
  const { userId } = usePlayerEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const save = usePlayerSectionSave(userId);
  const data = profileQuery.data;

  const [draft, setDraft] = useState<AwardDraft | null>(null);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const awards = useMemo(
    () => (data ? sortAwardsByRecency(data.playerPalmares) : []),
    [data],
  );

  const seasonOptions = useMemo(
    () => getPlayerSeasonSelectOptions(new Set<string>()),
    [],
  );

  const leaveList = useCallback(() => router.back(), []);
  const handleListBack = useUnsavedChangesGuard({
    isDirty: false,
    isSaving: save.isPending,
    onLeave: leaveList,
  });
  const handleEditorBack = useUnsavedChangesGuard({
    isDirty: draft !== null,
    isSaving: save.isPending,
    onLeave: () => setDraft(null),
  });

  function persist(next: PlayerPalmaresInput[], event: "created" | "edited" | "deleted", awardType: string) {
    if (!data) {
      return;
    }

    setErrorMessage(null);
    save.mutate(
      {
        data,
        patch: {
          playerPalmares: next.map((entry, index) => ({
            ...entry,
            sort_order: index,
          })),
        },
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "player",
            section: "awards",
            success: false,
          });
          setErrorMessage(
            error instanceof Error && error.message
              ? error.message
              : GENERIC_SAVE_ERROR,
          );
        },
        onSuccess: () => {
          trackProfileEvent(
            event === "created"
              ? "award_created"
              : event === "edited"
                ? "award_edited"
                : "award_deleted",
            { awardType, profileType: "player", section: "awards" },
          );
          trackProfileEvent("profile_edit_section_saved", {
            profileType: "player",
            section: "awards",
            success: true,
          });
          setDraft(null);
          setPendingDeleteIndex(null);
        },
      },
    );
  }

  function handleSaveAward() {
    if (!draft || !data) {
      return;
    }

    if (!draft.competitionName.trim()) {
      setErrorMessage("Indica la competizione.");
      return;
    }

    if (!draft.seasonLabel.trim()) {
      setErrorMessage("Indica la stagione.");
      return;
    }

    const base = awards.map((record, index) => toInput(record, index));
    const entry: PlayerPalmaresInput = {
      club_name: draft.clubName.trim(),
      competition_name: draft.competitionName.trim(),
      id: draft.index === null ? "" : (base[draft.index]?.id ?? ""),
      palmares_type: draft.palmaresType,
      season_label: draft.seasonLabel.trim(),
      sort_order: 0,
    };

    const next =
      draft.index === null
        ? [...base, entry]
        : base.map((item, index) => (index === draft.index ? entry : item));

    persist(next, draft.index === null ? "created" : "edited", draft.palmaresType);
  }

  function handleDelete() {
    if (pendingDeleteIndex === null || !data) {
      return;
    }

    const removed = awards[pendingDeleteIndex];
    const next = awards
      .map((record, index) => toInput(record, index))
      .filter((_, index) => index !== pendingDeleteIndex);

    persist(next, "deleted", removed?.palmares_type ?? "trophy");
  }

  // ── Editor ────────────────────────────────────────────────────────────
  if (draft) {
    const isEditing = draft.index !== null;

    return (
      <ProfileEditScaffold
        errorMessage={errorMessage}
        onBack={handleEditorBack}
        onSave={handleSaveAward}
        saveLabel={isEditing ? "Salva modifiche" : "Salva riconoscimento"}
        saving={save.isPending}
        testID="profile-edit-award-editor"
        title={isEditing ? "Modifica riconoscimento" : "Aggiungi riconoscimento"}
      >
        <SegmentedSelector
          label="Tipo di riconoscimento"
          onChange={(value) => setDraft({ ...draft, palmaresType: value })}
          options={PLAYER_AWARD_OPTIONS.map((option) => ({
            label: option.label,
            value: option.value,
          }))}
          testID="award-type"
          value={draft.palmaresType}
        />

        <OnboardingTextField
          label="Competizione"
          onChangeText={(value) => setDraft({ ...draft, competitionName: value })}
          placeholder="Es. Coppa Italia Dilettanti"
          testID="award-competition"
          value={draft.competitionName}
        />

        <OnboardingSelectField
          label="Stagione"
          onChange={(value) => setDraft({ ...draft, seasonLabel: value })}
          options={seasonOptions}
          placeholder="Seleziona la stagione"
          searchable
          sheetTitle="Stagione"
          testID="award-season"
          value={draft.seasonLabel}
        />

        <OnboardingTextField
          label="Squadra"
          onChangeText={(value) => setDraft({ ...draft, clubName: value })}
          optional
          placeholder="Es. ASD Romano Prodi"
          testID="award-club"
          value={draft.clubName}
        />

        {/* Anteprima editoriale: il titolo nasce dai dati, non da un campo. */}
        <View style={styles.preview}>
          <AppText color="secondary" variant="eyebrow">
            Anteprima
          </AppText>
          <AppText variant="titleSm">
            {buildAwardTitle({
              competition_name: draft.competitionName,
              palmares_type: draft.palmaresType,
              season_label: draft.seasonLabel,
            })}
          </AppText>
        </View>

        {isEditing ? (
          <Button
            destructive
            label="Elimina riconoscimento"
            onPress={() => setPendingDeleteIndex(draft.index)}
            testID="award-delete"
            variant="ghost"
          />
        ) : null}

        <ConfirmModal
          cancelLabel="Annulla"
          confirmLabel="Elimina"
          isBusy={save.isPending}
          message="Il riconoscimento non sarà più visibile nel tuo profilo."
          onCancel={() => setPendingDeleteIndex(null)}
          onConfirm={handleDelete}
          title="Eliminare questo riconoscimento?"
          visible={pendingDeleteIndex !== null}
        />
      </ProfileEditScaffold>
    );
  }

  // ── Lista ─────────────────────────────────────────────────────────────
  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleListBack}
      testID="profile-edit-awards"
      title="Palmarès"
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

      {data ? (
        <>
          <AppText color="secondary" variant="bodySm">
            Aggiungi i riconoscimenti più importanti del tuo percorso.
          </AppText>

          {awards.length === 0 ? (
            <View style={styles.empty} testID="awards-empty">
              <AppText variant="titleSm">Nessun riconoscimento ancora</AppText>
              <AppText color="secondary" variant="bodySm">
                Aggiungi i risultati più importanti del tuo percorso calcistico.
              </AppText>
            </View>
          ) : (
            <View style={styles.list}>
              {awards.map((award, index) => (
                <View key={award.id || `${award.competition_name}-${index}`}>
                  {index > 0 ? <Divider /> : null}
                  <Pressable
                    accessibilityHint="Modifica riconoscimento"
                    accessibilityRole="button"
                    onPress={() =>
                      setDraft({
                        clubName: award.club_name ?? "",
                        competitionName: award.competition_name ?? "",
                        index,
                        palmaresType:
                          (award.palmares_type as PlayerAwardType) ?? "trophy",
                        seasonLabel: award.season_label ?? "",
                      })
                    }
                    style={styles.row}
                    testID={`award-row-${index}`}
                  >
                    <Ionicons
                      color={colors.textSecondary}
                      name={getAwardIcon(award.palmares_type)}
                      size={20}
                    />
                    <View style={styles.rowText}>
                      <AppText variant="titleSm">
                        {buildAwardTitle(award)}
                      </AppText>
                      {award.club_name ? (
                        <AppText color="secondary" variant="bodySm">
                          {award.club_name}
                        </AppText>
                      ) : null}
                    </View>
                    <Ionicons
                      color={colors.textMuted}
                      name="chevron-forward"
                      size={18}
                    />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <Button
            label="+ Aggiungi riconoscimento"
            onPress={() => {
              trackProfileEvent("award_add_tapped", {
                profileType: "player",
                section: "awards",
              });
              setDraft({
                clubName: "",
                competitionName: "",
                index: null,
                palmaresType: "trophy",
                seasonLabel: "",
              });
            }}
            testID="awards-add"
            variant="outline"
          />
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
  empty: {
    gap: spacing[8],
    padding: spacing[16],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[16],
  },
  list: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius[16],
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[12],
    minHeight: 56,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
  preview: {
    gap: spacing[4],
    padding: spacing[16],
    backgroundColor: colors.accentSoft,
    borderRadius: radius[16],
  },
});
