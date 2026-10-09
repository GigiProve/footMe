/**
 * Gestione di un rapporto attivo o di una richiesta pendente, lato Procuratore
 * (REV-PROF-14).
 *
 * È l'unico form di modifica del rapporto: hub, notifiche e schermata richieste
 * portano tutti qui, quindi tipo, visibilità e date hanno un solo posto dove
 * cambiare.
 *
 * La visibilità non si modifica come gli altri campi: passare a "Pubblico"
 * manda una proposta al calciatore e diventa effettiva solo con il suo
 * consenso. Tornare privato è immediato, perché togliere visibilità non ha
 * bisogno del permesso di nessuno.
 */
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { Screen } from "../../../src/components/ui/screen";
import { KeyboardAwareForm } from "../../../src/components/ui/keyboard-aware-form";
import {
  AppText,
  Avatar,
  Badge,
  Button,
  ConfirmModal,
  Divider,
  Input,
  ScreenHeader,
  useToast,
} from "../../../src/ui";
import { useSession } from "../../../src/features/auth/use-session";
import { useUnsavedChangesGuard } from "../../../src/features/profiles/edit/use-unsaved-changes-guard";
import {
  fetchRepresentationDetail,
  proposeVisibility,
  removeRepresentation,
  setPrivateNote,
  type AgentRepresentation,
} from "../../../src/features/relationships/agent-representation-service";
import { trackAssistitiEvent } from "../../../src/features/relationships/assistiti/assistiti-analytics";
import {
  describeAssistitiError,
  formatIsoDate,
  isFutureDate,
  parseStartDateInput,
  type RelationshipType,
  type RepresentationVisibility,
} from "../../../src/features/relationships/assistiti/assistiti-model";
import {
  assistitiQueryKeys,
  endRepresentation,
  updateRepresentationTerms,
} from "../../../src/features/relationships/assistiti/assistiti-service";
import {
  AssistitiSkeleton,
  BackButton,
  RelationshipTypeChoice,
  SectionError,
  VisibilityChoice,
} from "../../../src/features/relationships/assistiti/assistiti-ui";
import { supabase } from "../../../src/lib/supabase";
import { colors, radius, spacing } from "../../../src/theme/tokens";

type Detail = AgentRepresentation & {
  agent_full_name: string | null;
};

type PendingAction = "end" | "remove" | null;

async function fetchPlayerProfile(profileId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", profileId)
    .maybeSingle();

  return {
    avatar_url: (data?.avatar_url as string | null) ?? null,
    full_name: (data?.full_name as string | null) ?? null,
  };
}

export default function AssistitoDetailScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const representationId = typeof id === "string" ? id : "";

  const [detail, setDetail] = useState<Detail | null>(null);
  const [player, setPlayer] = useState<{
    avatar_url: string | null;
    full_name: string | null;
  }>({ avatar_url: null, full_name: null });
  const [isLoading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [relationshipType, setRelationshipType] =
    useState<RelationshipType | null>(null);
  const [visibility, setVisibility] =
    useState<RepresentationVisibility | null>(null);
  const [startedOn, setStartedOn] = useState("");
  const [endedOn, setEndedOn] = useState("");
  const [note, setNote] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const [isSavingNote, setSavingNote] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isActing, setActing] = useState(false);

  const load = useCallback(async () => {
    if (!representationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const row = await fetchRepresentationDetail(representationId);

      if (!row) {
        setLoadError("Collegamento non trovato.");
        return;
      }

      setDetail(row);
      setRelationshipType(row.relationship_type);
      setVisibility(row.visibility);
      setStartedOn(formatIsoDate(row.started_on ?? null));
      setNote(row.private_note ?? "");
      setPlayer(await fetchPlayerProfile(row.player_profile_id));
    } catch {
      setLoadError("Non è stato possibile caricare il rapporto.");
    } finally {
      setLoading(false);
    }
  }, [representationId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refreshLists() {
    if (!profile?.id) {
      return;
    }

    await queryClient.invalidateQueries({
      queryKey: assistitiQueryKeys.overview(profile.id),
    });
    await queryClient.invalidateQueries({
      queryKey: assistitiQueryKeys.counts(profile.id),
    });
  }

  async function handleSave() {
    if (!detail || isSaving) {
      return;
    }

    let isoStart: string | null = null;

    if (startedOn.trim()) {
      isoStart = parseStartDateInput(startedOn);

      if (!isoStart || isFutureDate(isoStart)) {
        setFieldError("La data iniziale non è valida.");
        return;
      }
    }

    setFieldError(null);
    setSaving(true);

    try {
      await updateRepresentationTerms({
        id: detail.id,
        relationshipType: relationshipType ?? undefined,
        startedOn: isoStart,
      });

      if (visibility && visibility !== detail.visibility) {
        // Passa dalla proposta: il backend applica "privato" subito e manda
        // "pubblico" in approvazione al calciatore.
        await proposeVisibility(detail.id, visibility);
      }

      trackAssistitiEvent("assistiti_relationship_updated", {
        relationshipType: relationshipType ?? undefined,
        success: true,
        visibility: visibility ?? undefined,
      });

      await refreshLists();
      await load();
      showToast({ message: "Rapporto aggiornato.", tone: "success" });
    } catch (error) {
      setFieldError(
        describeAssistitiError(
          error,
          "Non è stato possibile aggiornare il rapporto. Riprova.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveNote() {
    if (!detail) {
      return;
    }

    setSavingNote(true);

    try {
      await setPrivateNote(detail.id, note.trim());
      showToast({ message: "Nota salvata.", tone: "success" });
    } catch {
      showToast({ message: "Non è stato possibile salvare la nota." });
    } finally {
      setSavingNote(false);
    }
  }

  async function handlePendingAction() {
    if (!detail || !pendingAction) {
      return;
    }

    setActing(true);

    try {
      if (pendingAction === "end") {
        let isoEnd: string | null = null;

        if (endedOn.trim()) {
          isoEnd = parseStartDateInput(endedOn);

          if (!isoEnd || isFutureDate(isoEnd)) {
            setFieldError("La data finale non è valida.");
            setPendingAction(null);
            return;
          }
        }

        await endRepresentation(detail.id, isoEnd);
        trackAssistitiEvent("assistiti_relationship_ended", { success: true });
        showToast({ message: "Rapporto concluso.", tone: "success" });
      } else {
        await removeRepresentation(detail.id);
        trackAssistitiEvent("assistiti_relationship_removed", { success: true });
        showToast({ message: "Collegamento rimosso.", tone: "success" });
      }

      await refreshLists();
      setPendingAction(null);
      router.back();
    } catch (error) {
      showToast({
        message: describeAssistitiError(
          error,
          "Non è stato possibile aggiornare il rapporto. Riprova.",
        ),
      });
      setPendingAction(null);
    } finally {
      setActing(false);
    }
  }

  /*
    Tipo di rappresentanza, visibilità, data e nota privata si modificano qui
    e si salvano con una CTA: uscire con il chevron, il back di sistema o la
    gesture li perdeva in silenzio. Confrontiamo con il record caricato, così
    un'uscita senza modifiche resta immediata.
  */
  const isDirty = Boolean(
    detail &&
      (relationshipType !== detail.relationship_type ||
        visibility !== detail.visibility ||
        startedOn !== formatIsoDate(detail.started_on ?? null) ||
        note !== (detail.private_note ?? "")),
  );

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: isSaving || isSavingNote,
    onLeave: () => router.back(),
  });

  const playerName = player.full_name ?? "Calciatore";
  const isAccepted = detail?.status === "accepted";
  const isPending = detail?.status === "pending";

  return (
    <Screen>
      <ScreenHeader
        leading={<BackButton onPress={handleBack} />}
        title="Gestisci rapporto"
      />

      {isLoading ? (
        <AssistitiSkeleton rows={3} />
      ) : loadError || !detail ? (
        <SectionError
          message={loadError ?? "Collegamento non trovato."}
          onRetry={() => void load()}
        />
      ) : (
        <>
          <KeyboardAwareForm contentContainerStyle={styles.form}>
            <View style={styles.playerCard}>
              <Avatar
                name={playerName}
                size="lg"
                uri={player.avatar_url ?? undefined}
              />
              <View style={styles.playerBody}>
                <AppText numberOfLines={1} variant="titleSm">
                  {playerName}
                </AppText>
                <Badge
                  label={
                    isAccepted
                      ? "Attivo"
                      : isPending
                        ? "In attesa"
                        : "Non attivo"
                  }
                  variant={isAccepted ? "success" : "warning"}
                />
                {detail.pending_visibility ? (
                  <AppText color="secondary" variant="caption">
                    Proposta di visibilità in attesa di conferma.
                  </AppText>
                ) : null}
              </View>
            </View>

            <Button
              label="Vedi profilo"
              onPress={() =>
                router.push({
                  params: { id: detail.player_profile_id },
                  pathname: "/profile/[id]",
                })
              }
              size="sm"
              variant="outline"
            />

            <Divider />

            <View style={styles.block}>
              <AppText color="muted" variant="eyebrow">
                Tipo di rapporto
              </AppText>
              <RelationshipTypeChoice
                onChange={setRelationshipType}
                value={relationshipType}
              />
            </View>

            <View style={styles.block}>
              <AppText color="muted" variant="eyebrow">
                Visibilità nel profilo
              </AppText>
              <VisibilityChoice onChange={setVisibility} value={visibility} />
              <AppText color="muted" variant="caption">
                Rendere pubblico il rapporto richiede la conferma del
                Calciatore.
              </AppText>
            </View>

            <Input
              keyboardType="numbers-and-punctuation"
              label="Dal"
              onChangeText={setStartedOn}
              placeholder="Anno (2024) o gg/mm/aaaa"
              testID="assistito-detail-start"
              value={startedOn}
            />

            {fieldError ? (
              <AppText color="danger" variant="bodySm">
                {fieldError}
              </AppText>
            ) : null}

            <Button
              fullWidth
              label="Salva modifiche"
              loading={isSaving}
              onPress={() => void handleSave()}
              testID="assistito-detail-save"
            />

            <Divider />

            <View style={styles.block}>
              <AppText color="muted" variant="eyebrow">
                Nota privata
              </AppText>
              <AppText color="secondary" variant="caption">
                Visibile solo a te.
              </AppText>
              <Input
                multiline
                onChangeText={setNote}
                placeholder="Aggiungi una nota privata su questo assistito…"
                value={note}
              />
              <Button
                label="Salva nota"
                loading={isSavingNote}
                onPress={() => void handleSaveNote()}
                size="sm"
                variant="secondary"
              />
            </View>

            {isAccepted ? (
              <>
                <Divider />
                <View style={styles.block}>
                  <AppText color="muted" variant="eyebrow">
                    Concludi rapporto
                  </AppText>
                  <Input
                    keyboardType="numbers-and-punctuation"
                    label="Data finale (facoltativa)"
                    onChangeText={setEndedOn}
                    placeholder="Anno (2026) o gg/mm/aaaa"
                    value={endedOn}
                  />
                  <Button
                    fullWidth
                    label="Concludi rapporto"
                    onPress={() => setPendingAction("end")}
                    variant="outline"
                  />
                </View>
              </>
            ) : null}

            <Divider />

            <Button
              destructive
              fullWidth
              label="Rimuovi collegamento"
              onPress={() => setPendingAction("remove")}
              variant="danger"
            />
          </KeyboardAwareForm>

          <ConfirmModal
            cancelLabel="Annulla"
            confirmLabel={
              pendingAction === "end" ? "Concludi rapporto" : "Rimuovi"
            }
            destructive
            isBusy={isActing}
            message={
              pendingAction === "end"
                ? "Il rapporto verrà spostato nello storico e non comparirà più tra gli assistiti attivi."
                : `${playerName} verrà rimosso dal tuo portfolio.`
            }
            onCancel={() => setPendingAction(null)}
            onConfirm={() => void handlePendingAction()}
            title={
              pendingAction === "end"
                ? "Concludere questo rapporto?"
                : "Rimuovere il collegamento?"
            }
            visible={pendingAction != null}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[8],
  },
  form: {
    gap: spacing[16],
    paddingBottom: spacing[40],
  },
  playerBody: {
    alignItems: "flex-start",
    flex: 1,
    gap: spacing[6],
    minWidth: 0,
  },
  playerCard: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[14],
    padding: spacing[16],
  },
});
