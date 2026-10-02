/**
 * Apertura del link di invito, lato Calciatore (REV-PROF-14).
 *
 * Aprire il link non collega niente. Qui si vede chi ha invitato, con che tipo
 * di rapporto e con che visibilità, e il collegamento nasce solo da un tap su
 * "Accetta": è il consenso esplicito che la task chiede, e senza di esso il
 * record manuale del procuratore resta un promemoria privato.
 *
 * Senza sessione il token viene messo da parte e ripreso dopo login o
 * registrazione: è l'unico modo perché un invito sopravviva all'iscrizione,
 * che è poi il caso d'uso principale di questo flusso.
 */
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";

import { Screen } from "../../src/components/ui/screen";
import { AppText, Avatar, Button, useToast } from "../../src/ui";
import { useSession } from "../../src/features/auth/use-session";
import { trackAssistitiEvent } from "../../src/features/relationships/assistiti/assistiti-analytics";
import {
  describeAssistitiError,
  getRelationshipDescription,
  RELATIONSHIP_TYPE_OPTIONS,
} from "../../src/features/relationships/assistiti/assistiti-model";
import {
  resolveInvite,
  respondInvite,
  type ResolvedInvite,
} from "../../src/features/relationships/assistiti/assistiti-service";
import { storePendingInviteToken } from "../../src/features/relationships/assistiti/assistiti-invite-link";
import { AssistitiSkeleton } from "../../src/features/relationships/assistiti/assistiti-ui";
import { colors, radius, spacing } from "../../src/theme/tokens";

type ScreenState = "loading" | "ready" | "invalid" | "done";

export default function AssistitoInviteScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const { isLoading: isSessionLoading, session } = useSession();
  const { token } = useLocalSearchParams<{ token?: string }>();

  const [state, setState] = useState<ScreenState>("loading");
  const [invite, setInvite] = useState<ResolvedInvite | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isResponding, setResponding] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setState("invalid");
      return;
    }

    setState("loading");

    try {
      const resolved = await resolveInvite(token);

      setInvite(resolved);
      setState("ready");
      trackAssistitiEvent("assistiti_invite_opened");
    } catch (error) {
      setErrorMessage(
        describeAssistitiError(error, "Il link non è più valido."),
      );
      setState("invalid");
    }
  }, [token]);

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    if (!session) {
      // Il token viene messo da parte PRIMA del redirect, altrimenti si perde
      // per strada come succede oggi con l'invito società.
      void storePendingInviteToken(token ?? "").then(() => {
        trackAssistitiEvent("assistiti_invite_registration_started");
        router.replace("/(auth)/welcome");
      });

      return;
    }

    void load();
  }, [isSessionLoading, load, router, session, token]);

  async function handleRespond(accept: boolean) {
    if (!token || isResponding) {
      return;
    }

    setResponding(true);

    try {
      await respondInvite(token, accept);

      if (accept) {
        trackAssistitiEvent("assistiti_invite_reconciled", { success: true });
        showToast({
          message: "Profilo collegato al portfolio.",
          tone: "success",
        });
      }

      setState("done");
    } catch (error) {
      trackAssistitiEvent("assistiti_invite_reconcile_failed", {
        success: false,
      });
      setErrorMessage(
        describeAssistitiError(error, "Operazione non riuscita. Riprova."),
      );
    } finally {
      setResponding(false);
    }
  }

  const relationshipLabel = invite
    ? (RELATIONSHIP_TYPE_OPTIONS.find(
        (option) => option.value === invite.relationship_type,
      )?.label ?? invite.relationship_type)
    : "";

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />

      {state === "loading" ? (
        <AssistitiSkeleton rows={2} />
      ) : state === "invalid" ? (
        <View style={styles.centered}>
          <AppText align="center" variant="headingMd">
            Invito non più valido
          </AppText>
          <AppText align="center" color="secondary" variant="bodySm">
            {errorMessage ??
              "Chiedi al Procuratore di inviarti un nuovo link."}
          </AppText>
          <Button
            label="Vai alla home"
            onPress={() => router.replace("/(tabs)")}
            variant="secondary"
          />
        </View>
      ) : state === "done" ? (
        <View style={styles.centered}>
          <AppText align="center" variant="headingMd">
            Fatto
          </AppText>
          <AppText align="center" color="secondary" variant="bodySm">
            Puoi gestire il collegamento dal tuo profilo in qualunque momento.
          </AppText>
          <Button label="Vai alla home" onPress={() => router.replace("/(tabs)")} />
        </View>
      ) : invite ? (
        <View style={styles.content}>
          <AppText variant="screenTitle">Richiesta di collegamento</AppText>

          <View style={styles.card}>
            <Avatar
              name={invite.agent_full_name ?? "Procuratore"}
              size="md"
              uri={invite.agent_avatar_url ?? undefined}
            />
            <View style={styles.cardBody}>
              <AppText numberOfLines={1} variant="titleSm">
                {invite.agent_full_name ?? "Procuratore"}
              </AppText>
              {invite.agency_name ? (
                <AppText color="secondary" numberOfLines={1} variant="bodySm">
                  {invite.agency_name}
                </AppText>
              ) : null}
            </View>
          </View>

          <View style={styles.detail}>
            <AppText color="muted" variant="eyebrow">
              Tipo di rapporto
            </AppText>
            <AppText variant="titleSm">{relationshipLabel}</AppText>
            <AppText color="secondary" variant="bodySm">
              {getRelationshipDescription(invite.relationship_type)}
            </AppText>
          </View>

          <View style={styles.detail}>
            <AppText color="muted" variant="eyebrow">
              Visibilità proposta
            </AppText>
            <AppText variant="titleSm">Privato</AppText>
            <AppText color="secondary" variant="bodySm">
              Il rapporto sarà visibile soltanto a te e al Procuratore. Potrai
              renderlo pubblico in seguito, con il tuo consenso.
            </AppText>
          </View>

          {invite.already_linked ? (
            <AppText color="secondary" variant="bodySm">
              Risulta già un rapporto con questo Procuratore: accettando non
              verrà creato un secondo collegamento.
            </AppText>
          ) : null}

          {errorMessage ? (
            <AppText color="danger" variant="bodySm">
              {errorMessage}
            </AppText>
          ) : null}

          <View style={styles.actions}>
            <Button
              fullWidth
              label="Accetta"
              loading={isResponding}
              onPress={() => void handleRespond(true)}
              testID="assistito-invite-accept"
            />
            <Button
              fullWidth
              label="Rifiuta"
              onPress={() => void handleRespond(false)}
              variant="ghost"
            />
          </View>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing[8],
    marginTop: "auto",
  },
  card: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    padding: spacing[12],
  },
  cardBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  centered: {
    alignItems: "center",
    flex: 1,
    gap: spacing[16],
    justifyContent: "center",
  },
  content: {
    flex: 1,
    gap: spacing[16],
  },
  detail: {
    gap: spacing[4],
  },
});
