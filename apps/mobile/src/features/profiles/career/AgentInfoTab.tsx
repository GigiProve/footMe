import { useMemo, useState } from "react";
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";

import {
  buildAgentCategoryDistribution,
  buildAgentManagedPlayerFilterOptions,
  filterAgentManagedPlayers,
  formatAgentManagedPlayerLine,
  getAgentManagedPlayerStatusLabel,
  type AgentManagedPlayersFilters,
} from "../agent-profile";
import {
  getSocialDisplayValue,
  normalizeContactEmail,
  normalizeFacebookInput,
  normalizeInstagramInput,
} from "../profile-form-utils";
import type { CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";
import { getPlayerPositionLabel } from "../player-sports";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Avatar } from "../../../ui";

type AgentInfoTabProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: (section: EditSection) => void;
};

type FilterKey = keyof AgentManagedPlayersFilters;

type FilterChip = {
  key: FilterKey;
  label: string;
};

type FilterMenuOption = {
  label: string;
  value: string;
};

type PublicContactRow = {
  iconName: keyof typeof Ionicons.glyphMap;
  key: string;
  linkUrl: string;
  value: string;
};

const EMPTY_FILTERS: AgentManagedPlayersFilters = {
  age: null,
  category: null,
  role: null,
  status: null,
};

const FILTER_LABELS: Record<FilterKey, string> = {
  age: "Età",
  category: "Categoria",
  role: "Ruolo",
  status: "Stato",
};

const FILTER_ORDER: FilterKey[] = ["category", "role", "age", "status"];

export function AgentInfoTab({
  completeProfile,
  isOwner,
  onEdit,
}: AgentInfoTabProps) {
  const router = useRouter();
  const agentProfile = completeProfile.agentProfile;
  const entries = completeProfile.agentManagedPlayerEntries;
  const [filters, setFilters] = useState<AgentManagedPlayersFilters>(EMPTY_FILTERS);
  const [openMenu, setOpenMenu] = useState<FilterKey | null>(null);

  const categoryDistribution = useMemo(
    () => buildAgentCategoryDistribution(entries),
    [entries],
  );
  const filterOptions = useMemo(
    () => buildAgentManagedPlayerFilterOptions(entries),
    [entries],
  );
  const filteredEntries = useMemo(
    () => filterAgentManagedPlayers(entries, filters),
    [entries, filters],
  );
  const positioningTitle = useMemo(
    () => buildPositioningTitle(agentProfile?.operational_focuses ?? [], categoryDistribution),
    [agentProfile?.operational_focuses, categoryDistribution],
  );
  const positioningSubtitle = useMemo(
    () =>
      buildPositioningSubtitle({
        categories: categoryDistribution.map((item) => item.label),
        macroAreas: agentProfile?.operating_macro_areas ?? [],
      }),
    [agentProfile?.operating_macro_areas, categoryDistribution],
  );
  const activeFilters = useMemo(
    () => buildFilterChips(filters),
    [filters],
  );
  const publicContacts = useMemo(
    () => buildPublicContactRows(completeProfile),
    [completeProfile],
  );
  const networkRows = useMemo(
    () => buildNetworkRows(completeProfile),
    [completeProfile],
  );

  const filterMenus: Record<FilterKey, FilterMenuOption[]> = useMemo(
    () => ({
      age: filterOptions.ages.map((value) => ({ label: value, value })),
      category: filterOptions.categories.map((value) => ({ label: value, value })),
      role: filterOptions.roles.map((value) => ({
        label: getPlayerPositionLabel(value),
        value,
      })),
      status: filterOptions.statuses.map((value) => ({
        label: getAgentManagedPlayerStatusLabel(value),
        value,
      })),
    }),
    [filterOptions],
  );

  function handleFilterToggle(key: FilterKey) {
    setOpenMenu((current) => (current === key ? null : key));
  }

  function handleFilterSelect(key: FilterKey, value: string) {
    setFilters((current) => ({
      ...current,
      [key]: current[key] === value ? null : value,
    }));
    setOpenMenu(null);
  }

  function handleFilterClear(key: FilterKey) {
    setFilters((current) => ({ ...current, [key]: null }));
  }

  function handlePlayerPress(profileId: string | null) {
    if (!profileId) {
      return;
    }

    router.push(`/profile/${profileId}` as never);
  }

  return (
    <View style={styles.container}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.positioningCopy}>
            <AppText variant="headingLg">{positioningTitle}</AppText>
            <AppText color="secondary" variant="bodySm">
              {positioningSubtitle}
            </AppText>
          </View>
          {isOwner ? (
            <Pressable
              accessibilityLabel="Modifica posizionamento agente"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onEdit("agentProfile")}
              style={styles.editButton}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <AppText style={styles.sectionTitle} variant="headingSm">
          {`Giocatori rappresentati (${entries.length})`}
        </AppText>
        {categoryDistribution.length > 0 ? (
          <View style={styles.distributionGrid}>
            {categoryDistribution.map((item) => (
              <View key={item.label} style={styles.distributionItem}>
                <AppText color="secondary" variant="bodySm">
                  {item.label}
                </AppText>
                <AppText style={styles.distributionCount} variant="bodySm">
                  {`(${item.count})`}
                </AppText>
              </View>
            ))}
          </View>
        ) : (
          <AppText color="secondary" variant="bodySm">
            Portfolio in definizione.
          </AppText>
        )}
      </View>

      <View style={styles.section}>
        <AppText color="secondary" style={styles.filterLabel} variant="caption">
          Filtra giocatori
        </AppText>
        <ScrollView
          contentContainerStyle={styles.filterControls}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {FILTER_ORDER.map((key) => {
            const isActive = openMenu === key || Boolean(filters[key]);

            return (
              <Pressable
                accessibilityLabel={`Apri filtro ${FILTER_LABELS[key]}`}
                accessibilityRole="button"
                key={key}
                onPress={() => handleFilterToggle(key)}
                style={[
                  styles.filterTrigger,
                  isActive ? styles.filterTriggerActive : null,
                ]}
              >
                <AppText variant="bodySm">{FILTER_LABELS[key]}</AppText>
                <Ionicons
                  color={colors.textPrimary}
                  name={openMenu === key ? "chevron-up" : "chevron-down"}
                  size={16}
                />
              </Pressable>
            );
          })}
        </ScrollView>

        {openMenu ? (
          <View style={styles.dropdownMenu}>
            {filterMenus[openMenu].map((option) => {
              const isSelected = filters[openMenu] === option.value;

              return (
                <Pressable
                  accessibilityLabel={`Seleziona ${FILTER_LABELS[openMenu]} ${option.label}`}
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => handleFilterSelect(openMenu, option.value)}
                  style={[
                    styles.dropdownItem,
                    isSelected ? styles.dropdownItemSelected : null,
                  ]}
                >
                  <AppText
                    style={isSelected ? styles.dropdownItemTextSelected : null}
                    variant="bodySm"
                  >
                    {option.label}
                  </AppText>
                  {isSelected ? (
                    <Ionicons color={colors.accent} name="checkmark" size={16} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {activeFilters.length > 0 ? (
          <View style={styles.activeFiltersRow}>
            {activeFilters.map((chip) => (
              <Pressable
                accessibilityLabel={`Rimuovi filtro ${chip.label}`}
                accessibilityRole="button"
                key={chip.key}
                onPress={() => handleFilterClear(chip.key)}
                style={styles.activeChip}
              >
                <AppText color="inverse" variant="caption">
                  {chip.label}
                </AppText>
                <Ionicons color={colors.inkInvert} name="close" size={14} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.playersList}>
        {filteredEntries.length > 0 ? (
          filteredEntries.map((entry, index) => {
            const isLinked = Boolean(entry.linked_profile_id);

            return (
              <Pressable
                accessibilityLabel={
                  isLinked
                    ? `Apri profilo di ${entry.display_name}`
                    : `${entry.display_name}, profilo non collegato`
                }
                accessibilityRole={isLinked ? "button" : undefined}
                key={entry.id}
                onPress={isLinked ? () => handlePlayerPress(entry.linked_profile_id) : undefined}
                style={({ pressed }) => [
                  styles.playerRow,
                  index === filteredEntries.length - 1 ? styles.playerRowLast : null,
                  pressed && isLinked ? styles.playerRowPressed : null,
                  !isLinked ? styles.playerRowUnlinked : null,
                ]}
              >
                <Avatar name={entry.display_name} size="md" uri={entry.avatar_url} />
                <View style={styles.playerInfo}>
                  <AppText variant="titleSm">{entry.display_name}</AppText>
                  <AppText
                    color={entry.is_free_agent ? "danger" : "secondary"}
                    numberOfLines={1}
                    variant="bodySm"
                  >
                    {formatAgentManagedPlayerLine(entry)}
                  </AppText>
                </View>
                {isLinked ? (
                  <Ionicons color={colors.textSecondary} name="chevron-forward" size={18} />
                ) : null}
              </Pressable>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <AppText color="secondary" variant="bodySm">
              Nessun giocatore corrisponde ai filtri selezionati.
            </AppText>
          </View>
        )}
      </View>

      {networkRows.length > 0 || publicContacts.length > 0 ? (
        <View style={styles.footerSection}>
          {networkRows.length > 0 ? (
            <View style={styles.footerBlock}>
              <AppText color="secondary" variant="caption">
                Network e operatività
              </AppText>
              <View style={styles.footerRows}>
                {networkRows.map((row) => (
                  <View key={row.label} style={styles.footerRow}>
                    <AppText color="secondary" variant="caption">
                      {row.label}
                    </AppText>
                    <AppText variant="bodySm">
                      {row.value}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {publicContacts.length > 0 ? (
            <View style={styles.footerBlock}>
              <View style={styles.footerHeaderRow}>
                <AppText color="secondary" variant="caption">
                  Contatti
                </AppText>
                {isOwner ? (
                  <Pressable
                    accessibilityLabel="Modifica contatti agente"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => onEdit("contact")}
                    style={styles.editTextButton}
                  >
                    <Ionicons color={colors.textSecondary} name="pencil" size={14} />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.contactList}>
                {publicContacts.map((item) => (
                  <Pressable
                    accessibilityRole="button"
                    key={item.key}
                    onPress={() => void Linking.openURL(item.linkUrl)}
                    style={({ pressed }) => [
                      styles.contactRow,
                      pressed ? styles.playerRowPressed : null,
                    ]}
                  >
                    <View style={styles.contactIcon}>
                      <Ionicons color={colors.accent} name={item.iconName} size={16} />
                    </View>
                    <AppText style={styles.contactValue} variant="bodySm">
                      {item.value}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function buildPositioningTitle(
  focuses: string[],
  distribution: { count: number; label: string }[],
) {
  const primaryFocus = focuses.find((item) => item.trim().length > 0)?.trim();

  if (primaryFocus) {
    return primaryFocus;
  }

  const topCategory = distribution.find((item) => item.label !== "Svincolati")?.label;

  if (topCategory) {
    return `Focus ${topCategory}`;
  }

  return "Portfolio in definizione";
}

function buildPositioningSubtitle(input: {
  categories: string[];
  macroAreas: string[];
}) {
  const categories = input.categories.filter((item) => item !== "Svincolati").slice(0, 2);

  if (categories.length > 0) {
    return `Focus ${categories.join(" – ")}`;
  }

  if (input.macroAreas.length > 0) {
    return input.macroAreas.join(" • ");
  }

  return "Ricerca rapida dei profili rappresentati.";
}

function buildFilterChips(filters: AgentManagedPlayersFilters): FilterChip[] {
  const chips: FilterChip[] = [];

  if (filters.category) {
    chips.push({ key: "category", label: filters.category });
  }

  if (filters.role) {
    chips.push({ key: "role", label: getPlayerPositionLabel(filters.role) });
  }

  if (filters.age) {
    chips.push({ key: "age", label: filters.age });
  }

  if (filters.status) {
    chips.push({
      key: "status",
      label: getAgentManagedPlayerStatusLabel(filters.status),
    });
  }

  return chips;
}

function buildPublicContactRows(
  completeProfile: CompleteProfessionalProfile,
): PublicContactRow[] {
  const contacts = completeProfile.userContacts;
  const instagramUrl = normalizeInstagramInput(contacts.instagram);
  const facebookUrl = normalizeFacebookInput(contacts.facebook);
  const emailValue = normalizeContactEmail(contacts.email);

  return [
    contacts.showInstagram && instagramUrl
      ? {
          iconName: "logo-instagram" as const,
          key: "instagram",
          linkUrl: instagramUrl,
          value: getSocialDisplayValue("instagram", instagramUrl),
        }
      : null,
    contacts.showFacebook && facebookUrl
      ? {
          iconName: "logo-facebook" as const,
          key: "facebook",
          linkUrl: facebookUrl,
          value: getSocialDisplayValue("facebook", facebookUrl),
        }
      : null,
    contacts.showEmail && emailValue
      ? {
          iconName: "mail-outline" as const,
          key: "email",
          linkUrl: `mailto:${emailValue}`,
          value: emailValue,
        }
      : null,
  ].filter(Boolean) as PublicContactRow[];
}

function buildNetworkRows(completeProfile: CompleteProfessionalProfile) {
  const agentProfile = completeProfile.agentProfile;
  const rows: { label: string; value: string }[] = [];

  if ((agentProfile?.operational_focuses ?? []).length > 0) {
    rows.push({
      label: "Focus",
      value: agentProfile!.operational_focuses.join(" • "),
    });
  }

  if ((agentProfile?.operating_macro_areas ?? []).length > 0) {
    rows.push({
      label: "Macro aree",
      value: agentProfile!.operating_macro_areas.join(" • "),
    });
  }

  if ((agentProfile?.operating_regions ?? []).length > 0) {
    rows.push({
      label: "Regioni",
      value: agentProfile!.operating_regions.join(", "),
    });
  }

  return rows;
}

const styles = StyleSheet.create({
  activeChip: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  activeFiltersRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginTop: spacing[12],
  },
  contactIcon: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  contactList: {
    gap: spacing[10],
  },
  contactRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  contactValue: {
    flex: 1,
  },
  container: {
    gap: spacing[32],
    paddingBottom: spacing[32],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[24],
  },
  distributionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: spacing[14],
    rowGap: spacing[12],
    columnGap: spacing[12],
  },
  distributionCount: {
    fontWeight: "700",
  },
  distributionItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
    width: "47%",
  },
  dropdownItem: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[14],
  },
  dropdownItemSelected: {
    backgroundColor: colors.accentSoft,
  },
  dropdownItemTextSelected: {
    fontWeight: "700",
  },
  dropdownMenu: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    marginTop: spacing[12],
    overflow: "hidden",
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 32,
    justifyContent: "center",
    marginTop: spacing[4],
    width: 32,
  },
  editTextButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  emptyState: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    padding: spacing[16],
  },
  filterControls: {
    gap: spacing[8],
    paddingTop: spacing[12],
  },
  filterLabel: {},
  filterTrigger: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  filterTriggerActive: {
    backgroundColor: colors.accentSoft,
  },
  footerBlock: {
    gap: spacing[12],
  },
  footerHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerRow: {
    flexDirection: "column",
    gap: spacing[4],
  },
  sectionTitle: {
    fontWeight: "800",
  },
  footerRows: {
    gap: spacing[8],
  },
  footerSection: {
    gap: spacing[24],
  },
  playerInfo: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  playerRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[14],
  },
  playerRowLast: {
    borderBottomWidth: 0,
  },
  playerRowPressed: {
    opacity: 0.82,
  },
  playerRowUnlinked: {
    opacity: 0.68,
  },
  playersList: {
    marginTop: -spacing[8],
  },
  positioningCopy: {
    flex: 1,
    gap: spacing[8],
  },
  section: {
    gap: spacing[4],
  },
  sectionHeader: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
  },
});
