import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, ListItem } from "../../../ui";
import {
  FILTER_MODAL_TITLES,
  FILTER_SECTIONS,
  type FilterSectionId,
} from "../profile-filters/profile-filter-configs";
import {
  buildFilterPayload,
  resetRole,
  resetSection,
  sectionSummary,
} from "../profile-filters/profile-filter-helpers";
import type { ProfileFiltersState } from "../profile-filters/profile-filter-types";
import { searchProfilesPage } from "../search-service";
import type { SearchProfileRole } from "../search-types";
import * as AgentEditors from "./filter-editors/agent-editors";
import * as CoachEditors from "./filter-editors/coach-editors";
import * as PlayerEditors from "./filter-editors/player-editors";
import { CategoryEditor, ZoneEditor } from "./filter-editors/shared-editors";
import * as StaffEditors from "./filter-editors/staff-editors";

type ModalView = { kind: "sections" } | { kind: "editor"; sectionId: FilterSectionId };

export type ProfileFiltersModalProps = {
  initialFilters: ProfileFiltersState;
  initialSectionId?: FilterSectionId | null;
  onApply: (next: ProfileFiltersState) => void;
  onClose: () => void;
  query: string | null;
  role: SearchProfileRole;
  visible: boolean;
};

function renderEditor(
  role: SearchProfileRole,
  sectionId: FilterSectionId,
  draft: ProfileFiltersState,
  onChange: (next: ProfileFiltersState) => void,
): ReactNode {
  if (role === "player") {
    switch (sectionId) {
      case "role":
        return <PlayerEditors.RoleEditor onChange={onChange} state={draft} />;
      case "age":
        return <PlayerEditors.AgeEditor onChange={onChange} state={draft} />;
      case "situation":
        return <PlayerEditors.SituationEditor onChange={onChange} state={draft} />;
      case "category":
        return <CategoryEditor onChange={onChange} role="player" state={draft} />;
      case "zone":
        return <ZoneEditor onChange={onChange} role="player" state={draft} />;
      case "traits":
        return <PlayerEditors.TraitsEditor onChange={onChange} state={draft} />;
      default:
        return null;
    }
  }

  if (role === "coach") {
    switch (sectionId) {
      case "role":
        return <CoachEditors.RoleEditor onChange={onChange} state={draft} />;
      case "license":
        return <CoachEditors.LicenseEditor onChange={onChange} state={draft} />;
      case "experience":
        return <CoachEditors.ExperienceEditor onChange={onChange} state={draft} />;
      case "category":
        return <CategoryEditor onChange={onChange} role="coach" state={draft} />;
      case "zone":
        return <ZoneEditor onChange={onChange} role="coach" state={draft} />;
      case "background":
        return <CoachEditors.BackgroundEditor onChange={onChange} state={draft} />;
      default:
        return null;
    }
  }

  if (role === "staff") {
    switch (sectionId) {
      case "role":
        return <StaffEditors.RoleEditor onChange={onChange} state={draft} />;
      case "certifications":
        return <StaffEditors.CertificationsEditor onChange={onChange} state={draft} />;
      case "scope":
        return <StaffEditors.ScopeEditor onChange={onChange} state={draft} />;
      case "category":
        return <CategoryEditor onChange={onChange} role="staff" state={draft} />;
      case "zone":
        return <ZoneEditor onChange={onChange} role="staff" state={draft} />;
      default:
        return null;
    }
  }

  switch (sectionId) {
    case "operating_area":
      return <AgentEditors.AreaEditor onChange={onChange} state={draft} />;
    case "category":
      return <AgentEditors.CategoriesEditor onChange={onChange} state={draft} />;
    case "assisted":
      return <AgentEditors.AssistedEditor onChange={onChange} state={draft} />;
    case "experience":
      return <AgentEditors.ExperienceEditor onChange={onChange} state={draft} />;
    case "agent_license":
      return <AgentEditors.LicenseEditor onChange={onChange} state={draft} />;
    case "availability":
      return <AgentEditors.AvailabilityEditor onChange={onChange} state={draft} />;
    default:
      return null;
  }
}

export function ProfileFiltersModal({
  initialFilters,
  initialSectionId = null,
  onApply,
  onClose,
  query,
  role,
  visible,
}: ProfileFiltersModalProps) {
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

  const payload = buildFilterPayload(role, draft);

  // Sort never changes the total, so it stays out of the key and the call:
  // one cached count per (query, role, filters) regardless of ordering.
  const countQuery = useQuery({
    queryKey: ["search-profiles-count", query, role, payload],
    queryFn: () =>
      searchProfilesPage({ filters: payload, page: 0, pageSize: 1, query, role }).then(
        (page) => page.totalCount,
      ),
    enabled: visible,
    placeholderData: keepPreviousData,
  });

  const isPlayerRoleEditor =
    role === "player" && view.kind === "editor" && view.sectionId === "role";

  function handleBack() {
    if (view.kind === "editor") {
      setView({ kind: "sections" });
      return;
    }
    onClose();
  }

  function handleReset() {
    if (view.kind === "editor") {
      setDraft(resetSection(role, view.sectionId, draft));
      return;
    }
    setDraft(resetRole(role, draft));
  }

  function handleFooterPress() {
    if (isPlayerRoleEditor) {
      setView({ kind: "sections" });
      return;
    }
    onApply(draft);
    onClose();
  }

  const headerTitle =
    view.kind === "editor"
      ? (FILTER_SECTIONS[role].find((section) => section.id === view.sectionId)?.title ?? "")
      : FILTER_MODAL_TITLES[role];

  const footerLabel = isPlayerRoleEditor
    ? "Salva selezione"
    : countQuery.data != null
      ? `Mostra ${countQuery.data} risultati`
      : "Mostra risultati";

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
            ? FILTER_SECTIONS[role].map((section) => (
                <ListItem
                  key={section.id}
                  onPress={() => setView({ kind: "editor", sectionId: section.id })}
                  right={<Ionicons color={colors.textMuted} name="chevron-forward" size={18} />}
                  subtitle={sectionSummary(role, section.id, draft)}
                  title={section.title}
                />
              ))
            : renderEditor(role, view.sectionId, draft, setDraft)}
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
