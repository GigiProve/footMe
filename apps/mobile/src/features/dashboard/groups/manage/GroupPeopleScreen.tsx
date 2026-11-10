/**
 * Persone del gruppo (DAS-REV-33 §12, §14, §15, §22; PNG 07, 09-11, 19).
 *
 * **Una sola lista** con «Amministratori · N» e «Altre persone · M» (§12): mai
 * un top-level Membri/Amministratori distinto, mai un ADMIN duplicato sotto
 * Altre. I conteggi sono del server; la ricerca (`Cerca persone`) lavora solo
 * sulle membership attive e la chiave della query contiene il testo, quindi una
 * risposta di una ricerca superata non può sostituire quella corrente (§12,
 * QA-045).
 *
 * Le azioni sulla riga arrivano come flag per riga dal server: un MEMBER vede la
 * lista e apre i profili senza azioni di gestione; chi gestisce apre l'action
 * sheet della PERSON (§14). Nessuna rimozione sulla propria riga. In modalità
 * recovery (§22, screen 19) è la stessa lista: il server ha già tolto rimozione
 * e demozione, restano aggiungi e promuovi.
 *
 * Una persona non scompare prima dell'esito affidabile (§15): nessun optimistic
 * update, la lista si rilegge dal server dopo il comando.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { ActionSheet, AppText, Avatar, SearchField } from "../../../../ui";
import { GroupNotice } from "../compose/components/GroupComposeChrome";
import { trackGroupPeopleOpened, trackGroupRetry } from "../groups-analytics";
import { GROUP_MANAGE_COPY as C } from "../groups-copy";
import { GROUPS_QK } from "../groups-keys";
import {
  memberActionsOf,
  memberSectionsOf,
  memberSubtitleOf,
  memberTapOf,
  memberTitleOf,
  type MemberSection,
} from "../groups-manage-presentation";
import { GROUP_MANAGE_HREFS } from "../groups-routes";
import { fetchGroupMembersPage, removeGroupMember, setGroupMemberRole, toGroupsError } from "../groups-service";
import { DEFAULT_GROUP_LIMITS, type GroupManageOrigin, type GroupMember, type GroupMembersPage } from "../groups-types";
import { GroupConfirmSheet, GroupManageHeader, GroupRowsSkeleton } from "./components/GroupManageChrome";
import { invalidateGroupQueries } from "./group-cache";
import { useGroupCommand } from "./use-group-command";
import { useGroupFailureHandler, useGroupManagement } from "./use-group-management";

const SEARCH_DEBOUNCE_MS = 300;

export function GroupPeopleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ conversationId?: string; mode?: string; origin?: string }>();
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";
  const origin: GroupManageOrigin = params.origin === "dashboard" ? "dashboard" : "messages";
  const recovery = params.mode === "recovery";
  /* Dopo la revoca le query si spengono: nessun refetch le ricrea (§17, §26). */
  const [leaving, setLeaving] = useState(false);
  const { actorId, management } = useGroupManagement(conversationId, !leaving);
  const { pending, run } = useGroupCommand({ limits: management?.limits ?? DEFAULT_GROUP_LIMITS, origin });
  const { exit, handleFailure } = useGroupFailureHandler({
    actorId,
    conversationId,
    onExiting: () => setLeaving(true),
    origin,
  });

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<GroupMember | null>(null);
  const [removing, setRemoving] = useState<GroupMember | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    trackGroupPeopleOpened(origin, recovery);
  }, [origin, recovery]);

  /* Debounce; la chiave contiene la query: nessuna risposta superata può
     sostituire quella corrente. */
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  const members = useInfiniteQuery<
    GroupMembersPage,
    Error,
    InfiniteData<GroupMembersPage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: !leaving && !!actorId && !!conversationId,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: null,
    queryFn: ({ pageParam }) => fetchGroupMembersPage({ conversationId, cursor: pageParam, query }),
    queryKey: GROUPS_QK.members(actorId, conversationId, query),
    retry: (count, error) => !toGroupsError(error).isAccessLost && count < 1,
    staleTime: 0,
  });

  const error = members.error ? toGroupsError(members.error) : null;
  const first = members.data?.pages[0] ?? null;
  const items = members.data?.pages.flatMap((page) => page.items) ?? [];
  const capabilities = first?.capabilities ?? management?.capabilities ?? null;
  const sections = first
    ? memberSectionsOf(items, { adminCount: first.adminCount, otherCount: first.otherCount }, query)
    : [];

  /* Eliminazione o periodo chiuso osservati dalla lettura: si chiude la superficie (§26). */
  useEffect(() => {
    if (error?.code === "SOCIETY_GROUP_DELETED") {
      void exit("deleted");
    } else if (error?.code === "SOCIETY_GROUP_NOT_MEMBER") {
      void exit("ended");
    }
  }, [error?.code, exit]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace(GROUP_MANAGE_HREFS.info(conversationId, origin) as never);
  };

  const reload = () => invalidateGroupQueries(queryClient, actorId, conversationId);

  // ── Azioni (§14, §15) ─────────────────────────────────────────────────────

  const openProfile = (member: GroupMember) => {
    router.push(GROUP_MANAGE_HREFS.profile(member.profileId) as never);
  };

  const changeRole = async (member: GroupMember, role: "admin" | "member") => {
    setBanner(null);
    setBusyId(member.profileId);

    try {
      const outcome = await run({
        command: role === "admin" ? "promote" : "demote",
        exec: (operationKey) =>
          setGroupMemberRole({
            conversationId,
            expectedPeriodVersion: member.periodVersion,
            operationKey,
            periodId: member.periodId,
            role,
          }),
        signature: `${member.periodId}:${member.periodVersion}:${role}`,
      });

      if (!outcome) return;

      if (outcome.ok) {
        await reload();
      } else {
        setBanner(handleFailure(outcome));
      }
    } finally {
      setBusyId(null);
    }
  };

  const confirmRemove = async () => {
    if (!removing) return;

    const member = removing;
    const outcome = await run({
      command: "remove",
      exec: (operationKey) => removeGroupMember({ conversationId, operationKey, periodId: member.periodId }),
      signature: member.periodId,
    });

    if (!outcome) return;

    if (outcome.ok) {
      /* `periodEnded` senza effetto: aveva già lasciato, nessun nuovo ingresso toccato (§15). */
      await reload();
      setRemoving(null);
      setRemoveError(null);

      return;
    }

    const message = handleFailure(outcome);

    if (message === null) {
      setRemoving(null);

      return;
    }

    if (outcome.failure.kind === "period_ended") {
      setRemoving(null);
      setBanner(message);

      return;
    }

    setRemoveError(message);
  };

  const onRowPress = (member: GroupMember) => {
    if (memberTapOf(member) === "profile") {
      openProfile(member);
    } else {
      setTarget(member);
    }
  };

  // ── Resa ──────────────────────────────────────────────────────────────────

  const retry = () => {
    trackGroupRetry("people");
    void members.refetch();
  };

  const canAdd = capabilities?.canManagePeople === true;
  const needsAdmin = first?.status === "archived" && first.adminCount === 0 && capabilities?.canRecover === true;

  const header = (
    <View style={styles.listHeader}>
      {banner ? <GroupNotice testID="group-people-banner" text={banner} /> : null}

      <SearchField
        onChangeText={setSearch}
        onClear={() => setSearch("")}
        placeholder={C.searchPeople}
        testID="group-people-search"
        value={search}
      />

      {canAdd ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(GROUP_MANAGE_HREFS.addPeople(conversationId, origin) as never)}
          style={styles.addLink}
          testID="group-people-add"
        >
          <AppText color="accent" variant="actionLabel">
            {C.addPeople}
          </AppText>
        </Pressable>
      ) : null}

      {needsAdmin ? (
        <AppText color="neutralMuted" testID="group-people-needs-admin" variant="bodySm">
          {C.needsAdmin}
        </AppText>
      ) : null}

      {error && first ? (
        <AppText color="neutralMuted" variant="meta">
          {C.refreshFailed}
        </AppText>
      ) : null}
    </View>
  );

  let empty: React.ReactNode = null;

  if (!first) {
    if (error && !error.isAccessLost) {
      empty = (
        <View style={styles.state}>
          <AppText color="neutralMuted" variant="bodySm">
            {error.code === "NETWORK" ? C.offline : C.peopleLoadError}
          </AppText>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retry} testID="group-people-retry">
            <AppText color="accent" variant="actionLabel">
              {C.retry}
            </AppText>
          </Pressable>
        </View>
      );
    } else if (error) {
      empty = (
        <AppText color="neutralMuted" style={styles.state} variant="bodySm">
          {C.infoNotFoundBody}
        </AppText>
      );
    } else {
      empty = <GroupRowsSkeleton />;
    }
  } else if (items.length === 0) {
    /* Vuoto valido solo con la conferma del server (§27); una ricerca senza
       match è un'altra cosa. */
    empty =
      query.length > 0 ? (
        <View style={styles.state} testID="group-people-search-empty">
          <AppText color="neutral" variant="titleSm">
            {C.peopleSearchEmpty}
          </AppText>
          <AppText color="neutralMuted" variant="bodySm">
            {C.peopleSearchEmptyBody}
          </AppText>
        </View>
      ) : (
        <AppText color="neutralMuted" style={styles.state} variant="bodySm">
          {C.peopleEmpty}
        </AppText>
      );
  }

  const targetActions = target ? memberActionsOf(target) : [];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <GroupManageHeader onBack={goBack} title={C.peopleTitle} />

      <SectionList<GroupMember, MemberSection>
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={empty}
        ListFooterComponent={
          members.isFetchingNextPage ? <ActivityIndicator color={colors.textNeutralMuted} style={styles.footer} /> : null
        }
        ListHeaderComponent={header}
        contentContainerStyle={[styles.content, { paddingBottom: spacing[32] + insets.bottom }]}
        keyExtractor={(member) => member.profileId}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => {
          if (members.hasNextPage && !members.isFetchingNextPage) {
            void members.fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.4}
        renderItem={({ item }) => (
          <MemberRow busy={busyId === item.profileId} member={item} onPress={onRowPress} />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <AppText accessibilityRole="header" color="neutralMuted" variant="eyebrow">
              {section.title}
            </AppText>
          </View>
        )}
        sections={sections}
        stickySectionHeadersEnabled={false}
        testID="group-people-list"
      />

      <ActionSheet
        actions={targetActions.map((action) => ({
          destructive: action.destructive,
          icon:
            action.key === "open_profile"
              ? ("person-outline" as const)
              : action.key === "remove"
                ? ("trash-outline" as const)
                : action.key === "promote"
                  ? ("person-add-outline" as const)
                  : ("person-remove-outline" as const),
          label: action.label,
          onPress: () => {
            if (!target) return;

            if (action.key === "open_profile") openProfile(target);
            else if (action.key === "promote") void changeRole(target, "admin");
            else if (action.key === "demote") void changeRole(target, "member");
            else {
              setRemoveError(null);
              setRemoving(target);
            }
          },
        }))}
        message={target ? (memberSubtitleOf(target) ?? undefined) : undefined}
        onClose={() => setTarget(null)}
        title={target?.fullName}
        visible={target !== null}
      />

      <GroupConfirmSheet
        busy={pending === "remove"}
        error={removeError}
        message={C.removeBody}
        onCancel={() => {
          setRemoving(null);
          setRemoveError(null);
        }}
        onPrimary={() => void confirmRemove()}
        primaryLabel={C.remove}
        primaryTone="danger"
        testID="group-confirm-remove"
        title={removing ? C.removeTitle(removing.fullName) : ""}
        visible={removing !== null}
      />
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

type RowProps = {
  busy: boolean;
  member: GroupMember;
  onPress: (member: GroupMember) => void;
};

function MemberRow({ busy, member, onPress }: RowProps) {
  const subtitle = memberSubtitleOf(member);
  const menu = memberTapOf(member) === "menu";

  return (
    <Pressable
      accessibilityLabel={subtitle ? `${memberTitleOf(member)}, ${subtitle}` : memberTitleOf(member)}
      accessibilityRole="button"
      accessibilityState={{ busy }}
      onPress={() => onPress(member)}
      style={({ pressed }) => [styles.row, pressed || busy ? styles.pressed : null]}
      testID={`group-member-${member.profileId}`}
    >
      <Avatar name={member.fullName} size="md" uri={member.avatarUrl ?? undefined} />
      <View style={styles.rowText}>
        <AppText color="neutral" numberOfLines={2} variant="titleSm">
          {memberTitleOf(member)}
        </AppText>
        {subtitle ? (
          <AppText color="neutralMuted" numberOfLines={3} variant="meta">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {busy ? (
        <ActivityIndicator color={colors.textNeutralMuted} size="small" />
      ) : (
        <Ionicons color={colors.textNeutralMuted} name={menu ? "ellipsis-horizontal" : "chevron-forward"} size={18} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  addLink: {
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 44,
  },
  content: {
    paddingHorizontal: spacing[20],
  },
  footer: {
    paddingVertical: spacing[16],
  },
  listHeader: {
    gap: spacing[8],
    paddingBottom: spacing[4],
    paddingTop: spacing[4],
  },
  pressed: {
    opacity: 0.6,
  },
  retry: {
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 44,
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 60,
    paddingVertical: spacing[8],
  },
  rowText: {
    flex: 1,
  },
  sectionHeader: {
    backgroundColor: colors.surface,
    minHeight: 40,
    justifyContent: "flex-end",
    paddingBottom: spacing[4],
    paddingTop: spacing[12],
  },
  separator: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
  },
  state: {
    gap: spacing[8],
    paddingVertical: spacing[24],
  },
});
