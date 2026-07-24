import { ScrollView, StyleSheet, View } from "react-native";

import { spacing } from "../../../theme/tokens";
import type { ClubAffiliationSummary } from "../../clubs/club-service";
import type { ClubTeam } from "../../clubs/team-service";
import type { ClubGroupedResults as ClubGroupedResultsData } from "../use-club-grouped-results";
import type { ClubSearchRow } from "../search-types";
import { ClubResultRow, type ClubRowData } from "./ClubResultRow";
import { SearchSectionHeader } from "./SearchSectionHeader";

const OTHERS_LIMIT = 5;
const TEAMS_PREVIEW_LIMIT = 3;
const AFFILIATES_PREVIEW_LIMIT = 3;

function fromSearchRow(row: ClubSearchRow): ClubRowData {
  return {
    id: row.entity_id,
    kind: row.kind,
    name: row.name,
    logo_url: row.logo_url,
    category: row.category,
    city: row.city,
    region: row.region,
    parent_club_name: row.parent_club_name,
    is_affiliate: row.is_affiliate,
    has_senior: row.has_senior,
    has_youth: row.has_youth,
  };
}

function fromTeam(team: ClubTeam, parentClubName: string): ClubRowData {
  return {
    id: team.id,
    kind: "team",
    name: team.name,
    logo_url: team.logo_url,
    category: team.category,
    city: team.city,
    region: team.region,
    parent_club_name: parentClubName,
    is_affiliate: false,
  };
}

function fromAffiliation(
  affiliation: ClubAffiliationSummary,
  parentClubName: string | null,
): ClubRowData {
  return {
    id: affiliation.id,
    kind: "club",
    name: affiliation.name,
    logo_url: affiliation.logo_url,
    category: affiliation.category,
    city: affiliation.city,
    region: affiliation.region,
    parent_club_name: parentClubName,
    is_affiliate: true,
  };
}

type ClubGroupedResultsProps = {
  data: ClubGroupedResultsData;
  savedClubIds: Set<string>;
  savedTeamIds: Set<string>;
  followedClubIds: Set<string>;
  onToggleSaveClub: (id: string) => void;
  onToggleSaveTeam: (id: string) => void;
  onToggleFollow: (id: string) => void;
  onOpenClub: (id: string) => void;
  onOpenTeam: (id: string) => void;
};

export function ClubGroupedResults({
  data,
  savedClubIds,
  savedTeamIds,
  followedClubIds,
  onToggleSaveClub,
  onToggleSaveTeam,
  onToggleFollow,
  onOpenClub,
  onOpenTeam,
}: ClubGroupedResultsProps) {
  if (data.mode === "empty") {
    return null;
  }

  const primaryData: ClubRowData = {
    ...fromSearchRow(data.primary),
    parent_club_name:
      data.mode === "club" && data.parent
        ? data.parent.name
        : data.primary.parent_club_name,
  };
  const primaryVariant =
    data.primary.is_affiliate
      ? "affiliate"
      : data.primary.kind === "team"
        ? "team"
        : "principal";

  function otherRowVariant(row: ClubSearchRow) {
    if (row.is_affiliate) return "affiliate" as const;
    if (row.kind === "team") return "team" as const;
    return "principal" as const;
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <SearchSectionHeader title="Risultato principale" />
      <ClubResultRow
        data={primaryData}
        follow={
          primaryVariant !== "team"
            ? {
                following: followedClubIds.has(primaryData.id),
                onToggle: () => onToggleFollow(primaryData.id),
              }
            : null
        }
        onPress={() =>
          primaryVariant === "team" ? onOpenTeam(primaryData.id) : onOpenClub(primaryData.id)
        }
        save={{
          saved:
            primaryVariant === "team"
              ? savedTeamIds.has(primaryData.id)
              : savedClubIds.has(primaryData.id),
          onToggle: () =>
            primaryVariant === "team"
              ? onToggleSaveTeam(primaryData.id)
              : onToggleSaveClub(primaryData.id),
        }}
        variant={primaryVariant}
      />

      {data.mode === "club" && data.parent ? (
        <View style={styles.section}>
          <SearchSectionHeader title="Società collegata" />
          <ClubResultRow
            data={{
              id: data.parent.id,
              kind: "club",
              name: data.parent.name,
              logo_url: null,
              category: null,
              city: null,
              region: null,
              parent_club_name: null,
              is_affiliate: false,
            }}
            onPress={() => onOpenClub(data.parent!.id)}
            variant="link"
          />
        </View>
      ) : null}

      {data.mode === "club" ? (
        <>
          {data.teams.length > 0 ? (
            <View style={styles.section}>
              <SearchSectionHeader
                actionLabel={
                  data.teams.length > TEAMS_PREVIEW_LIMIT ? "Vedi tutte le squadre" : undefined
                }
                onActionPress={
                  data.teams.length > TEAMS_PREVIEW_LIMIT
                    ? () => onOpenClub(data.primary.entity_id)
                    : undefined
                }
                title="Squadre del club"
              />
              {data.teams.slice(0, TEAMS_PREVIEW_LIMIT).map((team) => (
                <ClubResultRow
                  data={fromTeam(team, data.primary.name)}
                  indented
                  key={team.id}
                  onPress={() => onOpenTeam(team.id)}
                  save={{
                    saved: savedTeamIds.has(team.id),
                    onToggle: () => onToggleSaveTeam(team.id),
                  }}
                  variant="team"
                />
              ))}
            </View>
          ) : null}

          {data.affiliates.length > 0 ? (
            <View style={styles.section}>
              <SearchSectionHeader
                actionLabel={
                  data.affiliates.length > AFFILIATES_PREVIEW_LIMIT
                    ? "Vedi tutte le affiliate"
                    : undefined
                }
                onActionPress={
                  data.affiliates.length > AFFILIATES_PREVIEW_LIMIT
                    ? () => onOpenClub(data.primary.entity_id)
                    : undefined
                }
                title="Società affiliate"
              />
              {data.affiliates.slice(0, AFFILIATES_PREVIEW_LIMIT).map((affiliation) => (
                <ClubResultRow
                  data={fromAffiliation(affiliation, data.primary.name)}
                  follow={{
                    following: followedClubIds.has(affiliation.id),
                    onToggle: () => onToggleFollow(affiliation.id),
                  }}
                  key={affiliation.id}
                  onPress={() => onOpenClub(affiliation.id)}
                  save={{
                    saved: savedClubIds.has(affiliation.id),
                    onToggle: () => onToggleSaveClub(affiliation.id),
                  }}
                  variant="affiliate"
                />
              ))}
            </View>
          ) : null}

          {data.linkedSiblings.length > 0 ? (
            <View style={styles.section}>
              <SearchSectionHeader title="Altre società collegate" />
              {data.linkedSiblings.map((sibling) => (
                <ClubResultRow
                  data={fromAffiliation(sibling, data.parent?.name ?? null)}
                  follow={{
                    following: followedClubIds.has(sibling.id),
                    onToggle: () => onToggleFollow(sibling.id),
                  }}
                  key={sibling.id}
                  onPress={() => onOpenClub(sibling.id)}
                  save={{
                    saved: savedClubIds.has(sibling.id),
                    onToggle: () => onToggleSaveClub(sibling.id),
                  }}
                  variant="affiliate"
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {data.mode === "team" ? (
        <>
          {data.primary.parent_club_id && data.primary.parent_club_name ? (
            <View style={styles.section}>
              <SearchSectionHeader title="Fa parte di" />
              <ClubResultRow
                data={{
                  id: data.primary.parent_club_id,
                  kind: "club",
                  name: data.primary.parent_club_name,
                  logo_url: null,
                  category: null,
                  city: null,
                  region: null,
                  parent_club_name: null,
                  is_affiliate: false,
                }}
                onPress={() => onOpenClub(data.primary.parent_club_id as string)}
                variant="link"
              />
            </View>
          ) : null}

          {data.relatedTeams.length > 0 ? (
            <View style={styles.section}>
              <SearchSectionHeader title="Altre squadre pertinenti" />
              {data.relatedTeams.map((row) => (
                <ClubResultRow
                  data={fromSearchRow(row)}
                  key={row.entity_id}
                  onPress={() => onOpenTeam(row.entity_id)}
                  save={{
                    saved: savedTeamIds.has(row.entity_id),
                    onToggle: () => onToggleSaveTeam(row.entity_id),
                  }}
                  variant="team"
                />
              ))}
            </View>
          ) : null}
        </>
      ) : null}

      {data.others.length > 0 ? (
        <View style={styles.section}>
          <SearchSectionHeader title="Altri risultati" />
          {data.others.slice(0, OTHERS_LIMIT).map((row) => {
            const variant = otherRowVariant(row);
            return (
              <ClubResultRow
                data={fromSearchRow(row)}
                follow={
                  variant !== "team"
                    ? {
                        following: followedClubIds.has(row.entity_id),
                        onToggle: () => onToggleFollow(row.entity_id),
                      }
                    : null
                }
                key={`${row.kind}-${row.entity_id}`}
                onPress={() =>
                  variant === "team" ? onOpenTeam(row.entity_id) : onOpenClub(row.entity_id)
                }
                save={{
                  saved:
                    variant === "team"
                      ? savedTeamIds.has(row.entity_id)
                      : savedClubIds.has(row.entity_id),
                  onToggle: () =>
                    variant === "team"
                      ? onToggleSaveTeam(row.entity_id)
                      : onToggleSaveClub(row.entity_id),
                }}
                variant={variant}
              />
            );
          })}
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing[24],
  },
  scroll: {
    flex: 1,
  },
  section: {
    marginTop: spacing[16],
  },
});
