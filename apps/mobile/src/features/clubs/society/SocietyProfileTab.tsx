/**
 * Tab Profilo del Master Profile Società (REV-PROF-17 §"TAB 1 — PROFILO").
 *
 * Qui vive la struttura sportiva del club e nient'altro: descrizione, sede,
 * contatti e colori sociali stanno nella tab Info, le posizioni nella loro, i
 * contenuti in Media. Due sezioni sole, semanticamente distinte — le squadre
 * interne sono sottoentità del club, le affiliate sono altre Società.
 */
import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Button, EmptyState } from "../../../ui";
import { ProfileSectionError } from "../../profiles/master/ProfileSectionBlock";
import {
  TEAMS_PREVIEW_LIMIT,
  formatTeamsCount,
  hasPublicAffiliates,
} from "./society-profile-model";
import { SocietyListRow } from "./SocietyRows";
import type {
  SocietyAffiliate,
  SocietyTeamSummary,
  SocietyViewer,
} from "./society-profile-types";

type SocietyProfileTabProps = {
  affiliates: readonly SocietyAffiliate[];
  onOpenAffiliate: (clubId: string) => void;
  /**
   * Porta alla Dashboard dall'empty state delle squadre. Opzionale: senza
   * handler l'empty state resta solo descrittivo, come per il Visitor.
   */
  onOpenDashboard?: () => void;
  onOpenTeam: (teamId: string) => void;
  onRetry?: () => void;
  onSeeAllTeams: () => void;
  teams: readonly SocietyTeamSummary[];
  teamsError?: boolean;
  viewer: SocietyViewer;
};

export function SocietyProfileTab({
  affiliates,
  onOpenAffiliate,
  onOpenDashboard,
  onOpenTeam,
  onRetry,
  onSeeAllTeams,
  teams,
  teamsError = false,
  viewer,
}: SocietyProfileTabProps) {
  const previewTeams = teams.slice(0, TEAMS_PREVIEW_LIMIT);
  const hasMoreTeams = teams.length > previewTeams.length;

  return (
    <View style={styles.container} testID="society-profile-tab">
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitles}>
            <AppText accessibilityRole="header" variant="titleMd">
              Squadre del club
            </AppText>
            {/*
              Il conteggio esclude le affiliate per costruzione: arrivano da
              un'altra lista e non passano mai di qui.
            */}
            {teams.length > 0 ? (
              <AppText color="muted" testID="society-teams-count" variant="meta">
                {formatTeamsCount(teams.length)}
              </AppText>
            ) : null}
          </View>
          {hasMoreTeams ? (
            <Button
              label="Vedi tutte"
              onPress={onSeeAllTeams}
              size="sm"
              testID="society-teams-see-all"
              variant="ghost"
            />
          ) : null}
        </View>

        {teamsError ? (
          <ProfileSectionError
            message="Non è stato possibile caricare le squadre. Riprova."
            onRetry={onRetry}
            testID="society-teams-error"
          />
        ) : previewTeams.length > 0 ? (
          <View>
            {previewTeams.map((team, index) => (
              <SocietyListRow
                isLast={index === previewTeams.length - 1}
                key={team.id}
                logoUrl={team.logoUrl}
                onPress={() => onOpenTeam(team.id)}
                subtitle={buildTeamSubtitle(team)}
                testID={`society-team-row-${team.id}`}
                title={team.name}
              />
            ))}
          </View>
        ) : (
          <EmptyState
            /*
              "Gestiscile dalla Dashboard" era solo testo: diceva dove
              andare senza portarci. Per chi può gestire il club diventa
              un'azione vera.
            */
            action={
              viewer.canManage && onOpenDashboard ? (
                <Button
                  label="Vai alla Dashboard"
                  onPress={onOpenDashboard}
                  size="sm"
                  variant="outline"
                />
              ) : undefined
            }
            description={
              viewer.canManage
                ? "Le squadre che pubblichi compaiono qui."
                : "Il club non ha ancora pubblicato le proprie squadre."
            }
            icon="shield-outline"
            title="Nessuna squadra disponibile"
          />
        )}
      </View>

      {/*
        Nessuna affiliata pubblica: la sezione non compare. Una card vuota
        suggerirebbe che manchi qualcosa, mentre semplicemente non esiste.
      */}
      {hasPublicAffiliates(affiliates) ? (
        <View style={styles.section} testID="society-affiliates-section">
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitles}>
              <AppText accessibilityRole="header" variant="titleMd">
                Società affiliate
              </AppText>
            </View>
          </View>
          <View>
            {affiliates.map((affiliate, index) => (
              <SocietyListRow
                isLast={index === affiliates.length - 1}
                key={affiliate.id}
                logoUrl={affiliate.logoUrl}
                onPress={() => onOpenAffiliate(affiliate.id)}
                subtitle={buildAffiliateSubtitle(affiliate)}
                testID={`society-affiliate-row-${affiliate.id}`}
                title={affiliate.name}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/**
 * Sottotitolo della riga squadra: categoria o competizione. Niente numero di
 * giocatori, di staff o di posizioni, e niente "attiva" — una squadra
 * pubblicata è attiva per definizione.
 */
function buildTeamSubtitle(team: SocietyTeamSummary): string | null {
  return team.competitionName?.trim() || team.category?.trim() || null;
}

function buildAffiliateSubtitle(affiliate: SocietyAffiliate): string | null {
  return (
    affiliate.relationshipLabel?.trim() ||
    affiliate.category?.trim() ||
    affiliate.city?.trim() ||
    null
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[8],
  },
  section: {
    backgroundColor: colors.surface,
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
  sectionTitles: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
});
