import { useState } from "react";
import { Modal, Pressable, SafeAreaView, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { KeyboardAwareScrollView } from "../../components/ui/keyboard-aware-scroll-view";
import { SelectField } from "../../components/ui/select-field";
import { colors, radius, spacing, typography } from "../../theme/tokens";
import { Button, Card, Input } from "../../ui";
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

function ClubSeasonCard({ editable = false, onDelete, onEdit, season }: ClubSeasonCardProps) {
  const yearRange = season.endYear
    ? `${season.startYear} – ${season.endYear}`
    : `${season.startYear} – Attuale`;

  return (
    <Card style={{ gap: spacing[8] }} variant="muted">
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flex: 1, gap: spacing[4] }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: typography.fontSize[16],
              fontWeight: typography.fontWeight.heavy,
            }}
          >
            {season.category || "Categoria da definire"}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: typography.fontSize[14] }}>
            {yearRange}
            {season.league ? ` · ${season.league}` : ""}
          </Text>
          {season.notes ? (
            <Text style={{ color: colors.textMuted, fontSize: typography.fontSize[12], marginTop: spacing[4] }}>
              {season.notes}
            </Text>
          ) : null}
        </View>
        {editable ? (
          <View style={{ flexDirection: "row", gap: spacing[8] }}>
            <Pressable
              accessibilityLabel="Modifica stagione"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onEdit}
              style={iconButtonStyle}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
            <Pressable
              accessibilityLabel="Elimina stagione"
              accessibilityRole="button"
              hitSlop={8}
              onPress={onDelete}
              style={iconButtonStyle}
            >
              <Ionicons color={colors.danger} name="trash-outline" size={16} />
            </Pressable>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const iconButtonStyle = {
  width: 32,
  height: 32,
  borderRadius: radius.full,
  backgroundColor: colors.surface,
  alignItems: "center" as const,
  justifyContent: "center" as const,
};

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

function ClubSeasonEditorModal({ draft, isNew, onClose, onSave, visible }: ClubSeasonEditorModalProps) {
  const [form, setForm] = useState(draft);

  const isValid = form.category.trim() && form.startYear.trim();

  function handleSave() {
    if (!isValid) {
      return;
    }

    onSave(form);
  }

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => setForm(draft)}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView style={{ backgroundColor: colors.background, flex: 1 }}>
        <View style={modalHeaderStyle}>
          <Pressable onPress={onClose}>
            <Ionicons color={colors.textPrimary} name="close" size={24} />
          </Pressable>
          <Text style={modalTitleStyle}>
            {isNew ? "Aggiungi stagione" : "Modifica stagione"}
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <KeyboardAwareScrollView contentContainerStyle={{ gap: spacing[16], padding: spacing[20] }}>
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
            label="Campionato"
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
          <Button
            disabled={!isValid}
            label={isNew ? "Aggiungi" : "Salva modifiche"}
            onPress={handleSave}
            variant="primary"
          />
        </KeyboardAwareScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const modalHeaderStyle = {
  alignItems: "center" as const,
  borderBottomColor: colors.border,
  borderBottomWidth: 1,
  flexDirection: "row" as const,
  justifyContent: "space-between" as const,
  paddingHorizontal: spacing[20],
  paddingVertical: spacing[16],
};

const modalTitleStyle = {
  color: colors.textPrimary,
  fontSize: typography.fontSize[18],
  fontWeight: typography.fontWeight.heavy,
};

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

  const draft = editingIndex !== null ? seasons[editingIndex] : createEmptySeasonForm();
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
    <View style={{ gap: spacing[12] }}>
      {seasons.length === 0 ? (
        <Text style={{ color: colors.textMuted, fontSize: typography.fontSize[14] }}>
          {editable
            ? "Aggiungi una stagione per completare lo storico del club."
            : "Nessuna stagione registrata."}
        </Text>
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
