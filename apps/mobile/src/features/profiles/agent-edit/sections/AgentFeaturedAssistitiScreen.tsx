/**
 * Assistiti in evidenza del Procuratore (REV-PROF-16, schermata 7).
 *
 * Questa schermata fa **una cosa sola**: sceglie quali assistiti pubblici
 * compaiono nel Master Profile e in che ordine. Non crea un assistito, non lo
 * invita, non approva una richiesta, non cambia il tipo di rapporto, non
 * rende pubblico un rapporto privato e non elimina niente — tutto questo
 * appartiene alla Gestione assistiti, raggiungibile dalla CTA secondaria.
 * Non è una scelta di interfaccia: la RPC che salva scrive solo la posizione.
 *
 * L'elenco contiene i soli rapporti accettati e pubblici, già filtrati dal
 * backend. Inserimenti manuali, inviti non completati, richieste in attesa o
 * rifiutate, collegamenti annullati e rapporti privati non arrivano qui.
 *
 * L'ordine si cambia con "Sposta su" e "Sposta giù", non col trascinamento.
 * Non è una semplificazione: una lista di tre elementi con comandi espliciti
 * è utilizzabile da chiunque — screen reader compresi — mentre un drag and
 * drop senza alternativa non lo sarebbe. La numerazione visibile dice qual è
 * la posizione prima ancora di toccare qualcosa.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../../ui";
import type { AgentPublicAssistito } from "../../../relationships/agent-representation-service";
import { getPlayerPositionLabel } from "../../player-sports";
import { trackProfileEvent } from "../../profile-analytics";
import { withDefaultProfileAvatar } from "../../profile-avatar";
import { ProfileEditScaffold } from "../../edit/ProfileEditScaffold";
import {
  ProfileEditErrorState,
  ProfileEditFieldsSkeleton,
} from "../../edit/ProfileEditStates";
import { useUnsavedChangesGuard } from "../../edit/use-unsaved-changes-guard";
import {
  AGENT_FEATURED_LIMIT,
  AGENT_FEATURED_LIMIT_MESSAGE,
  moveFeaturedSelection,
  pruneFeaturedSelection,
  readFeaturedSelection,
  toggleFeaturedSelection,
  useAgentPublicAssistitiQuery,
  useSaveFeaturedAssistiti,
} from "../agent-featured-assistiti";
import { useAgentEditorGuard } from "../use-agent-editor-guard";

const GENERIC_SAVE_ERROR =
  "Non è stato possibile salvare le modifiche. Riprova.";

export function AgentFeaturedAssistitiScreen() {
  const { userId } = useAgentEditorGuard();
  const assistitiQuery = useAgentPublicAssistitiQuery(userId);
  const save = useSaveFeaturedAssistiti();
  const assistiti = useMemo(
    () => assistitiQuery.data ?? [],
    [assistitiQuery.data],
  );

  const initialSelection = useMemo(
    () => readFeaturedSelection(assistiti),
    [assistiti],
  );

  const [draft, setDraft] = useState<string[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [limitMessage, setLimitMessage] = useState<string | null>(null);
  /*
    L'elenco può cambiare altrove mentre questa schermata è aperta — un
    assistito reso privato dalla Gestione assistiti, per esempio. Chi non è
    più eleggibile esce dalla selezione *in lettura*, senza che nessuno
    prenda il suo posto: derivarlo qui invece di correggere la bozza in un
    effetto evita un render in più e, soprattutto, evita che la bozza e
    l'elenco possano restare per un istante in disaccordo.
  */
  const selection = useMemo(
    () => pruneFeaturedSelection(draft ?? initialSelection, assistiti),
    [assistiti, draft, initialSelection],
  );

  /** Una scelta è caduta perché non più eleggibile, non per un errore. */
  const hasStaleSelection = draft !== null && draft.length !== selection.length;

  useFocusEffect(
    useCallback(() => {
      trackProfileEvent("agent_featured_assistiti_opened", {
        profileType: "agent",
        section: "assistiti",
      });
    }, []),
  );

  useEffect(() => {
    if (assistitiQuery.isError) {
      trackProfileEvent("agent_featured_assistiti_load_failed", {
        profileType: "agent",
        section: "assistiti",
        success: false,
      });
    }
  }, [assistitiQuery.isError]);

  const isDirty =
    draft !== null &&
    JSON.stringify(selection) !== JSON.stringify(initialSelection);

  const handleBack = useUnsavedChangesGuard({
    isDirty,
    isSaving: save.isPending,
    onLeave: () => {
      if (isDirty) {
        trackProfileEvent("profile_edit_unsaved_exit", {
          profileType: "agent",
          section: "assistiti",
        });
      }

      router.back();
    },
  });

  function handleToggle(relationshipId: string) {
    const next = toggleFeaturedSelection(selection, relationshipId);

    if (next.atLimit) {
      trackProfileEvent("agent_featured_assistiti_limit_reached", {
        profileType: "agent",
        section: "assistiti",
        selectionCount: selection.length,
      });
      setLimitMessage(AGENT_FEATURED_LIMIT_MESSAGE);
      return;
    }

    trackProfileEvent("agent_featured_assistito_changed", {
      profileType: "agent",
      section: "assistiti",
      selectionCount: next.selection.length,
    });
    setErrorMessage(null);
    setLimitMessage(null);
    setDraft(next.selection);
  }

  function handleMove(relationshipId: string, direction: "down" | "up") {
    trackProfileEvent("agent_featured_assistiti_reordered", {
      profileType: "agent",
      section: "assistiti",
      selectionCount: selection.length,
    });
    setErrorMessage(null);
    setDraft(moveFeaturedSelection(selection, relationshipId, direction));
  }

  /** Esce dal modulo: una bozza non salvata va confermata, come per il back. */
  const handleManageAll = useCallback(() => {
    trackProfileEvent("agent_featured_assistiti_manage_tapped", {
      profileType: "agent",
      section: "assistiti",
    });

    const open = () => router.push("/representation/hub?source=profile-edit");

    if (!isDirty) {
      open();
      return;
    }

    Alert.alert(
      "Vuoi uscire senza salvare?",
      "Le modifiche effettuate andranno perse.",
      [
        { style: "cancel", text: "Continua a modificare" },
        { onPress: open, style: "destructive", text: "Esci senza salvare" },
      ],
    );
  }, [isDirty]);

  function handleSave() {
    if (!userId) {
      return;
    }

    setErrorMessage(null);
    save.mutate(
      { profileId: userId, relationshipIds: selection },
      {
        onError: (error) => {
          trackProfileEvent("profile_edit_section_save_failed", {
            profileType: "agent",
            section: "assistiti",
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
            profileType: "agent",
            section: "assistiti",
            selectionCount: selection.length,
            success: true,
          });
          setDraft(null);
          router.back();
        },
      },
    );
  }

  /*
    I selezionati in testa e nel loro ordine, gli altri dopo: la numerazione
    deve stare accanto alla riga che la porta, non a tre righe di distanza.
  */
  const ordered = useMemo(() => {
    const byId = new Map(assistiti.map((item) => [item.id, item]));
    const selected = selection
      .map((id) => byId.get(id))
      .filter((item): item is AgentPublicAssistito => Boolean(item));
    const rest = assistiti.filter((item) => !selection.includes(item.id));

    return [...selected, ...rest];
  }, [assistiti, selection]);

  const hasAssistiti = assistiti.length > 0;

  return (
    <ProfileEditScaffold
      errorMessage={errorMessage}
      onBack={handleBack}
      onSave={hasAssistiti ? handleSave : undefined}
      saving={save.isPending}
      testID="agent-profile-edit-assistiti"
      title="Assistiti in evidenza"
    >
      {assistitiQuery.isPending ? (
        <ProfileEditFieldsSkeleton rows={4} testID="agent-edit-skeleton" />
      ) : null}

      {assistitiQuery.isError ? (
        <ProfileEditErrorState
          message="Non è stato possibile caricare gli assistiti."
          onRetry={() => void assistitiQuery.refetch()}
          testID="agent-assistiti-error"
        />
      ) : null}

      {!assistitiQuery.isPending && !assistitiQuery.isError ? (
        <>
          <AppText color="secondary" variant="bodySm">
            Scegli fino a 3 assistiti pubblici da mostrare nel profilo.
          </AppText>

          {hasAssistiti ? (
            <>
              <View style={styles.counter}>
                <AppText
                  accessibilityLiveRegion="polite"
                  color="secondary"
                  testID="agent-assistiti-counter"
                  variant="meta"
                >
                  {`${selection.length} di ${AGENT_FEATURED_LIMIT} selezionati`}
                </AppText>
              </View>

              <View style={styles.list}>
                {ordered.map((item) => {
                  const position = selection.indexOf(item.id);
                  const isSelected = position >= 0;
                  const name = item.player_full_name ?? "Giocatore";
                  const meta = [
                    item.primary_position
                      ? getPlayerPositionLabel(item.primary_position)
                      : null,
                    item.current_team,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <View key={item.id} style={styles.rowWrapper}>
                      <Pressable
                        accessibilityHint={
                          isSelected
                            ? `In evidenza in posizione ${position + 1}`
                            : undefined
                        }
                        accessibilityLabel={`${name}${meta ? `, ${meta}` : ""}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{
                          checked: isSelected,
                          selected: isSelected,
                        }}
                        onPress={() => handleToggle(item.id)}
                        style={({ pressed }) => [
                          styles.row,
                          isSelected ? styles.rowSelected : null,
                          pressed ? styles.rowPressed : null,
                        ]}
                        testID={`agent-assistito-${item.id}`}
                      >
                        {/* La posizione è un numero, non solo un ordine visivo. */}
                        <AppText
                          color={isSelected ? "accent" : "muted"}
                          style={styles.position}
                          variant="meta"
                        >
                          {isSelected ? `${position + 1}` : "—"}
                        </AppText>

                        <Avatar
                          name={name}
                          size="md"
                          uri={withDefaultProfileAvatar(item.player_avatar_url)}
                        />

                        <View style={styles.rowText}>
                          <AppText numberOfLines={1} variant="titleSm">
                            {name}
                          </AppText>
                          {meta ? (
                            <AppText
                              color="secondary"
                              numberOfLines={1}
                              variant="meta"
                            >
                              {meta}
                            </AppText>
                          ) : null}
                        </View>

                        {/* Lo stato non è affidato al solo colore. */}
                        <Ionicons
                          color={isSelected ? colors.accent : colors.border}
                          name={
                            isSelected
                              ? "checkmark-circle"
                              : "ellipse-outline"
                          }
                          size={24}
                        />
                      </Pressable>

                      {isSelected ? (
                        <View style={styles.reorder}>
                          <Button
                            disabled={position === 0}
                            label="Sposta su"
                            onPress={() => handleMove(item.id, "up")}
                            size="sm"
                            testID={`agent-assistito-${item.id}-up`}
                            variant="ghost"
                          />
                          <Button
                            disabled={position === selection.length - 1}
                            label="Sposta giù"
                            onPress={() => handleMove(item.id, "down")}
                            size="sm"
                            testID={`agent-assistito-${item.id}-down`}
                            variant="ghost"
                          />
                        </View>
                      ) : null}
                    </View>
                  );
                })}
              </View>

              {hasStaleSelection ? (
                <AppText
                  accessibilityLiveRegion="polite"
                  color="danger"
                  testID="agent-assistiti-stale"
                  variant="meta"
                >
                  Questo assistito non è più disponibile.
                </AppText>
              ) : null}

              {limitMessage ? (
                <AppText
                  accessibilityLiveRegion="polite"
                  color="danger"
                  testID="agent-assistiti-limit"
                  variant="meta"
                >
                  {limitMessage}
                </AppText>
              ) : null}
            </>
          ) : (
            <View style={styles.empty} testID="agent-assistiti-empty">
              <AppText variant="titleSm">Nessun assistito disponibile</AppText>
              <AppText color="secondary" variant="bodySm">
                Puoi mettere in evidenza gli assistiti collegati e visibili
                pubblicamente.
              </AppText>
            </View>
          )}

          <Button
            fullWidth
            label={
              hasAssistiti ? "Gestisci tutti gli assistiti" : "Gestisci assistiti"
            }
            onPress={handleManageAll}
            size="md"
            testID="agent-assistiti-manage-all"
            variant="secondary"
          />
        </>
      ) : null}
    </ProfileEditScaffold>
  );
}

const styles = StyleSheet.create({
  counter: {
    alignItems: "center",
  },
  empty: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    gap: spacing[8],
    padding: spacing[24],
  },
  list: {
    gap: spacing[8],
  },
  position: {
    minWidth: 16,
    textAlign: "center",
  },
  reorder: {
    flexDirection: "row",
    gap: spacing[8],
    justifyContent: "flex-end",
    paddingHorizontal: spacing[8],
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowSelected: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  rowText: {
    flex: 1,
    gap: spacing[4],
  },
  rowWrapper: {
    gap: spacing[4],
  },
});
