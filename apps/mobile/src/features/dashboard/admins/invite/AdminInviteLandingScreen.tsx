/**
 * Apertura del link (DAS-REV-13, screen 06).
 *
 * La revisione corrente del master ha **una sola** CTA — «Apri invito su
 * PROLINK» — e §13 vieta esplicitamente di ripristinare «Accetta, Rifiuta,
 * Hai già un account? Accedi, Continua su PROLINK, un selector account o la
 * bottom navigation». Il testo sotto la CTA è grigio, non un link.
 *
 * La pagina mostra solo il contesto minimo condiviso: Società, ruolo e
 * ambito. Nessuna email del destinatario, nessun invitante tecnico, nessun
 * id interno, nessun token in chiaro (§13).
 *
 * «L'apertura del link, la sua anteprima in una chat, il prefetch di un
 * browser e il tap Apri invito non attivano accessi, non accettano l'invito
 * e non consumano irreversibilmente la possibilità di utilizzarlo»: la
 * lettura pubblica è una query senza effetti, e il tap porta al percorso
 * autenticato, non a una concessione.
 */
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { DashboardSkeleton } from "../../components/DashboardStates";
import { ADMINS_QK } from "../admins-keys";
import { ADMIN_HREFS } from "../admins-routes";
import { trackAdminEvent } from "../admins-analytics";
import {
  ADMIN_COPY,
  landingBody,
  landingHeading,
} from "../admins-presentation";
import { AdminFieldRow } from "../components/AdminFieldRow";
import {
  fetchAdminInvitePublic,
  resolveAdminInviteBinding,
} from "../admins-service";
import { pendingAdminInvite } from "../admin-invite-link";

/**
 * §14: «Esterno descrive il canale di condivisione. Non dedurre da questo
 * flag se il destinatario ha l'app, possiede un account o ha una sessione
 * valida.» Le quattro condizioni si distinguono guardando la sessione reale
 * e l'esito del binding server-side, mai il link.
 */
const BINDING_MESSAGE: Record<string, string> = {
  accepted: "Hai già accettato questo invito.",
  already_admin: "Hai già un accesso amministrativo a questa società.",
  expired: "Questo invito è scaduto.",
  needs_verified_email:
    "Questo invito è destinato a un indirizzo email verificato. Verifica il tuo indirizzo e riapri il link.",
  rejected: "Hai rifiutato questo invito.",
  revoked: "Questo invito non è più disponibile.",
  unavailable: "Questo invito non è più disponibile.",
  wrong_account: "Questo invito è destinato a un altro account.",
};

export function AdminInviteLandingScreen({ token }: { token: string }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isLoading: isSessionLoading, session } = useSession();
  const isAuthenticated = Boolean(session) && !isSessionLoading;
  const [message, setMessage] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  const publicQuery = useQuery({
    enabled: !isSessionLoading,
    queryFn: () => fetchAdminInvitePublic(token),
    queryKey: ADMINS_QK.invitePublic(token),
    staleTime: 0,
  });

  useEffect(() => {
    trackAdminEvent("admin_invite_landing_opened", {
      authenticated: isAuthenticated,
    });
  }, [isAuthenticated]);

  /**
   * L'unica CTA. Tre esiti, una sola azione per l'utente:
   *
   *   · senza sessione → flusso globale di accesso, con il token messo da
   *     parte dal meccanismo condiviso di continuità (§14);
   *   · con sessione → binding verificato sul server e, se valido, la
   *     revisione del consenso;
   *   · altrimenti → lo stato reale, senza concedere nulla.
   */
  const openInvite = useCallback(async () => {
    if (!isAuthenticated) {
      trackAdminEvent("admin_invite_handoff_started");
      await pendingAdminInvite.store(token);
      router.replace("/(auth)/welcome" as never);

      return;
    }

    setIsResolving(true);
    setMessage(null);

    try {
      const binding = await resolveAdminInviteBinding(token);

      trackAdminEvent("admin_invite_binding_result", { state: binding.state });

      if (binding.state === "valid" && binding.inviteId) {
        router.replace(ADMIN_HREFS.review(binding.inviteId) as never);

        return;
      }

      /* Uno stato terminale che riguarda **il destinatario** apre comunque la
         ricezione: §25 vuole che lì legga «Hai già accettato questo invito»
         con l'accesso attuale verificato, non un vicolo cieco. */
      if (binding.inviteId) {
        router.replace(ADMIN_HREFS.review(binding.inviteId) as never);

        return;
      }

      setMessage(BINDING_MESSAGE[binding.state] ?? BINDING_MESSAGE.unavailable);
    } catch {
      setMessage("Non siamo riusciti a caricare l'invito. Riprova.");
    } finally {
      setIsResolving(false);
    }
  }, [isAuthenticated, router, token]);

  if (isSessionLoading || publicQuery.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  const payload = publicQuery.data;

  /* §13: «Per token non valido, revocato, scaduto o già concluso applica la
     risposta minima appropriata; non mostrare il normale invito come se fosse
     ancora accettabile.» */
  if (!payload || payload.state !== "valid") {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <AppText color="neutral" style={styles.center} variant="titleMd">
          {ADMIN_COPY.landingUnavailable}
        </AppText>

        <Button
          label="Chiudi"
          onPress={() => router.replace("/" as never)}
          size="lg"
          testID="admin-landing-close"
          variant="neutralOutline"
        />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.landing,
        {
          paddingBottom: spacing[32] + insets.bottom,
          paddingTop: insets.top + spacing[40],
        },
      ]}
      style={styles.root}
      testID="admin-landing-scroll"
    >
      {/* §13: wordmark tipografico, senza nuovi simboli. */}
      <AppText color="neutral" style={styles.wordmark} variant="screenTitle">
        PROLINK
      </AppText>

      <View style={styles.clubRow}>
        <Avatar
          name={payload.clubName}
          size="sm"
          square
          tone="ink"
          uri={payload.clubLogoUrl ?? undefined}
        />

        <AppText color="neutral" variant="titleMd">
          {payload.clubName}
        </AppText>
      </View>

      <AppText color="neutral" style={styles.center} variant="headingLg">
        {landingHeading(payload.clubName)}
      </AppText>

      <AppText color="neutralMuted" style={styles.center} variant="bodyLg">
        {landingBody(payload.clubName)}
      </AppText>

      <View style={styles.fields}>
        <AdminFieldRow
          label={ADMIN_COPY.roleLabel}
          testID="admin-landing-role"
          value={payload.roleLabel}
        />

        <AdminFieldRow
          label={ADMIN_COPY.scopeLabel}
          testID="admin-landing-scope"
          value={payload.scopeLabel}
        />
      </View>

      <AppText color="neutralMuted" style={styles.center} variant="bodySm">
        {ADMIN_COPY.landingHelper}
      </AppText>

      {message ? (
        <AppText
          accessibilityRole="alert"
          color="danger"
          style={styles.center}
          variant="bodySm"
        >
          {message}
        </AppText>
      ) : null}

      <Button
        fullWidth
        label={ADMIN_COPY.landingCta}
        loading={isResolving}
        onPress={() => void openInvite()}
        size="lg"
        testID="admin-landing-cta"
        variant="primary"
      />

      {/* §13: helper non interattivo, grigio. Non è un link e non deve
          essere annunciato come tale (§31). */}
      <AppText color="neutralMuted" style={styles.center} variant="bodySm">
        {ADMIN_COPY.landingFooter}
      </AppText>
    </ScrollView>
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
  centered: {
    alignItems: "center",
    gap: spacing[16],
    justifyContent: "center",
    paddingHorizontal: spacing[24],
  },
  wordmark: {
    letterSpacing: 1,
  },
  clubRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
  },
  center: {
    textAlign: "center",
  },
  fields: {
    alignSelf: "stretch",
    gap: spacing[12],
  },
});
