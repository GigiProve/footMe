import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { AvailabilityProvincesSelector } from "../../../components/ui/availability-provinces-selector";
import { AvailabilityRegionsSelector } from "../../../components/ui/availability-regions-selector";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, ListItem, Radio, Toggle } from "../../../ui";
import { CLUB_CATEGORY_OPTIONS } from "../club-filters/club-filter-configs";
import {
  MEDIA_FILTER_MODAL_TITLE,
  MEDIA_FILTER_SECTIONS,
  MEDIA_FORMAT_OPTIONS,
  MEDIA_PUBLISHED_OPTIONS,
  MEDIA_RELATION_OPTIONS,
  MEDIA_RESULT_KIND_OPTIONS,
  MEDIA_SOURCE_OPTIONS,
  type MediaFilterSectionId,
} from "./media-filter-configs";
import {
  buildMediaFilterPayload,
  mediaSectionSummary,
  resetMediaFilters,
  resetMediaSection,
} from "./media-filter-helpers";
import type { MediaFiltersState } from "./media-filter-types";
import {
  searchMediaContentPage,
  searchMediaSourcesPage,
} from "./media-search-service";

/**
 * Pagina "Filtri media e contenuti" (CER-05 §18): righe accordion chiuse che
 * aprono un editor per sezione, CTA sticky con il conteggio live e
 * "Reimposta" contestuale alla vista corrente.
 *
 * Struttura e comportamento sono quelli di `ClubFiltersModal`, così i tre
 * verticali di Cerca si comportano allo stesso modo.
 */

type ModalView = { kind: "sections" } | { kind: "editor"; sectionId: MediaFilterSectionId };

export type MediaFiltersModalProps = {
  initialFilters: MediaFiltersState;
  initialSectionId?: MediaFilterSectionId | null;
  onApply: (next: MediaFiltersState) => void;
  onClose: () => void;
  query: string | null;
  visible: boolean;
};

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
}

function renderEditor(
  sectionId: MediaFilterSectionId,
  draft: MediaFiltersState,
  onChange: (next: MediaFiltersState) => void,
): ReactNode {
  switch (sectionId) {
    case "risultato":
      return (
        <View style={styles.editorGroup}>
          {MEDIA_RESULT_KIND_OPTIONS.map((option) => (
            <Radio
              checked={draft.resultKind === option.value}
              key={option.value}
              label={option.label}
              onPress={() => onChange({ ...draft, resultKind: option.value })}
            />
          ))}
        </View>
      );
    case "tipo":
      return (
        <View style={styles.editorGroup}>
          <AppText color="muted" variant="caption">
            Nessuna selezione equivale a tutti i tipi di contenuto.
          </AppText>
          <View style={styles.chipRow}>
            {MEDIA_FORMAT_OPTIONS.map((option) => (
              <Button
                key={option.value}
                label={option.label}
                onPress={() =>
                  onChange({ ...draft, formats: toggleValue(draft.formats, option.value) })
                }
                selected={draft.formats.includes(option.value)}
                size="sm"
                variant="chipAction"
              />
            ))}
          </View>
        </View>
      );
    case "fonte":
      return (
        <View style={styles.editorGroup}>
          <AppText color="muted" variant="caption">
            Nessuna selezione equivale a tutte le fonti.
          </AppText>
          <View style={styles.chipRow}>
            {MEDIA_SOURCE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                label={option.label}
                onPress={() =>
                  onChange({ ...draft, sources: toggleValue(draft.sources, option.value) })
                }
                selected={draft.sources.includes(option.value)}
                size="sm"
                variant="chipAction"
              />
            ))}
          </View>
          <Toggle
            label="Solo fonti che segui"
            onValueChange={(value) =>
              onChange({ ...draft, relation: { ...draft.relation, followedSources: value } })
            }
            value={draft.relation.followedSources}
          />
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
                onChange({
                  ...draft,
                  categories: toggleValue(draft.categories, option.value),
                })
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
          <AppText color="muted" variant="caption">
            La zona indica il territorio trattato dal contenuto, non la tua posizione.
          </AppText>
          <AvailabilityRegionsSelector
            label="Regioni trattate"
            onChange={(value) => onChange({ ...draft, regions: value })}
            placeholder="Cerca una regione"
            value={draft.regions}
          />
          <AvailabilityProvincesSelector
            label="Province trattate"
            onChange={(value) => onChange({ ...draft, provinces: value })}
            placeholder="Cerca una provincia"
            value={draft.provinces}
          />
        </View>
      );
    case "data":
      return (
        <View style={styles.editorGroup}>
          {MEDIA_PUBLISHED_OPTIONS.map((option) => (
            <Radio
              checked={draft.publishedWithin === option.value}
              key={option.value}
              label={option.label}
              onPress={() => onChange({ ...draft, publishedWithin: option.value })}
            />
          ))}
        </View>
      );
    case "relazione":
      return (
        <View style={styles.editorGroup}>
          {MEDIA_RELATION_OPTIONS.map((option) => (
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

export function MediaFiltersModal({
  initialFilters,
  initialSectionId = null,
  onApply,
  onClose,
  query,
  visible,
}: MediaFiltersModalProps) {
  const [draft, setDraft] = useState(initialFilters);
  const [view, setView] = useState<ModalView>(
    initialSectionId ? { kind: "editor", sectionId: initialSectionId } : { kind: "sections" },
  );

  useEffect(() => {
    if (visible) {
      setDraft(initialFilters);
      setView(
        initialSectionId
          ? { kind: "editor", sectionId: initialSectionId }
          : { kind: "sections" },
      );
    }
  }, [visible, initialFilters, initialSectionId]);

  const payload = buildMediaFilterPayload(draft);

  // Il conteggio somma contenuti e fonti secondo il tipo di risultato scelto.
  // Sort e paginazione non cambiano il totale, quindi restano fuori dalla key.
  const countQuery = useQuery({
    enabled: visible,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const wantsContents = draft.resultKind !== "sources";
      const wantsSources = draft.resultKind !== "contents";

      const [contents, sources] = await Promise.all([
        wantsContents
          ? searchMediaContentPage({ filters: payload, page: 0, pageSize: 1, query })
          : Promise.resolve({ rows: [], totalCount: 0 }),
        wantsSources
          ? searchMediaSourcesPage({ filters: payload, page: 0, pageSize: 1, query })
          : Promise.resolve({ rows: [], totalCount: 0 }),
      ]);

      return contents.totalCount + sources.totalCount;
    },
    queryKey: ["search-media-count", query, draft.resultKind, payload],
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
      setDraft(resetMediaSection(view.sectionId, draft));
      return;
    }
    setDraft(resetMediaFilters());
  }

  function handleFooterPress() {
    onApply(draft);
    onClose();
  }

  const headerTitle =
    view.kind === "editor"
      ? (MEDIA_FILTER_SECTIONS.find((section) => section.id === view.sectionId)?.title ?? "")
      : MEDIA_FILTER_MODAL_TITLE;

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

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          {view.kind === "sections"
            ? MEDIA_FILTER_SECTIONS.map((section) => (
                <ListItem
                  key={section.id}
                  onPress={() => setView({ kind: "editor", sectionId: section.id })}
                  right={<Ionicons color={colors.textMuted} name="chevron-forward" size={18} />}
                  subtitle={mediaSectionSummary(section.id, draft)}
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
