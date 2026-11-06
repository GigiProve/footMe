/**
 * La proposta come la vede il destinatario (§28-§33; screen 10-14, 16).
 *
 * Una schermata per sei master, perché sono sei **stati dello stesso
 * record**: §33 ne elenca le condizioni e la prima regola è che «la vecchia
 * notification … apre sempre lo stato corrente del record». Costruire una
 * pagina per stato avrebbe significato legare il rendering allo stato che
 * esisteva quando la notifica è nata.
 *
 * Superficie focalizzata: niente bottom navigation, e aprirla non rende
 * disponibile la Dashboard della Società invitante (§6).
 *
 * Tutto è in sola lettura: §28 vieta «chevron di modifica, selector, cambio
 * di Team, controproposta o testo verso la società». Le righe sono
 * `InviteFieldRow` senza `onPress`, che per costruzione non sono controlli.
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../../ui";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { InviteConfirmSheet } from "../components/InviteConfirmSheet";
import { InviteFieldRow } from "../components/InviteFieldRow";
import { trackInvitesEvent } from "../invites-analytics";
import { INVITES_QK } from "../invites-keys";
import {
  INVITES_COPY,
  cancelledByClubSentence,
  contextLine,
  declineSentence,
  invitationSentence,
  linkSentence,
  mutationErrorCopy,
  resolutionLine,
} from "../invites-presentation";
import {
  InvitesAccessError,
  fetchMyInvite,
  respondToMemberInvite,
  toInvitesError,
} from "../invites-service";
import { newInviteSessionNonce, operationKeyOf } from "../operation-key";
import type { MyInvite } from "../invites-types";

type OpenSheet = "accept" | "decline" | null;

export function ReceivedInviteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const params = useLocalSearchParams<{ inviteId?: string | string[] }>();
  const inviteId = Array.isArray(params.inviteId)
    ? params.inviteId[0]
    : params.inviteId;

  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [error, setError] = useState<string | null>(null);
  /* Un nonce per apertura: due tap sullo stesso pulsante conservano la
     stessa identità dell'operazione (§37). */
  const [nonce] = useState(newInviteSessionNonce);

  const inviteQuery = useQuery({
    enabled: !!inviteId && !!actorId,
    queryFn: () => fetchMyInvite(inviteId as string),
    queryKey: INVITES_QK.myInvite(actorId, inviteId ?? ""),
    retry: (failureCount, raw) =>
      !(raw instanceof InvitesAccessError) && failureCount < 1,
    staleTime: STALE_MS.operational,
  });

  const invite = inviteQuery.data ?? null;

  const mutation = useMutation({
    mutationFn: (accept: boolean) =>
      respondToMemberInvite({
        accept,
        inviteId: inviteId as string,
        operationKey: operationKeyOf(nonce, accept ? "accept" : "decline"),
        revision: invite?.revision ?? 1,
      }),
    onError: (raw) => {
      const failure =
        raw instanceof InvitesAccessError ? raw : toInvitesError(raw);

      trackInvitesEvent("invite_response_result", {
        outcome: "error",
        reason: failure.code,
      });
      setSheet(null);
      setError(mutationErrorCopy(failure.code, "respond"));
      /* Lo stato reale può essere cambiato sotto la risposta: si rilegge
         invece di affermare qualcosa (§33). */
      void inviteQuery.refetch();
    },
    onSuccess: (result) => {
      trackInvitesEvent("invite_response_result", {
        outcome: "ok",
        state: result.state,
      });
      setSheet(null);
      setError(null);

      void queryClient.invalidateQueries({
        queryKey: INVITES_QK.myInvite(actorId, inviteId ?? ""),
      });
      /* L'esito mostrato è quello riletto dal server: §30 vieta di
         «mostrare successo sulla sola base di un optimistic update». */
      void inviteQuery.refetch();
    },
  });

  const respond = useCallback(
    (accept: boolean) => {
      if (mutation.isPending) {
        return;
      }

      setError(null);
      mutation.mutate(accept);
    },
    [mutation],
  );

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/notifications" as never);
  }, [router]);

  const title = invite ? TITLES[stateOf(invite)] : INVITES_COPY.receivedTitle;

  const shell = (body: React.ReactNode) => (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <View style={styles.bar}>
          <BackButton onPress={goBack} />
          <AppText
            accessibilityRole="header"
            color="neutral"
            numberOfLines={1}
            style={styles.barTitle}
            variant="titleMd"
          >
            {title}
          </AppText>
        </View>
      </View>
      {body}
    </View>
  );

  if (!inviteId) {
    return shell(
      <DashboardGlobalError
        body="Riapri l'invito dalle notifiche."
        onRetry={goBack}
        title={INVITES_COPY.unavailableTitle}
      />,
    );
  }

  if (inviteQuery.isLoading && !invite) {
    return shell(
      <View style={styles.content}>
        <DashboardSkeleton />
      </View>,
    );
  }

  if (!invite) {
    /* §33: un errore temporaneo non è un annullamento. La copy non afferma
       niente sul record, e offre un retry. */
    return shell(
      <DashboardGlobalError
        body={INVITES_COPY.detailError}
        onRetry={() => void inviteQuery.refetch()}
        title={INVITES_COPY.unavailableTitle}
      />,
    );
  }

  const state = stateOf(invite);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <View style={styles.bar}>
          <BackButton onPress={goBack} />
          <AppText
            accessibilityRole="header"
            color="neutral"
            numberOfLines={1}
            style={styles.barTitle}
            variant="titleMd"
          >
            {title}
          </AppText>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[32] + insets.bottom },
        ]}
      >
        <View style={styles.clubRow}>
          <Avatar
            name={invite.clubName}
            size="md"
            square
            tone="ink"
            uri={invite.clubLogoUrl ?? undefined}
          />
          <AppText color="neutral" numberOfLines={1} style={styles.clubName} variant="titleSm">
            {invite.clubName}
          </AppText>
          {invite.clubIsVerified ? (
            <Ionicons
              accessibilityLabel="Società verificata"
              color={colors.accent}
              name="checkmark-circle"
              size={16}
            />
          ) : null}
          {invite.clubCity ? (
            <AppText color="neutralSoft" variant="meta">
              {invite.clubCity}
            </AppText>
          ) : null}
        </View>

        {state === "actionable" ? (
          <>
            <AppText color="neutral" style={styles.lead} variant="bodyLg">
              {invitationSentence(invite.clubName)}
            </AppText>

            <AppText color="neutralMuted" style={styles.section} variant="metaStrong">
              {INVITES_COPY.proposedSection}
            </AppText>

            <InviteFieldRow label="Ruolo" value={invite.roleLabel} />

            {invite.scopeType === "society" ? (
              <InviteFieldRow
                label={INVITES_COPY.scopeFieldLabel}
                showDivider
                value={INVITES_COPY.societyScope}
              />
            ) : (
              <InviteFieldRow
                label={INVITES_COPY.teamFieldLabel}
                showDivider
                value={invite.teamName}
              />
            )}

            {/* §28: trattamento informativo discreto, senza checkbox
                contrattuali o grandi warning. */}
            <AppText color="neutralMuted" style={styles.consent} variant="meta">
              {INVITES_COPY.receivedConsent}
            </AppText>
          </>
        ) : (
          <>
            <AppText color="neutral" style={styles.lead} variant="titleMd">
              {HEADLINES[state as Exclude<ResolvedState, "actionable">]}
            </AppText>

            <AppText color="neutralMuted" style={styles.body} variant="bodyLg">
              {bodyFor(invite, state)}
            </AppText>

            {state === "accepted" ? (
              <AppText color="neutralSoft" style={styles.meta} variant="meta">
                {resolutionLine("accepted", invite.resolvedAt) ?? ""}
              </AppText>
            ) : (
              <AppText color="neutralSoft" style={styles.meta} variant="meta">
                {contextLine({
                  contextLabel: invite.contextLabel,
                  roleLabel: invite.roleLabel,
                })}
              </AppText>
            )}
          </>
        )}

        {error ? (
          <AppText
            accessibilityRole="alert"
            color="danger"
            style={styles.error}
            variant="bodySm"
          >
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing[16] + insets.bottom }]}>
        {state === "actionable" ? (
          /* §45: affiancate nel viewport del master, impilate quando non
             entrano — qui la riga si avvolge invece di troncare. */
          <View style={styles.actions}>
            <Button
              label={INVITES_COPY.accept}
              onPress={() => {
                trackInvitesEvent("invite_response_confirm_opened", {
                  action: "accept",
                });
                setSheet("accept");
              }}
              size="md"
              style={styles.action}
              testID="invite-accept"
              variant="primary"
            />
            <Button
              label={INVITES_COPY.decline}
              onPress={() => {
                trackInvitesEvent("invite_response_confirm_opened", {
                  action: "decline",
                });
                setSheet("decline");
              }}
              size="md"
              style={styles.action}
              testID="invite-decline"
              variant="neutralOutline"
            />
          </View>
        ) : state === "accepted" ? (
          <Button
            fullWidth
            label={INVITES_COPY.goToProfile}
            /* §31: il profilo **personale** della persona corrente. Non apre
               la Dashboard della Società e non cambia identità. */
            onPress={() => router.replace("/(tabs)/profile" as never)}
            size="md"
            testID="invite-go-profile"
            variant="primary"
          />
        ) : (
          <Button
            fullWidth
            label={INVITES_COPY.close}
            onPress={goBack}
            size="md"
            testID="invite-close"
            variant="primary"
          />
        )}
      </View>

      <InviteConfirmSheet
        body={linkSentence({
          clubName: invite.clubName,
          roleLabel: invite.roleLabel,
          scopeType: invite.scopeType,
          teamName: invite.teamName,
        })}
        cancelLabel={INVITES_COPY.cancelFlow}
        confirmLabel={INVITES_COPY.acceptConfirm}
        isBusy={mutation.isPending}
        onCancel={() => setSheet(null)}
        onConfirm={() => respond(true)}
        title={INVITES_COPY.acceptConfirmTitle}
        visible={sheet === "accept"}
      />

      <InviteConfirmSheet
        body={declineSentence(invite.clubName)}
        cancelLabel={INVITES_COPY.cancelFlow}
        confirmLabel={INVITES_COPY.decline}
        isBusy={mutation.isPending}
        onCancel={() => setSheet(null)}
        onConfirm={() => respond(false)}
        title={INVITES_COPY.declineConfirmTitle}
        tone="outline"
        visible={sheet === "decline"}
      />
    </View>
  );
}

type ResolvedState =
  | "actionable"
  | "accepted"
  | "declined"
  | "cancelled"
  | "stale";

/**
 * §33: lo stato mostrato è **riletto dal server**, non dedotto dal percorso
 * di arrivo né dallo stato che il record aveva quando la notifica è nata.
 *
 * `canRespond` separa le due righe che §33 tiene distinte: un PENDING ancora
 * azionabile e un PENDING il cui contesto non è più utilizzabile. La seconda
 * non è un annullamento della Società, e la copy non glielo attribuisce.
 */
function stateOf(invite: MyInvite): ResolvedState {
  if (invite.state === "pending") {
    return invite.canRespond ? "actionable" : "stale";
  }

  if (invite.state === "accepted") {
    return "accepted";
  }

  return invite.state === "cancelled" ? "cancelled" : "declined";
}

const TITLES: Record<ResolvedState, string> = {
  accepted: INVITES_COPY.acceptedTitle,
  actionable: INVITES_COPY.receivedTitle,
  cancelled: INVITES_COPY.unavailableTitle,
  declined: INVITES_COPY.declinedTitle,
  stale: INVITES_COPY.unavailableTitle,
};

const HEADLINES: Record<Exclude<ResolvedState, "actionable">, string> = {
  accepted: INVITES_COPY.acceptedHeadline,
  cancelled: INVITES_COPY.unavailableTitle,
  declined: INVITES_COPY.declinedTitle,
  stale: INVITES_COPY.unavailableTitle,
};

function bodyFor(invite: MyInvite, state: ResolvedState): string {
  if (state === "accepted") {
    /* §33: «Il testo distingue accettazione storica e incarico attualmente
       attivo.» Un accept il cui incarico è stato poi chiuso non afferma che
       il rapporto esista ancora. */
    return invite.assignmentActive
      ? linkSentence({
          clubName: invite.clubName,
          past: true,
          roleLabel: invite.roleLabel,
          scopeType: invite.scopeType,
          teamName: invite.teamName,
        })
      : "Questo collegamento non è più attivo.";
  }

  if (state === "declined") {
    return INVITES_COPY.declinedBody;
  }

  return state === "cancelled"
    ? cancelledByClubSentence(invite.clubName)
    : INVITES_COPY.noLongerAcceptable;
}

/** Back della superficie focalizzata: un solo target, 44pt (§45). */
function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityLabel="Indietro"
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={styles.back}
      testID="invite-received-back"
    >
      <Ionicons color={colors.textNeutral} name="arrow-back" size={22} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  navWrap: {
    paddingHorizontal: spacing[20],
  },
  bar: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    minHeight: sizes.touchTarget,
  },
  back: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    marginLeft: -spacing[10],
    width: sizes.touchTarget,
  },
  barTitle: {
    flexShrink: 1,
  },
  content: {
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  clubRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    paddingBottom: spacing[16],
  },
  clubName: {
    flexShrink: 1,
    fontWeight: "600",
  },
  lead: {
    paddingBottom: spacing[8],
  },
  body: {
    paddingBottom: spacing[8],
  },
  meta: {
    paddingBottom: spacing[8],
  },
  section: {
    paddingBottom: spacing[4],
    paddingTop: spacing[16],
  },
  consent: {
    paddingTop: spacing[16],
  },
  error: {
    paddingTop: spacing[16],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[12],
  },
  action: {
    flexBasis: 140,
    flexGrow: 1,
  },
});
