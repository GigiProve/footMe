import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { SelectField } from "../../../components/ui/select-field";
import { spacing } from "../../../theme/tokens";
import { AppText, Button, Input } from "../../../ui";
import type { SimplePlayerCareerEntry } from "./coach-career-types";
import {
  PLAYER_POSITION_OPTIONS,
  generateCoachEntryId,
  getPlayerSeasonOptions,
} from "./coach-career-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type SimplePlayerCareerFormProps = {
  entry: SimplePlayerCareerEntry;
  isEditing: boolean;
  onCancel: () => void;
  onSave: (entry: SimplePlayerCareerEntry) => void;
};

type FormErrors = {
  teamName?: string;
};

// ---------------------------------------------------------------------------
// SimplePlayerCareerForm
// ---------------------------------------------------------------------------

export function SimplePlayerCareerForm({
  entry,
  isEditing,
  onCancel,
  onSave,
}: SimplePlayerCareerFormProps) {
  const [form, setForm] = useState<SimplePlayerCareerEntry>(entry);
  const [errors, setErrors] = useState<FormErrors>({});

  const seasonOptions = getPlayerSeasonOptions();

  function updateField<K extends keyof SimplePlayerCareerEntry>(
    key: K,
    value: SimplePlayerCareerEntry[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (key === "teamName") {
      setErrors((prev) => ({ ...prev, teamName: undefined }));
    }
  }

  function handleSave() {
    const nextErrors: FormErrors = {};

    if (!form.teamName.trim()) {
      nextErrors.teamName = "Il nome della squadra è obbligatorio.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const entryToSave: SimplePlayerCareerEntry = {
      ...form,
      id: form.id || generateCoachEntryId(),
    };

    onSave(entryToSave);
  }

  return (
    <View style={formStyles.container}>
      <AppText variant="headingMd">
        {isEditing ? "Modifica carriera" : "Aggiungi carriera giocatore"}
      </AppText>

      {/* Team name */}
      <View style={formStyles.fieldGroup}>
        <Input
          label="Squadra *"
          onChangeText={(val) => updateField("teamName", val)}
          placeholder="Es. ASD Pro Calcio"
          value={form.teamName}
        />
        {errors.teamName ? (
          <AppText variant="caption" color="danger">
            {errors.teamName}
          </AppText>
        ) : null}
      </View>

      {/* Season */}
      <SelectField
        label="Stagione"
        onChange={(val) => updateField("season", val)}
        options={seasonOptions}
        placeholder="Seleziona stagione"
        value={form.season}
      />

      {/* Category */}
      <Input
        label="Categoria"
        onChangeText={(val) => updateField("category", val)}
        placeholder="Es. Eccellenza, Promozione"
        value={form.category}
      />

      {/* Position */}
      <SelectField
        label="Ruolo in campo"
        onChange={(val) => updateField("position", val)}
        options={PLAYER_POSITION_OPTIONS}
        placeholder="Seleziona ruolo"
        value={form.position}
      />

      {/* Action buttons */}
      <Button
        label={isEditing ? "Salva modifiche" : "Salva"}
        onPress={handleSave}
        variant="primary"
      />
      <Button label="Annulla" onPress={onCancel} variant="tertiary" />
    </View>
  );
}

const formStyles = StyleSheet.create({
  container: {
    gap: spacing[18],
  },
  fieldGroup: {
    gap: spacing[8],
  },
});
