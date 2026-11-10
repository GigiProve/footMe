/**
 * Step 2 — Aggiungi persone (DAS-REV-32 §18, §19; PNG 10, 11, 15).
 *
 * Elenco paginato di PERSON eleggibili: la ricerca e lo scope li decide il
 * server, qui si selezionano solo ID. Con una squadra prima le sue persone,
 * poi «Altre persone della Società»; «Seleziona tutti» sta solo
 * nell'intestazione della sezione squadra e solo con ricerca vuota (§19).
 * Il creator non compare né conta (§18). Nessun chip delle selezioni: il
 * contatore sta nel footer.
 */
import { ActivityIndicator, Pressable, SectionList, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../../theme/tokens";
import { AppText, Avatar, SearchField } from "../../../../../ui";
import { GROUPS_COPY } from "../../groups-copy";
import { peopleSections, type PeopleSection } from "../../groups-presentation";
import type { EligiblePerson } from "../../groups-types";
import { GroupNotice } from "./GroupComposeChrome";

type Section = PeopleSection & { data: EligiblePerson[] };

type Props = {
  banner: string | null;
  bulkError: string | null;
  bulkPending: boolean;
  fetchingNext: boolean;
  hasError: boolean;
  loading: boolean;
  onEndReached: () => void;
  onRetry: () => void;
  onSearchChange: (value: string) => void;
  onSelectAll: () => void;
  onToggle: (id: string) => void;
  people: readonly EligiblePerson[];
  query: string;
  search: string;
  selected: readonly string[];
  showSelectAll: boolean;
  teamName: string | null;
};

export function GroupPeopleStep({
  banner,
  bulkError,
  bulkPending,
  fetchingNext,
  hasError,
  loading,
  onEndReached,
  onRetry,
  onSearchChange,
  onSelectAll,
  onToggle,
  people,
  query,
  search,
  selected,
  showSelectAll,
  teamName,
}: Props) {
  const sections: Section[] = peopleSections(people, teamName).map((section) => ({
    ...section,
    data: section.people,
  }));

  const header = (
    <View style={styles.listHeader}>
      {banner ? <GroupNotice testID="group-people-banner" text={banner} /> : null}
      <SearchField
        onChangeText={onSearchChange}
        onClear={() => onSearchChange("")}
        placeholder={GROUPS_COPY.searchPeople}
        testID="group-people-search"
        value={search}
      />
      <AppText color="neutralMuted" variant="meta">
        {GROUPS_COPY.creatorHelp}
      </AppText>
      {bulkError ? <GroupNotice testID="group-people-bulk-error" text={bulkError} /> : null}
    </View>
  );

  const empty = loading ? (
    <AppText color="neutralMuted" style={styles.state} variant="bodySm">
      {GROUPS_COPY.loading}
    </AppText>
  ) : hasError ? (
    <View style={styles.state}>
      <AppText color="neutralMuted" variant="bodySm">
        {GROUPS_COPY.peopleLoadError}
      </AppText>
      <Pressable accessibilityRole="button" onPress={onRetry} style={styles.retry} testID="group-people-retry">
        <AppText color="accent" variant="actionLabel">
          {GROUPS_COPY.retry}
        </AppText>
      </Pressable>
    </View>
  ) : query.trim().length > 0 ? (
    <AppText color="neutralMuted" style={styles.state} variant="bodySm">
      {GROUPS_COPY.peopleSearchEmpty}
    </AppText>
  ) : (
    <View style={styles.state}>
      <AppText color="neutral" variant="titleSm">
        {GROUPS_COPY.peopleEmptyTitle}
      </AppText>
      <AppText color="neutralMuted" variant="bodySm">
        {GROUPS_COPY.peopleEmptyBody}
      </AppText>
    </View>
  );

  return (
    <SectionList<EligiblePerson, Section>
      ItemSeparatorComponent={Separator}
      ListEmptyComponent={empty}
      ListFooterComponent={fetchingNext ? <ActivityIndicator color={colors.textNeutralMuted} style={styles.footer} /> : null}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      keyExtractor={(person) => person.profileId}
      keyboardShouldPersistTaps="handled"
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      renderItem={({ item }) => (
        <PersonRow checked={selected.includes(item.profileId)} onToggle={onToggle} person={item} />
      )}
      renderSectionHeader={({ section }) =>
        section.title ? (
          <View style={styles.sectionHeader}>
            <AppText accessibilityRole="header" color="neutralMuted" numberOfLines={1} style={styles.sectionTitle} variant="eyebrow">
              {section.title}
            </AppText>
            {section.key === "team" && showSelectAll ? (
              <Pressable
                accessibilityLabel={GROUPS_COPY.selectAllA11y(section.title)}
                accessibilityRole="button"
                accessibilityState={{ busy: bulkPending, disabled: bulkPending }}
                disabled={bulkPending}
                hitSlop={8}
                onPress={onSelectAll}
                style={styles.selectAll}
                testID="group-select-all"
              >
                <AppText color="accent" variant="actionLabel">
                  {bulkPending ? GROUPS_COPY.selectingAll : GROUPS_COPY.selectAll}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null
      }
      sections={sections}
      stickySectionHeadersEnabled={false}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

type RowProps = {
  checked: boolean;
  onToggle: (id: string) => void;
  person: EligiblePerson;
};

/** L'intera riga seleziona (§18): mai apre il profilo al posto della selezione. */
function PersonRow({ checked, onToggle, person }: RowProps) {
  return (
    <Pressable
      accessibilityLabel={person.roleLabel ? `${person.fullName}, ${person.roleLabel}` : person.fullName}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={() => onToggle(person.profileId)}
      style={({ pressed }) => [styles.row, pressed ? styles.pressed : null]}
      testID={`group-person-${person.profileId}`}
    >
      <Avatar name={person.fullName} size="md" uri={person.avatarUrl ?? undefined} />
      <View style={styles.rowText}>
        <AppText color="neutral" numberOfLines={1} variant="titleSm">
          {person.fullName}
        </AppText>
        {person.roleLabel ? (
          <AppText color="neutralMuted" numberOfLines={1} variant="meta">
            {person.roleLabel}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.box, checked ? styles.boxChecked : null]}>
        {checked ? <Ionicons color={colors.inkInvert} name="checkmark" size={14} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    backgroundColor: colors.inputBackground,
    borderColor: colors.border,
    borderRadius: radius[4],
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  boxChecked: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  content: {
    paddingBottom: spacing[24],
    paddingHorizontal: spacing[20],
  },
  footer: {
    paddingVertical: spacing[16],
  },
  listHeader: {
    gap: spacing[10],
    paddingBottom: spacing[8],
    paddingTop: spacing[4],
  },
  pressed: {
    opacity: 0.7,
  },
  retry: {
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 44,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 56,
    paddingVertical: spacing[6],
  },
  rowText: {
    flex: 1,
  },
  sectionHeader: {
    alignItems: "center",
    backgroundColor: colors.surface,
    flexDirection: "row",
    gap: spacing[12],
    justifyContent: "space-between",
    minHeight: 44,
    paddingTop: spacing[8],
  },
  sectionTitle: {
    flex: 1,
  },
  selectAll: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  separator: {
    backgroundColor: colors.divider,
    height: StyleSheet.hairlineWidth,
  },
  state: {
    gap: spacing[8],
    paddingVertical: spacing[24],
  },
});
