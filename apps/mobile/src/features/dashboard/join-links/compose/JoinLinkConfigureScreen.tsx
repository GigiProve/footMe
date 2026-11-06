/**
 * Screen 02 del composer — Crea link di invito (§11, §12, §15, §16).
 *
 * Squadra a scelta singola obbligatoria (mai multi-select, mai un'affiliata,
 * mai una finta "Intera società"). Con un'unica squadra disponibile viene
 * preselezionata senza forzare una scelta (§11). L'audience è un elenco di
 * checkbox: select-all più le quattro categorie nell'ordine canonico, senza
 * chip né una seconda riga di riepilogo sotto (§12). Scadenza e limite sono
 * facoltativi e default a `null` — il 40 del mockup è un dato di fixture, non
 * un default di prodotto (§15).
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import {
  AppText,
  BottomSheet,
  Button,
  Checkbox,
  Radio,
} from "../../../../ui";
import { colors, spacing } from "../../../../theme/tokens";
import {
  DashboardGlobalEmpty,
  DashboardGlobalError,
  DashboardSkeleton,
} from "../../components/DashboardStates";
import { SocietyContextHeader } from "../../components/SocietyContextHeader";
import { useSession } from "../../../auth/use-session";
import { useDashboardIdentity } from "../../identity/use-dashboard-identity";
import { STALE_MS } from "../../cache/freshness-policy";
import {
  FIELD_ERRORS,
  JOIN_LINKS_COPY,
  JOIN_PROFILE_TYPES,
  audienceLabel,
  expiryLabel,
  limitLabel,
  selectAllState,
  toggleAllTeam,
  toggleProfileType,
} from "../join-links-presentation";
import { JoinLinkExpirySheet } from "../components/JoinLinkExpirySheet";
import { JoinLinkFieldRow } from "../components/JoinLinkFieldRow";
import { JoinLinkLimitSheet } from "../components/JoinLinkLimitSheet";
import { JOIN_LINKS_QK } from "../join-links-keys";
import { JOIN_LINKS_HREFS } from "../join-links-routes";
import { trackJoinLinksEvent } from "../join-links-analytics";
import { fetchJoinLinkTeams, fetchJoinLinksCenter } from "../join-links-service";
import { useComposeExitGuard } from "./use-compose-exit-guard";
import { useJoinLinkCompose } from "./JoinLinkComposeProvider";

export function JoinLinkConfigureScreen() {
  const router = useRouter();
  const { profile } = useSession();
  const { current } = useDashboardIdentity();
  const clubId = current?.kind === "society" ? current.id : "";
  const actorId = profile?.id ?? "";

  const { draft, isDirty, setExpiresOn, setMaxRedemptions, setProfileTypes, setTeam } =
    useJoinLinkCompose();
  const handleExit = useComposeExitGuard({ isDirty });

  const centerQuery = useQuery({
    queryKey: JOIN_LINKS_QK.center(actorId, clubId),
    queryFn: () => fetchJoinLinksCenter(clubId),
    staleTime: STALE_MS.operational,
  });

  const teamsQuery = useQuery({
    queryKey: JOIN_LINKS_QK.teams(actorId, clubId),
    queryFn: () => fetchJoinLinkTeams(clubId),
    staleTime: STALE_MS.management,
  });

  const [teamSheetOpen, setTeamSheetOpen] = useState(false);
  const [expirySheetOpen, setExpirySheetOpen] = useState(false);
  const [limitSheetOpen, setLimitSheetOpen] = useState(false);
  const [showCategoriesError, setShowCategoriesError] = useState(false);

  const teams = teamsQuery.data ?? [];

  /*
   * §11: «Se esiste una sola squadra selezionabile, mostrala direttamente
   * senza obbligare a una selezione inutile.» La precompilazione avviene
   * una volta sola e non sovrascrive una scelta già fatta.
   */
  useEffect(() => {
    const available = teamsQuery.data ?? [];
    const only = available.length === 1 ? available[0] : null;

    if (only && !draft.teamId) {
      setTeam({ teamId: only.id, label: only.label });
    }
  }, [teamsQuery.data, draft.teamId, setTeam]);

  function handleBack() {
    router.back();
  }

  function handleContinue() {
    if (draft.profileTypes.length === 0) {
      setShowCategoriesError(true);
      return;
    }

    trackJoinLinksEvent("join_link_categories_configured", {
      categoriesCount: draft.profileTypes.length,
      hasExpiry: draft.expiresOn !== null,
      hasLimit: draft.maxRedemptions !== null,
      hasDirector: draft.profileTypes.includes("director"),
    });

    router.push(
      (draft.profileTypes.includes("director")
        ? JOIN_LINKS_HREFS.composeRoles
        : JOIN_LINKS_HREFS.composeReview) as Parameters<typeof router.push>[0],
    );
  }

  if (centerQuery.isLoading) {
    return <DashboardSkeleton />;
  }

  if (centerQuery.isError || !centerQuery.data) {
    return <DashboardGlobalError onRetry={() => centerQuery.refetch()} />;
  }

  const center = centerQuery.data;
  const canPickTeam = teams.length > 1;
  const state = selectAllState(draft.profileTypes);

  return (
    <View style={styles.screen}>
      <SocietyContextHeader
        title={JOIN_LINKS_COPY.composeTitle}
        isVerified={center.clubIsVerified}
        logoUrl={center.clubLogoUrl}
        name={center.clubName}
        onBack={handleBack}
        onCancel={handleExit}
      />

      <View style={styles.body}>
        {teams.length === 0 ? (
          <DashboardGlobalEmpty
            copy={{
              actionLabel: "",
              body: JOIN_LINKS_COPY.optionalHint,
              icon: "people-outline",
              title: JOIN_LINKS_COPY.noTeams,
            }}
            onAction={null}
          />
        ) : (
          <JoinLinkFieldRow
            label={JOIN_LINKS_COPY.teamField}
            onPress={canPickTeam ? () => setTeamSheetOpen(true) : undefined}
            testID="join-link-team-row"
            value={draft.teamLabel ?? "Scegli una squadra"}
          />
        )}

        <AppText variant="headingSm" color="neutral" style={styles.sectionTitle}>
          {JOIN_LINKS_COPY.audienceQuestion}
        </AppText>

        <Checkbox
          checked={state === "checked"}
          indeterminate={state === "indeterminate"}
          label={JOIN_LINKS_COPY.allTeam}
          onValueChange={() => setProfileTypes(toggleAllTeam(draft.profileTypes))}
          testID="join-link-all-team"
        />

        {JOIN_PROFILE_TYPES.map((type) => (
          <Checkbox
            key={type}
            checked={draft.profileTypes.includes(type)}
            label={audienceLabel(type)}
            onValueChange={() => {
              setShowCategoriesError(false);
              setProfileTypes(toggleProfileType(draft.profileTypes, type));
            }}
            testID={`join-link-category-${type}`}
          />
        ))}

        {showCategoriesError ? (
          <AppText variant="caption" color="danger" style={styles.errorText}>
            {FIELD_ERRORS.categories}
          </AppText>
        ) : null}

        <JoinLinkFieldRow
          label={JOIN_LINKS_COPY.expiryField}
          onPress={() => setExpirySheetOpen(true)}
          testID="join-link-expiry-row"
          value={expiryLabel(draft.expiresOn)}
        />

        <JoinLinkFieldRow
          label={JOIN_LINKS_COPY.limitField}
          onPress={() => setLimitSheetOpen(true)}
          testID="join-link-limit-row"
          value={limitLabel(draft.maxRedemptions)}
        />

        <AppText variant="caption" color="neutralMuted" style={styles.hint}>
          {JOIN_LINKS_COPY.optionalHint}
        </AppText>
      </View>

      <View style={styles.footer}>
        <Button
          label={JOIN_LINKS_COPY.continueCta}
          onPress={handleContinue}
          variant="primary"
          fullWidth
          disabled={teams.length === 0 || !draft.teamId}
          testID="join-link-continue"
        />
      </View>

      <BottomSheet
        visible={teamSheetOpen}
        title={JOIN_LINKS_COPY.teamField}
        onClose={() => setTeamSheetOpen(false)}
      >
        <View style={styles.sheetContent}>
          {teams.map((team) => (
            <Radio
              key={team.id}
              checked={draft.teamId === team.id}
              label={team.label}
              tone="neutral"
              onPress={() => {
                setTeam({ teamId: team.id, label: team.label });
                setTeamSheetOpen(false);
              }}
              testID={`join-link-team-${team.id}`}
            />
          ))}
        </View>
      </BottomSheet>

      <JoinLinkExpirySheet
        visible={expirySheetOpen}
        value={draft.expiresOn}
        onClose={() => setExpirySheetOpen(false)}
        onSave={setExpiresOn}
      />

      <JoinLinkLimitSheet
        completedUses={0}
        visible={limitSheetOpen}
        value={draft.maxRedemptions}
        onClose={() => setLimitSheetOpen(false)}
        onSave={setMaxRedemptions}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: spacing[12],
    padding: spacing[4],
  },
  errorText: {
    marginTop: -spacing[8],
  },
  footer: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing[4],
  },
  hint: {
    marginTop: spacing[4],
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.dividerNeutral,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing[12],
  },
  screen: {
    backgroundColor: colors.surface,
    flex: 1,
  },
  sectionTitle: {
    marginTop: spacing[8],
  },
  sheetContent: {
    gap: spacing[12],
    paddingBottom: spacing[4],
  },
});
