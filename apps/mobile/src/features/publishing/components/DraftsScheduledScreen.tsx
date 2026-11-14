/**
 * «Bozze e programmati» (HOM-06.2 §137–§179, §191–§198, §234–§240, §254–§255;
 * mockup 6–8).
 *
 * Schermata unica fuori dalle tab (niente bottom navigation): header con
 * indietro, `TabBar` Bozze | Programmati (le tab non sono bottoni) e una FlatList
 * per tab. Nessuna tab «Pubblicati»: appartengono a Feed e Profilo (§138).
 *
 * Caricamento (§234–§239):
 *  • skeleton SOLO senza cache (§235); con dati noti restano visibili durante il
 *    refetch (§236) e dopo un errore transitorio (§238), con una riga d'avviso
 *    sobria e «Riprova»;
 *  • senza dati e in errore: «Non è stato possibile caricare i contenuti.» +
 *    «Riprova» (§237); pull-to-refresh (§239); paginazione a cursore;
 *  • stati vuoti senza illustrazioni (§240): «Nessuna bozza» (§154) e «Nessun
 *    contenuto programmato» (§161); in fondo il conteggio («4 bozze»).
 *
 * Azioni (§149, §162, §195): il menu ••• mostra le voci per capability
 * (`itemMenu`); «Programma» di una bozza non programmabile dice il perché invece
 * di aprire il foglio (§150–§152). «Cambia data e ora» e «Programma» usano lo
 * stesso `PublicationSheet` del composer, solo date future (§168–§169); «Pubblica
 * ora» e «Elimina» chiedono conferma (§153, §172, §178).
 */

import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, sizes, spacing } from "../../../styles";
import {
  ActionSheet,
  AppText,
  Button,
  ConfirmModal,
  EmptyState,
  ScreenHeader,
  Skeleton,
  TabBar,
  useToast,
  type ActionSheetAction,
  type TabBarItem,
} from "../../../ui";
import { useSession } from "../../auth/use-session";
import { trackPublishing } from "../publishing-analytics";
import {
  DEFAULT_SCHEDULE_POLICY,
  itemMenu,
  listCountLabel,
  unschedulableCopy,
  type ItemMenuActionId,
} from "../publishing-presentation";
import type { DraftListItem, DraftsTab, Publication } from "../publishing-types";
import { draftItemKey, useDraftActions } from "../use-draft-actions";
import { useDraftsList } from "../use-drafts-list";
import { DraftListRow } from "./DraftListRow";
import { PublicationSheet } from "./PublicationSheet";

export const DRAFTS_ERROR_COPY = "Non è stato possibile caricare i contenuti."; // §237

const TABS: readonly TabBarItem<DraftsTab>[] = [
  { label: "Bozze", value: "drafts" },
  { label: "Programmati", value: "scheduled" },
];

const EMPTY: Record<DraftsTab, { title: string; description: string }> = {
  drafts: {
    description: "I contenuti che inizi a preparare verranno salvati qui automaticamente.",
    title: "Nessuna bozza",
  },
  scheduled: {
    description: "I Post e gli Articoli programmati compariranno qui.",
    title: "Nessun contenuto programmato",
  },
};

const ICONS: Record<ItemMenuActionId, keyof typeof Ionicons.glyphMap> = {
  delete: "trash-outline",
  edit: "create-outline",
  move_to_draft: "folder-open-outline",
  publish_now: "play-outline",
  reschedule: "calendar-outline",
  retry: "refresh-outline",
  schedule: "calendar-outline",
};

/** I due comandi che chiedono conferma: «Pubblica ora» (§172) ed «Elimina» (§153, §178). */
type Confirm = { kind: "publish_now" | "delete"; item: DraftListItem };

function SkeletonRows() {
  return (
    <View testID="drafts-skeleton">
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={styles.skeletonRow}>
          <View style={styles.skeletonThumb} />
          <View style={styles.skeletonText}>
            <Skeleton.Row style={styles.skeletonTitle} />
            <Skeleton.Row style={styles.skeletonMeta} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function DraftsScheduledScreen({ initialTab = "drafts" }: { initialTab?: DraftsTab }) {
  const router = useRouter();
  const { showToast } = useToast();
  const { profile, session } = useSession();
  // Stessa chiave utente del composer e del «+»: le invalidazioni dopo ogni azione le raggiungono tutte.
  const userId = session?.user.id ?? profile?.id ?? "";
  const profileId = profile?.id ?? userId;

  const [tab, setTab] = useState<DraftsTab>(initialTab);
  const [pulling, setPulling] = useState(false);
  const [menuItem, setMenuItem] = useState<DraftListItem | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [scheduleItem, setScheduleItem] = useState<DraftListItem | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const { items, query } = useDraftsList(userId, tab);
  const actions = useDraftActions({ profileId, userId });
  const confirmBusy = confirm !== null && actions.busyKey === draftItemKey(confirm.item);
  const scheduleBusy = scheduleItem !== null && actions.busyKey === draftItemKey(scheduleItem);

  useEffect(() => {
    trackPublishing({ name: tab === "drafts" ? "drafts_opened" : "scheduled_opened", tab });
  }, [tab]);

  function goBack() {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)" as never);
    }
  }

  async function handleRefresh() {
    setPulling(true);
    await query.refetch();
    setPulling(false);
  }

  function handleMenuAction(item: DraftListItem, id: ItemMenuActionId) {
    switch (id) {
      case "edit":
        actions.edit(item);
        break;
      case "schedule":
        // §150–§152: prima verificare validità, capability, asset; se manca qualcosa lo si dice.
        if (item.schedulable) {
          setScheduleError(null);
          setScheduleItem(item);
        } else {
          showToast({ message: unschedulableCopy(item.unschedulableReason), tone: "neutral" });
        }
        break;
      case "reschedule":
        setScheduleError(null);
        setScheduleItem(item);
        break;
      case "publish_now":
        setConfirm({ item, kind: "publish_now" });
        break;
      case "retry":
        void actions.retry(item);
        break;
      case "move_to_draft":
        void actions.moveToDraft(item);
        break;
      case "delete":
        setConfirm({ item, kind: "delete" });
        break;
    }
  }

  async function handleConfirm() {
    if (!confirm) {
      return;
    }

    const { item, kind } = confirm;

    if (kind === "publish_now") {
      await actions.publishNow(item);
    } else {
      await actions.remove(item);
    }

    // Con un esito negativo l'elenco è già stato riletto e il toast detto: il dialogo si chiude comunque.
    setConfirm(null);
  }

  async function handleSchedule(publication: Publication) {
    if (!scheduleItem) {
      return;
    }

    const outcome = await actions.reschedule(scheduleItem, publication);

    if (outcome.ok) {
      setScheduleItem(null);
    } else {
      setScheduleError(outcome.message);
    }
  }

  const menuActions: ActionSheetAction[] = menuItem
    ? itemMenu(menuItem).map((entry) => ({
        dividerBefore: entry.dividerBefore,
        destructive: entry.destructive,
        icon: ICONS[entry.id],
        id: entry.id,
        label: entry.label,
        onPress: () => handleMenuAction(menuItem, entry.id),
      }))
    : [];

  // Il foglio parte dalla data già programmata se futura, altrimenti da una proposta (§89).
  const schedulePublication: Publication =
    scheduleItem?.scheduledAt && new Date(scheduleItem.scheduledAt).getTime() > Date.now()
      ? {
          mode: "scheduled",
          scheduledAt: scheduleItem.scheduledAt,
          timezone: scheduleItem.scheduleTimezone ?? "UTC",
        }
      : { mode: "now" };

  const confirmCopy =
    confirm?.kind === "publish_now"
      ? { confirmLabel: "Pubblica ora", title: "Pubblicare questo contenuto adesso?" } // §172
      : {
          confirmLabel: "Elimina",
          message: "Il contenuto non potrà essere recuperato.", // §153
          title: confirm?.item.status === "draft" ? "Eliminare questa bozza?" : "Eliminare questo contenuto programmato?",
        };

  const transientError = query.isError && items.length > 0;

  function renderBody() {
    // §235: lo skeleton solo senza cache, mai uno spinner a tutto schermo.
    if (query.isPending) {
      return <SkeletonRows />;
    }

    if (query.isError && items.length === 0) {
      return (
        <View style={styles.message}>
          <EmptyState
            action={<Button label="Riprova" onPress={() => void query.refetch()} variant="secondary" />}
            title={DRAFTS_ERROR_COPY}
            variant="error"
          />
        </View>
      );
    }

    if (items.length === 0) {
      return (
        <View style={styles.message}>
          <EmptyState description={EMPTY[tab].description} title={EMPTY[tab].title} />
        </View>
      );
    }

    return (
      <FlatList
        ListFooterComponent={
          query.hasNextPage ? null : (
            <AppText align="center" color="muted" style={styles.count} variant="bodySm">
              {listCountLabel(tab, items.length)}
            </AppText>
          )
        }
        ListHeaderComponent={
          transientError ? (
            <View accessibilityLiveRegion="polite" style={styles.transient}>
              <AppText color="secondary" style={styles.transientText} variant="bodySm">
                {DRAFTS_ERROR_COPY}
              </AppText>
              <Pressable
                accessibilityLabel="Riprova"
                accessibilityRole="button"
                onPress={() => void query.refetch()}
                style={styles.transientAction}
              >
                <AppText color="accent" variant="actionLabel">
                  Riprova
                </AppText>
              </Pressable>
            </View>
          ) : null
        }
        contentContainerStyle={styles.listContent}
        data={items}
        keyExtractor={draftItemKey}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) {
            void query.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        onRefresh={() => void handleRefresh()}
        refreshing={pulling}
        renderItem={({ item }) => (
          <DraftListRow
            busy={actions.busyKey === draftItemKey(item)}
            item={item}
            onMenu={() => setMenuItem(item)}
            onMoveToDraft={() => void actions.moveToDraft(item)}
            onOpen={() => actions.edit(item)}
            onRetry={() => void actions.retry(item)}
          />
        )}
        testID="drafts-list"
      />
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.root}>
      <View style={styles.header}>
        <ScreenHeader
          leading={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={goBack}
              style={({ pressed }) => [styles.back, pressed ? styles.pressed : null]}
              testID="drafts-back"
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
            </Pressable>
          }
          title="Bozze e programmati"
        />
      </View>

      <TabBar active={tab} items={TABS} onChange={setTab} testID="drafts-tabs" />

      <View style={styles.body}>{renderBody()}</View>

      <ActionSheet
        accessibilityLabel={menuItem ? "Azioni sul contenuto" : undefined}
        actions={menuActions}
        onClose={() => setMenuItem(null)}
        visible={menuItem !== null}
      />

      <ConfirmModal
        cancelLabel="Annulla"
        confirmLabel={confirmCopy.confirmLabel}
        confirmVariant={confirm?.kind === "delete" ? "neutralOutline" : "primary"}
        destructive={confirm?.kind === "delete"}
        isBusy={confirmBusy}
        message={"message" in confirmCopy ? confirmCopy.message : undefined}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void handleConfirm()}
        title={confirmCopy.title}
        visible={confirm !== null}
      />

      <PublicationSheet
        busy={scheduleBusy}
        futureOnly
        onClose={() => setScheduleItem(null)}
        onConfirm={(publication) => void handleSchedule(publication)}
        // La policy vera è del server (§96) e rivalida alla conferma: qui il ripiego dà solo una pre-validazione.
        policy={DEFAULT_SCHEDULE_POLICY}
        publication={schedulePublication}
        serverError={scheduleError}
        visible={scheduleItem !== null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  body: {
    flex: 1,
  },
  count: {
    paddingVertical: spacing[20],
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  listContent: {
    paddingBottom: spacing[24],
  },
  message: {
    padding: spacing[16],
  },
  pressed: {
    opacity: 0.75,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  skeletonMeta: {
    width: "40%",
  },
  skeletonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[12],
  },
  skeletonText: {
    flex: 1,
  },
  skeletonThumb: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[10],
    height: 56,
    width: 56,
  },
  skeletonTitle: {
    width: "80%",
  },
  transient: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[8],
  },
  transientAction: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[8],
  },
  transientText: {
    flex: 1,
  },
});
