/**
 * Info gruppo (DAS-REV-33 §6, §9–§11, §18–§23; PNG 01-06, 12, 14-16, 19-21).
 *
 * **Un solo componente per due ingressi** (§9): da Messaggi (`origin =
 * "messages"`, tap sull'header della chat, nessuna bottom navigation) e dalla
 * Dashboard (`origin = "dashboard"`, «Gestisci gruppo», Dashboard selezionata).
 * Le differenze di chrome non producono business logic diversa: tutto ciò che
 * si vede o si può fare lo decidono le 13 capability del server (§5), che qui si
 * traducono in azioni con `infoActionsOf` — le non autorizzate non si
 * disegnano, non si disabilitano.
 *
 * Nome e avatar si modificano dove compaiono (§6, §10). La Squadra è un valore
 * semplice senza `can_edit_team` (§11). Il lifecycle (Lascia, Archivia,
 * Riattiva, Elimina) usa sheet di conferma con un solo trattamento; la
 * riattivazione non ne ha, solo loading locale (§22).
 *
 * Ogni comando porta la versione osservata e una chiave per intenzione
 * (`useGroupCommand`): un conflitto rilegge e conserva la bozza (§10), un
 * esito incerto ritenta con la stessa chiave (§27). Nessun optimistic update.
 */
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { ActionSheet, AppText, type ActionSheetAction } from "../../../../ui";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import { purgeConversationCache } from "../../../messaging/use-group-chat-access";
import { DashboardGlobalEmpty, DashboardGlobalError, DashboardGlobalOffline } from "../../components/DashboardStates";
import { GroupNotice } from "../compose/components/GroupComposeChrome";
import { GroupTeamSheet } from "../compose/components/GroupPickerSheets";
import { avatarErrorMessage } from "../compose/group-compose-model";
import { trackGroupManageOpened, trackGroupRetry } from "../groups-analytics";
import { GROUP_MANAGE_COPY as C, GROUPS_COPY } from "../groups-copy";
import { GROUPS_QK } from "../groups-keys";
import {
  createdLineOf,
  deleteOffersArchive,
  infoActionsOf,
  infoAffordancesOf,
  infoNoticeOf,
  infoVariantOf,
  leaveFlowOf,
  leaveOutcomeOf,
  nameDraftDirty,
  nameSaveOf,
  teamValueOf,
  type GroupInfoActionKey,
} from "../groups-manage-presentation";
import { GROUP_MANAGE_HREFS, GROUPS_HREFS } from "../groups-routes";
import {
  GroupAvatarError,
  archiveGroup,
  deleteGroup,
  fetchGroupTeamOptions,
  leaveGroup,
  pickGroupAvatar,
  reactivateGroup,
  renameGroup,
  setGroupAvatar,
  setGroupTeam,
  uploadGroupAvatar,
  type GroupAvatarErrorCode,
} from "../groups-service";
import { DEFAULT_GROUP_LIMITS, type GroupManageOrigin } from "../groups-types";
import { GroupInfoHeader } from "./components/GroupInfoHeader";
import { GroupInfoActions, GroupInfoRow } from "./components/GroupInfoSections";
import { GroupConfirmSheet, GroupInfoSkeleton, GroupManageHeader } from "./components/GroupManageChrome";
import { invalidateGroupQueries } from "./group-cache";
import { useGroupCommand, type GroupCommandOutcome } from "./use-group-command";
import { useGroupFailureHandler, useGroupManagement, useGroupPeriodSignals } from "./use-group-management";

type Confirm = "archive" | "delete" | "leave";

const avatarCodeOf = (error: unknown): GroupAvatarErrorCode =>
  error instanceof GroupAvatarError ? error.code : "upload_failed";

export function GroupInfoScreen({ origin }: { origin: GroupManageOrigin }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const conversationId = typeof params.conversationId === "string" ? params.conversationId : "";
  /* Dopo l'uscita o la revoca le query della schermata si spengono: nessun
     refetch può ricrearle prima dello smontaggio (§17, §26). */
  const [leaving, setLeaving] = useState(false);
  const { actorId, error, management, query } = useGroupManagement(conversationId, !leaving);
  const limits = management?.limits ?? DEFAULT_GROUP_LIMITS;
  const { pending, run } = useGroupCommand({ limits, origin });
  const { exit, handleFailure } = useGroupFailureHandler({
    actorId,
    conversationId,
    onExiting: () => setLeaving(true),
    origin,
  });

  /* §17, §26: la fine del proprio periodo arriva in tempo reale. */
  useGroupPeriodSignals({ actorId, conversationId, exit, origin, periodId: management?.myPeriodId ?? null });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [avatarSheet, setAvatarSheet] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [teamSheet, setTeamSheet] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const variant = management ? infoVariantOf(management) : null;
  const status = management?.status ?? null;

  useEffect(() => {
    if (variant && status) {
      trackGroupManageOpened({ origin, status, variant });
    }
  }, [origin, status, variant]);

  /* §26: eliminazione o periodo chiuso osservati dalla lettura (deep link,
     cache stantia, revoca da un altro dispositivo): la superficie privata si
     chiude e si torna al contenitore consentito. */
  useEffect(() => {
    if (error?.code === "SOCIETY_GROUP_DELETED") {
      void exit("deleted");
    } else if (error?.code === "SOCIETY_GROUP_NOT_MEMBER") {
      void exit("ended");
    }
    /* `exit` è ricreata a ogni render ma protetta da un ref: l'effetto agisce
       una volta sola, solo per questi due codici. */
  }, [error?.code, exit]);

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    /* Senza storia di navigazione (deep link) si torna all'origine: l'anteprima
       amministrativa 32 dalla Dashboard, l'Inbox da Messaggi. */
    router.replace(
      (origin === "messages" ? GROUP_MANAGE_HREFS.inbox() : GROUPS_HREFS.detail(conversationId)) as never,
    );
  };

  /* §27: l'uscita con un nome modificato e non salvato chiede la conferma
     condivisa; consultare, aprire un profilo o tornare da un picker non la chiede. */
  const requestExit = useUnsavedChangesGuard({
    isDirty: management ? nameDraftDirty(draft, management.name, editing) : false,
    isSaving: pending === "rename",
    onLeave: goBack,
    title: GROUPS_COPY.exitTitle,
  });

  // ── Esiti condivisi ───────────────────────────────────────────────────────

  /** Rilegge e attende: il dato nuovo è visibile prima di chiudere l'editing o lo sheet. */
  const refresh = async () => {
    setRefreshing(true);

    try {
      await invalidateGroupQueries(queryClient, actorId, conversationId);
    } finally {
      setRefreshing(false);
    }
  };

  // ── Nome (§10) ────────────────────────────────────────────────────────────

  const startName = () => {
    if (!management) return;

    setDraft(management.name);
    setNameError(null);
    setBanner(null);
    setEditing(true);
  };

  const cancelName = () => {
    setEditing(false);
    setNameError(null);
  };

  const saveName = async () => {
    if (!management || pending || refreshing) return;

    const decision = nameSaveOf(draft, management.name, management.limits);

    if (decision.kind === "invalid") {
      setNameError(decision.message);

      return;
    }

    if (decision.kind === "noop") {
      cancelName();

      return;
    }

    const outcome = await run({
      command: "rename",
      exec: (operationKey) =>
        renameGroup({ conversationId, expectedVersion: management.version, name: decision.name, operationKey }),
      signature: `${decision.name}:${management.version}`,
    });

    if (!outcome) return;

    if (outcome.ok) {
      await refresh();
      cancelName();
    } else {
      /* Errore: si resta in editing col testo e il messaggio vicino al campo. */
      setNameError(handleFailure(outcome));
    }
  };

  // ── Immagine (§10) ────────────────────────────────────────────────────────

  const applyAvatar = async (assetId: string | null) => {
    if (!management) return;

    const outcome = await run({
      command: "avatar",
      exec: (operationKey) =>
        setGroupAvatar({ assetId, conversationId, expectedVersion: management.version, operationKey }),
      signature: `${assetId ?? "none"}:${management.version}`,
    });

    if (!outcome) return;

    if (outcome.ok) {
      await refresh();
    } else {
      setBanner(handleFailure(outcome));
    }
  };

  /** Il vecchio avatar resta confermato finché il nuovo collegamento non è salvato. */
  const changeAvatar = async (source: "camera" | "library") => {
    if (!management || avatarBusy) return;

    setBanner(null);
    setAvatarBusy(true);

    try {
      const picked = await pickGroupAvatar(source);

      if (picked) {
        const ref = await uploadGroupAvatar({ clubId: management.clubId, limits: management.limits, picked });

        await applyAvatar(ref.assetId);
      }
    } catch (failure) {
      setBanner(avatarErrorMessage(avatarCodeOf(failure)));
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    if (!management || avatarBusy) return;

    setBanner(null);
    setAvatarBusy(true);

    try {
      await applyAvatar(null);
    } finally {
      setAvatarBusy(false);
    }
  };

  // ── Squadra (§11) ─────────────────────────────────────────────────────────

  const teamQuery = useQuery({
    enabled: teamSheet && !leaving && !!actorId && !!conversationId,
    queryFn: () => fetchGroupTeamOptions(conversationId),
    queryKey: GROUPS_QK.teamOptions(actorId, conversationId),
    staleTime: 0,
  });
  const teamLookup = teamQuery.data
    ? { canCreateWithoutTeam: teamQuery.data.canClear, limits, teams: teamQuery.data.teams }
    : null;

  const selectTeam = async (teamId: string | null) => {
    setTeamSheet(false);

    if (!management || teamId === management.teamId) return;

    setBanner(null);

    const outcome = await run({
      command: "team",
      exec: (operationKey) =>
        setGroupTeam({ conversationId, expectedVersion: management.version, operationKey, teamId }),
      signature: `${teamId ?? "none"}:${management.version}`,
    });

    if (!outcome) return;

    if (outcome.ok) {
      await refresh();
    } else {
      /* §11: mai null al posto di una Squadra non più disponibile: il
         riferimento precedente resta e il selector si aggiorna. */
      setBanner(handleFailure(outcome));
    }
  };

  // ── Lifecycle (§18, §21–§23) ──────────────────────────────────────────────

  const closeConfirm = () => {
    setConfirm(null);
    setConfirmError(null);
  };

  const onAction = (key: GroupInfoActionKey) => {
    if (!management) return;

    setBanner(null);

    switch (key) {
      case "add_people":
        router.push(GROUP_MANAGE_HREFS.addPeople(conversationId, origin) as never);
        break;
      case "manage_people":
        router.push(GROUP_MANAGE_HREFS.people(conversationId, origin, "recovery") as never);
        break;
      case "leave":
        if (leaveFlowOf(management) === "handover") {
          router.push(GROUP_MANAGE_HREFS.handover(conversationId, origin) as never);
        } else {
          setConfirm("leave");
        }
        break;
      case "archive":
        setConfirm("archive");
        break;
      case "delete":
        setConfirm("delete");
        break;
      case "reactivate":
        void reactivate();
        break;
    }
  };

  /** Errore in una conferma: la revoca porta via; il resto resta nello sheet, ripetibile. */
  const closeIfHandled = (outcome: Extract<GroupCommandOutcome, { ok: false }>) => {
    const message = handleFailure(outcome);

    if (message === null) {
      closeConfirm();

      return;
    }

    /* Lo stato è cambiato sotto la conferma (§18, §19): si chiude, la pagina
       si riallinea e il messaggio sta sulla pagina, non in uno sheet obsoleto. */
    if (outcome.failure.kind === "only_person" || outcome.failure.kind === "handover_not_required") {
      closeConfirm();
      setBanner(message);

      return;
    }

    setConfirmError(message);
  };

  const confirmLeave = async () => {
    if (!management?.myPeriodId) return;

    const periodId = management.myPeriodId;
    const outcome = await run({
      command: "leave",
      exec: (operationKey) => leaveGroup({ conversationId, operationKey, periodId }),
      signature: periodId,
    });

    if (!outcome) return;

    if (!outcome.ok) {
      closeIfHandled(outcome);

      return;
    }

    if (leaveOutcomeOf(outcome.value) === "stale") {
      /* Un nuovo ingresso successivo alla schermata: non si tocca (§18). */
      closeConfirm();
      void refresh();

      return;
    }

    closeConfirm();

    if (origin === "messages") {
      void exit("done");
    } else {
      /* Da manager si resta sulla proiezione amministrativa, senza accesso
         alla timeline (§18): la chat si svuota, Info si riallinea. */
      await purgeConversationCache(queryClient, conversationId);
      void refresh();
    }
  };

  const confirmArchive = async () => {
    if (!management) return;

    const outcome = await run({
      command: "archive",
      exec: (operationKey) => archiveGroup({ conversationId, expectedVersion: management.version, operationKey }),
      signature: String(management.version),
    });

    if (!outcome) return;

    if (outcome.ok) {
      await refresh();
      closeConfirm();
    } else {
      closeIfHandled(outcome);
    }
  };

  const reactivate = async () => {
    if (!management) return;

    const outcome = await run({
      command: "reactivate",
      exec: (operationKey) => reactivateGroup({ conversationId, expectedVersion: management.version, operationKey }),
      signature: String(management.version),
    });

    if (!outcome) return;

    if (outcome.ok) {
      await refresh();
    } else {
      setBanner(handleFailure(outcome));
    }
  };

  const confirmDelete = async () => {
    if (!management) return;

    const outcome = await run({
      command: "delete",
      exec: (operationKey) => deleteGroup({ conversationId, expectedVersion: management.version, operationKey }),
      signature: String(management.version),
    });

    if (!outcome) return;

    if (outcome.ok) {
      closeConfirm();
      void exit("done");
    } else {
      closeIfHandled(outcome);
    }
  };

  // ── Resa ──────────────────────────────────────────────────────────────────

  const title = origin === "dashboard" ? C.titleManage : C.titleInfo;

  const shell = (content: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <GroupManageHeader onBack={requestExit} title={title} />
      {content}
    </View>
  );

  if (!management) {
    if (
      leaving ||
      query.isLoading ||
      error?.code === "SOCIETY_GROUP_DELETED" ||
      error?.code === "SOCIETY_GROUP_NOT_MEMBER"
    ) {
      return shell(<GroupInfoSkeleton />);
    }

    /* Non trovato e non autorizzato sono la stessa risposta (QA-007). */
    if (error?.isAccessLost) {
      return shell(
        <View style={styles.state}>
          <DashboardGlobalEmpty
            copy={{ actionLabel: C.back, body: C.infoNotFoundBody, icon: "people-outline", title: C.infoNotFoundTitle }}
            onAction={goBack}
          />
        </View>,
      );
    }

    const retry = () => {
      trackGroupRetry("info");
      void query.refetch();
    };

    return shell(
      <View style={styles.state}>
        {error?.code === "NETWORK" ? (
          <DashboardGlobalOffline body={C.offline} onRetry={retry} />
        ) : (
          <DashboardGlobalError body={C.infoLoadError} onRetry={retry} title={C.infoLoadError} />
        )}
      </View>,
    );
  }

  const affordances = infoAffordancesOf(management.capabilities);
  const actions = infoActionsOf(management);
  const createdLine = createdLineOf(management);
  const busyKey: GroupInfoActionKey | null = pending === "reactivate" ? "reactivate" : null;
  const avatarActions: ActionSheetAction[] = [
    { icon: "camera-outline", label: C.takePhoto, onPress: () => void changeAvatar("camera") },
    { icon: "image-outline", label: C.chooseFromLibrary, onPress: () => void changeAvatar("library") },
    ...(management.avatarPath
      ? [{ destructive: true, icon: "trash-outline" as const, label: C.removeImage, onPress: () => void removeAvatar() }]
      : []),
  ];

  return shell(
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: spacing[32] + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
    >
      {banner ? <GroupNotice testID="group-info-banner" text={banner} /> : null}

      {query.error ? (
        <AppText color="neutralMuted" style={styles.refreshFailed} variant="meta">
          {C.refreshFailed}
        </AppText>
      ) : null}

      <GroupInfoHeader
        avatarBusy={avatarBusy || pending === "avatar"}
        avatarEditable={affordances.avatarEditable}
        draft={draft}
        editing={editing}
        management={management}
        nameEditable={affordances.nameEditable}
        nameError={nameError}
        onCancelName={cancelName}
        onChangeDraft={(value) => {
          setDraft(value);
          setNameError(null);
        }}
        onEditAvatar={() => setAvatarSheet(true)}
        onSaveName={() => void saveName()}
        onStartName={startName}
        saving={pending === "rename" || refreshing}
      />

      <GroupInfoRow
        label={C.team}
        onPress={affordances.teamEditable ? () => setTeamSheet(true) : null}
        testID="group-info-team"
        value={pending === "team" ? C.loading : teamValueOf(management)}
      />
      {affordances.peopleRow ? (
        <GroupInfoRow
          label={C.people}
          onPress={() => router.push(GROUP_MANAGE_HREFS.people(conversationId, origin) as never)}
          testID="group-info-people"
          value={String(management.peopleCount)}
        />
      ) : null}

      {createdLine ? (
        <AppText color="neutralMuted" style={styles.created} testID="group-info-created" variant="meta">
          {createdLine}
        </AppText>
      ) : null}

      <GroupInfoActions actions={actions} busyKey={busyKey} notice={infoNoticeOf(management)} onAction={onAction} />

      <ActionSheet
        actions={avatarActions}
        onClose={() => setAvatarSheet(false)}
        title={C.imageSheetTitle}
        visible={avatarSheet}
      />

      <GroupTeamSheet
        error={teamQuery.isError}
        loading={teamQuery.isPending}
        lookup={teamLookup}
        onClose={() => setTeamSheet(false)}
        onRetry={() => void teamQuery.refetch()}
        onSelect={(choice) => void selectTeam(choice)}
        value={management.teamId}
        visible={teamSheet}
      />

      <GroupConfirmSheet
        busy={pending === "leave"}
        error={confirm === "leave" ? confirmError : null}
        message={C.leaveBody}
        note={C.leaveReentry}
        onCancel={closeConfirm}
        onPrimary={() => void confirmLeave()}
        primaryLabel={C.leave}
        primaryTone="primary"
        testID="group-confirm-leave"
        title={C.leaveTitle}
        visible={confirm === "leave"}
      />

      <GroupConfirmSheet
        busy={pending === "archive"}
        error={confirm === "archive" ? confirmError : null}
        message={C.archiveBody}
        onCancel={closeConfirm}
        onPrimary={() => void confirmArchive()}
        primaryLabel={C.archive}
        primaryTone="primary"
        testID="group-confirm-archive"
        title={C.archiveTitle}
        visible={confirm === "archive"}
      />

      {/* §23: «Archivia» nel Delete ACTIVE porta all'archiviazione nello stesso
          contesto; per ARCHIVED lo sheet ha solo Elimina e Annulla. */}
      <GroupConfirmSheet
        alternative={
          deleteOffersArchive(management)
            ? {
                label: C.deleteArchiveInstead,
                onPress: () => {
                  setConfirmError(null);
                  setConfirm("archive");
                },
              }
            : undefined
        }
        busy={pending === "delete"}
        error={confirm === "delete" ? confirmError : null}
        message={C.deleteBody}
        onCancel={closeConfirm}
        onPrimary={() => void confirmDelete()}
        primaryLabel={C.deleteConfirm}
        primaryTone="danger"
        testID="group-confirm-delete"
        title={C.deleteTitle}
        visible={confirm === "delete"}
      />
    </ScrollView>,
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[4],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[8],
  },
  created: {
    paddingBottom: spacing[4],
    paddingTop: spacing[12],
  },
  refreshFailed: {
    paddingBottom: spacing[8],
  },
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  state: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
});
