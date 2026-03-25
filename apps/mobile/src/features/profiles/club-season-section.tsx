import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareScrollView } from "../../components/ui/keyboard-aware-scroll-view";
import { SelectField } from "../../components/ui/select-field";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText, Button, Card, Input, ModalHeader } from "../../ui";
import { EditModalShell } from "./edit-modals/EditModalShell";
import { PLAYER_CATEGORY_OPTIONS } from "./player-sports";
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
              leftIcon={<Ionicons color={colors.textSecondary} name="pencil" size={16} />}
              onPress={onEdit}
              size="sm"
              variant="icon"
            />
            <Button
              accessibilityLabel="Elimina stagione"
              destructive
              label=""
              leftIcon={<Ionicons color={colors.danger} name="trash-outline" size={16} />}
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

type ClubSeasonEditorModalProps = {
  draft: ClubSeasonForm;
  isNew: boolean;
  onClose: () => void;
  onSave: (form: ClubSeasonForm) => void;
  visible: boolean;
};

function ClubSeasonEditorModal({
  draft,
  isNew,
  onClose,
  onSave,
  visible,
}: ClubSeasonEditorModalProps) {
  const [form, setForm] = useState(draft);

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
        onChange={(value) => setForm((f) => ({ ...f, startYear: value }))}
        options={YEAR_OPTIONS}
        placeholder="Seleziona anno"
        value={form.startYear}
      />
      <SelectField
        allowClear
        clearLabel="In corso (attuale)"
        label="Anno fine"
        onChange={(value) => setForm((f) => ({ ...f, endYear: value }))}
        options={YEAR_OPTIONS}
        placeholder="In corso (attuale)"
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
          isNew={isNew}
          onClose={() => {
            setModalVisible(false);
            setEditingIndex(null);
          }}
          onSave={handleSave}
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
