/**
 * Palmarès dell'Allenatore (REV-PROF-05, schermate 6 e 7).
 *
 * Lista ed editor vivono sulla stessa rotta come due schermate interne: il
 * riconoscimento in lavorazione è stato locale e non ha senso farlo viaggiare
 * in un parametro di navigazione.
 *
 * La lista non ha una CTA "Salva": si salva un riconoscimento alla volta,
 * dall'editor. L'azione conclusiva è "Fine", che riporta all'hub.
 */
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import {
  ActionSheet,
  AppText,
  Button,
  ConfirmModal,
  Divider,
} from "../../../../ui";
import { getPlayerSeasonSelectOptions } from "../../../onboarding/career/player-career-utils";
import { FieldShell, OnboardingSelectField, OnboardingTextField } from "../../../onboarding/ui";
import { TeamAutocompleteInput } from "../../player-sports-section";
import { trackProfileEvent } from "../../profile-analytics";
import { searchTeams, type CoachAchievementRecord } from "../../profile-service";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import {
  buildCoachAwardTitle,
  COACH_AWARD_OPTIONS,
  getCoachAwardIcon,
  getCoachAwardTypeMeta,
  isDuplicateCoachAward,
  sortCoachAwards,
  type CoachAwardType,
} from "../coach-awards";
import {
  CoachEditErrorState,
  CoachEditFieldsSkeleton,
} from "../CoachEditStates";
import {
  useCompleteProfileQuery,
  useDeleteCoachAward,
  useSaveCoachAward,
} from "../coach-profile-edit-service";
import { useCoachEditorGuard } from "../use-coach-editor-guard";

type AwardDraft = {
  achievementType: CoachAwardType;
  clubId: string | null;
  clubName: string;
  competitionName: string;
  /** `null` in creazione: l'id esiste solo dopo il primo salvataggio. */
  id: string | null;
  seasonLabel: string;
};

const EMPTY_DRAFT: AwardDraft = {
  achievementType: "campionato",
  clubId: null,
  clubName: "",
  competitionName: "",
  id: null,
  seasonLabel: "",
};

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";
const GENERIC_DELETE_ERROR =
  "Non è stato possibile eliminare il riconoscimento. Riprova.";

function toDraft(record: CoachAchievementRecord): AwardDraft {
  return {
    achievementType: record.achievement_type,
    clubId: record.club_id,
    clubName: record.club_name ?? "",
    competitionName: record.competition_name ?? "",
    id: record.id,
    seasonLabel: record.season_label ?? "",
  };
}

export function CoachAwardsScreen() {
  const { userId } = useCoachEditorGuard();
  const profileQuery = useCompleteProfileQuery(userId);
  const saveAward = useSaveCoachAward(userId);
  const deleteAward = useDeleteCoachAward(userId);
  const data = profileQuery.data;

  const [draft, setDraft] = useState<AwardDraft | null>(null);
  const [menuAwardId, setMenuAwardId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const awards = useMemo(
    () => sortCoachAwards(data?.coachProfile?.achievements ?? []),
    [data?.coachProfile?.achievements],
  );

  const seasonOptions = useMemo(
    () => getPlayerSeasonSelectOptions(new Set<string>()),
    [],
  );

  const isBusy = saveAward.isPending || deleteAward.isPending;

  const handleListBack = useCallback(() => {
    router.back();
  }, []);

  const handleEditorBack = useUnsavedChangesGuard({
    isDirty: draft !== null,
    isSaving: isBusy,
    onLeave: () => {
      trackProfileEvent("profile_edit_unsaved_exit", {
        profileType: "coach",
        section: "awards",
      });
      setErrorMessage(null);
      setDraft(null);
    },
  });

  function handleSaveAward() {
    if (!draft) {
      return;
    }

    const competition = draft.competitionName.trim();
    const club = draft.clubName.trim();

    if (!competition) {
      setErrorMessage("Seleziona la competizione.");
      return;
    }

    if (!draft.seasonLabel.trim()) {
      setErrorMessage("Seleziona la stagione.");
      return;
    }

    if (!club) {
      setErrorMessage("Seleziona la società.");
      return;
    }

    const candidate = {
      achievement_type: draft.achievementType,
      club_name: club,
      competition_name: competition,
      id: draft.id ?? undefined,
      season_label: draft.seasonLabel,
    };

    /*
      Duplicato esatto: stesso tipo, competizione, stagione e società. Due
      riconoscimenti diversi nella stessa stagione restano legittimi.
    */
    if (isDuplicateCoachAward(candidate, awards)) {
      setErrorMessage("Questo riconoscimento è già presente.");
      return;
    }

    const isEditing = draft.id !== null;
    // In modifica il posto in lista non cambia: riscriverlo a 0 sposterebbe
    // il riconoscimento senza che nessuno lo abbia chiesto.
    const existing = awards.find((award) => award.id === draft.id);

    setErrorMessage(null);
    saveAward.mutate(
      {
        achievement_type: draft.achievementType,
        club_id: draft.clubId,
        club_name: club,
        competition_name: competition,
        ...(draft.id ? { id: draft.id } : {}),
        label: buildCoachAwardTitle({
          achievement_type: draft.achievementType,
          competition_name: competition,
          season_label: draft.seasonLabel,
        }),
        season_label: draft.seasonLabel,
        sort_order: existing?.sort_order ?? awards.length,
      },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "coach",
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
          trackProfileEvent(isEditing ? "award_edited" : "award_created", {
            awardType: draft.achievementType,
            profileType: "coach",
            section: "awards",
          });
          setDraft(null);
        },
      },
    );
  }

  function handleDelete() {
    const target = awards.find((award) => award.id === pendingDeleteId);

    if (!target) {
      return;
    }

    setErrorMessage(null);
    deleteAward.mutate(target.id, {
      onError: (error) => {
        trackProfileEvent("award_delete_failed", {
          awardType: target.achievement_type,
          profileType: "coach",
          section: "awards",
          success: false,
        });
        setPendingDeleteId(null);
        setErrorMessage(
          error instanceof Error && error.message
            ? error.message
            : GENERIC_DELETE_ERROR,
        );
      },
      onSuccess: () => {
        trackProfileEvent("award_deleted", {
          awardType: target.achievement_type,
          profileType: "coach",
          section: "awards",
        });
        setPendingDeleteId(null);
      },
    });
  }

  // ── Editor ────────────────────────────────────────────────────────────
  if (draft) {
    const isEditing = draft.id !== null;
    const typeMeta = getCoachAwardTypeMeta(draft.achievementType);
    const previewTitle = buildCoachAwardTitle({
      achievement_type: draft.achievementType,
      competition_name: draft.competitionName,
      season_label: draft.seasonLabel,
    });

    return (
      <ProfileEditScaffold
        errorMessage={errorMessage}
        onBack={handleEditorBack}
        onSave={handleSaveAward}
        saveDisabled={isBusy}
        saveLabel={isEditing ? "Salva modifiche" : "Salva riconoscimento"}
        saving={saveAward.isPending}
        testID="coach-profile-edit-award-editor"
        title={isEditing ? "Modifica riconoscimento" : "Aggiungi riconoscimento"}
      >
        <View style={styles.field}>
          <AppText variant="titleSm">Tipo di riconoscimento</AppText>
          <View style={styles.chipRow}>
            {COACH_AWARD_OPTIONS.map((option) => (
              <Button
                key={option.value}
                label={option.label}
                onPress={() =>
                  setDraft({ ...draft, achievementType: option.value })
                }
                selected={draft.achievementType === option.value}
                size="sm"
                testID={`coach-award-type-${option.value}`}
                variant="chipAction"
              />
            ))}
          </View>
        </View>

        <OnboardingTextField
          label={typeMeta.competitionLabel}
          onChangeText={(value) =>
            setDraft({ ...draft, competitionName: value })
          }
          placeholder={typeMeta.competitionPlaceholder}
          testID="coach-award-competition"
          value={draft.competitionName}
        />

        <OnboardingSelectField
          label="Stagione"
          onChange={(value) => setDraft({ ...draft, seasonLabel: value })}
          options={seasonOptions}
          placeholder="Seleziona la stagione"
          searchable
          sheetTitle="Stagione"
          testID="coach-award-season"
          value={draft.seasonLabel}
        />

        {/* Stesso selettore società di onboarding e carriera: logo e nome. */}
        <FieldShell label="Società">
          <TeamAutocompleteInput
            onChangeText={(value) =>
              setDraft({ ...draft, clubId: null, clubName: value })
            }
            onSelectTeam={(team) =>
              setDraft({ ...draft, clubId: team.id, clubName: team.name })
            }
            placeholder="Cerca la società"
            searchTeams={searchTeams}
            testID="coach-award-club"
            value={draft.clubName}
          />
        </FieldShell>

        {/*
          Anteprima: anticipa la resa nel profilo combinando tipo, competizione
          e stagione. Non crea né salva nulla.
        */}
        <View style={styles.field}>
          <AppText color="secondary" variant="eyebrow">
            Anteprima
          </AppText>
          <View style={styles.previewCard} testID="coach-award-preview">
            <Ionicons
              color={colors.accent}
              name={getCoachAwardIcon(draft.achievementType)}
              size={22}
            />
            <View style={styles.previewText}>
              <AppText variant="titleSm">
                {previewTitle || "Il titolo comparirà qui"}
              </AppText>
              {draft.clubName.trim() ? (
                <AppText color="secondary" variant="bodySm">
                  {draft.clubName.trim()}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>
      </ProfileEditScaffold>
    );
  }

  // ── Lista ─────────────────────────────────────────────────────────────
  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleListBack}
      testID="coach-profile-edit-awards"
      title="Palmarès"
    >
      {profileQuery.isPending ? <CoachEditFieldsSkeleton rows={3} /> : null}

      {profileQuery.isError ? (
        <CoachEditErrorState onRetry={() => void profileQuery.refetch()} />
      ) : null}

      {data ? (
        <>
          <AppText color="secondary" variant="bodySm">
            Aggiungi i riconoscimenti più importanti del tuo percorso.
          </AppText>

          {awards.length === 0 ? (
            <View style={styles.empty} testID="coach-awards-empty">
              <AppText variant="titleSm">Racconta i tuoi traguardi</AppText>
              <AppText color="secondary" variant="bodySm">
                Aggiungi campionati, coppe, promozioni o premi personali
                ottenuti nel tuo percorso.
              </AppText>
            </View>
          ) : (
            <View style={styles.list}>
              {awards.map((award, index) => (
                <View key={award.id}>
                  {index > 0 ? <Divider /> : null}
                  <View style={styles.row}>
                    <Ionicons
                      color={colors.accent}
                      name={getCoachAwardIcon(award.achievement_type)}
                      size={22}
                    />
                    <View style={styles.rowText}>
                      <AppText variant="titleSm">
                        {award.label || buildCoachAwardTitle(award)}
                      </AppText>
                      {award.club_name ? (
                        <AppText color="secondary" variant="bodySm">
                          {award.club_name}
                        </AppText>
                      ) : null}
                    </View>

                    <Pressable
                      accessibilityLabel={`Modifica ${award.label}`}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setDraft(toDraft(award))}
                      style={styles.rowAction}
                      testID={`coach-award-edit-${award.id}`}
                    >
                      <Ionicons
                        color={colors.textSecondary}
                        name="pencil-outline"
                        size={18}
                      />
                    </Pressable>

                    <Pressable
                      accessibilityLabel={`Altre azioni per ${award.label}`}
                      accessibilityRole="button"
                      hitSlop={10}
                      onPress={() => setMenuAwardId(award.id)}
                      style={styles.rowAction}
                      testID={`coach-award-menu-${award.id}`}
                    >
                      <Ionicons
                        color={colors.textSecondary}
                        name="ellipsis-horizontal"
                        size={18}
                      />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <Button
            label="+ Aggiungi riconoscimento"
            onPress={() => {
              trackProfileEvent("award_add_tapped", {
                profileType: "coach",
                section: "awards",
              });
              setErrorMessage(null);
              setDraft(EMPTY_DRAFT);
            }}
            testID="coach-awards-add"
            variant="outline"
          />

          <Button
            label="Fine"
            onPress={handleListBack}
            testID="coach-awards-done"
            variant="tertiary"
          />
        </>
      ) : null}

      <ActionSheet
        actions={[
          {
            label: "Modifica riconoscimento",
            onPress: () => {
              const target = awards.find((award) => award.id === menuAwardId);
              setMenuAwardId(null);

              if (target) {
                setDraft(toDraft(target));
              }
            },
          },
          {
            destructive: true,
            label: "Elimina riconoscimento",
            onPress: () => {
              setPendingDeleteId(menuAwardId);
              setMenuAwardId(null);
            },
          },
        ]}
        onClose={() => setMenuAwardId(null)}
        visible={menuAwardId !== null}
      />

      <ConfirmModal
        cancelLabel="Annulla"
        confirmLabel="Elimina"
        isBusy={deleteAward.isPending}
        message="Il riconoscimento verrà rimosso dal tuo palmarès."
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={handleDelete}
        title="Eliminare questo riconoscimento?"
        visible={pendingDeleteId !== null}
      />
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  empty: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[16],
  },
  field: {
    gap: spacing[8],
  },
  list: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    overflow: "hidden",
  },
  previewCard: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius[16],
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[16],
  },
  previewText: {
    flex: 1,
    gap: spacing[4],
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  rowAction: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 32,
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
});
