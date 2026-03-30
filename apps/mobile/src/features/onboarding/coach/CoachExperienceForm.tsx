import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { SelectField } from "../../../components/ui/select-field";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import {
  SENIOR_CATEGORY_OPTIONS,
  YOUTH_CATEGORY_OPTIONS,
} from "../../profiles/player-sports";
import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import { TeamAutocompleteInput } from "../../profiles/player-sports-section";
import type { CoachCareerEntry } from "./coach-career-types";
import {
  COACH_ROLE_OPTIONS,
  MONTH_OPTIONS,
  formatSeasonShort,
  generateCoachEntryId,
  getCoachSeasonOptions,
  getCoachYearOptions,
  getOlderCoachSeasonOptions,
} from "./coach-career-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CoachExperienceFormProps = {
  entry: CoachCareerEntry;
  isEditing: boolean;
  onCancel: () => void;
  onSave: (entry: CoachCareerEntry) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
};

const COACH_EXPERIENCE_CATEGORY_OPTIONS = [
  ...SENIOR_CATEGORY_OPTIONS,
  ...YOUTH_CATEGORY_OPTIONS,
];

type FormErrors = {
  teamName?: string;
  seasons?: string;
  startYear?: string;
  endYear?: string;
};

// ---------------------------------------------------------------------------
// SeasonChipGrid — multi-select chips
// ---------------------------------------------------------------------------

function SeasonChipGrid({
  selectedSeasons,
  onToggle,
}: {
  selectedSeasons: string[];
  onToggle: (season: string) => void;
}) {
  const allSeasons = getCoachSeasonOptions();
  const selectedSet = new Set(selectedSeasons);

  const olderSelected = selectedSeasons.filter((s) => !allSeasons.includes(s));
  const olderSeasonOptions = getOlderCoachSeasonOptions();
  const availableOlderOptions = olderSeasonOptions.filter(
    (o) => !selectedSet.has(o.value),
  );

  return (
    <View style={chipStyles.container}>
      {allSeasons.map((season) => {
        const isSelected = selectedSet.has(season);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            key={season}
            onPress={() => onToggle(season)}
            style={[
              chipStyles.chip,
              isSelected ? chipStyles.chipSelected : null,
            ]}
          >
            <AppText
              variant="bodySm"
              style={isSelected ? chipStyles.chipTextSelected : chipStyles.chipText}
            >
              {formatSeasonShort(season)}
            </AppText>
          </Pressable>
        );
      })}

      {olderSelected.map((season) => (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: true }}
          key={season}
          onPress={() => onToggle(season)}
          style={[chipStyles.chip, chipStyles.chipSelected]}
        >
          <AppText variant="bodySm" style={chipStyles.chipTextSelected}>
            {formatSeasonShort(season)}
          </AppText>
        </Pressable>
      ))}

      {availableOlderOptions.length > 0 ? (
        <View style={chipStyles.olderPickerRow}>
          <SelectField
            label="Aggiungi stagione precedente"
            onChange={(val) => {
              if (val) {
                onToggle(val);
              }
            }}
            options={availableOlderOptions}
            placeholder="Prima del 2010..."
            searchable
            searchPlaceholder="Cerca anno..."
            value=""
          />
        </View>
      ) : null}
    </View>
  );
}

const chipStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  chip: {
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.inkInvert,
    fontWeight: "600",
  },
  olderPickerRow: {
    width: "100%",
    marginTop: spacing[4],
  },
});

// ---------------------------------------------------------------------------
// PeriodSelector
// ---------------------------------------------------------------------------

type Period = NonNullable<CoachCareerEntry["period"]>;

function PeriodSelector({
  period,
  onChange,
  startYearError,
  endYearError,
}: {
  period: Period | null;
  onChange: (period: Period) => void;
  startYearError?: string;
  endYearError?: string;
}) {
  const yearOptions = getCoachYearOptions();
  const current: Period = period ?? {
    startMonth: "",
    startYear: "",
    endMonth: "",
    endYear: "",
  };

  function update(patch: Partial<Period>) {
    onChange({ ...current, ...patch });
  }

  return (
    <View style={periodStyles.container}>
      <View style={periodStyles.row}>
        <View style={periodStyles.field}>
          <SelectField
            allowClear
            clearLabel="Rimuovi mese"
            label="Dal (Mese)"
            onChange={(val) => update({ startMonth: val })}
            options={MONTH_OPTIONS}
            placeholder="Mese"
            value={current.startMonth}
          />
        </View>
        <View style={periodStyles.field}>
          <SelectField
            label="Dal (Anno) *"
            onChange={(val) => update({ startYear: val })}
            options={yearOptions}
            placeholder="Anno"
            searchable
            searchPlaceholder="Cerca anno..."
            value={current.startYear}
          />
        </View>
      </View>
      {startYearError ? (
        <AppText variant="caption" color="danger">
          {startYearError}
        </AppText>
      ) : null}

      <View style={periodStyles.row}>
        <View style={periodStyles.field}>
          <SelectField
            allowClear
            clearLabel="Rimuovi mese"
            label="Al (Mese)"
            onChange={(val) => update({ endMonth: val })}
            options={MONTH_OPTIONS}
            placeholder="Mese"
            value={current.endMonth}
          />
        </View>
        <View style={periodStyles.field}>
          <SelectField
            label="Al (Anno) *"
            onChange={(val) => update({ endYear: val })}
            options={yearOptions}
            placeholder="Anno"
            searchable
            searchPlaceholder="Cerca anno..."
            value={current.endYear}
          />
        </View>
      </View>
      {endYearError ? (
        <AppText variant="caption" color="danger">
          {endYearError}
        </AppText>
      ) : null}
    </View>
  );
}

const periodStyles = StyleSheet.create({
  container: {
    gap: spacing[10],
  },
  row: {
    flexDirection: "row",
    gap: spacing[10],
  },
  field: {
    flex: 1,
  },
});

// ---------------------------------------------------------------------------
// CoachExperienceForm
// ---------------------------------------------------------------------------

export function CoachExperienceForm({
  entry,
  isEditing,
  onCancel,
  onSave,
  searchTeams,
}: CoachExperienceFormProps) {
  const [form, setForm] = useState<CoachCareerEntry>(entry);
  const [errors, setErrors] = useState<FormErrors>({});

  const seasonOptions = getCoachSeasonOptions().map((s) => ({
    label: formatSeasonShort(s),
    value: s,
  }));

  function updateField<K extends keyof CoachCareerEntry>(
    key: K,
    value: CoachCareerEntry[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleToggleSeason(season: string) {
    setForm((prev) => {
      const isSelected = prev.seasons.includes(season);
      const nextSeasons = isSelected
        ? prev.seasons.filter((s) => s !== season)
        : [...prev.seasons, season];
      return { ...prev, seasons: nextSeasons };
    });
    setErrors((prev) => ({ ...prev, seasons: undefined }));
  }

  function handlePeriodChange(period: NonNullable<CoachCareerEntry["period"]>) {
    setForm((prev) => ({ ...prev, period }));
    setErrors((prev) => ({ ...prev, startYear: undefined, endYear: undefined }));
  }

  function handleSave() {
    const nextErrors: FormErrors = {};

    if (!form.teamName.trim()) {
      nextErrors.teamName = "Il nome della squadra è obbligatorio.";
    }

    if (form.type === "MULTI_SEASON" && form.seasons.length === 0) {
      nextErrors.seasons = "Seleziona almeno una stagione.";
    }

    if (form.type === "SINGLE_SEASON" && form.seasons.length === 0) {
      nextErrors.seasons = "Seleziona una stagione.";
    }

    if (form.type === "CUSTOM_PERIOD") {
      if (!form.period?.startYear) {
        nextErrors.startYear = "L'anno di inizio è obbligatorio.";
      }
      if (!form.period?.endYear) {
        nextErrors.endYear = "L'anno di fine è obbligatorio.";
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    const entryToSave: CoachCareerEntry = {
      ...form,
      id: form.id || generateCoachEntryId(),
    };

    onSave(entryToSave);
  }

  return (
    <View style={formStyles.container}>
      <AppText variant="headingMd">
        {isEditing ? "Modifica esperienza" : "Dettagli esperienza"}
      </AppText>

      {/* Team name */}
      <View style={formStyles.fieldGroup}>
        <TeamAutocompleteInput
          label="Nome squadra *"
          onChangeText={(val) => updateField("teamName", val)}
          onSelectTeam={(team) => updateField("teamName", team.name)}
          placeholder="Es. ASD Pro Calcio"
          searchTeams={searchTeams}
          value={form.teamName}
        />
        {errors.teamName ? (
          <AppText variant="caption" color="danger">
            {errors.teamName}
          </AppText>
        ) : null}
      </View>

      {/* Category */}
      <SelectField
        label="Categoria"
        onChange={(val) => updateField("category", val)}
        options={COACH_EXPERIENCE_CATEGORY_OPTIONS}
        placeholder="Seleziona categoria"
        value={form.category}
      />

      {/* Role */}
      <SelectField
        label="Ruolo"
        onChange={(val) => updateField("role", val)}
        options={COACH_ROLE_OPTIONS}
        placeholder="Seleziona ruolo"
        value={form.role}
      />

      {/* Duration content by type */}
      {form.type === "MULTI_SEASON" ? (
        <View style={formStyles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Stagioni (seleziona tutte quelle applicabili)
          </AppText>
          <SeasonChipGrid
            onToggle={handleToggleSeason}
            selectedSeasons={form.seasons}
          />
          {errors.seasons ? (
            <AppText variant="caption" color="danger">
              {errors.seasons}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {form.type === "SINGLE_SEASON" ? (
        <View style={formStyles.fieldGroup}>
          <SelectField
            label="Stagione"
            onChange={(val) =>
              setForm((prev) => ({ ...prev, seasons: val ? [val] : [] }))
            }
            options={seasonOptions}
            placeholder="Seleziona stagione"
            value={form.seasons[0] ?? ""}
          />
          {errors.seasons ? (
            <AppText variant="caption" color="danger">
              {errors.seasons}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {form.type === "CUSTOM_PERIOD" ? (
        <PeriodSelector
          endYearError={errors.endYear}
          onChange={handlePeriodChange}
          period={form.period}
          startYearError={errors.startYear}
        />
      ) : null}

      {/* Action buttons */}
      <Button
        label={isEditing ? "Salva modifiche" : "Salva esperienza"}
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
