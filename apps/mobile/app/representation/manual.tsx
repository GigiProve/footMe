/**
 * SCREEN 6 — Aggiunta manuale (REV-PROF-14).
 *
 * Si arriva qui solo dopo una ricerca: è il fallback, non un'alternativa
 * offerta in partenza. Quello che viene salvato NON è un profilo PROLINK — non
 * ha un account, non ha una route pubblica, non compare in Cerca, non riceve
 * badge e non entra in nessun conteggio pubblico. La visibilità è "Privato" e
 * non è negoziabile: il campo esiste per dirlo, non per cambiarlo.
 *
 * Il controllo duplicati gira prima del salvataggio e non fonde mai due persone
 * da solo: propone il record esistente e lascia decidere.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../src/components/ui/screen";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import { SelectField } from "../../src/components/ui/select-field";
import {
  AppText,
  BottomSheet,
  Button,
  ConfirmModal,
  Input,
  ScreenHeader,
  useToast,
} from "../../src/ui";
import { useSession } from "../../src/features/auth/use-session";
import { trackAssistitiEvent } from "../../src/features/relationships/assistiti/assistiti-analytics";
import {
  describeAssistitiError,
  isFutureDate,
  parseStartDateInput,
  RELATIONSHIP_TYPE_OPTIONS,
  type RelationshipType,
} from "../../src/features/relationships/assistiti/assistiti-model";
import {
  assistitiQueryKeys,
  createManualAssistito,
  findManualDuplicates,
  type ManualDuplicate,
} from "../../src/features/relationships/assistiti/assistiti-service";
import {
  BackButton,
  InfoCallout,
} from "../../src/features/relationships/assistiti/assistiti-ui";
import {
  PLAYER_CATEGORY_OPTIONS,
  PLAYER_POSITION_OPTIONS,
  getPlayerPositionLabel,
  type PlayerPosition,
} from "../../src/features/profiles/player-sports";
import { colors, radius, spacing } from "../../src/theme/tokens";

export default function ManualAssistitoScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const params = useLocalSearchParams<{ suggestedName?: string }>();

  // La query cercata è un suggerimento, non il nome definitivo: resta
  // modificabile e non viene mai salvata da sola.
  const [fullName, setFullName] = useState(params.suggestedName ?? "");
  const [position, setPosition] = useState<PlayerPosition | "">("");
  const [team, setTeam] = useState("");
  const [relationshipType, setRelationshipType] =
    useState<RelationshipType | "">("");
  const [startedOn, setStartedOn] = useState("");
  const [errors, setErrors] = useState<{
    fullName?: string;
    relationshipType?: string;
    startedOn?: string;
    submit?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [duplicates, setDuplicates] = useState<ManualDuplicate[] | null>(null);
  const [isExitPromptVisible, setExitPromptVisible] = useState(false);

  const isDirty =
    fullName.trim() !== (params.suggestedName ?? "").trim() ||
    position !== "" ||
    team !== "" ||
    relationshipType !== "" ||
    startedOn !== "";

  function validate(): string | null {
    const nextErrors: typeof errors = {};

    if (fullName.trim().length === 0) {
      nextErrors.fullName = "Inserisci nome e cognome.";
    }

    if (!relationshipType) {
      nextErrors.relationshipType = "Seleziona un tipo di rapporto.";
    }

    let isoDate: string | null = null;

    if (startedOn.trim()) {
      isoDate = parseStartDateInput(startedOn);

      if (!isoDate || isFutureDate(isoDate)) {
        nextErrors.startedOn = "La data iniziale non è valida.";
      }
    }

    setErrors(nextErrors);

    return Object.keys(nextErrors).length > 0 ? null : (isoDate ?? "");
  }

  async function save(confirmDuplicate: boolean) {
    const validated = validate();

    if (validated === null) {
      return;
    }

    setIsSaving(true);
    setErrors({});

    try {
      const created = await createManualAssistito({
        confirmDuplicate,
        fullName: fullName.trim(),
        position: position || null,
        relationshipType: relationshipType as RelationshipType,
        startedOn: validated || null,
        team: team || null,
      });

      trackAssistitiEvent("assistiti_manual_created", {
        relationshipType: relationshipType as RelationshipType,
        success: true,
      });
      trackAssistitiEvent("assistiti_invite_created");

      if (profile?.id) {
        await queryClient.invalidateQueries({
          queryKey: assistitiQueryKeys.counts(profile.id),
        });
        await queryClient.invalidateQueries({
          queryKey: assistitiQueryKeys.overview(profile.id),
        });
      }

      showToast({ message: "Assistito salvato.", tone: "success" });

      // Il token in chiaro vive solo in questo passaggio: va consegnato subito
      // alla schermata di invito e non viene mai riletto da nessuna parte.
      router.replace({
        params: {
          inviteId: created.invite_id,
          manualId: created.manual_id,
          token: created.invite_token,
        },
        pathname: `/representation/invite/${created.manual_id}`,
      } as never);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "";

      if (raw.includes("DUPLICATE_SUSPECTED")) {
        trackAssistitiEvent("assistiti_manual_duplicate_shown");

        try {
          setDuplicates(
            await findManualDuplicates({
              fullName: fullName.trim(),
              position: position || null,
              team: team || null,
            }),
          );
        } catch {
          setDuplicates([]);
        }

        return;
      }

      trackAssistitiEvent("assistiti_manual_failed", { success: false });
      setErrors({
        submit: describeAssistitiError(
          error,
          "Non è stato possibile salvare l'assistito. Riprova.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleBack() {
    if (isDirty) {
      setExitPromptVisible(true);
      return;
    }

    router.back();
  }

  return (
    <Screen>
      <ScreenHeader
        leading={<BackButton onPress={handleBack} />}
        title="Aggiungi manualmente"
      />

      <KeyboardAwareForm contentContainerStyle={styles.form}>
        <InfoCallout testID="assistiti-manual-notice">
          <AppText color="secondary" variant="bodySm">
            Non verrà creato un profilo PROLINK. I dati serviranno solo a
            identificare l&apos;assistito fino alla registrazione.
          </AppText>
        </InfoCallout>

        <View>
          <Input
            autoCapitalize="words"
            label="Nome e cognome"
            onChangeText={setFullName}
            placeholder="Nome e cognome"
            testID="assistiti-manual-name"
            value={fullName}
          />
          {errors.fullName ? (
            <AppText color="danger" variant="caption">
              {errors.fullName}
            </AppText>
          ) : null}
        </View>

        <SelectField
          label="Ruolo"
          onChange={(next) => setPosition(next as PlayerPosition | "")}
          options={PLAYER_POSITION_OPTIONS}
          placeholder="Seleziona un ruolo"
          value={position}
        />

        <SelectField
          allowClear
          label="Squadra / Categoria"
          onChange={(next) => setTeam(next)}
          options={PLAYER_CATEGORY_OPTIONS}
          placeholder="Seleziona una categoria"
          value={team}
        />

        <View>
          <SelectField
            label="Tipo di rapporto"
            onChange={(next) =>
              setRelationshipType(next as RelationshipType | "")
            }
            options={RELATIONSHIP_TYPE_OPTIONS.map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            placeholder="Seleziona il tipo di rapporto"
            value={relationshipType}
          />
          {errors.relationshipType ? (
            <AppText color="danger" variant="caption">
              {errors.relationshipType}
            </AppText>
          ) : null}
        </View>

        <View>
          <Input
            keyboardType="numbers-and-punctuation"
            label="Dal"
            onChangeText={setStartedOn}
            placeholder="Anno (2024) o gg/mm/aaaa"
            testID="assistiti-manual-start"
            value={startedOn}
          />
          {errors.startedOn ? (
            <AppText color="danger" variant="caption">
              {errors.startedOn}
            </AppText>
          ) : null}
        </View>

        <View style={styles.lockedField}>
          <AppText color="muted" variant="caption">
            Visibilità
          </AppText>
          <View style={styles.lockedValue}>
            <Ionicons
              color={colors.textMuted}
              name="lock-closed-outline"
              size={16}
            />
            <AppText variant="bodyLg">Privato</AppText>
          </View>
          <AppText color="muted" variant="caption">
            Gli inserimenti manuali non sono pubblici.
          </AppText>
        </View>

        {errors.submit ? (
          <AppText color="danger" variant="bodySm">
            {errors.submit}
          </AppText>
        ) : null}
      </KeyboardAwareForm>

      <View style={styles.footer}>
        <Button
          fullWidth
          label="Salva e invita"
          loading={isSaving}
          onPress={() => void save(false)}
          testID="assistiti-manual-save"
        />
        <Button
          label="Annulla"
          onPress={handleBack}
          variant="link"
        />
      </View>

      <BottomSheet
        onClose={() => setDuplicates(null)}
        title="Potrebbe essere già presente"
        visible={duplicates != null}
      >
        <View style={styles.duplicateBody}>
          <AppText color="secondary" variant="bodySm">
            Questo record potrebbe essere già presente nel tuo portfolio.
          </AppText>

          {(duplicates ?? []).map((duplicate) => (
            <Pressable
              accessibilityRole="button"
              key={`${duplicate.kind}-${duplicate.id}`}
              onPress={() => {
                setDuplicates(null);
                router.replace(
                  (duplicate.kind === "manual"
                    ? `/representation/invite/${duplicate.id}`
                    : `/representation/assistito/${duplicate.id}`) as never,
                );
              }}
              style={styles.duplicateRow}
            >
              <View style={styles.duplicateText}>
                <AppText numberOfLines={1} variant="titleSm">
                  {duplicate.full_name}
                </AppText>
                <AppText color="muted" numberOfLines={1} variant="caption">
                  {[
                    duplicate.primary_position
                      ? getPlayerPositionLabel(duplicate.primary_position)
                      : null,
                    duplicate.team_label,
                    duplicate.kind === "representation"
                      ? "Già nel portfolio"
                      : "Record manuale",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </AppText>
              </View>
              <Ionicons
                color={colors.textMuted}
                name="chevron-forward"
                size={18}
              />
            </Pressable>
          ))}

          <Button
            fullWidth
            label="È una persona diversa, continua"
            loading={isSaving}
            onPress={() => {
              setDuplicates(null);
              void save(true);
            }}
            variant="outline"
          />
          <Button
            label="Annulla"
            onPress={() => setDuplicates(null)}
            variant="link"
          />
        </View>
      </BottomSheet>

      <ConfirmModal
        cancelLabel="Continua a modificare"
        confirmLabel="Esci senza salvare"
        message="Le modifiche effettuate andranno perse."
        onCancel={() => setExitPromptVisible(false)}
        onConfirm={() => {
          setExitPromptVisible(false);
          router.back();
        }}
        title="Uscire senza salvare?"
        visible={isExitPromptVisible}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  duplicateBody: {
    gap: spacing[12],
    paddingBottom: spacing[8],
  },
  duplicateRow: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 56,
    paddingHorizontal: spacing[12],
  },
  duplicateText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing[4],
    paddingTop: spacing[12],
  },
  form: {
    gap: spacing[16],
    paddingBottom: spacing[24],
  },
  lockedField: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    gap: spacing[4],
    padding: spacing[12],
  },
  lockedValue: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
});
