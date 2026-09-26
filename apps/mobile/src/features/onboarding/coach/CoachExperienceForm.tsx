import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "../../../styles";
import { AppText, Button } from "../../../ui";
import {
  SENIOR_CATEGORY_OPTIONS,
  YOUTH_CATEGORY_OPTIONS,
} from "../../profiles/player-sports";
import type { TeamAutocompleteOption } from "../../profiles/player-sports";
import { TeamAutocompleteInput } from "../../profiles/player-sports-section";
import { MultiSeasonSelector } from "../career/MultiSeasonSelector";
import {
  FieldShell,
  InlineError,
  OnboardingSection,
  OnboardingSelectField,
  OnboardingTextField,
  PeriodField,
} from "../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";
import type { CoachCareerEntry, CoachSeasonDetail } from "./coach-career-types";
import {
  COACH_ROLE_OPTIONS,
  coachPeriodFromDateValue,
  coachPeriodToDateValue,
  formatSeasonShort,
  generateCoachEntryId,
  getCoachPeriodOverlapSeasons,
  getCoachSeasonSelectOptions,
  getOccupiedCoachSeasonLabels,
  sanitizeCoachPeriodSelection,
} from "./coach-career-utils";

type CoachExperienceFormProps = {
  /**
   * Ammette un'esperienza senza data di fine (§Z). Il pattern è del Master;
   * decide il flusso se offrirlo: lo Staff sì, l'Allenatore no.
   */
  allowOngoing?: boolean;
  categoryLabel?: string;
  categoryPlaceholder?: string;
  descriptionLabel?: string;
  descriptionPlaceholder?: string;
  entry: CoachCareerEntry;
  existingEntries?: CoachCareerEntry[];
  isEditing: boolean;
  onCancel: () => void;
  onSave: (entry: CoachCareerEntry) => void;
  roleLabel?: string;
  roleOptions?: { label: string; value: string }[];
  rolePlaceholder?: string;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  /** Copy della sezione "Ruolo per stagione": cambia da un profilo all'altro. */
  seasonRoleDescription?: string;
  showDescription?: boolean;
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
  endDate?: string;
  period?: string;
  role?: string;
  seasonRoles?: string;
  seasons?: string;
  startDate?: string;
  teamName?: string;
};

type Period = NonNullable<CoachCareerEntry["period"]>;

const EMPTY_PERIOD: Period = {
  endMonth: "",
  endYear: "",
  startMonth: "",
  startYear: "",
};

// ---------------------------------------------------------------------------
// SeasonRoleRow — una riga compatta per stagione (§T)
// ---------------------------------------------------------------------------

function SeasonRoleRow({
  isLast,
  onChange,
  roleOptions,
  season,
  value,
}: {
  isLast: boolean;
  onChange: (role: string) => void;
  roleOptions: { label: string; value: string }[];
  season: string;
  value: string;
}) {
  return (
    <View style={[styles.seasonRow, isLast ? null : styles.seasonRowDivider]}>
      <AppText style={styles.seasonLabel} variant="metaStrong">
        {formatSeasonShort(season)}
      </AppText>

      <View style={styles.seasonControl}>
        <OnboardingSelectField
          onChange={onChange}
          options={roleOptions}
          placeholder="Seleziona ruolo"
          sheetTitle={`Ruolo ${formatSeasonShort(season)}`}
          testID={`season-role-${season}`}
          value={value}
        />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// CoachExperienceForm
// ---------------------------------------------------------------------------

/**
 * Editor di un'esperienza da allenatore (REV-ONB-03 §Q–§Z).
 *
 * Unico per le tre modalità e unico fra onboarding e profilo: una modifica
 * riapre questo stesso form precompilato (§AB).
 *
 * Due differenze sostanziali rispetto al Calciatore:
 * — nessuna statistica, mai, in nessuna modalità (§V);
 * — dentro "Più stagioni complete" squadra e categoria restano le stesse,
 *   mentre il ruolo può cambiare stagione per stagione (§S, §U).
 */
export function CoachExperienceForm({
  allowOngoing = false,
  categoryLabel = "Categoria",
  categoryPlaceholder = "Seleziona categoria",
  descriptionLabel = "Attività svolte",
  descriptionPlaceholder = "Riassumi in una o due righe attività, gestione del gruppo o coordinamento sportivo.",
  entry,
  existingEntries = [],
  isEditing,
  onCancel,
  onSave,
  roleLabel = "Ruolo",
  roleOptions = COACH_ROLE_OPTIONS,
  rolePlaceholder = "Seleziona ruolo",
  searchTeams,
  seasonRoleDescription = "Un allenatore può avere ruoli diversi nelle diverse stagioni.",
  showDescription = false,
  teamLabel = "Squadra",
  teamPlaceholder = "Cerca la squadra",
  title,
}: CoachExperienceFormProps) {
  const [form, setForm] = useState<CoachCareerEntry>(entry);
  const [errors, setErrors] = useState<FormErrors>({});
  /**
   * §Z: "nessuna data di fine" da solo è ambiguo — può voler dire "non l'ho
   * ancora scelta". Lo stato esplicito distingue i due casi.
   */
  const [isOngoing, setIsOngoing] = useState(
    allowOngoing &&
      entry.type === "CUSTOM_PERIOD" &&
      Boolean(entry.period?.startYear) &&
      !entry.period?.endYear,
  );

  const occupiedSeasons = useMemo(
    () => getOccupiedCoachSeasonLabels(existingEntries, entry.id),
    [existingEntries, entry.id],
  );
  const seasonOptions = useMemo(
    () => getCoachSeasonSelectOptions(occupiedSeasons),
    [occupiedSeasons],
  );

  /** Stagioni che meritano una riga "Ruolo per stagione", più recenti prima. */
  const roleSeasons = useMemo(() => {
    if (form.type !== "MULTI_SEASON" || form.seasons.length < 2) {
      return [];
    }

    return [...form.seasons].sort((left, right) => right.localeCompare(left));
  }, [form.seasons, form.type]);

  const period = form.period ?? EMPTY_PERIOD;
  const startValue = coachPeriodToDateValue(period.startMonth, period.startYear);
  const endValue = coachPeriodToDateValue(period.endMonth, period.endYear);

  function getSeasonRole(season: string) {
    return form.seasonDetails[season]?.role ?? form.role;
  }

  function handleToggleSeason(season: string) {
    setForm((current) => {
      const isSelected = current.seasons.includes(season);
      const nextSeasons = isSelected
        ? current.seasons.filter((entrySeason) => entrySeason !== season)
        : [...current.seasons, season];

      const nextDetails: Record<string, CoachSeasonDetail> = {
        ...current.seasonDetails,
      };

      if (isSelected) {
        delete nextDetails[season];
      } else {
        // Il ruolo principale è solo un default: da qui in poi la stagione
        // vive di vita propria (§T).
        nextDetails[season] = {
          category: current.category,
          role: current.role,
        };
      }

      return { ...current, seasonDetails: nextDetails, seasons: nextSeasons };
    });
    setErrors((current) => ({ ...current, seasons: undefined }));
  }

  function handleSingleSeasonSelect(season: string) {
    setForm((current) => ({
      ...current,
      seasonDetails: {},
      seasons: season ? [season] : [],
    }));
    setErrors((current) => ({ ...current, seasons: undefined }));
  }

  /** Cambiare un anno non tocca gli altri (§T). */
  function handleSeasonRoleChange(season: string, role: string) {
    setForm((current) => ({
      ...current,
      seasonDetails: {
        ...current.seasonDetails,
        [season]: { category: current.category, role },
      },
    }));
    setErrors((current) => ({ ...current, seasonRoles: undefined }));
  }

  function handleRoleChange(role: string) {
    setForm((current) => {
      const nextDetails: Record<string, CoachSeasonDetail> = {};

      // Il nuovo ruolo principale ridiventa il default delle stagioni non
      // ancora personalizzate; quelle già cambiate restano dove sono.
      for (const [season, detail] of Object.entries(current.seasonDetails)) {
        nextDetails[season] =
          !detail.role || detail.role === current.role
            ? { ...detail, role }
            : detail;
      }

      return { ...current, role, seasonDetails: nextDetails };
    });
    setErrors((current) => ({ ...current, role: undefined }));
  }

  function handleCategoryChange(category: string) {
    setForm((current) => {
      const nextDetails: Record<string, CoachSeasonDetail> = {};

      // §U: dentro un blocco la categoria è una sola, quindi si propaga.
      for (const [season, detail] of Object.entries(current.seasonDetails)) {
        nextDetails[season] = { ...detail, category };
      }

      return { ...current, category, seasonDetails: nextDetails };
    });
    setErrors((current) => ({ ...current, category: undefined }));
  }

  function handlePeriodChange(patch: Partial<Period>) {
    const requested = { ...period, ...patch };
    const sanitized = sanitizeCoachPeriodSelection(requested, occupiedSeasons);
    /**
     * La sanitizzazione azzera l'estremo opposto quando la nuova data lo
     * renderebbe impossibile: senza dirlo, la data scomparsa sembrerebbe un
     * bug (§BH).
     */
    const clearedStart = Boolean(requested.startYear) && !sanitized.startYear;
    const clearedEnd = Boolean(requested.endYear) && !sanitized.endYear;
    const conflictMessage =
      "Questo periodo si sovrappone a un'esperienza già inserita: scegli di nuovo l'altra data.";

    setForm((current) => ({
      ...current,
      period: sanitizeCoachPeriodSelection(
        { ...(current.period ?? EMPTY_PERIOD), ...patch },
        occupiedSeasons,
      ),
      seasonDetails: {},
    }));
    setErrors((current) => ({
      ...current,
      endDate: clearedEnd ? conflictMessage : undefined,
      period: undefined,
      startDate: clearedStart ? conflictMessage : undefined,
    }));
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!form.teamName.trim()) {
      nextErrors.teamName = "La squadra è obbligatoria.";
    }

    if (!form.role.trim()) {
      nextErrors.role = "Seleziona un ruolo.";
    }

    if (!form.category.trim()) {
      nextErrors.category = "Seleziona una categoria.";
    }

    if (form.type === "MULTI_SEASON" && form.seasons.length === 0) {
      nextErrors.seasons = "Seleziona almeno una stagione.";
    }

    if (form.type === "SINGLE_SEASON" && form.seasons.length === 0) {
      nextErrors.seasons = "Seleziona una stagione.";
    }

    for (const season of roleSeasons) {
      if (!getSeasonRole(season).trim()) {
        nextErrors.seasonRoles = `Seleziona un ruolo per la stagione ${formatSeasonShort(season)}.`;
        break;
      }
    }

    if (form.type === "CUSTOM_PERIOD") {
      if (!startValue) {
        nextErrors.startDate = "Indica il mese e l'anno di inizio.";
      }

      // §Z: una collaborazione ancora attiva non ha una data di fine.
      if (!endValue && !isOngoing) {
        nextErrors.endDate = "Indica il mese e l'anno di fine.";
      }

      // §BD: la data finale non può precedere quella iniziale.
      if (startValue && endValue && endValue < startValue) {
        nextErrors.endDate =
          "La data finale deve essere successiva alla data iniziale.";
      }

      const overlapping = getCoachPeriodOverlapSeasons(
        form.period,
        occupiedSeasons,
      );

      if (overlapping.length > 0) {
        const labels = overlapping.map(formatSeasonShort).join(", ");

        nextErrors.period =
          overlapping.length === 1
            ? `Il periodo si sovrappone alla stagione ${labels} già inserita.`
            : `Il periodo si sovrappone alle stagioni ${labels} già inserite.`;
      }
    }

    return nextErrors;
  }

  function handleSave() {
    const nextErrors = validate();

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSave({ ...form, id: form.id || generateCoachEntryId() });
  }

  return (
    <View style={styles.container}>
      {title ? <AppText variant="headingSm">{title}</AppText> : null}

      <OnboardingSection>
        <FieldShell errorMessage={errors.teamName} label={teamLabel}>
          <TeamAutocompleteInput
            onChangeText={(value) =>
              setForm((current) => ({
                ...current,
                clubId: null,
                teamCity: "",
                teamLogoUrl: null,
                teamName: value,
              }))
            }
            onSelectTeam={(team) =>
              setForm((current) => ({
                ...current,
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
        </FieldShell>

        <OnboardingSelectField
          errorMessage={errors.role}
          helperText={
            form.type === "MULTI_SEASON"
              ? "Puoi cambiarlo per singola stagione qui sotto."
              : undefined
          }
          label={roleLabel}
          onChange={handleRoleChange}
          options={roleOptions}
          placeholder={rolePlaceholder}
          sheetTitle="Ruolo"
          testID="coach-experience-role"
          value={form.role}
        />

        <OnboardingSelectField
          errorMessage={errors.category}
          label={categoryLabel}
          onChange={handleCategoryChange}
          options={COACH_EXPERIENCE_CATEGORY_OPTIONS}
          placeholder={categoryPlaceholder}
          searchable
          sheetTitle="Categoria"
          testID="coach-experience-category"
          value={form.category}
        />

        {form.type === "MULTI_SEASON" ? (
          <MultiSeasonSelector
            disabledSeasons={occupiedSeasons}
            errorMessage={errors.seasons}
            helperText="Seleziona tutte le stagioni nella stessa squadra."
            onToggle={handleToggleSeason}
            selectedSeasons={form.seasons}
            testID="coach-multi-season-selector"
          />
        ) : null}

        {form.type === "SINGLE_SEASON" ? (
          <OnboardingSelectField
            errorMessage={errors.seasons}
            label="Stagione"
            onChange={handleSingleSeasonSelect}
            options={seasonOptions}
            placeholder="Seleziona la stagione"
            searchable
            sheetTitle="Stagione"
            testID="coach-single-season-select"
            value={form.seasons[0] ?? ""}
          />
        ) : null}

        {form.type === "CUSTOM_PERIOD" ? (
          <>
            {/* §Y: due sole righe, ognuna sceglie mese e anno insieme. */}
            <PeriodField
              endErrorMessage={errors.endDate}
              endLabel="A"
              endPlaceholder="Mese e anno di fine"
              endTestID="coach-period-end"
              endValue={endValue}
              isCurrent={isOngoing}
              mode="monthYear"
              onCurrentChange={
                allowOngoing
                  ? (value) => {
                      setIsOngoing(value);

                      if (value) {
                        handlePeriodChange({ endMonth: "", endYear: "" });
                      }
                    }
                  : undefined
              }
              onEndChange={(value) => {
                const { month, year } = coachPeriodFromDateValue(value);

                handlePeriodChange({ endMonth: month, endYear: year });
              }}
              onStartChange={(value) => {
                const { month, year } = coachPeriodFromDateValue(value);

                handlePeriodChange({ startMonth: month, startYear: year });
              }}
              startErrorMessage={errors.startDate}
              startLabel="Da"
              startPlaceholder="Mese e anno di inizio"
              startTestID="coach-period-start"
              startValue={startValue}
            />

            {errors.period ? <InlineError message={errors.period} /> : null}
          </>
        ) : null}

        {showDescription ? (
          <OnboardingTextField
            label={descriptionLabel}
            multiline
            numberOfLines={3}
            onChangeText={(value) =>
              setForm((current) => ({ ...current, description: value }))
            }
            optional
            placeholder={descriptionPlaceholder}
            value={form.description ?? ""}
          />
        ) : null}
      </OnboardingSection>

      {roleSeasons.length > 0 ? (
        <OnboardingSection
          description={seasonRoleDescription}
          title="Ruolo per stagione"
        >
          <View style={styles.seasonList} testID="coach-season-roles">
            {roleSeasons.map((season, index) => (
              <SeasonRoleRow
                isLast={index === roleSeasons.length - 1}
                key={season}
                onChange={(role) => handleSeasonRoleChange(season, role)}
                roleOptions={roleOptions}
                season={season}
                value={getSeasonRole(season)}
              />
            ))}
          </View>

          {errors.seasonRoles ? (
            <InlineError message={errors.seasonRoles} />
          ) : null}
        </OnboardingSection>
      ) : null}

      <View style={styles.actions}>
        <Button
          fullWidth
          label={isEditing ? "Salva modifiche" : "Salva esperienza"}
          onPress={handleSave}
          size="lg"
          testID="coach-save-experience"
          variant="primary"
        />
        <Button
          fullWidth
          label="Annulla"
          onPress={onCancel}
          size="md"
          variant="tertiary"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: onboardingSpacing.s,
  },
  seasonList: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: onboardingRadius.card,
    borderWidth: onboardingBorderWidth.hairline,
    paddingHorizontal: onboardingSpacing.m - 4,
  },
  seasonRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: onboardingSpacing.s + 4,
    paddingVertical: onboardingSpacing.s + 2,
  },
  seasonRowDivider: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  seasonLabel: {
    minWidth: 62,
  },
  seasonControl: {
    flex: 1,
  },
  actions: {
    gap: onboardingSpacing.s,
    paddingTop: onboardingSpacing.s,
  },
});
