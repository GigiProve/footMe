/**
 * Passo 3 del composer — Riepilogo e invio (§23, §24; screen 08).
 *
 * «Nessun campo Messaggio della società, nota, textarea, checkbox
 * contrattuale o conferma aggiuntiva ridondante dopo il riepilogo.» Il tap su
 * Invia invito è l'unica conferma, ed è anche l'unico punto dell'intero
 * composer che scrive qualcosa.
 *
 * Il riepilogo Persona non ripete il ruolo (§23): il ruolo è la prima riga
 * del Collegamento, e stamparlo due volte è esattamente ciò che il master
 * mostra di non fare.
 */
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing } from "../../../../theme/tokens";
import { AppText, Button } from "../../../../ui";
import { useToast } from "../../../../ui/Toast/ToastProvider";
import { useSession } from "../../../auth/use-session";
import { STALE_MS } from "../../cache/freshness-policy";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { InviteFieldRow } from "../components/InviteFieldRow";
import { InvitePersonHeader } from "../components/InvitePersonHeader";
import { InvitesCenterHeader } from "../components/InvitesCenterHeader";
import { trackInvitesEvent } from "../invites-analytics";
import { INVITES_QK, INVITES_QK_PREFIXES } from "../invites-keys";
import {
  INVITES_COPY,
  mutationErrorCopy,
  normalizeCustomRole,
  sentFeedbackBody,
} from "../invites-presentation";
import { INVITES_HREFS } from "../invites-routes";
import {
  InvitesAccessError,
  createMemberInvite,
  fetchAssignmentRoles,
  fetchInvitesCenter,
  toInvitesError,
} from "../invites-service";
import { useInviteCompose } from "./InviteComposeProvider";

export function InviteReviewScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : null;
  const { draft, operationKey, reset } = useInviteCompose();

  const [error, setError] = useState<string | null>(null);

  const centerQuery = useQuery({
    enabled: !!clubId && !!actorId,
    queryFn: () => fetchInvitesCenter(clubId as string),
    queryKey: INVITES_QK.center(actorId, clubId ?? ""),
    staleTime: STALE_MS.operational,
  });

  const rolesQuery = useQuery({
    enabled: !!actorId,
    queryFn: fetchAssignmentRoles,
    queryKey: INVITES_QK.roles(actorId),
    staleTime: STALE_MS.presentation,
  });

  const center = centerQuery.data ?? null;
  const person = draft.person;
  const role = (rolesQuery.data?.roles ?? []).find(
    (item) => item.roleId === draft.roleId,
  );
  const customRole = normalizeCustomRole(draft.customRole);
  const roleLabel = role?.isCustom ? customRole : (role?.label ?? null);

  const mutation = useMutation({
    mutationFn: () =>
      createMemberInvite({
        clubId: clubId as string,
        customRole: role?.isCustom ? customRole : null,
        operationKey,
        profileId: person?.profileId ?? "",
        roleId: draft.roleId ?? "",
        scopeType: draft.scopeType,
        teamId: draft.scopeType === "team" ? draft.teamId : null,
      }),
    onError: (raw) => {
      const failure =
        raw instanceof InvitesAccessError ? raw : toInvitesError(raw);

      trackInvitesEvent("invite_submit_result", {
        outcome: "error",
        reason: failure.code,
      });
      setError(mutationErrorCopy(failure.code, "create"));
    },
    onSuccess: () => {
      trackInvitesEvent("invite_submit_result", { outcome: "ok" });

      INVITES_QK_PREFIXES.forEach((prefix) => {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      });

      /* §24: «Usa feedback e ritorno al Centro; non è obbligatoria una
         pagina di successo autonoma.» Il feedback conferma la registrazione
         dell'invito, non la consegna di una push. */
      showToast({
        message: person
          ? `${INVITES_COPY.sentFeedback}. ${sentFeedbackBody(person.fullName)}`
          : INVITES_COPY.sentFeedback,
        tone: "success",
      });

      reset();

      /* §24: il ritorno è comprensibile — il Centro si apre sulla tab degli
         inviti inviati, e sul contesto della squadra appena proposta quando
         ce n'è una, senza ampliare lo scope. */
      router.replace(
        INVITES_HREFS.center({
          tab: "sent",
          teamId: draft.scopeType === "team" ? (draft.teamId ?? undefined) : undefined,
        }) as never,
      );
    },
  });

  const submit = useCallback(() => {
    if (!clubId || !person || !draft.roleId || mutation.isPending) {
      return;
    }

    setError(null);
    trackInvitesEvent("invite_submitted", {
      profile_type: person.profileType,
      scope: draft.scopeType,
    });
    mutation.mutate();
  }, [clubId, draft.roleId, draft.scopeType, mutation, person]);

  if (!person) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.navWrap}>
          <InvitesCenterHeader
            isVerified={center?.clubIsVerified ?? false}
            logoUrl={center?.clubLogoUrl ?? null}
            name={center?.clubName ?? ""}
            onBack={() => router.back()}
            title={INVITES_COPY.reviewTitle}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.navWrap}>
        <InvitesCenterHeader
          isVerified={center?.clubIsVerified ?? false}
          logoUrl={center?.clubLogoUrl ?? null}
          name={center?.clubName ?? ""}
          onBack={() => router.back()}
          step="3 di 3 · Riepilogo"
          title={INVITES_COPY.reviewTitle}
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: spacing[48] + spacing[40] + insets.bottom },
        ]}
      >
        <AppText color="neutralMuted" style={styles.section} variant="metaStrong">
          {INVITES_COPY.personSection}
        </AppText>

        {/* §23: senza sottotitolo professionale duplicato. */}
        <InvitePersonHeader avatarUrl={person.avatarUrl} name={person.fullName} />

        <AppText color="neutralMuted" style={styles.section} variant="metaStrong">
          {INVITES_COPY.linkSection}
        </AppText>

        <InviteFieldRow label="Ruolo" value={roleLabel} />

        {draft.scopeType === "society" ? (
          <InviteFieldRow
            label={INVITES_COPY.scopeFieldLabel}
            showDivider
            value={INVITES_COPY.societyScope}
          />
        ) : (
          <InviteFieldRow
            label={INVITES_COPY.teamFieldLabel}
            showDivider
            value={draft.teamLabel}
          />
        )}

        <AppText color="neutralMuted" style={styles.consent} variant="meta">
          {INVITES_COPY.reviewConsent}
        </AppText>

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

        <Button
          fullWidth
          label={INVITES_COPY.editLink}
          onPress={() => router.back()}
          size="md"
          testID="invite-review-edit"
          variant="link"
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: spacing[16] + insets.bottom }]}>
        <Button
          fullWidth
          label={INVITES_COPY.submit}
          loading={mutation.isPending}
          onPress={submit}
          size="md"
          testID="invite-review-submit"
          variant="primary"
        />
      </View>
    </View>
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
  content: {
    paddingHorizontal: spacing[20],
  },
  section: {
    paddingBottom: spacing[4],
    paddingTop: spacing[16],
  },
  consent: {
    paddingTop: spacing[16],
  },
  error: {
    paddingTop: spacing[12],
  },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
});
