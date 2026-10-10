/**
 * Apertura del link di invito (master 07) e handoff autenticato (§19).
 *
 * Tre stati di una sola route, non tre pagine:
 *
 *   · **pre-auth** — wordmark PROLINK, chi invita, il tipo, Continua/Accedi.
 *     §18 vieta qui «Accetta, conferme di relazione o comandi
 *     amministrativi»: «Il possesso del link non dimostra che chi lo apre
 *     rappresenti il destinatario».
 *   · **scelta della Società** — §19: «più Society eleggibili: richiedere una
 *     scelta esplicita, senza usare la prima della lista».
 *   · **richiesta risolta** — si prosegue sulla revisione dello screen 05,
 *     perché «Solo Accetta attiva la relazione».
 *
 * Nessuna bottom navigation e nessun chrome Dashboard (§4).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { DashboardSkeleton } from "../../dashboard/components/DashboardStates";
import { SocietyListRow } from "../components/SocietyListRow";
import { NETWORK_QK } from "../network-keys";
import { describeNetworkError } from "../network-presentation";
import {
  fetchInvitePublicContext,
  fetchInviteResolveContext,
  resolveSocietyInvite,
  toNetworkError,
} from "../network-service";
import { pendingSocietyInvite } from "../network-invite-link";
import { newNetworkOperationKey } from "../operation-key";
import { trackNetworkEvent } from "../network-analytics";

const UNAVAILABLE_COPY: Record<string, string> = {
  expired: "Questo invito è scaduto. Chiedi alla società un nuovo link.",
  invalid: "Questo invito non è più disponibile.",
  revoked: "Questo invito non è più disponibile.",
  unavailable: "Questo invito non è più disponibile.",
};

export function SocietyInviteScreen({ token }: { token: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoading: isSessionLoading, profile, session } = useSession();
  const actorId = profile?.id ?? "";
  const isAuthenticated = Boolean(session) && !isSessionLoading;
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const operationKeyRef = useRef(newNetworkOperationKey());

  const publicQuery = useQuery({
    enabled: !isAuthenticated && !isSessionLoading,
    queryFn: () => fetchInvitePublicContext(token),
    queryKey: NETWORK_QK.invitePublic(token),
  });

  const contextQuery = useQuery({
    enabled: isAuthenticated,
    // §19: «Dopo l'autenticazione risolvere nuovamente token, invito e
    // autorizzazioni.» Non si riusa il payload pre-auth.
    queryFn: () => fetchInviteResolveContext(token),
    queryKey: NETWORK_QK.inviteContext(actorId, token),
  });

  const resolve = useMutation({
    mutationFn: (clubId: string) =>
      resolveSocietyInvite({
        clubId,
        idempotencyKey: operationKeyRef.current,
        token,
      }),
    onError: (error) => {
      const parsed = toNetworkError(error);
      setErrorMessage(describeNetworkError(parsed.code));
      trackNetworkEvent("network_invite_resolved", {
        error_code: parsed.code,
        outcome: "error",
      });
      void contextQuery.refetch();
    },
    onSuccess: (relationship) => {
      trackNetworkEvent("network_invite_resolved", { outcome: "ok" });
      // §19: «Solo Accetta attiva la relazione.» Qui si apre la revisione.
      router.replace(
        `/society-link/review?clubId=${encodeURIComponent(relationship.viewerClubId)}&relationshipId=${encodeURIComponent(relationship.relationshipId)}`,
      );
    },
  });

  useEffect(() => {
    trackNetworkEvent("network_invite_landing_opened", {
      authenticated: isAuthenticated,
    });
  }, [isAuthenticated]);

  const continueToAuth = useCallback(
    (destination: "/(auth)/welcome" | "/(auth)/sign-in") => {
      trackNetworkEvent("network_invite_handoff_started", {
        destination: destination.includes("sign-in") ? "sign_in" : "welcome",
      });

      // §19: il contesto deve sopravvivere a login, registrazione e
      // onboarding. Il token messo da parte non è una prova di nulla: dopo
      // l'accesso viene risolto di nuovo dal server.
      void pendingSocietyInvite.store(token).then(() => {
        router.replace(destination as never);
      });
    },
    [router, token],
  );

  if (isSessionLoading || publicQuery.isLoading || contextQuery.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  // ── Pre-auth: la landing pubblica dello screen 07 ────────────────────────
  if (!isAuthenticated) {
    const payload = publicQuery.data;

    if (!payload || payload.state !== "valid") {
      return (
        <Unavailable
          insetTop={insets.top}
          message={UNAVAILABLE_COPY[payload?.state ?? "invalid"]}
          onClose={() => router.replace("/" as never)}
        />
      );
    }

    return (
      <ScrollView
        contentContainerStyle={[
          styles.landing,
          { paddingBottom: spacing[32] + insets.bottom, paddingTop: insets.top + spacing[40] },
        ]}
        style={styles.root}
      >
        {/* §18: wordmark tipografico, senza nuovi simboli. */}
        <AppText color="neutral" style={styles.wordmark} variant="screenTitle">
          PROLINK
        </AppText>

        <Avatar
          name={payload.inviter.name}
          size="lg"
          square
          tone="ink"
          uri={payload.inviter.logoUrl ?? undefined}
        />

        <AppText color="neutral" style={styles.center} variant="titleMd">
          {payload.inviter.name}
        </AppText>

        <AppText color="neutral" style={styles.center} variant="headingSm">
          {`${payload.inviter.name} ti invita su PROLINK`}
        </AppText>

        <AppText color="neutralMuted" style={styles.center} variant="bodySm">
          {`${payload.inviter.name} vuole collegare la tua società alla propria rete.`}
        </AppText>

        <View style={styles.field}>
          <AppText color="neutralMuted" variant="meta">
            Tipo di collegamento
          </AppText>
          <AppText color="neutral" variant="bodyLg">
            {payload.typeLabel}
          </AppText>
        </View>

        <AppText color="neutralSoft" style={styles.center} variant="meta">
          Dopo l'accesso potrai scegliere o creare il profilo della tua società
          e verificare la richiesta.
        </AppText>

        {/* §3, riga 07 della matrice: primaria blu PROLINK, testo bianco. */}
        <Button
          fullWidth
          label="Continua su PROLINK"
          onPress={() => continueToAuth("/(auth)/welcome")}
          size="lg"
          testID="society-invite-continue"
          variant="primary"
        />

        <Pressable
          accessibilityRole="button"
          onPress={() => continueToAuth("/(auth)/sign-in")}
          style={styles.secondary}
          testID="society-invite-sign-in"
        >
          <AppText color="accent" variant="actionLabel">
            Hai già un account? Accedi
          </AppText>
        </Pressable>
      </ScrollView>
    );
  }

  // ── Autenticato ──────────────────────────────────────────────────────────
  const context = contextQuery.data;

  if (!context || (context.state !== "valid" && context.state !== "resolved")) {
    return (
      <Unavailable
        insetTop={insets.top}
        message={UNAVAILABLE_COPY[context?.state ?? "invalid"]}
        onClose={() => router.replace("/(tabs)/dashboard" as never)}
      />
    );
  }

  if (context.state === "resolved") {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <AppText color="neutral" style={styles.center} variant="titleMd">
          Questo invito è già stato collegato a una società.
        </AppText>

        {context.relationshipId ? (
          <Button
            label="Apri la richiesta"
            onPress={() =>
              router.replace(
                `/society-link/review?clubId=${encodeURIComponent(context.clubId)}&relationshipId=${encodeURIComponent(context.relationshipId as string)}`,
              )
            }
            size="lg"
            testID="society-invite-open-request"
            variant="primary"
          />
        ) : null}
      </View>
    );
  }

  const selectable = context.eligibleSocieties.filter(
    (society) => !society.isSelf && !society.blocked,
  );

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing[32] + insets.bottom, paddingTop: insets.top + spacing[16] },
      ]}
      style={styles.root}
    >
      <AppText color="neutral" variant="titleMd">
        {`${context.inviter.name} ti invita su PROLINK`}
      </AppText>

      <AppText color="neutralMuted" variant="bodySm">
        {`${context.inviter.name} vuole collegare la tua società alla propria rete. Tipo di collegamento: ${context.typeLabel}.`}
      </AppText>

      {errorMessage ? (
        <AppText accessibilityRole="alert" color="danger" variant="bodySm">
          {errorMessage}
        </AppText>
      ) : null}

      {selectable.length === 0 ? (
        /* §19: «nessuna Society gestibile: accompagnare al percorso standard
           per creare/associare una società o ottenere l'accesso necessario».
           Il link non rende owner e non crea una Society al posto tuo. */
        <View style={styles.block}>
          <AppText color="neutral" variant="bodyLg">
            Non gestisci nessuna società che possa accettare questo
            collegamento.
          </AppText>
          <AppText color="neutralSoft" variant="meta">
            Serve una società di cui puoi gestire le richieste di collegamento.
          </AppText>
          <Button
            fullWidth
            label="Vai alla Dashboard"
            onPress={() => router.replace("/(tabs)/dashboard" as never)}
            size="lg"
            testID="society-invite-dashboard"
            variant="neutralOutline"
          />
        </View>
      ) : (
        <View style={styles.block}>
          <AppText color="neutralMuted" variant="meta">
            {selectable.length === 1
              ? "La tua società"
              : "Scegli la società destinataria"}
          </AppText>

          {selectable.map((society) => (
            <SocietyListRow
              key={society.clubId}
              onPress={() => {
                setErrorMessage(null);
                resolve.mutate(society.clubId);
              }}
              society={society}
              testID={`society-invite-choice-${society.clubId}`}
            />
          ))}

          <AppText color="neutralSoft" variant="meta">
            Dopo la scelta potrai verificare i termini e accettare o rifiutare.
          </AppText>
        </View>
      )}
    </ScrollView>
  );
}

function Unavailable({
  insetTop,
  message,
  onClose,
}: {
  insetTop: number;
  message: string;
  onClose: () => void;
}) {
  return (
    <View style={[styles.root, styles.centered, { paddingTop: insetTop }]}>
      <AppText color="neutral" style={styles.center} variant="titleMd">
        {message}
      </AppText>

      <Button
        label="Chiudi"
        onPress={onClose}
        size="lg"
        testID="society-invite-close"
        variant="neutralOutline"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  landing: {
    alignItems: "center",
    gap: spacing[16],
    paddingHorizontal: spacing[24],
  },
  content: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
  },
  centered: {
    alignItems: "center",
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[24],
  },
  wordmark: {
    letterSpacing: 1,
  },
  center: {
    textAlign: "center",
  },
  field: {
    alignSelf: "stretch",
    gap: spacing[6],
  },
  block: {
    gap: spacing[12],
  },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
  },
});
