/**
 * Il rapporto con una persona, lato Società (§32, §37, §38 — screen 21,
 * 23, 24).
 *
 * «Il dettaglio può mostrare tutti gli incarichi autorizzati della persona,
 * non soltanto quello della squadra di provenienza. Un admin limitato vede
 * esclusivamente i propri ambiti.» Il filtro è del backend: questa schermata
 * disegna ciò che riceve e non nasconde righe già arrivate.
 *
 * «Il contesto di ritorno resta il Team di ingresso anche quando il dettaglio
 * espone altri incarichi autorizzati»: `from` e `teamId` viaggiano nella
 * route e il back li usa.
 */
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { STALE_MS } from "../../dashboard/cache/freshness-policy";
import {
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../dashboard/components/DashboardStates";
import { SocietyContextHeader } from "../../dashboard/components/SocietyContextHeader";
import { RoleConfirmSheet } from "../components/RoleConfirmSheet";
import { RoleListRow } from "../components/RoleListRow";
import { RoleOutcomeView } from "../components/RoleOutcomeView";
import { newRoleLinkNonce, roleLinkOperationKey } from "../operation-key";
import { trackRoleLinkEvent } from "../role-link-analytics";
import {
  ROLE_LINK_QK,
  ROLE_LINK_QK_PREFIXES,
  ROLE_LINK_RELATED_PREFIXES,
} from "../role-link-keys";
import {
  ROLE_LINK_COPY,
  ROLE_LINK_FAILURES,
  roleLinkErrorMessage,
} from "../role-link-presentation";
import { ROLE_LINK_HREFS } from "../role-link-routes";
import {
  fetchSocietyPersonLink,
  removePersonFromSociety,
  toRoleLinkError,
} from "../role-link-service";

export function SocietyPersonLinkScreen({
  clubId,
  profileId,
  returnHref,
}: {
  clubId: string;
  profileId: string;
  /** Il contesto di ingresso: Organico della squadra, struttura, Centro. */
  returnHref: string | null;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useSession();
  const actorId = profile?.id ?? "";
  const [sheetOpen, setSheetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [terminated, setTerminated] = useState(false);
  const [nonce] = useState(newRoleLinkNonce);

  const linkQuery = useQuery({
    enabled: !!actorId && !!clubId && !!profileId,
    queryFn: () => fetchSocietyPersonLink(clubId, profileId),
    queryKey: ROLE_LINK_QK.societyPerson(actorId, clubId, profileId),
    staleTime: STALE_MS.operational,
  });

  const link = linkQuery.data ?? null;

  useEffect(() => {
    if (linkQuery.isSuccess) {
      trackRoleLinkEvent("role_link_society_opened", { actor_type: "society" });
    }
  }, [linkQuery.isSuccess]);

  const removeAll = useMutation({
    mutationFn: () => {
      if (!link) throw new Error("ROLE_LINK_NOT_FOUND");

      return removePersonFromSociety({
        clubId,
        expectedRevision: link.aggregateRevision,
        operationKey: roleLinkOperationKey(
          nonce,
          `remove-all|${clubId}|${profileId}|${link.aggregateRevision}`,
        ),
        profileId,
      });
    },
    onError: (raw) => {
      const failure = toRoleLinkError(raw);

      trackRoleLinkEvent("role_link_terminate_result", {
        actor_type: "society",
        outcome: "error",
        reason: failure.code,
      });
      setSheetOpen(false);
      setError(
        failure.code === "UNKNOWN"
          ? ROLE_LINK_FAILURES.terminate
          : roleLinkErrorMessage(failure.code, { club: link?.clubName }),
      );
      void linkQuery.refetch();
    },
    onSuccess: () => {
      trackRoleLinkEvent("role_link_terminate_result", {
        actor_type: "society",
        outcome: "removed",
      });
      setSheetOpen(false);
      setTerminated(true);

      for (const prefix of [
        ...ROLE_LINK_QK_PREFIXES,
        ...ROLE_LINK_RELATED_PREFIXES,
      ]) {
        void queryClient.invalidateQueries({ queryKey: [prefix] });
      }
    },
  });

  const onBack = () => {
    if (returnHref) {
      router.replace(returnHref as never);

      return;
    }

    if (router.canGoBack()) {
      router.back();

      return;
    }

    router.replace("/(tabs)/dashboard" as never);
  };

  if (linkQuery.isLoading && !link) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.pad}>
          <SocietyContextHeader
            isVerified={false}
            logoUrl={null}
            name=""
            onBack={onBack}
          />
        </View>
        <DashboardSkeleton />
      </View>
    );
  }

  if (!link) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.pad}>
          <SocietyContextHeader
            isVerified={false}
            logoUrl={null}
            name=""
            onBack={onBack}
          />
        </View>
        <DashboardGlobalError
          body={ROLE_LINK_FAILURES.load}
          onRetry={() => void linkQuery.refetch()}
          title="Persona non disponibile"
        />
      </View>
    );
  }

  /*
   * Screen 24: l'esito della rimozione completa. §38 — «Il dettaglio non
   * offre Modifica ruolo o Aggiungi ruolo come scorciatoia di
   * riattivazione.»
   */
  if (terminated || !link.isActive) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.pad}>
          <SocietyContextHeader
            isVerified={link.clubIsVerified}
            logoUrl={link.clubLogoUrl}
            name={link.clubName}
            onBack={onBack}
          />

          <RoleOutcomeView
            avatarUrl={link.personAvatarUrl}
            body={ROLE_LINK_COPY.terminatedBody(link.personName, link.clubName)}
            helper={ROLE_LINK_COPY.terminatedHelper}
            name={link.personName}
            testID="role-link-person-terminated"
            title={ROLE_LINK_COPY.terminatedTitle}
          />

          <View style={styles.outcomeActions}>
            {link.canViewPerson ? (
              <Button
                fullWidth
                label={ROLE_LINK_COPY.viewProfile}
                onPress={() => router.push(`/profile/${profileId}` as never)}
                size="md"
                testID="role-link-person-profile"
                variant="neutralOutline"
              />
            ) : null}

            <Button
              fullWidth
              label={ROLE_LINK_COPY.close}
              onPress={onBack}
              size="lg"
              testID="role-link-person-close"
              variant="primary"
            />
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.pad}>
        <SocietyContextHeader
          isVerified={link.clubIsVerified}
          logoUrl={link.clubLogoUrl}
          name={link.clubName}
          onBack={onBack}
        />

        <View style={styles.person}>
          <Avatar
            name={link.personName}
            size="md"
            uri={link.personAvatarUrl ?? undefined}
          />

          <View style={styles.personBody}>
            <AppText color="neutral" variant="titleSm">
              {link.personName}
            </AppText>

            {link.canViewPerson ? (
              <Button
                label={ROLE_LINK_COPY.viewProfile}
                onPress={() => router.push(`/profile/${profileId}` as never)}
                size="sm"
                testID="role-link-view-profile"
                variant="link"
              />
            ) : null}
          </View>
        </View>

        <AppText
          accessibilityRole="header"
          color="neutral"
          style={styles.heading}
          variant="titleMd"
        >
          {ROLE_LINK_COPY.societyRolesHeading(link.clubName)}
        </AppText>

        <View>
          {link.roles.map((role, index) => (
            <RoleListRow
              key={role.assignmentId}
              onPress={() =>
                router.push(
                  ROLE_LINK_HREFS.societyAssignment(role.assignmentId) as never,
                )
              }
              showDivider={index > 0}
              subtitle={role.contextLabel}
              testID={`role-link-person-role-${role.assignmentId}`}
              title={role.roleLabel}
            />
          ))}
        </View>

        {link.canAdd ? (
          <View style={styles.addRow}>
            <Button
              label={`+ ${ROLE_LINK_COPY.addRoleSociety}`}
              onPress={() =>
                router.push(
                  ROLE_LINK_HREFS.assignmentAdd(clubId, { profileId }) as never,
                )
              }
              size="md"
              testID="role-link-person-add"
              variant="link"
            />
          </View>
        ) : null}

        {error ? (
          <AppText
            accessibilityRole="alert"
            color="danger"
            style={styles.error}
            variant="meta"
          >
            {error}
          </AppText>
        ) : null}

        {/* §8: «Se non disponibile, nascondi l'azione globale e mantieni le
            azioni consentite sui singoli incarichi.» */}
        {link.canRemoveAll ? (
          <View style={styles.removeRow}>
            <Button
              destructive
              label={ROLE_LINK_COPY.removeFromSociety}
              onPress={() => {
                trackRoleLinkEvent("role_link_terminate_confirm_opened", {
                  actor_type: "society",
                });
                setSheetOpen(true);
              }}
              size="md"
              testID="role-link-person-remove-all"
              variant="link"
            />
          </View>
        ) : null}
      </ScrollView>

      <RoleConfirmSheet
        body={ROLE_LINK_COPY.removeSheetBody(link.clubName)}
        cancelLabel={ROLE_LINK_COPY.cancelLabel}
        confirmLabel={ROLE_LINK_COPY.removeFromSociety}
        destructive
        isBusy={removeAll.isPending}
        note={ROLE_LINK_COPY.removeSheetKeep}
        onCancel={() => setSheetOpen(false)}
        onConfirm={() => removeAll.mutate()}
        testID="role-link-person-remove-sheet"
        title={ROLE_LINK_COPY.removeSheetTitle(link.personName)}
        visible={sheetOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  pad: {
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  person: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  personBody: {
    flex: 1,
    gap: spacing[4],
  },
  heading: {
    paddingBottom: spacing[4],
    paddingTop: spacing[8],
  },
  addRow: {
    alignItems: "flex-start",
    paddingTop: spacing[12],
  },
  removeRow: {
    alignItems: "flex-start",
    paddingTop: spacing[32],
  },
  error: {
    paddingTop: spacing[12],
  },
  outcomeActions: {
    gap: spacing[8],
    paddingTop: spacing[16],
  },
});
