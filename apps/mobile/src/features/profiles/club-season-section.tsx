import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { SelectField } from "../../components/ui/select-field";
import { colors, spacing } from "../../theme/tokens";
import { AppText, Button, Card, Input } from "../../ui";
import { EditModalShell } from "./edit-modals/EditModalShell";
import { PLAYER_CATEGORY_OPTIONS } from "./player-sports";
import type { SelectOption } from "./profile-form-utils";
import type { ClubSeasonEntryRecord } from "./profile-service";

export type ClubSeasonForm = {
  category: string;
  endYear: string;
  id?: string;
  league: string;
  notes: string;
  startYear: string;
};

function createEmptySeasonForm(): ClubSeasonForm {
  return {
    category: "",
    endYear: "",
    league: "",
    notes: "",
    startYear: "",
  };
}

export function recordToForm(record: ClubSeasonEntryRecord): ClubSeasonForm {
  return {
    category: record.category,
    endYear: record.end_year ? String(record.end_year) : "",
    id: record.id,
    league: record.league ?? "",
    notes: record.notes ?? "",
    startYear: String(record.start_year),
  };
}

export function formToInput(form: ClubSeasonForm, index: number) {
  return {
    category: form.category,
    end_year: form.endYear.trim() ? parseInt(form.endYear, 10) : null,
    ...(form.id ? { id: form.id } : {}),
    league: form.league.trim() || null,
    notes: form.notes.trim() || null,
    sort_order: index,
    start_year: parseInt(form.startYear, 10),
  };
}

type ClubSeasonCardProps = {
  editable?: boolean;
  onDelete?: () => void;
  onEdit?: () => void;
  season: ClubSeasonForm;
};

function ClubSeasonCard({
  editable = false,
  onDelete,
  onEdit,
  season,
}: ClubSeasonCardProps) {
  const yearRange = season.endYear
    ? `${season.startYear} – ${season.endYear}`
    : `${season.startYear} – Attuale`;

  return (
    <Card style={styles.seasonCard} variant="muted">
      <View style={styles.seasonHeader}>
        <View style={styles.seasonInfo}>
          <AppText variant="titleSm">
            {season.category || "Categoria da definire"}
          </AppText>
          <AppText variant="bodySm" color="muted">
            {yearRange}
            {season.league ? ` · ${season.league}` : ""}
          </AppText>
          {season.notes ? (
            <AppText variant="caption" color="muted" style={styles.notesText}>
              {season.notes}
            </AppText>
          ) : null}
        </View>
        {editable ? (
          <View style={styles.seasonActions}>
            <Button
              accessibilityLabel="Modifica stagione"
              label=""
              leftIcon={
                <Ionicons
                  color={colors.textSecondary}
                  name="pencil"
                  size={16}
                />
              }
              onPress={onEdit}
              size="sm"
              variant="icon"
            />
            <Button
              accessibilityLabel="Elimina stagione"
              destructive
              label=""
              leftIcon={
                <Ionicons
                  color={colors.danger}
                  name="trash-outline"
                  size={16}
                />
              }
              onPress={onDelete}
              size="sm"
              variant="icon"
            />
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const currentYear = new Date().getFullYear();

const YEAR_OPTIONS = Array.from({ length: currentYear - 1950 + 1 }, (_, i) => {
  const year = String(currentYear - i);
  return { label: year, value: year };
});

export function getClubSeasonRange(form: ClubSeasonForm): { start: number; end: number } | null {
  const start = Number.parseInt(form.startYear, 10);
  const end = form.endYear.trim()
    ? Number.parseInt(form.endYear, 10)
    : currentYear;

  if (Number.isNaN(start) || Number.isNaN(end)) {
    return null;
  }

  return { start, end };
}

function rangesOverlap(
  left: { start: number; end: number },
  right: { start: number; end: number },
): boolean {
  return left.start <= right.end && right.start <= left.end;
}

function getOtherClubSeasonRanges(
  seasons: ClubSeasonForm[],
  currentSeasonId?: string,
  editingIndex?: number | null,
) {
  return seasons
    .filter((season, index) => {
      if (editingIndex !== null && editingIndex !== undefined && index === editingIndex) {
        return false;
      }

      if (currentSeasonId && season.id === currentSeasonId) {
        return false;
      }

      return true;
    })
    .map(getClubSeasonRange)
    .filter((range): range is { start: number; end: number } => range !== null);
}

export function getClubStartYearOptions(
  endYear: string,
  occupiedRanges: { start: number; end: number }[],
): SelectOption[] {
  const parsedEndYear = endYear.trim() ? Number.parseInt(endYear, 10) : currentYear;

  return YEAR_OPTIONS.map((option) => {
    const startYear = Number.parseInt(option.value, 10);
    if (!Number.isNaN(parsedEndYear) && startYear > parsedEndYear) {
      return { ...option, disabled: true };
    }

    const candidateRange = { start: startYear, end: parsedEndYear };
    return occupiedRanges.some((range) => rangesOverlap(candidateRange, range))
      ? { ...option, disabled: true }
      : option;
  });
}

export function getClubEndYearOptions(
  startYear: string,
  occupiedRanges: { start: number; end: number }[],
): SelectOption[] {
  if (!startYear.trim()) {
    return YEAR_OPTIONS;
  }

  const parsedStartYear = Number.parseInt(startYear, 10);
  if (Number.isNaN(parsedStartYear)) {
    return YEAR_OPTIONS;
  }

  return YEAR_OPTIONS.map((option) => {
    const endYear = Number.parseInt(option.value, 10);
    if (endYear < parsedStartYear) {
      return { ...option, disabled: true };
    }

    const candidateRange = { start: parsedStartYear, end: endYear };
    return occupiedRanges.some((range) => rangesOverlap(candidateRange, range))
      ? { ...option, disabled: true }
      : option;
  });
}

export function sanitizeClubSeasonSelection(
  form: ClubSeasonForm,
  occupiedRanges: { start: number; end: number }[],
): ClubSeasonForm {
  let nextForm = { ...form };

  if (nextForm.startYear.trim() && nextForm.endYear.trim()) {
    const selectedEndYear = getClubEndYearOptions(
      nextForm.startYear,
      occupiedRanges,
    ).find((option) => option.value === nextForm.endYear);

    if (selectedEndYear?.disabled) {
      nextForm = { ...nextForm, endYear: "" };
    }
  }

  if (nextForm.startYear.trim()) {
    const selectedStartYear = getClubStartYearOptions(
      nextForm.endYear,
      occupiedRanges,
    ).find((option) => option.value === nextForm.startYear);

    if (selectedStartYear?.disabled) {
      nextForm = { ...nextForm, startYear: "", endYear: "" };
    }
  }

  return nextForm;
}

type ClubSeasonEditorModalProps = {
  draft: ClubSeasonForm;
  editingIndex: number | null;
  isNew: boolean;
  onClose: () => void;
  onSave: (form: ClubSeasonForm) => void;
  seasons: ClubSeasonForm[];
  visible: boolean;
};

function ClubSeasonEditorModal({
  draft,
  editingIndex,
  isNew,
  onClose,
  onSave,
  seasons,
  visible,
}: ClubSeasonEditorModalProps) {
  const [form, setForm] = useState(draft);
  const occupiedRanges = useMemo(
    () => getOtherClubSeasonRanges(seasons, draft.id, editingIndex),
    [draft.id, editingIndex, seasons],
  );
  const startYearOptions = useMemo(
    () => getClubStartYearOptions(form.endYear, occupiedRanges),
    [form.endYear, occupiedRanges],
  );
  const endYearOptions = useMemo(
    () => getClubEndYearOptions(form.startYear, occupiedRanges),
    [form.startYear, occupiedRanges],
  );

  const isValid = form.category.trim() && form.startYear.trim();

  function handleSave() {
    if (!isValid) {
      return;
    }

    onSave(form);
  }

  return (
    <EditModalShell
      isSaving={false}
      onClose={onClose}
      onSave={handleSave}
      onShow={() => setForm(draft)}
      saveDisabled={!isValid}
      saveLabel={isNew ? "Aggiungi" : "Salva modifiche"}
      title={isNew ? "Aggiungi stagione" : "Modifica stagione"}
      visible={visible}
    >
      <SelectField
        label="Categoria *"
        onChange={(value) => setForm((f) => ({ ...f, category: value }))}
        options={PLAYER_CATEGORY_OPTIONS}
        placeholder="Seleziona categoria"
        value={form.category}
      />
      <SelectField
        label="Anno inizio *"
        onChange={(value) =>
          setForm((f) =>
            sanitizeClubSeasonSelection({ ...f, startYear: value }, occupiedRanges),
          )
        }
        options={startYearOptions}
        placeholder="Seleziona anno"
        searchable
        searchPlaceholder="Cerca anno..."
        value={form.startYear}
      />
      <SelectField
        allowClear
        clearLabel="In corso (attuale)"
        label="Anno fine"
        onChange={(value) =>
          setForm((f) =>
            sanitizeClubSeasonSelection({ ...f, endYear: value }, occupiedRanges),
          )
        }
        options={endYearOptions}
        placeholder="In corso (attuale)"
        searchable
        searchPlaceholder="Cerca anno..."
        value={form.endYear}
      />
      <Input
        label="Girone"
        onChangeText={(value) => setForm((f) => ({ ...f, league: value }))}
        placeholder="Es. Girone A"
        value={form.league}
      />
      <Input
        label="Note"
        multiline
        onChangeText={(value) => setForm((f) => ({ ...f, notes: value }))}
        placeholder="Es. Promozione, Campione regionale..."
        value={form.notes}
      />
    </EditModalShell>
  );
}

type ClubSeasonsSectionProps = {
  editable?: boolean;
  onChange?: (seasons: ClubSeasonForm[]) => void;
  seasons: ClubSeasonForm[];
};

export function ClubSeasonsSection({
  editable = false,
  onChange,
  seasons,
}: ClubSeasonsSectionProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const draft =
    editingIndex !== null ? seasons[editingIndex] : createEmptySeasonForm();
  const isNew = editingIndex === null;

  function handleAdd() {
    setEditingIndex(null);
    setModalVisible(true);
  }

  function handleEdit(index: number) {
    setEditingIndex(index);
    setModalVisible(true);
  }

  function handleDelete(index: number) {
    onChange?.(seasons.filter((_, i) => i !== index));
  }

  function handleSave(form: ClubSeasonForm) {
    if (isNew) {
      onChange?.([...seasons, form]);
    } else {
      onChange?.(seasons.map((s, i) => (i === editingIndex ? form : s)));
    }

    setModalVisible(false);
    setEditingIndex(null);
  }

  return (
    <View style={styles.sectionContainer}>
      {seasons.length === 0 ? (
        <AppText variant="bodySm" color="muted">
          {editable
            ? "Aggiungi una stagione per completare lo storico del club."
            : "Nessuna stagione registrata."}
        </AppText>
      ) : (
        seasons.map((season, index) => (
          <ClubSeasonCard
            editable={editable}
            key={season.id ?? `season-${index}`}
            onDelete={() => handleDelete(index)}
            onEdit={() => handleEdit(index)}
            season={season}
          />
        ))
      )}
      {editable ? (
        <Button
          label="Aggiungi stagione"
          onPress={handleAdd}
          size="sm"
          variant="secondary"
        />
      ) : null}
      {editable ? (
        <ClubSeasonEditorModal
          draft={draft}
          editingIndex={editingIndex}
          isNew={isNew}
          onClose={() => {
            setModalVisible(false);
            setEditingIndex(null);
          }}
          onSave={handleSave}
          seasons={seasons}
          visible={modalVisible}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notesText: {
    marginTop: spacing[4],
  },
  seasonActions: {
    flexDirection: "row",
    gap: spacing[8],
  },
  seasonCard: {
    gap: spacing[8],
  },
  seasonHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  seasonInfo: {
    flex: 1,
    gap: spacing[4],
  },
  sectionContainer: {
    gap: spacing[12],
  },
});
