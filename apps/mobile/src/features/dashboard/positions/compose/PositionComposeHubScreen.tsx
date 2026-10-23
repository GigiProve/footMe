import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import { DashboardGlobalEmpty, DashboardSkeleton } from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { ComposerFooter } from "./components/ComposerFooter";
import { ComposerNavBar } from "./components/ComposerNavBar";
import { ComposerStepHeader } from "./components/ComposerStepHeader";
import { DraftHubRow } from "./components/DraftHubRow";
import { COMPOSE_HREFS } from "./compose-routes";
import {
  describeComposeError,
  continueLabel,
  COMPOSE_COPY,
  isPublishable,
  remainingDraftsHelper,
  saveDraftsMessage,
} from "./compose-presentation";
import { fetchComposerContext, fetchPositionDrafts, toComposeError } from "./compose-service";
import { COMPOSE_QK } from "./compose-keys";
import { useComposeSession } from "./ComposeSessionProvider";

/**
 * Step 2 con più Position: «Configura le posizioni» (DAS-REV-16, screen 04).
 */
export function PositionComposeHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { createdIds } = useComposeSession();

  const contextQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchComposerContext(clubId as string),
    queryKey: COMPOSE_QK.context(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const draftsQuery = useQuery({
    enabled: createdIds.length > 0 && !!actorId,
    queryFn: () => fetchPositionDrafts(createdIds),
    queryKey: COMPOSE_QK.drafts(actorId, createdIds),
    staleTime: STALE_MS.operational,
  });

  const drafts = draftsQuery.data ?? [];
  const publishable = drafts.filter(isPublishable);
  const pending = drafts.filter((draft) => !isPublishable(draft));

  const firstDraft = drafts[0];
  const navClubName = current?.kind === "society" ? current.name : "";
  const navLogoUrl = contextQuery.data?.clubLogoUrl ?? firstDraft?.clubLogoUrl ?? null;
  const navIsVerified = contextQuery.data?.clubIsVerified ?? firstDraft?.clubIsVerified ?? false;
  const navName = contextQuery.data?.clubName ?? firstDraft?.clubName ?? navClubName;

  const handleSaveDrafts = () => {
    /* Nessuna mutation: le bozze sono già persistite sul server dallo step 1,
       quindi la conferma "Bozza salvata" (§21) qui è già vera. */
    showToast({ message: saveDraftsMessage(drafts.length), tone: "success" });
    router.dismissAll();
    router.replace("/(tabs)/dashboard/positions" as never);
  };

  if (draftsQuery.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (draftsQuery.isError) {
    const message = describeComposeError(toComposeError(draftsQuery.error));

    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ComposerNavBar
            isVerified={navIsVerified}
            logoUrl={navLogoUrl}
            name={navName}
            onBack={() => router.back()}
          />
        <View style={styles.errorBlock}>
          <AppText color="neutral" variant="bodySm">
            {message}
          </AppText>
          <Button
            label="Riprova"
            onPress={() => draftsQuery.refetch()}
            variant="secondary"
          />
        </View>
      </View>
    );
  }

  if (drafts.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ComposerNavBar
          isVerified={navIsVerified}
          logoUrl={navLogoUrl}
          name={navName}
          onBack={() => router.back()}
        />
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna al Centro",
            body: "Le bozze già salvate restano nel Centro Posizioni aperte.",
            icon: "briefcase-outline",
            title: "Nessuna posizione in preparazione",
          }}
          onAction={() =>
            router.replace("/(tabs)/dashboard/positions" as never)
          }
        />
      </View>
    );
  }

  const primaryDisabled = publishable.length === 0;
  /* §11: l'helper conta solo ciò che resterebbe in bozza fra le pubblicabili;
     con zero pubblicabili il messaggio giusto è "completa almeno una", non
     l'elenco di ciò che manca. */
  const helper = primaryDisabled
    ? COMPOSE_COPY.completeAtLeastOne
    : remainingDraftsHelper(
        pending.map((draft) =>
          draft.scope === "society" ? "Intera società" : (draft.teamName ?? "Senza squadra"),
        ),
      );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={navIsVerified}
        logoUrl={navLogoUrl}
        name={navName}
        onBack={() => router.back()}
      />

      <ScrollView contentContainerStyle={styles.content} style={styles.scroll}>
        <ComposerStepHeader step={2} title="Configura le posizioni" />

        {drafts.map((draft) => (
          <DraftHubRow
            draft={draft}
            key={draft.id}
            onAction={() => router.push(COMPOSE_HREFS.details(draft.id, { from: "hub" }) as never)}
          />
        ))}
      </ScrollView>

      <ComposerFooter
        helper={helper}
        onPrimary={() => router.push(COMPOSE_HREFS.preview() as never)}
        primaryDisabled={primaryDisabled}
        primaryLabel={continueLabel(publishable.length)}
        secondaryLabel="Salva come bozze"
        secondaryOnPress={handleSaveDrafts}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  /* La barra condivide il gutter orizzontale del contenuto: senza, il back
     resta incollato al bordo e la app bar non si allinea alle altre
     schermate del flusso. */
  bar: {
    paddingHorizontal: spacing[20],
  },
  content: {
    gap: spacing[4],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
  },
  errorBlock: {
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[16],
  },
  /* §4: «il footer resta sopra safe area e tastiera, con spazio di
     scorrimento sufficiente dopo l'ultimo campo.» Senza `flex: 1` la
     ScrollView si dimensiona sul contenuto e il footer risale sotto
     l'ultimo campo invece di restare in fondo. */
  scroll: {
    flex: 1,
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
