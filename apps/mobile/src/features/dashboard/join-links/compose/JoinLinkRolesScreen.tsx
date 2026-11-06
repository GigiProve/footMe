/**
 * Screen 03 del composer — Ruoli dirigenziali consentiti (§13, §14).
 *
 * Multi-select sull'intero catalogo dei ruoli `director`: il mockup ne mostra
 * solo una parte, qui va reso tutto il catalogo restituito dal server. Niente
 * selettore di "Ambito": ogni incarico nato da un link è sempre vincolato
 * alla squadra scelta nello step precedente (§13). La selezione, la data di
 * scadenza e il limite tornano intatti se si rientra da qui o si prosegue al
 * Riepilogo.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { AppText, Button, Checkbox, Input } from "../../../../ui";
import { colors, spacing } from "../../../../theme/tokens";
import { DashboardGlobalError, DashboardSkeleton } from "../../components/DashboardStates";
import { SocietyContextHeader } from "../../components/SocietyContextHeader";
import { useSession } from "../../../auth/use-session";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  FIELD_ERRORS,
  JOIN_LINKS_COPY,
  normalizeCustomRole,
} from "../join-links-presentation";
import { JOIN_LINKS_QK } from "../join-links-keys";
import { JOIN_LINKS_HREFS } from "../join-links-routes";
import { trackJoinLinksEvent } from "../join-links-analytics";
import { fetchAssignmentRoles, fetchJoinLinksCenter } from "../join-links-service";
import { useComposeExitGuard } from "./use-compose-exit-guard";
import { useJoinLinkCompose } from "./JoinLinkComposeProvider";

export function JoinLinkRolesScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : "";
  const actorId = profile?.id ?? "";

  const { draft, isDirty, setCustomExecutiveRole, setExecutiveRoleIds } =
    useJoinLinkCompose();
  const handleExit = useComposeExitGuard({ isDirty });

  const centerQuery = useQuery({
    queryKey: JOIN_LINKS_QK.center(actorId, clubId),
    queryFn: () => fetchJoinLinksCenter(clubId),
    staleTime: STALE_MS.operational,
  });

  const rolesQuery = useQuery({
    queryKey: JOIN_LINKS_QK.roles(actorId),
    queryFn: () => fetchAssignmentRoles(),
    staleTime: STALE_MS.presentation,
  });

  const [showRolesError, setShowRolesError] = useState(false);
  const [showCustomError, setShowCustomError] = useState(false);

  function handleBack() {
    router.back();
  }

  const catalog = rolesQuery.data;
  const directorRoles = catalog
    ? catalog.roles.filter((role) => role.profileType === "director")
    : [];
  const customRole = directorRoles.find((role) => role.isCustom);
  const hasCustomSelected = customRole
    ? draft.executiveRoleIds.includes(customRole.id)
    : false;

  function toggleRole(id: string) {
    setShowRolesError(false);
    const next = draft.executiveRoleIds.includes(id)
      ? draft.executiveRoleIds.filter((item) => item !== id)
      : [...draft.executiveRoleIds, id];
    setExecutiveRoleIds(next);
  }

  function handleContinue() {
    if (draft.executiveRoleIds.length === 0) {
      setShowRolesError(true);
      return;
    }

    if (hasCustomSelected && normalizeCustomRole(draft.customExecutiveRole).length === 0) {
      setShowCustomError(true);
      return;
    }

    if (hasCustomSelected) {
      setCustomExecutiveRole(normalizeCustomRole(draft.customExecutiveRole));
    }

    trackJoinLinksEvent("join_link_roles_configured", {
      rolesCount: draft.executiveRoleIds.length,
      hasCustomRole: hasCustomSelected,
    });

    router.push(JOIN_LINKS_HREFS.composeReview as Parameters<typeof router.push>[0]);
  }

  if (centerQuery.isLoading || rolesQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (centerQuery.isError || rolesQuery.isError || !centerQuery.data || !catalog) {
    return (
      <DashboardGlobalError
        onRetry={() => {
          centerQuery.refetch();
          rolesQuery.refetch();
        }}
      />
    );
  }

  const center = centerQuery.data;

  return (
    <View style={styles.screen}>
      <SocietyContextHeader
        title={JOIN_LINKS_COPY.rolesTitle}
        isVerified={center.clubIsVerified}
        logoUrl={center.clubLogoUrl}
        name={center.clubName}
        onBack={handleBack}
        onCancel={handleExit}
      />

      <View style={styles.body}>
        <AppText variant="bodySm" color="neutralMuted">
          {JOIN_LINKS_COPY.rolesHelper(draft.teamLabel ?? "")}
        </AppText>

        {directorRoles.map((role) => (
          <Checkbox
            key={role.id}
            checked={draft.executiveRoleIds.includes(role.id)}
            label={role.label}
            onValueChange={() => toggleRole(role.id)}
            testID={`join-link-role-${role.id}`}
          />
        ))}

        {showRolesError ? (
          <AppText variant="caption" color="danger">
            {FIELD_ERRORS.executiveRoles}
          </AppText>
        ) : null}

        {hasCustomSelected ? (
          <Input
            label={JOIN_LINKS_COPY.customRoleField}
            value={draft.customExecutiveRole}
            onChangeText={(next: string) => {
              setShowCustomError(false);
              setCustomExecutiveRole(next);
            }}
            maxLength={catalog.customRoleMax}
            error={showCustomError}
            helperText={showCustomError ? FIELD_ERRORS.customRole : undefined}
            testID="join-link-custom-role"
          />
        ) : null}
      </View>

      <View style={styles.footer}>
        <Button
          label={JOIN_LINKS_COPY.continueCta}
          onPress={handleContinue}
          variant="primary"
          fullWidth
          testID="join-link-continue"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[12],
    padding: spacing[4],
  },
  footer: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
});
