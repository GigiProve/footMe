/**
 * SCREEN 4 — Richiedi collegamento (REV-PROF-14).
 *
 * Tipo di rapporto e visibilità sono obbligatori e non hanno un default
 * silenzioso: il procuratore deve sceglierli, perché la visibilità decide se il
 * rapporto finirà nel profilo pubblico del calciatore.
 *
 * La richiesta nasce `pending`: non tocca il portfolio pubblico finché il
 * calciatore non accetta.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";

import { Screen } from "../../src/components/ui/screen";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import {
  AppText,
  Avatar,
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
  type RelationshipType,
  type RepresentationVisibility,
} from "../../src/features/relationships/assistiti/assistiti-model";
import { assistitiQueryKeys } from "../../src/features/relationships/assistiti/assistiti-service";
import {
  BackButton,
  RelationshipTypeChoice,
  VisibilityChoice,
} from "../../src/features/relationships/assistiti/assistiti-ui";
import { requestRepresentation } from "../../src/features/relationships/agent-representation-service";
import {
  getPlayerPositionLabel,
  type PlayerPosition,
} from "../../src/features/profiles/player-sports";
import { colors, radius, spacing } from "../../src/theme/tokens";

const MESSAGE_MAX_LENGTH = 400;

export default function RequestRepresentationScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const params = useLocalSearchParams<{
    name?: string;
    playerId?: string;
    position?: string;
    team?: string;
  }>();

  const playerId = params.playerId ?? "";
  const name = params.name ?? "Calciatore";
  const position = (params.position ?? "") as PlayerPosition | "";
  const team = params.team ?? "";

  const [relationshipType, setRelationshipType] =
    useState<RelationshipType | null>(null);
  const [visibility, setVisibility] =
    useState<RepresentationVisibility | null>(null);
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<{
    relationshipType?: string;
    submit?: string;
    visibility?: string;
  }>({});
  const [isSending, setIsSending] = useState(false);
  const [isExitPromptVisible, setExitPromptVisible] = useState(false);

  const metaLine = [
    position ? getPlayerPositionLabel(position) : null,
    team || null,
  ]
    .filter(Boolean)
    .join(" · ");

  const isDirty =
    relationshipType != null || visibility != null || message.trim().length > 0;

  async function handleSend() {
    if (isSending) {
      // Doppio tap: la richiesta è già partita e la RPC è idempotente, ma non
      // c'è ragione di farne partire una seconda.
      return;
    }

    const nextErrors: typeof errors = {};

    if (!relationshipType) {
      nextErrors.relationshipType = "Seleziona un tipo di rapporto.";
    }

    if (!visibility) {
      nextErrors.visibility = "Seleziona la visibilità.";
    }

    if (Object.keys(nextErrors).length > 0 || !playerId) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSending(true);

    try {
      await requestRepresentation(playerId, {
        message: message.trim() || undefined,
        relationshipType: relationshipType!,
        visibility: visibility!,
      });

      trackAssistitiEvent("assistiti_request_sent", {
        relationshipType: relationshipType!,
        success: true,
        visibility: visibility!,
      });

      if (profile?.id) {
        await queryClient.invalidateQueries({
          queryKey: assistitiQueryKeys.counts(profile.id),
        });
        await queryClient.invalidateQueries({
          queryKey: assistitiQueryKeys.overview(profile.id),
        });
      }

      showToast({ message: "Richiesta inviata.", tone: "success" });
      router.back();
    } catch (error) {
      trackAssistitiEvent("assistiti_request_failed", { success: false });
      // I valori restano compilati: un errore di rete non deve costare il form.
      setErrors({
        submit: describeAssistitiError(
          error,
          "Non è stato possibile inviare la richiesta. Riprova.",
        ),
      });
    } finally {
      setIsSending(false);
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
        title="Richiedi collegamento"
      />

      <KeyboardAwareForm contentContainerStyle={styles.form}>
        <View style={styles.summary}>
          <Avatar name={name} size="md" />
          <View style={styles.summaryBody}>
            <AppText numberOfLines={1} variant="titleSm">
              {name}
            </AppText>
            {metaLine ? (
              <AppText color="secondary" numberOfLines={1} variant="bodySm">
                {metaLine}
              </AppText>
            ) : null}
          </View>
        </View>

        <View style={styles.block}>
          <AppText color="muted" variant="eyebrow">
            Tipo di rapporto
          </AppText>
          <RelationshipTypeChoice
            onChange={(next) => {
              setRelationshipType(next);
              setErrors((current) => ({ ...current, relationshipType: undefined }));
              trackAssistitiEvent("assistiti_request_type_selected", {
                relationshipType: next,
              });
            }}
            value={relationshipType}
          />
          {errors.relationshipType ? (
            <AppText color="danger" variant="caption">
              {errors.relationshipType}
            </AppText>
          ) : null}
        </View>

        <View style={styles.block}>
          <AppText color="muted" variant="eyebrow">
            Visibilità nel profilo
          </AppText>
          <VisibilityChoice
            onChange={(next) => {
              setVisibility(next);
              setErrors((current) => ({ ...current, visibility: undefined }));
              trackAssistitiEvent("assistiti_request_visibility_selected", {
                visibility: next,
              });
            }}
            value={visibility}
          />
          <AppText color="muted" variant="caption">
            {visibility === "private"
              ? "Il rapporto sarà visibile soltanto a te e al Calciatore."
              : "Il rapporto sarà visibile nei profili pubblici dopo l'accettazione."}
          </AppText>
          {errors.visibility ? (
            <AppText color="danger" variant="caption">
              {errors.visibility}
            </AppText>
          ) : null}
        </View>

        <View style={styles.block}>
          <Input
            label="Messaggio (opzionale)"
            maxLength={MESSAGE_MAX_LENGTH}
            multiline
            onChangeText={setMessage}
            placeholder="Aggiungi un messaggio (facoltativo)"
            testID="assistiti-request-message"
            value={message}
          />
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
          label="Invia richiesta"
          loading={isSending}
          onPress={() => void handleSend()}
          testID="assistiti-request-submit"
        />
      </View>

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
  block: {
    gap: spacing[8],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingTop: spacing[12],
  },
  form: {
    gap: spacing[20],
    paddingBottom: spacing[24],
  },
  summary: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  summaryBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
});
