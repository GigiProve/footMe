import { useMemo, useState } from "react";
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
import type { CoachCareerEntry, CoachSeasonDetail } from "./coach-career-types";
import {
  COACH_ROLE_OPTIONS,
  MONTH_OPTIONS,
  computeCoachSeasonsFromPeriod,
  formatSeasonShort,
  generateCoachEntryId,
  getCoachEndYearOptions,
  getCoachPeriodOverlapSeasons,
  getCoachSeasonSelectOptions,
  getCoachStartYearOptions,
  getOccupiedCoachSeasonLabels,
  getOlderCoachSeasonSelectOptions,
  sanitizeCoachPeriodSelection,
} from "./coach-career-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CoachExperienceFormProps = {
  categoryLabel?: string;
  categoryPlaceholder?: string;
  entry: CoachCareerEntry;
  existingEntries?: CoachCareerEntry[];
  isEditing: boolean;
  onCancel: () => void;
  onSave: (entry: CoachCareerEntry) => void;
  roleLabel?: string;
  roleOptions?: { label: string; value: string }[];
  rolePlaceholder?: string;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  teamLabel?: string;
  teamPlaceholder?: string;
  title?: string;
};

const COACH_EXPERIENCE_CATEGORY_OPTIONS = [
  ...SENIOR_CATEGORY_OPTIONS,
  ...YOUTH_CATEGORY_OPTIONS,
];

type FormErrors = {
  category?: string;
  role?: string;
  teamName?: string;
  seasons?: string;
  startYear?: string;
  endYear?: string;
  period?: string;
  seasonDetails?: string;
};

// ---------------------------------------------------------------------------
// SeasonChipGrid — multi-select chips
// ---------------------------------------------------------------------------

function SeasonChipGrid({
  disabledSeasons,
  selectedSeasons,
  onToggle,
}: {
  disabledSeasons?: Set<string>;
  selectedSeasons: string[];
  onToggle: (season: string) => void;
}) {
  const allSeasons = getCoachSeasonSelectOptions(disabledSeasons ?? new Set());
  const selectedSet = new Set(selectedSeasons);

  const olderSelected = selectedSeasons.filter(
    (season) => !allSeasons.some((option) => option.value === season),
  );
  const olderSeasonOptions = getOlderCoachSeasonSelectOptions(
    disabledSeasons ?? new Set(),
  );
  const availableOlderOptions = olderSeasonOptions.filter(
    (o) => !selectedSet.has(o.value),
  );

  return (
    <View style={chipStyles.container}>
      {allSeasons.map((seasonOption) => {
        const isSelected = selectedSet.has(seasonOption.value);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled: seasonOption.disabled === true,
              selected: isSelected,
            }}
            disabled={seasonOption.disabled === true}
            key={seasonOption.value}
            onPress={() => onToggle(seasonOption.value)}
            style={[
              chipStyles.chip,
              seasonOption.disabled ? chipStyles.chipDisabled : null,
              isSelected ? chipStyles.chipSelected : null,
            ]}
          >
            <AppText
              variant="bodySm"
              style={[
                isSelected ? chipStyles.chipTextSelected : chipStyles.chipText,
                seasonOption.disabled ? chipStyles.chipTextDisabled : null,
              ]}
            >
              {seasonOption.label}
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
  chipDisabled: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    opacity: 0.5,
  },
  chipText: {
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.inkInvert,
    fontWeight: "600",
  },
  chipTextDisabled: {
    color: colors.textMuted,
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
  endYearOptions,
  period,
  onChange,
  startYearOptions,
  startYearError,
  endYearError,
  periodError,
}: {
  endYearOptions: { label: string; value: string; disabled?: boolean }[];
  period: Period | null;
  onChange: (period: Period) => void;
  startYearOptions: { label: string; value: string; disabled?: boolean }[];
  startYearError?: string;
  endYearError?: string;
  periodError?: string;
}) {
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
            options={startYearOptions}
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
            options={endYearOptions}
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
      {periodError ? (
        <AppText variant="caption" color="danger">
          {periodError}
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
// SeasonDetailCard
// ---------------------------------------------------------------------------

function SeasonDetailCard({
  categoryOptions,
  detail,
  onChange,
  roleOptions,
  season,
}: {
  categoryOptions: { label: string; value: string }[];
  detail: CoachSeasonDetail;
  onChange: (field: keyof CoachSeasonDetail, value: string) => void;
  roleOptions: { label: string; value: string }[];
  season: string;
}) {
  return (
    <View style={seasonDetailStyles.container}>
      <View style={seasonDetailStyles.labelBadge}>
        <AppText variant="caption" style={seasonDetailStyles.labelText}>
          {formatSeasonShort(season)}
        </AppText>
      </View>

      <SelectField
        label="Categoria *"
        onChange={(val) => onChange("category", val)}
        options={categoryOptions}
        placeholder="Seleziona categoria"
        searchable
        searchPlaceholder="Cerca categoria..."
        value={detail.category}
      />

      <SelectField
        label="Ruolo *"
        onChange={(val) => onChange("role", val)}
        options={roleOptions}
        placeholder="Seleziona ruolo"
        value={detail.role}
      />
    </View>
  );
}

const seasonDetailStyles = StyleSheet.create({
  container: {
    gap: spacing[10],
    padding: spacing[14],
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
  },
  labelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
    borderRadius: radius.full,
    backgroundColor: colors.heroSoft,
    borderWidth: 1,
    borderColor: colors.hero,
  },
  labelText: {
    color: colors.hero,
  },
});

// ---------------------------------------------------------------------------
// CoachExperienceForm
// ---------------------------------------------------------------------------

export function CoachExperienceForm({
  categoryLabel = "Categoria *",
  categoryPlaceholder = "Seleziona categoria",
  entry,
  existingEntries = [],
  isEditing,
  onCancel,
  onSave,
  roleLabel = "Ruolo *",
  roleOptions = COACH_ROLE_OPTIONS,
  rolePlaceholder = "Seleziona ruolo",
  searchTeams,
  teamLabel = "Squadra *",
  teamPlaceholder = "Es. ASD Pro Calcio",
  title,
}: CoachExperienceFormProps) {
  const [form, setForm] = useState<CoachCareerEntry>(entry);
  const [errors, setErrors] = useState<FormErrors>({});
  const occupiedSeasons = useMemo(
    () => getOccupiedCoachSeasonLabels(existingEntries, entry.id),
    [existingEntries, entry.id],
  );
  const seasonOptions = useMemo(
    () => getCoachSeasonSelectOptions(occupiedSeasons),
    [occupiedSeasons],
  );
  const startYearOptions = useMemo(
    () =>
      getCoachStartYearOptions(
        form.period?.endYear ?? "",
        form.period?.endMonth ?? "",
        form.period?.startMonth ?? "",
        occupiedSeasons,
      ),
    [form.period?.endMonth, form.period?.endYear, form.period?.startMonth, occupiedSeasons],
  );
  const endYearOptions = useMemo(
    () =>
      getCoachEndYearOptions(
        form.period?.startYear ?? "",
        form.period?.startMonth ?? "",
        occupiedSeasons,
      ),
    [form.period?.startMonth, form.period?.startYear, occupiedSeasons],
  );

  const effectiveSeasons = useMemo(() => {
    if (form.type === "MULTI_SEASON") {
      return form.seasons.length > 1 ? form.seasons : [];
    }
    if (form.type === "CUSTOM_PERIOD" && form.period) {
      const seasons = computeCoachSeasonsFromPeriod(form.period);
      return seasons.length > 1 ? seasons : [];
    }
    return [];
  }, [form.type, form.seasons, form.period]);

  const isMultiSeason = effectiveSeasons.length > 1;

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

      const nextDetails = { ...prev.seasonDetails };
      if (!isSelected && !nextDetails[season]) {
        nextDetails[season] = { category: prev.category, role: prev.role };
      }
      if (isSelected) {
        delete nextDetails[season];
      }

      return { ...prev, seasons: nextSeasons, seasonDetails: nextDetails };
    });
    setErrors((prev) => ({ ...prev, seasons: undefined }));
  }

  function handlePeriodChange(period: NonNullable<CoachCareerEntry["period"]>) {
    const nextPeriod = sanitizeCoachPeriodSelection(period, occupiedSeasons);

    setForm((prev) => {
      const newSeasons = computeCoachSeasonsFromPeriod(nextPeriod);
      if (newSeasons.length <= 1) {
        return { ...prev, period: nextPeriod, seasonDetails: {} };
      }
      const nextDetails: Record<string, CoachSeasonDetail> = {};
      for (const season of newSeasons) {
        nextDetails[season] = prev.seasonDetails[season] ?? {
          category: prev.category,
          role: prev.role,
        };
      }
      return { ...prev, period: nextPeriod, seasonDetails: nextDetails };
    });
    setErrors((prev) => ({
      ...prev,
      startYear: undefined,
      endYear: undefined,
      period: undefined,
    }));
  }

  function handleSeasonDetailChange(
    season: string,
    field: keyof CoachSeasonDetail,
    value: string,
  ) {
    setForm((prev) => ({
      ...prev,
      seasonDetails: {
        ...prev.seasonDetails,
        [season]: { ...(prev.seasonDetails[season] ?? { category: "", role: "" }), [field]: value },
      },
    }));
    setErrors((prev) => ({ ...prev, seasonDetails: undefined }));
  }

  function handleSave() {
    const nextErrors: FormErrors = {};

    if (!form.teamName.trim()) {
      nextErrors.teamName = "La squadra è obbligatoria.";
    }

    if (!isMultiSeason) {
      if (!form.role.trim()) {
        nextErrors.role = "Seleziona un ruolo.";
      }
      if (!form.category.trim()) {
        nextErrors.category = "Seleziona una categoria.";
      }
    } else {
      for (const season of effectiveSeasons) {
        const detail = form.seasonDetails[season];
        if (!detail?.category) {
          nextErrors.seasonDetails = `Seleziona una categoria per la stagione ${formatSeasonShort(season)}.`;
          break;
        }
        if (!detail?.role) {
          nextErrors.seasonDetails = `Seleziona un ruolo per la stagione ${formatSeasonShort(season)}.`;
          break;
        }
      }
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
      const overlappingSeasons = getCoachPeriodOverlapSeasons(
        form.period,
        occupiedSeasons,
      );
      if (overlappingSeasons.length > 0) {
        const seasonLabels = overlappingSeasons.map(formatSeasonShort).join(", ");
        nextErrors.period =
          overlappingSeasons.length === 1
            ? `Il periodo personalizzato si sovrappone alla stagione ${seasonLabels} gia' inserita.`
            : `Il periodo personalizzato si sovrappone alle stagioni ${seasonLabels} gia' inserite.`;
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
        {title ?? (isEditing ? "Modifica esperienza" : "Dettagli esperienza")}
      </AppText>

      {/* Team name */}
      <View style={formStyles.fieldGroup}>
        <TeamAutocompleteInput
          label={teamLabel}
          onChangeText={(val) =>
            setForm((prev) => ({
              ...prev,
              clubId: null,
              teamCity: "",
              teamLogoUrl: null,
              teamName: val,
            }))
          }
          onSelectTeam={(team) =>
            setForm((prev) => ({
              ...prev,
              clubId: team.id,
              teamCity: team.city ?? "",
              teamLogoUrl: team.logoUrl,
              teamName: team.name,
            }))
          }
          placeholder={teamPlaceholder}
          searchTeams={searchTeams}
          value={form.teamName}
        />
        {errors.teamName ? (
          <AppText variant="caption" color="danger">
            {errors.teamName}
          </AppText>
        ) : null}
      </View>

      {/* Category — only shown when single season */}
      {!isMultiSeason ? (
        <View style={formStyles.fieldGroup}>
          <SelectField
            label={categoryLabel}
            onChange={(val) => updateField("category", val)}
            options={COACH_EXPERIENCE_CATEGORY_OPTIONS}
            placeholder={categoryPlaceholder}
            searchable
            searchPlaceholder="Cerca categoria..."
            value={form.category}
          />
          {errors.category ? (
            <AppText variant="caption" color="danger">
              {errors.category}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* Role — only shown when single season */}
      {!isMultiSeason ? (
        <View style={formStyles.fieldGroup}>
          <SelectField
            label={roleLabel}
            onChange={(val) => updateField("role", val)}
            options={roleOptions}
            placeholder={rolePlaceholder}
            value={form.role}
          />
          {errors.role ? (
            <AppText variant="caption" color="danger">
              {errors.role}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {/* Duration content by type */}
      {form.type === "MULTI_SEASON" ? (
        <View style={formStyles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Stagioni (seleziona tutte quelle applicabili)
          </AppText>
          <SeasonChipGrid
            disabledSeasons={occupiedSeasons}
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
            searchable
            searchPlaceholder="Cerca stagione..."
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
          endYearOptions={endYearOptions}
          endYearError={errors.endYear}
          onChange={handlePeriodChange}
          period={form.period}
          periodError={errors.period}
          startYearOptions={startYearOptions}
          startYearError={errors.startYear}
        />
      ) : null}

      {/* Per-season category + role — only when multiple seasons selected */}
      {isMultiSeason ? (
        <View style={formStyles.fieldGroup}>
          <AppText variant="caption" color="muted">
            Categoria e ruolo per stagione
          </AppText>
          <View style={formStyles.seasonDetailsSection}>
            {effectiveSeasons.map((season) => (
              <SeasonDetailCard
                key={season}
                categoryOptions={COACH_EXPERIENCE_CATEGORY_OPTIONS}
                detail={form.seasonDetails[season] ?? { category: form.category, role: form.role }}
                onChange={(field, value) => handleSeasonDetailChange(season, field, value)}
                roleOptions={roleOptions}
                season={season}
              />
            ))}
          </View>
          {errors.seasonDetails ? (
            <AppText variant="caption" color="danger">
              {errors.seasonDetails}
            </AppText>
          ) : null}
        </View>
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
  seasonDetailsSection: {
    gap: spacing[12],
  },
});
