/**
 * Landing pubblica del Link di invito (DAS-REV-20, screen 06 e 12).
 *
 * Una sola CTA — «Apri invito su PROLINK» — niente «Hai già un account?
 * Accedi», «Continua su PROLINK», «Accetta», elenco persone, contatori interni,
 * creatore del link o bottom navigation (vedi spec). La query pubblica deve
 * funzionare senza sessione e non deve mai consumare un utilizzo o creare
 * alcunché: l'apertura, la sua anteprima in una chat o il prefetch di un
 * browser restano letture senza effetti.
 *
 * Quando il link non è più disponibile si mostra lo stato minimo (screen 12):
 * mai il motivo tecnico (token non valido, revocato, quota, errore db) — solo
 * «Invito non più disponibile». Un errore di rete non è "unavailable": resta
 * sulla stessa pagina offrendo "Riprova".
 */
import { useEffect } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { DashboardSkeleton } from "../../components/DashboardStates";
import { trackJoinLinksEvent } from "../join-links-analytics";
import { JOIN_LINKS_HREFS } from "../join-links-routes";
import { JOIN_LINKS_QK } from "../join-links-keys";
import {
  JOIN_LINKS_COPY,
  landingAudience,
  landingHeading,
} from "../join-links-presentation";
import { fetchJoinLinkPublicContext } from "../join-links-service";
import { pendingTeamJoin } from "../join-link-url";

export function TeamJoinLandingScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const insets = useSafeAreaInsets();
  const { isLoading: isSessionLoading, session } = useSession();
  const isAuthenticated = Boolean(session) && !isSessionLoading;

  const publicQuery = useQuery({
    enabled: !isSessionLoading && Boolean(token),
    queryFn: () => fetchJoinLinkPublicContext(token),
    queryKey: JOIN_LINKS_QK.publicContext(token),
    staleTime: 0,
  });

  useEffect(() => {
    trackJoinLinksEvent("join_landing_opened", {
      authenticated: isAuthenticated,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openInvite = async () => {
    if (!isAuthenticated) {
      trackJoinLinksEvent("join_handoff_started");
      await pendingTeamJoin.store(token);
      router.replace("/(auth)/welcome" as never);

      return;
    }

    router.replace(JOIN_LINKS_HREFS.join(token) as never as Parameters<typeof router.replace>[0]);
  };

  if (isSessionLoading || publicQuery.isLoading) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  const context = publicQuery.data;

  /* Un fallimento di rete/timeout non è "unavailable": si resta sul
     percorso e si offre "Riprova" invece dello stato terminale. */
  if (publicQuery.isError) {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <AppText color="neutral" style={styles.center} variant="titleMd">
          {JOIN_LINKS_COPY.listError}
        </AppText>

        <Button
          label={JOIN_LINKS_COPY.retry}
          onPress={() => void publicQuery.refetch()}
          size="lg"
          testID="join-landing-retry"
          variant="neutralOutline"
        />
      </View>
    );
  }

  /* Screen 12: nessun motivo tecnico esposto, solo lo stato minimo. */
  if (!context || context.state === "unavailable") {
    return (
      <View style={[styles.root, styles.centered, { paddingTop: insets.top }]}>
        <AppText color="neutral" style={styles.center} variant="headingLg">
          {JOIN_LINKS_COPY.unavailableTitle}
        </AppText>

        <AppText color="neutralMuted" style={styles.center} variant="bodyLg">
          {JOIN_LINKS_COPY.unavailableBody}
        </AppText>

        <Button
          label={JOIN_LINKS_COPY.close}
          onPress={() => router.replace("/" as never)}
          size="lg"
          testID="join-landing-close"
          variant="neutralOutline"
        />
      </View>
    );
  }

  const audience = landingAudience(context.allowedProfileTypes);

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
      testID="join-landing-scroll"
    >
      <AppText color="neutral" style={styles.wordmark} variant="screenTitle">
        {JOIN_LINKS_COPY.brand}
      </AppText>

      <View style={styles.clubRow}>
        <Avatar
          name={context.clubName}
          size="sm"
          square
          tone="ink"
          uri={context.clubLogoUrl ?? undefined}
        />

        <AppText color="neutral" variant="titleMd">
          {context.clubName}
        </AppText>

        {context.clubIsVerified ? (
          <AppText color="accent" variant="titleMd">
            ✓
          </AppText>
        ) : null}
      </View>

      <AppText color="neutralMuted" variant="bodySm">
        {context.teamName}
      </AppText>

      <AppText color="neutral" style={styles.center} variant="headingLg">
        {landingHeading(context.clubName)}
      </AppText>

      {audience ? (
        <AppText color="neutralMuted" style={styles.center} variant="bodyLg">
          {audience}
        </AppText>
      ) : null}

      <AppText color="neutralMuted" style={styles.center} variant="bodySm">
        {JOIN_LINKS_COPY.landingHint}
      </AppText>

      <Button
        fullWidth
        label={JOIN_LINKS_COPY.openInApp}
        onPress={() => void openInvite()}
        size="lg"
        testID="join-landing-cta"
        variant="primary"
      />

      <AppText color="neutralSoft" style={styles.center} variant="caption">
        {JOIN_LINKS_COPY.landingFooter}
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
});
