/**
 * Anteprima multipla e selezione di pubblicazione (DAS-REV-16 §24, mockup
 * screen 11).
 *
 * «La pubblicabilità e la selezione sono cose diverse: una riga pronta non è
 * automaticamente selezionata.» Da qui le due nozioni separate in questa
 * schermata: `isPublishable(draft)` dice se **si può**, `selectedIds` dice
 * se l'utente **vuole**. Nessuna delle due deriva dall'altra.
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalEmpty,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { trackComposeEvent } from "./compose-analytics";
import { COMPOSE_QK } from "./compose-keys";
import {
  COMPOSE_COPY,
  ageSummary,
  contextSummary,
  describeBlocker,
  describeComposeError,
  isPublishable,
  publishLabel,
  remainingCountHelper,
} from "./compose-presentation";
import { COMPOSE_HREFS } from "./compose-routes";
import {
  fetchComposerContext,
  fetchPositionDrafts,
  toComposeError,
} from "./compose-service";
import type { PositionDraft } from "./compose-types";
import { ComposerFooter } from "./components/ComposerFooter";
import { ComposerNavBar } from "./components/ComposerNavBar";
import { ComposerStepHeader } from "./components/ComposerStepHeader";
import { useComposeSession } from "./ComposeSessionProvider";
import { usePublishPositions } from "./use-publish-positions";

export function PositionComposeBatchPreviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;

  const { createdIds, publishOperationKey, selectedIds, setSelectedIds, toggleSelected } =
    useComposeSession();
  const [error, setError] = useState<string | null>(null);

  const draftsQuery = useQuery({
    enabled: createdIds.length > 0 && !!actorId,
    queryFn: () => fetchPositionDrafts(createdIds),
    queryKey: COMPOSE_QK.drafts(actorId, createdIds),
    staleTime: STALE_MS.operational,
  });

  const contextQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchComposerContext(clubId as string),
    queryKey: COMPOSE_QK.context(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const publishMutation = usePublishPositions({
    onError: (_composeError, message) => setError(message),
    operationKey: publishOperationKey,
  });

  const drafts = draftsQuery.data ?? [];
  const publishable = drafts.filter(isPublishable);

  /**
   * §24: «Se esiste una sola Position pubblicabile nel batch, mostrala come
   * unica destinazione esplicita della CTA, senza chiedere una checkbox
   * ridondante.» Una checkbox che l'utente non può che spuntare non è una
   * scelta.
   */
  const singleTarget = publishable.length === 1 ? publishable[0] : null;

  /**
   * §24: «Tornando da una preview o da Modifica, conserva le scelte ancora
   * valide; non selezionare automaticamente elementi diventati pronti nel
   * frattempo.» L'intersezione fa esattamente questo, e non aggiunge nulla.
   *
   * Ma solo **a dati arrivati**: finché la lettura non ha prodotto righe,
   * `publishable` è vuoto e l'intersezione cancellerebbe una selezione
   * ancora valida — che è il contrario di conservarla. Al ritorno da una
   * preview il refetch passa per questo stato, quindi non è un caso di
   * bordo.
   */
  const draftsLoaded = draftsQuery.data !== undefined;
  const effectiveSelection = singleTarget
    ? [singleTarget.id]
    : draftsLoaded
      ? selectedIds.filter((id) => publishable.some((draft) => draft.id === id))
      : selectedIds;

  /* La potatura va in un effetto e non nel corpo del render: scrivere lo
     stato durante il render di un componente che legge quello stesso valore
     è un ciclo che React non garantisce di chiudere. */
  const prunedSelection = effectiveSelection.join(",");
  const storedSelection = selectedIds.join(",");

  useEffect(() => {
    if (draftsLoaded && !singleTarget && prunedSelection !== storedSelection) {
      setSelectedIds(prunedSelection === "" ? [] : prunedSelection.split(","));
    }
  }, [
    draftsLoaded,
    prunedSelection,
    setSelectedIds,
    singleTarget,
    storedSelection,
  ]);

  if (draftsQuery.isLoading || contextQuery.isLoading) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardSkeleton />
      </View>
    );
  }

  if (drafts.length === 0) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <DashboardGlobalEmpty
          copy={{
            actionLabel: "Torna al Centro",
            body: "Torna al Centro per riprendere le bozze già salvate.",
            icon: "briefcase-outline",
            title: "Nessuna posizione da pubblicare",
          }}
          onAction={() =>
            router.replace("/(tabs)/dashboard/positions" as never)
          }
        />
      </View>
    );
  }

  const context = contextQuery.data;
  const remaining = drafts.length - effectiveSelection.length;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ComposerNavBar
        isVerified={context?.clubIsVerified ?? drafts[0].clubIsVerified}
        logoUrl={context?.clubLogoUrl ?? drafts[0].clubLogoUrl}
        name={context?.clubName ?? drafts[0].clubName}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
      >
        <ComposerStepHeader step={3} title="Anteprima" />

        <AppText color="neutralMuted" variant="bodySm">
          {singleTarget
            ? "Questa posizione verrà pubblicata ora. Le altre resteranno nelle bozze."
            : "Seleziona le posizioni che vuoi pubblicare ora. Le altre resteranno nelle bozze."}
        </AppText>

        {drafts.map((draft) => (
          <BatchRow
            draft={draft}
            isLocked={singleTarget !== null}
            key={draft.id}
            onOpenPreview={() =>
              router.push(COMPOSE_HREFS.previewSingle(draft.id) as never)
            }
            onComplete={() =>
              router.push(COMPOSE_HREFS.details(draft.id, { from: "hub" }) as never)
            }
            onToggle={() => toggleSelected(draft.id)}
            selected={effectiveSelection.includes(draft.id)}
          />
        ))}

        {error ? (
          <AppText accessibilityRole="alert" color="danger" variant="meta">
            {error}
          </AppText>
        ) : draftsQuery.isError ? (
          <AppText accessibilityRole="alert" color="danger" variant="meta">
            {describeComposeError(toComposeError(draftsQuery.error))}
          </AppText>
        ) : null}
      </ScrollView>

      <ComposerFooter
        helper={
          effectiveSelection.length === 0
            ? COMPOSE_COPY.selectionRequired
            : remainingCountHelper(remaining)
        }
        onPrimary={() => {
          setError(null);
          trackComposeEvent("position_compose_selection_changed", {
            count: effectiveSelection.length,
            mode: "batch",
          });
          publishMutation.mutate({
            expectedVersions: effectiveSelection.map(
              (id) => drafts.find((draft) => draft.id === id)?.resourceVersion ?? null,
            ),
            positionIds: effectiveSelection,
            remaining,
          });
        }}
        primaryDisabled={effectiveSelection.length === 0}
        primaryLabel={publishLabel(Math.max(effectiveSelection.length, 1))}
        primaryLoading={publishMutation.isPending}
        primaryTestID="compose-publish-batch"
        secondaryLabel="Salva come bozze"
        secondaryOnPress={() => {
          router.dismissAll();
          router.replace("/(tabs)/dashboard/positions" as never);
        }}
      />
    </View>
  );
}

/**
 * Una riga del riepilogo.
 *
 * La checkbox esiste solo quando c'è davvero una scelta: con un solo
 * elemento pubblicabile `isLocked` la sostituisce con un check neutro, che
 * §24 preferisce a una spunta obbligata.
 *
 * Una Position non pubblicabile **non è selezionabile** e mostra il motivo
 * più «Completa»: §24 vieta sia di nasconderla sia di farla sembrare in
 * procinto di essere pubblicata.
 */
function BatchRow({
  draft,
  isLocked,
  onComplete,
  onOpenPreview,
  onToggle,
  selected,
}: {
  draft: PositionDraft;
  isLocked: boolean;
  onComplete: () => void;
  onOpenPreview: () => void;
  onToggle: () => void;
  selected: boolean;
}) {
  const publishable = isPublishable(draft);
  const age = ageSummary(draft);
  const blocker = draft.blockers[0] ?? null;

  return (
    <View style={styles.row}>
      {publishable && !isLocked ? (
        <Pressable
          accessibilityLabel={`Pubblica ${draft.title ?? "questa posizione"}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: selected }}
          hitSlop={8}
          onPress={onToggle}
          style={styles.checkboxHit}
          testID={`compose-select-${draft.id}`}
        >
          <View style={[styles.box, selected ? styles.boxOn : null]}>
            {selected ? (
              <Ionicons color={colors.inkInvert} name="checkmark" size={14} />
            ) : null}
          </View>
        </Pressable>
      ) : (
        <View style={styles.checkboxHit}>
          {publishable ? (
            <Ionicons color={colors.textNeutral} name="checkmark" size={16} />
          ) : null}
        </View>
      )}

      <View style={styles.rowBody}>
        <AppText color="neutral" variant="titleSm">
          {draft.title ?? "Posizione senza titolo"}
        </AppText>

        <AppText color="neutralMuted" variant="bodySm">
          {contextSummary(draft)}
        </AppText>

        {age ? (
          <AppText color="neutralMuted" variant="meta">
            {age}
          </AppText>
        ) : null}

        {publishable ? (
          <Pressable
            accessibilityLabel={`Vedi anteprima di ${draft.title ?? "questa posizione"}`}
            accessibilityRole="button"
            onPress={onOpenPreview}
            style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
          >
            <AppText color="accent" variant="actionLabel">
              Vedi anteprima
            </AppText>

            <Ionicons color={colors.accent} name="chevron-forward" size={16} />
          </Pressable>
        ) : (
          <>
            {blocker ? (
              <AppText color="neutralMuted" variant="meta">
                {describeBlocker(blocker)}
              </AppText>
            ) : null}

            <Pressable
              accessibilityLabel={`Completa ${draft.title ?? "questa posizione"}`}
              accessibilityRole="button"
              onPress={onComplete}
              style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
            >
              <AppText color="accent" variant="actionLabel">
                Completa
              </AppText>

              <Ionicons color={colors.accent} name="chevron-forward" size={16} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    minHeight: spacing[32],
  },
  box: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 6,
    borderWidth: 1.5,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  boxOn: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  checkboxHit: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing[4],
    width: sizes.touchTarget - spacing[12],
  },
  content: {
    gap: spacing[12],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[14],
  },
  rowBody: {
    flex: 1,
    gap: spacing[4],
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
