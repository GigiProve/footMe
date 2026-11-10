/**
 * Wizard «Crea gruppo» (DAS-REV-32 §12–§24; PNG 06–12, 15).
 *
 * **Una route, tre step logici** come `EventComposeScreen`: i passaggi sono
 * stato interno, quindi il guard di uscita intercetta solo l'uscita dal
 * wizard, mai un cambio di step (§13). Nessuna Conversation nasce prima del
 * comando finale: upload e step non scrivono nulla di visibile (§13, §16).
 *
 * La Società si risolve prima del wizard (§12) e il wizard è montato con
 * `key` = actor + Società: un cambio di Società azzera ogni dato contestuale,
 * niente transita da una Società all'altra (§13).
 *
 * Il comando usa una chiave stabile = nonce di sessione + firma canonica del
 * payload (§23). Un esito incerto conserva l'input e lo rispedisce identico:
 * mai una nuova chiave finché l'esito resta ambiguo.
 *
 * Il Riepilogo si raggiunge solo da «Continua» dello step 2: cambiare
 * Squadra dallo step 1 obbliga a ripassare dalle persone (§15, §20). Le
 * selezioni sono ID e il server le rivalida al commit; quelle non più valide
 * tornano come SOCIETY_GROUP_PEOPLE_UNAVAILABLE e vengono rimosse (§21, §24).
 */
import { useEffect, useRef, useState } from "react";
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { ActionSheet, AppText, Button } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { MESSAGING_QK } from "../../../messaging/messaging-keys";
import { useUnsavedChangesGuard } from "../../../profiles/edit/use-unsaved-changes-guard";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { newInviteSessionNonce, operationKeyOf } from "../../invites/operation-key";
import { trackGroupCreateOpened, trackGroupCreateResult } from "../groups-analytics";
import { GROUPS_COPY } from "../groups-copy";
import type { EligiblePeoplePage } from "../groups-types";
import { GROUPS_QK, GROUPS_QK_PREFIXES } from "../groups-keys";
import {
  addToSelection,
  canContinueInfo,
  canContinuePeople,
  createFailureOf,
  createSignature,
  exceedsMax,
  groupNameIssue,
  groupNameMessage,
  hasMeaningfulDraft,
  normalizeGroupName,
  removeFromSelection,
  selectedCount,
  showSelectAll,
  summaryPeople,
  teamFieldOf,
  teamValueLabel,
  toggleSelection,
  type TeamChoice,
} from "../groups-presentation";
import { GROUPS_HREFS } from "../groups-routes";
import {
  GroupAvatarError,
  createSocietyGroup,
  fetchEligiblePeoplePage,
  fetchGroupCreateContexts,
  fetchGroupTeams,
  fetchTeamPeopleIds,
  pickGroupAvatar,
  toGroupsError,
  uploadGroupAvatar,
  type GroupAvatarErrorCode,
  type PickedGroupAvatar,
} from "../groups-service";
import {
  DEFAULT_GROUP_LIMITS,
  type CreateGroupInput,
  type EligiblePerson,
  type GroupAvatarRef,
  type GroupComposeOrigin,
} from "../groups-types";
import { GroupNotice, GroupComposeFooter, GroupComposeHeader, type WizardStep } from "./components/GroupComposeChrome";
import { GroupInfoStep } from "./components/GroupInfoStep";
import { GroupPeopleStep } from "./components/GroupPeopleStep";
import { GroupSocietySheet, GroupTeamSheet } from "./components/GroupPickerSheets";
import { GroupSummaryStep } from "./components/GroupSummaryStep";
import {
  SUMMARY_PREVIEW_MAX,
  avatarErrorMessage,
  mergeKnownPeople,
  resolveComposeSociety,
  type ComposeSociety,
} from "./group-compose-model";

type Creator = { avatarUrl: string | null; fullName: string; profileId: string };

type AvatarDraft = {
  error: string | null;
  picked: PickedGroupAvatar;
  ref: GroupAvatarRef | null;
  status: "error" | "ready" | "uploading";
};

type Notice = { text: string; tone: "error" | "info" };

const STEP_TITLES: Record<WizardStep, string> = {
  1: GROUPS_COPY.createGroup,
  2: GROUPS_COPY.stepPeople,
  3: GROUPS_COPY.stepSummary,
};

const SEARCH_DEBOUNCE_MS = 300;

/** §12: in caso di annullamento si torna all'origine corretta. */
function useLeaveCompose(origin: GroupComposeOrigin) {
  const router = useRouter();

  return () => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace((origin === "messages" ? "/(tabs)/messages" : GROUPS_HREFS.center()) as never);
  };
}

const avatarCodeOf = (error: unknown): GroupAvatarErrorCode =>
  error instanceof GroupAvatarError ? error.code : "upload_failed";

export function GroupComposeScreen() {
  const params = useLocalSearchParams<{ clubId?: string; origin?: string }>();
  const origin: GroupComposeOrigin = params.origin === "messages" ? "messages" : "dashboard";
  const clubIdParam = typeof params.clubId === "string" && params.clubId ? params.clubId : null;
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current, isLoading: identityLoading } = useDashboardIdentity();
  const leave = useLeaveCompose(origin);

  useEffect(() => {
    trackGroupCreateOpened(origin);
  }, [origin]);

  const [picked, setPicked] = useState<string | null>(null);

  const contextsQuery = useQuery({
    enabled: origin === "messages" && !!actorId,
    queryFn: fetchGroupCreateContexts,
    queryKey: GROUPS_QK.contexts(actorId),
    staleTime: 30_000,
  });

  const resolution = resolveComposeSociety({
    clubIdParam,
    contexts: contextsQuery.data ?? null,
    contextsFailed: contextsQuery.isError,
    identity: current,
    identityLoading,
    origin,
    picked,
  });

  if (!profile || resolution.status === "loading") {
    return (
      <View style={styles.center}>
        <AppText color="neutralMuted" variant="bodySm">
          {GROUPS_COPY.loading}
        </AppText>
      </View>
    );
  }

  if (resolution.status === "unavailable") {
    return <ComposeUnavailable onBack={leave} origin={origin} />;
  }

  if (resolution.status === "choose") {
    return (
      <View style={styles.screen}>
        <GroupSocietySheet contexts={resolution.contexts} onClose={leave} onConfirm={setPicked} />
      </View>
    );
  }

  return (
    <GroupWizard
      creator={{ avatarUrl: profile.avatar_url, fullName: profile.full_name ?? "", profileId: profile.id }}
      key={`${actorId}:${resolution.society.clubId}`}
      leave={leave}
      origin={origin}
      society={resolution.society}
    />
  );
}

function ComposeUnavailable({ onBack, origin }: { onBack: () => void; origin: GroupComposeOrigin }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Pressable
        accessibilityLabel={GROUPS_COPY.back}
        accessibilityRole="button"
        onPress={onBack}
        style={styles.unavailableBack}
      >
        <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
      </Pressable>

      <View style={styles.unavailableBody}>
        <AppText accessibilityRole="header" color="neutral" variant="titleMd">
          {GROUPS_COPY.notAuthorizedTitle}
        </AppText>
        <AppText color="neutralMuted" variant="bodyLg">
          {GROUPS_COPY.notAuthorizedBody}
        </AppText>
        <Button
          label={origin === "dashboard" ? GROUPS_COPY.backToDashboard : GROUPS_COPY.goBack}
          onPress={onBack}
          variant="neutralOutline"
        />
      </View>
    </View>
  );
}

type WizardProps = {
  creator: Creator;
  leave: () => void;
  origin: GroupComposeOrigin;
  society: ComposeSociety;
};

function GroupWizard({ creator, leave, origin, society }: WizardProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const actorId = creator.profileId;
  const clubId = society.clubId;

  const [nonce] = useState(newInviteSessionNonce);
  const [step, setStep] = useState<WizardStep>(1);

  // Step 1
  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [nameServerError, setNameServerError] = useState<string | null>(null);
  const [team, setTeam] = useState<TeamChoice>(undefined);
  const [presetApplied, setPresetApplied] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [avatar, setAvatar] = useState<AvatarDraft | null>(null);
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null);
  const [avatarSheetOpen, setAvatarSheetOpen] = useState(false);
  const uploadSeq = useRef(0);

  // Step 2
  const [selected, setSelected] = useState<string[]>([]);
  const [known, setKnown] = useState<Record<string, EligiblePerson>>({});
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [bulkPending, setBulkPending] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [peopleNotice, setPeopleNotice] = useState<string | null>(null);

  // Step 3 e comando
  const [pending, setPending] = useState(false);
  const [uncertainInput, setUncertainInput] = useState<CreateGroupInput | null>(null);
  const [createNotice, setCreateNotice] = useState<Notice | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [done, setDone] = useState<{ conversationId: string; title: string } | null>(null);

  // ── Letture ───────────────────────────────────────────────────────────────

  const teamsQuery = useQuery({
    queryFn: () => fetchGroupTeams(clubId),
    queryKey: GROUPS_QK.teams(actorId, clubId),
    retry: (count, error) => !toGroupsError(error).isAuthorization && count < 1,
    staleTime: 60_000,
  });
  const lookup = teamsQuery.data ?? null;
  const limits = lookup?.limits ?? DEFAULT_GROUP_LIMITS;
  const teamField = teamFieldOf(lookup);
  const teamsDenied = teamsQuery.isError && toGroupsError(teamsQuery.error).isAuthorization;

  /* §15: la preimpostazione si applica una volta sola, quando il lookup
     arriva, e solo se il contesto la determina. Aggiustata durante il render,
     non in un effetto. */
  if (lookup && !presetApplied) {
    setPresetApplied(true);

    if (teamField.preset !== undefined) {
      setTeam(teamField.preset);
    }
  }

  const peopleTeamId = typeof team === "string" ? team : null;
  const peopleQuery = useInfiniteQuery<
    EligiblePeoplePage,
    Error,
    InfiniteData<EligiblePeoplePage, string | null>,
    readonly unknown[],
    string | null
  >({
    enabled: step === 2 && !!lookup,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialPageParam: null,
    queryFn: ({ pageParam }) =>
      fetchEligiblePeoplePage({ clubId, cursor: pageParam, query, teamId: peopleTeamId }),
    queryKey: GROUPS_QK.people(actorId, clubId, peopleTeamId, query),
    staleTime: 0,
  });
  const pages = peopleQuery.data?.pages;
  const people = (pages?.flatMap((page) => page.items) ?? []).filter((person) => person.profileId !== creator.profileId);
  const teamTotal = pages?.[0]?.teamTotal ?? 0;
  const teamName = typeof team === "string" ? (lookup?.teams.find((entry) => entry.teamId === team)?.teamName ?? null) : null;

  useEffect(() => {
    if (pages) {
      setKnown((previous) => mergeKnownPeople(previous, pages.flatMap((page) => page.items)));
    }
  }, [pages]);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [search]);

  // ── Uscita ────────────────────────────────────────────────────────────────

  const count = selectedCount(selected, creator.profileId);
  const draft = hasMeaningfulDraft({
    avatar: avatar !== null,
    name,
    presetTeam: teamField.preset,
    selected: count,
    team,
  });
  const requestExit = useUnsavedChangesGuard({
    isDirty: draft && done === null,
    isSaving: pending,
    onLeave: leave,
    title: GROUPS_COPY.exitTitle,
  });

  /* Il guard sopra si aggiorna prima di questo effetto (stesso commit): la
     replace non chiede conferma per un gruppo appena creato. */
  useEffect(() => {
    if (done) {
      router.replace(GROUPS_HREFS.conversation(done.conversationId, done.title) as never);
    }
  }, [done, router]);

  const locked = pending || uncertainInput !== null || done !== null;

  /* §13: il back tra step non chiede conferma. Su Android lo gestiamo qui;
     allo step 1 passa al navigatore e al guard. */
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (step === 1) {
        return false;
      }

      /* §23: con esito incerto non si torna a modificare (cambierebbe
         l'intento), ma si può uscire con la conferma condivisa. */
      if (uncertainInput !== null && !pending) {
        requestExit();
      } else if (!locked) {
        setCreateNotice(null);
        setStep(step === 3 ? 2 : 1);
      }

      return true;
    });

    return () => subscription.remove();
  }, [locked, pending, requestExit, step, uncertainInput]);

  const goBack = () => {
    if (step === 1) {
      requestExit();

      return;
    }

    if (uncertainInput !== null && !pending) {
      requestExit();

      return;
    }

    if (locked) {
      return;
    }

    setCreateNotice(null);
    setStep(step === 3 ? 2 : 1);
  };

  // ── Immagine (§16) ────────────────────────────────────────────────────────

  const uploadPicked = async (pickedAvatar: PickedGroupAvatar) => {
    uploadSeq.current += 1;
    const token = uploadSeq.current;

    setAvatar({ error: null, picked: pickedAvatar, ref: null, status: "uploading" });

    try {
      const ref = await uploadGroupAvatar({ clubId, limits, picked: pickedAvatar });

      if (uploadSeq.current === token) {
        setAvatar({ error: null, picked: pickedAvatar, ref, status: "ready" });
      }
    } catch (error) {
      if (uploadSeq.current === token) {
        setAvatar({
          error: avatarErrorMessage(avatarCodeOf(error)),
          picked: pickedAvatar,
          ref: null,
          status: "error",
        });
      }
    }
  };

  const pickAndUpload = async () => {
    setAvatarNotice(null);

    let pickedAvatar: PickedGroupAvatar | null;

    try {
      pickedAvatar = await pickGroupAvatar();
    } catch (error) {
      setAvatarNotice(avatarErrorMessage(avatarCodeOf(error)));

      return;
    }

    if (pickedAvatar) {
      await uploadPicked(pickedAvatar);
    }
  };

  const removeAvatar = () => {
    uploadSeq.current += 1;
    setAvatar(null);
    setAvatarNotice(null);
    setAvatarSheetOpen(false);
  };

  const onAvatarPress = () => {
    if (avatar?.status === "uploading") {
      return;
    }

    if (avatar?.status === "ready") {
      setAvatarSheetOpen(true);

      return;
    }

    void pickAndUpload();
  };

  // ── Persone (§18, §19) ────────────────────────────────────────────────────

  const toggle = (id: string) => {
    if (bulkPending || id === creator.profileId) {
      return;
    }

    setSelected((previous) => toggleSelection(previous, id));
    setPeopleNotice(null);
    setBulkError(null);
  };

  const selectAll = async () => {
    if (bulkPending || typeof team !== "string") {
      return;
    }

    setBulkPending(true);
    setBulkError(null);
    setPeopleNotice(null);

    try {
      const ids = await fetchTeamPeopleIds(clubId, team);
      const next = addToSelection(selected, ids, creator.profileId);

      /* §19: se «tutti» supera il massimo non si selezionano i primi N. */
      if (exceedsMax(selectedCount(next, creator.profileId), limits)) {
        setBulkError(GROUPS_COPY.tooMany(limits.maxPeople));
      } else {
        setSelected(next);
      }
    } catch (error) {
      setBulkError(
        toGroupsError(error).code === "SOCIETY_GROUP_TOO_MANY_PEOPLE"
          ? GROUPS_COPY.tooMany(limits.maxPeople)
          : GROUPS_COPY.selectAllError,
      );
    } finally {
      setBulkPending(false);
    }
  };

  const continueFromPeople = () => {
    if (!canContinuePeople({ bulkPending, count })) {
      setPeopleNotice(GROUPS_COPY.peopleRequired);

      return;
    }

    if (exceedsMax(count, limits)) {
      setPeopleNotice(GROUPS_COPY.tooMany(limits.maxPeople));

      return;
    }

    setPeopleNotice(null);
    setStep(3);
  };

  // ── Comando (§21–§24) ─────────────────────────────────────────────────────

  const buildInput = (): CreateGroupInput => {
    const teamId = typeof team === "string" ? team : null;
    const avatarAssetId = avatar?.status === "ready" ? (avatar.ref?.assetId ?? null) : null;
    const personIds = selected.filter((id) => id !== creator.profileId);

    return {
      avatarAssetId,
      clubId,
      name: normalizeGroupName(name),
      operationKey: operationKeyOf(
        nonce,
        createSignature({ avatarAssetId, clubId, creatorId: creator.profileId, name, personIds, teamId }),
      ),
      personIds,
      source: origin,
      teamId,
    };
  };

  const applyFailure = (raw: unknown, input: CreateGroupInput) => {
    const failure = createFailureOf(toGroupsError(raw), limits);

    /* Un rifiuto definitivo chiude l’esito incerto: il server ha risposto, e
       la correzione successiva è un nuovo intento con una nuova chiave. */
    if (failure.kind !== "uncertain") {
      setUncertainInput(null);
    }

    trackGroupCreateResult({
      errorCategory: failure.kind,
      hasAvatar: input.avatarAssetId !== null,
      hasTeam: input.teamId !== null,
      origin,
      outcome: "failed",
      people: input.personIds.length + 1,
    });

    switch (failure.kind) {
      case "people":
        setSelected((previous) => removeFromSelection(previous, failure.removeIds));
        setPeopleNotice(failure.message);
        setStep(2);
        void queryClient.invalidateQueries({ queryKey: ["society-group-people", actorId, clubId] });
        break;
      case "team":
        /* §15: mai null al posto di una squadra non più disponibile. */
        setTeam(undefined);
        setTeamError(failure.message);
        setStep(1);
        void queryClient.invalidateQueries({ queryKey: GROUPS_QK.teams(actorId, clubId) });
        break;
      case "name":
        setNameServerError(failure.message);
        setNameTouched(true);
        setStep(1);
        break;
      case "avatar":
        setAvatar((previous) =>
          previous ? { ...previous, error: failure.message, ref: null, status: "error" } : previous,
        );
        setStep(1);
        break;
      case "revoked":
        setRevoked(true);
        setCreateNotice({ text: failure.message, tone: "error" });
        void queryClient.invalidateQueries({ queryKey: GROUPS_QK.contexts(actorId) });
        break;
      case "uncertain":
        /* §23: l'intento resta quello: stessa chiave al prossimo tentativo. */
        setUncertainInput(input);
        setCreateNotice({ text: failure.message, tone: "info" });
        break;
      default:
        setCreateNotice({ text: failure.message, tone: "error" });
    }
  };

  const submit = async (input: CreateGroupInput) => {
    setPending(true);
    setCreateNotice(null);

    try {
      const result = await createSocietyGroup(input);

      /* §29: un retry dello stesso intento non è un secondo gruppo creato. */
      trackGroupCreateResult({
        hasAvatar: input.avatarAssetId !== null,
        hasTeam: input.teamId !== null,
        origin,
        outcome: result.replayed ? "recovered" : "succeeded",
        people: input.personIds.length + 1,
      });

      setUncertainInput(null);
      GROUPS_QK_PREFIXES.forEach((prefix) => {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      });
      void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(actorId) });
      setDone({ conversationId: result.conversationId, title: input.name });
    } catch (error) {
      applyFailure(error, input);
    } finally {
      setPending(false);
    }
  };

  const onCreate = () => {
    if (pending || revoked || done) {
      return;
    }

    void submit(uncertainInput ?? buildInput());
  };

  // ── Resa ──────────────────────────────────────────────────────────────────

  if (teamsDenied) {
    return <ComposeUnavailable onBack={leave} origin={origin} />;
  }

  const issue = groupNameIssue(name, limits);
  const nameError =
    nameServerError ?? (issue === "too_long" || (nameTouched && issue) ? groupNameMessage(issue, limits) : null);
  const summary =
    step === 3
      ? summaryPeople({
          creator: { avatarUrl: creator.avatarUrl, fullName: creator.fullName, profileId: creator.profileId },
          known: new Map(Object.entries(known)),
          previewMax: SUMMARY_PREVIEW_MAX,
          selected,
        })
      : null;
  const avatarView = avatar
    ? { error: avatar.error, previewUri: avatar.picked.uri, status: avatar.status }
    : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <GroupComposeHeader onBack={goBack} society={society} step={step} title={STEP_TITLES[step]} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.body}>
        <View style={styles.body}>
          {step === 1 ? (
            <GroupInfoStep
              avatar={avatarView}
              avatarNotice={avatarNotice}
              nameError={nameError}
              nameValue={name}
              onAvatarPress={onAvatarPress}
              onAvatarRemove={removeAvatar}
              onAvatarRetry={() => {
                if (avatar) void uploadPicked(avatar.picked);
              }}
              onNameBlur={() => setNameTouched(true)}
              onNameChange={(value) => {
                setName(value);
                setNameServerError(null);
              }}
              onTeamPress={() => setTeamSheetOpen(true)}
              onTeamRetry={() => void teamsQuery.refetch()}
              teamError={teamError}
              teamField={teamField}
              teamLoadError={teamsQuery.isError}
              teamLoading={teamsQuery.isPending}
              teamValue={teamValueLabel(team, lookup)}
            />
          ) : null}

          {step === 2 ? (
            <GroupPeopleStep
              banner={peopleNotice}
              bulkError={bulkError}
              bulkPending={bulkPending}
              fetchingNext={peopleQuery.isFetchingNextPage}
              hasError={peopleQuery.isError}
              loading={peopleQuery.isPending}
              onEndReached={() => {
                if (peopleQuery.hasNextPage && !peopleQuery.isFetchingNextPage) {
                  void peopleQuery.fetchNextPage();
                }
              }}
              onRetry={() => void peopleQuery.refetch()}
              onSearchChange={setSearch}
              onSelectAll={() => void selectAll()}
              onToggle={toggle}
              people={people}
              query={query}
              search={search}
              selected={selected}
              showSelectAll={showSelectAll({ query, teamId: peopleTeamId, teamTotal })}
              teamName={teamName}
            />
          ) : null}

          {step === 3 && summary ? (
            <GroupSummaryStep
              adminName={GROUPS_COPY.you}
              avatarUri={avatar?.status === "ready" ? avatar.picked.uri : null}
              locked={locked}
              more={summary.more}
              name={normalizeGroupName(name)}
              notice={createNotice ? <GroupNotice testID="group-create-notice" text={createNotice.text} tone={createNotice.tone} /> : null}
              onEditInfo={() => setStep(1)}
              onEditPeople={() => setStep(2)}
              people={summary.people}
              societyName={society.name}
              teamLabel={teamValueLabel(team, lookup)}
              total={summary.total}
            />
          ) : null}
        </View>

        {step === 1 ? (
          <GroupComposeFooter
            disabled={
              !canContinueInfo({
                limits,
                lookup,
                name,
                team,
                /* Un avatar in errore non si ignora in silenzio: o si riprova o si rimuove (§16). */
                uploading: avatar?.status === "uploading" || avatar?.status === "error",
              })
            }
            label={GROUPS_COPY.continue}
            onPress={() => setStep(2)}
            testID="group-compose-continue"
          />
        ) : null}

        {step === 2 ? (
          <GroupComposeFooter
            counter={GROUPS_COPY.selected(count)}
            disabled={!canContinuePeople({ bulkPending, count })}
            label={GROUPS_COPY.continue}
            onPress={continueFromPeople}
            testID="group-compose-continue"
          />
        ) : null}

        {step === 3 ? (
          <GroupComposeFooter
            disabled={revoked || pending || done !== null}
            label={uncertainInput ? GROUPS_COPY.retry : GROUPS_COPY.createGroup}
            loading={pending || done !== null}
            onPress={onCreate}
            testID="group-compose-create"
          />
        ) : null}
      </KeyboardAvoidingView>

      <GroupTeamSheet
        error={teamsQuery.isError}
        loading={teamsQuery.isPending}
        lookup={lookup}
        onClose={() => setTeamSheetOpen(false)}
        onRetry={() => void teamsQuery.refetch()}
        onSelect={(choice) => {
          setTeam(choice);
          setTeamError(null);
          setTeamSheetOpen(false);
        }}
        value={team}
        visible={teamSheetOpen}
      />

      <ActionSheet
        actions={[
          {
            icon: "image-outline",
            label: GROUPS_COPY.changeImage,
            onPress: () => {
              setAvatarSheetOpen(false);
              void pickAndUpload();
            },
          },
          { destructive: true, icon: "trash-outline", label: GROUPS_COPY.removeImage, onPress: removeAvatar },
        ]}
        onClose={() => setAvatarSheetOpen(false)}
        visible={avatarSheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flex: 1,
    justifyContent: "center",
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  unavailableBack: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: spacing[10],
    width: sizes.touchTarget,
  },
  unavailableBody: {
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
});
