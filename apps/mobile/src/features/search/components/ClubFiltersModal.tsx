import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { PROVINCE_OPTIONS, REGION_OPTIONS } from "../../profiles/profile-form-utils";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, ListItem, Radio, Toggle } from "../../../ui";
import { SelectField } from "../../../components/ui/select-field";
import {
  CLUB_CATEGORY_OPTIONS,
  CLUB_FILTER_MODAL_TITLE,
  CLUB_FILTER_SECTIONS,
  CLUB_OPPORTUNITY_OPTIONS,
  CLUB_RELATION_OPTIONS,
  CLUB_STRUCTURE_OPTIONS,
  CLUB_TIPOLOGIA_OPTIONS,
  type ClubFilterSectionId,
} from "../club-filters/club-filter-configs";
import {
  buildClubFilterPayload,
  clubSectionSummary,
  resetClubFilters,
  resetClubSection,
  tipologiaToKind,
} from "../club-filters/club-filter-helpers";
import type { ClubFiltersState } from "../club-filters/club-filter-types";
import { searchClubsPage } from "../search-service";

type ModalView = { kind: "sections" } | { kind: "editor"; sectionId: ClubFilterSectionId };

export type ClubFiltersModalProps = {
  initialFilters: ClubFiltersState;
  initialSectionId?: ClubFilterSectionId | null;
  onApply: (next: ClubFiltersState) => void;
  onClose: () => void;
  query: string | null;
  visible: boolean;
};

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function renderEditor(
  sectionId: ClubFilterSectionId,
  draft: ClubFiltersState,
  onChange: (next: ClubFiltersState) => void,
): ReactNode {
  switch (sectionId) {
    case "tipologia":
      return (
        <View style={styles.editorGroup}>
          {CLUB_TIPOLOGIA_OPTIONS.map((option) => (
            <Radio
              checked={draft.tipologia === option.value}
              key={option.value}
              label={option.label}
              onPress={() => onChange({ ...draft, tipologia: option.value })}
            />
          ))}
        </View>
      );
    case "categoria":
      return (
        <View style={styles.chipRow}>
          {CLUB_CATEGORY_OPTIONS.map((option) => (
            <Button
              key={option.value}
              label={option.label}
              onPress={() =>
                onChange({ ...draft, categories: toggleValue(draft.categories, option.value) })
              }
              selected={draft.categories.includes(option.value)}
              size="sm"
              variant="chipAction"
            />
          ))}
        </View>
      );
    case "zona":
      return (
        <View style={styles.editorGroup}>
          <SelectField
            allowClear
            label="Regione"
            onChange={(value) => onChange({ ...draft, region: value || null })}
            options={REGION_OPTIONS}
            placeholder="Seleziona regione"
            searchable
            value={draft.region ?? ""}
          />
          <SelectField
            allowClear
            label="Città / provincia"
            onChange={(value) => onChange({ ...draft, city: value || null })}
            options={PROVINCE_OPTIONS}
            placeholder="Seleziona città"
            searchable
            value={draft.city ?? ""}
          />
        </View>
      );
    case "struttura":
      return (
        <View style={styles.editorGroup}>
          {CLUB_STRUCTURE_OPTIONS.map((option) => (
            <Toggle
              key={option.value}
              label={option.label}
              onValueChange={(value) =>
                onChange({ ...draft, structure: { ...draft.structure, [option.value]: value } })
              }
              value={draft.structure[option.value]}
            />
          ))}
        </View>
      );
    case "opportunita":
      return (
        <View style={styles.editorGroup}>
          {CLUB_OPPORTUNITY_OPTIONS.map((option) => (
            <Toggle
              key={option.value}
              label={option.label}
              onValueChange={(value) =>
                onChange({
                  ...draft,
                  opportunities: { ...draft.opportunities, [option.value]: value },
                })
              }
              value={draft.opportunities[option.value]}
            />
          ))}
        </View>
      );
    case "relazione":
      return (
        <View style={styles.editorGroup}>
          {CLUB_RELATION_OPTIONS.map((option) => (
            <Toggle
              key={option.value}
              label={option.label}
              onValueChange={(value) =>
                onChange({ ...draft, relation: { ...draft.relation, [option.value]: value } })
              }
              value={draft.relation[option.value]}
            />
          ))}
        </View>
      );
    default:
      return null;
  }
}

export function ClubFiltersModal({
  initialFilters,
  initialSectionId = null,
  onApply,
  onClose,
  query,
  visible,
}: ClubFiltersModalProps) {
  const [draft, setDraft] = useState(initialFilters);
  const [view, setView] = useState<ModalView>(
    initialSectionId ? { kind: "editor", sectionId: initialSectionId } : { kind: "sections" },
  );

  useEffect(() => {
    if (visible) {
      setDraft(initialFilters);
      setView(
        initialSectionId ? { kind: "editor", sectionId: initialSectionId } : { kind: "sections" },
      );
    }
  }, [visible, initialFilters, initialSectionId]);

  const kind = tipologiaToKind(draft.tipologia);
  const payload = buildClubFilterPayload(draft);

  const countQuery = useQuery({
    queryKey: ["search-clubs-count", query, kind, payload],
    queryFn: () =>
      searchClubsPage({ query, kind, filters: payload, sort: "relevance", page: 0, pageSize: 1 }).then(
        (page) => page.totalCount,
      ),
    enabled: visible,
    placeholderData: keepPreviousData,
  });

  function handleBack() {
    if (view.kind === "editor") {
      setView({ kind: "sections" });
      return;
    }
    onClose();
  }

  function handleReset() {
    if (view.kind === "editor") {
      setDraft(resetClubSection(view.sectionId, draft));
      return;
    }
    setDraft(resetClubFilters());
  }

  function handleFooterPress() {
    onApply(draft);
    onClose();
  }

  const headerTitle =
    view.kind === "editor"
      ? (CLUB_FILTER_SECTIONS.find((section) => section.id === view.sectionId)?.title ?? "")
      : CLUB_FILTER_MODAL_TITLE;

  const footerLabel =
    countQuery.data != null ? `Mostra ${countQuery.data} risultati` : "Mostra risultati";

  return (
    <Modal animationType="slide" onRequestClose={handleBack} visible={visible}>
      <SafeAreaView style={styles.root}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={handleBack}
            style={styles.backButton}
          >
            <Ionicons color={colors.textPrimary} name="arrow-back" size={22} />
          </Pressable>
          <AppText numberOfLines={1} style={styles.headerTitle} variant="headingSm">
            {headerTitle}
          </AppText>
          <Button label="Reimposta" onPress={handleReset} size="sm" variant="link" />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {view.kind === "sections"
            ? CLUB_FILTER_SECTIONS.map((section) => (
                <ListItem
                  key={section.id}
                  onPress={() => setView({ kind: "editor", sectionId: section.id })}
                  right={<Ionicons color={colors.textMuted} name="chevron-forward" size={18} />}
                  subtitle={clubSectionSummary(section.id, draft)}
                  title={section.title}
                />
              ))
            : renderEditor(view.sectionId, draft, setDraft)}
        </ScrollView>

        <View style={styles.footer}>
          <Button fullWidth label={footerLabel} onPress={handleFooterPress} variant="primary" />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.full,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  body: {
    gap: spacing[4],
    padding: spacing[20],
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  editorGroup: {
    gap: spacing[16],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingHorizontal: spacing[20],
    paddingVertical: spacing[12],
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
});
