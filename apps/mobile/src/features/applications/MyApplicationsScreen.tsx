import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { useSession } from "../auth/use-session";
import { getPlayerPositionLabel } from "../profiles/player-sports";
import { DashboardEntityRow } from "../dashboard/components/DashboardEntityRow";
import { acknowledgeApplicationEvent } from "../dashboard/adapters/personal-adapter";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText, EmptyState, ScreenHeader, TabBar } from "../../ui";
import {
  applicationStatusLabel,
  formatOutcomeLine,
  POSITION_CLOSED_A11Y,
  POSITION_CLOSED_NOTE,
} from "./application-presentation";
import {
  fetchMyApplicationsPage,
  type ApplicationGroup,
  type ApplicationListItem,
  type ApplicationPage,
} from "./applications-service";

/**
 * §14: due tab e due sole. «Non aggiungere tab separate Rifiutate, Ritirate,
 * Scadute o Chiuse»: sono esiti, non gruppi, e vivono dentro la row.
 */
const TABS = [
  { label: "Attive", value: "active" as const },
  { label: "Concluse", value: "completed" as const },
];

function resolveGroup(value: string | undefined): ApplicationGroup {
  // "Concluse è selezionata quando richiesta dal collegamento contestuale";
  // ogni altro accesso, incluso quello ordinario, apre Attive (§14).
  return value === "completed" ? "completed" : "active";
}

/**
 * "Le mie candidature" (DAS-REV-03 §9, DAS-REV-04 §14).
 *
 * La pagina esiste da DAS-REV-03 con tab Attive / Tutte. DAS-REV-04 la
 * riallinea sulla classificazione canonica — Attive / Concluse — e non ne
 * crea una seconda riservata alla Dashboard: §14 lo vieta esplicitamente.
 *
 * Il parametro `focus` serve al collegamento che arriva da una conclusione
 * mostrata in Dashboard: evidenzia la row e, **solo quando quella row è
 * davvero caricata e consultabile**, segna come consultato il suo evento
 * (§13). Aprire la tab non marca nulla.
 */
export function MyApplicationsScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const profileId = profile?.id ?? null;
  const params = useLocalSearchParams<{ filter?: string; focus?: string }>();
  const focusId = typeof params.focus === "string" ? params.focus : null;
  const [group, setGroup] = useState<ApplicationGroup>(
    resolveGroup(typeof params.filter === "string" ? params.filter : undefined),
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      enabled: !!profileId,
      initialPageParam: null as string | null,
      queryFn: ({ pageParam }: { pageParam: string | null }) =>
        fetchMyApplicationsPage(group, pageParam),
      queryKey: ["my-applications", profileId, group],
      getNextPageParam: (lastPage: ApplicationPage) => lastPage.nextCursor,
    });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const focused = focusId
    ? (items.find((item) => item.id === focusId) ?? null)
    : null;

  useApplicationEventAck(focused);

  return (
    <>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Le mie candidature"
          action={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed ? styles.pressed : null,
              ]}
            >
              <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
            </Pressable>
          }
        />
      </View>

      <TabBar
        active={group}
        items={TABS}
        onChange={setGroup}
        style={styles.tabs}
      />

      {isLoading ? (
        <View style={styles.loader}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          description={
            group === "completed"
              ? "Le candidature concluse restano qui, con il loro esito."
              : "Le candidature che invii compaiono qui con il loro stato."
          }
          icon="document-text-outline"
          title={
            group === "completed"
              ? "Nessuna candidatura conclusa"
              : "Nessuna candidatura attiva"
          }
        />
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={items}
          keyExtractor={(item) => item.id}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator color={colors.accent} style={styles.footer} />
            ) : null
          }
          renderItem={({ index, item }) => (
            <ApplicationRow
              index={index}
              isFocused={item.id === focusId}
              item={item}
              onPress={() => router.push(`/applications/${item.id}` as never)}
            />
          )}
        />
      )}

      <AppText color="muted" style={styles.note} variant="caption">
        Solo tu vedi le tue candidature.
      </AppText>
    </>
  );
}

/**
 * Row della lista: stessa riga visuale della Dashboard, contenuto diverso a
 * seconda del gruppo (§14).
 *
 * Una conclusa mostra esito e data reale; una attiva mostra lo stato e, se
 * serve, il metadato della posizione chiusa. §22: lo storico resta a
 * contrasto normale, senza aspetto disabled.
 */
function ApplicationRow({
  index,
  isFocused,
  item,
  onPress,
}: {
  index: number;
  isFocused: boolean;
  item: ApplicationListItem;
  onPress: () => void;
}) {
  const isCompleted = item.group === "completed";

  const row = (
    <DashboardEntityRow
      avatarName={item.clubName}
      avatarUrl={item.clubLogoUrl}
      meta={[item.clubName, item.teamName ?? item.category]
        .filter(Boolean)
        .join(" · ")}
      note={
        isCompleted
          ? formatOutcomeLine({
              concludedAt: item.concludedAt,
              outcome: item.outcome,
              status: item.status,
            })
          : item.positionAccepting
            ? null
            : POSITION_CLOSED_NOTE
      }
      noteAccessibilityLabel={
        !isCompleted && !item.positionAccepting ? POSITION_CLOSED_A11Y : null
      }
      onPress={onPress}
      showDivider={index > 0}
      status={isCompleted ? null : applicationStatusLabel(item.status)}
      statusPlacement="trailing"
      title={getPlayerPositionLabel(item.role, item.role)}
    />
  );

  // Evidenza del collegamento contestuale: un fondo tenue, non un bordo
  // colorato né un badge. Serve a ritrovare la row, non a classificarla.
  return isFocused ? <View style={styles.focused}>{row}</View> : row;
}

/**
 * Consultazione persistente dell'aggiornamento (§12, §13).
 *
 * Si invia una volta sola, e **solo** quando la row pertinente è realmente
 * caricata: l'impression nella Dashboard non basta, e il tap nemmeno se la
 * lista non si carica. Il fallimento non si ritenta in loop — la RPC è
 * idempotente e il prossimo ingresso riproverà.
 */
function useApplicationEventAck(item: ApplicationListItem | null) {
  const sentRef = useRef<string | null>(null);
  const eventId = item?.lastEventId ?? null;

  useEffect(() => {
    if (!eventId || sentRef.current === eventId) {
      return;
    }

    sentRef.current = eventId;
    void acknowledgeApplicationEvent(eventId).catch(() => {
      // Un ack non riuscito non è un errore per chi legge: la row resta
      // consultabile e la prossima apertura riproverà.
      sentRef.current = null;
    });
  }, [eventId]);
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: spacing[12],
  },
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 36,
    justifyContent: "center",
    width: 36,
  },
  tabs: {
    marginBottom: spacing[8],
  },
  loader: {
    paddingVertical: spacing[32],
  },
  list: {
    paddingBottom: spacing[24],
  },
  footer: {
    paddingVertical: spacing[16],
  },
  focused: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius[12],
    paddingHorizontal: spacing[8],
  },
  note: {
    paddingVertical: spacing[8],
  },
  pressed: {
    opacity: 0.75,
  },
});
