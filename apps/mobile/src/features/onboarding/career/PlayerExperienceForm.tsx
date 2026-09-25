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
import {
  FieldShell,
  InlineError,
  OnboardingSection,
  OnboardingSelectField,
  PeriodField,
} from "../ui";
import {
  onboardingBorderWidth,
  onboardingRadius,
  onboardingSpacing,
} from "../ui/onboarding-tokens";
import { ExperienceStatisticsStepper } from "./ExperienceStatisticsStepper";
import { MultiSeasonSelector } from "./MultiSeasonSelector";
import type {
  PlayerCareerEntry,
  PlayerSeasonDetail,
} from "./player-career-types";
import {
  computePlayerSeasonsFromPeriod,
  emptyPlayerSeasonDetail,
  formatSeasonShort,
  generatePlayerEntryId,
  getOccupiedPlayerSeasonLabels,
  getPlayerPeriodOverlapSeasons,
  getPlayerSeasonSelectOptions,
  playerPeriodFromDateValue,
  playerPeriodToDateValue,
  sanitizePlayerPeriodSelection,
} from "./player-career-utils";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type PlayerExperienceFormProps = {
  categoryLabel?: string;
  categoryPlaceholder?: string;
  entry: PlayerCareerEntry;
  existingEntries?: PlayerCareerEntry[];
  isEditing: boolean;
  onCancel: () => void;
  onSave: (entry: PlayerCareerEntry) => void;
  searchTeams: (query: string) => Promise<TeamAutocompleteOption[]>;
  teamLabel?: string;
  teamPlaceholder?: string;
  title?: string;
};

const PLAYER_EXPERIENCE_CATEGORY_OPTIONS = [
  ...SENIOR_CATEGORY_OPTIONS,
  ...YOUTH_CATEGORY_OPTIONS,
];

type FormErrors = {
  category?: string;
  endDate?: string;
  period?: string;
  seasonDetails?: string;
  seasons?: string;
  startDate?: string;
  teamName?: string;
};

type Period = NonNullable<PlayerCareerEntry["period"]>;

const EMPTY_PERIOD: Period = {
  endMonth: "",
  endYear: "",
  startMonth: "",
  startYear: "",
};

// ---------------------------------------------------------------------------
// SeasonStatisticsBlock — un blocco per stagione selezionata (§AM)
// ---------------------------------------------------------------------------

function SeasonStatisticsBlock({
  detail,
  onChange,
  season,
}: {
  detail: PlayerSeasonDetail;
  onChange: (field: keyof PlayerSeasonDetail, value: string) => void;
  season: string;
}) {
  return (
    <View style={styles.seasonBlock}>
      <View style={styles.seasonBadge}>
        <AppText color="inverse" variant="chipLabel">
          {formatSeasonShort(season)}
        </AppText>
      </View>

      <OnboardingSelectField
        label="Categoria"
        onChange={(value) => onChange("category", value)}
        options={PLAYER_EXPERIENCE_CATEGORY_OPTIONS}
        placeholder="Seleziona categoria"
        searchable
        sheetTitle="Categoria"
        value={detail.category}
      />

      <ExperienceStatisticsStepper
        detail={detail}
        onChange={onChange}
        testID={`season-stats-${season}`}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// PlayerExperienceForm
// ---------------------------------------------------------------------------

/**
 * Editor di un'esperienza del Calciatore (REV-ONB-02 §AH–§AZ).
 *
 * Unico per le tre modalità e unico fra onboarding e profilo: una modifica
 * riapre questo stesso form precompilato, non un editor parallelo (§BF).
 */
export function PlayerExperienceForm({
  categoryLabel = "Categoria",
  categoryPlaceholder = "Seleziona categoria",
  entry,
  existingEntries = [],
  isEditing,
  onCancel,
  onSave,
  searchTeams,
  teamLabel = "Squadra",
  teamPlaceholder = "Cerca la squadra",
  title,
}: PlayerExperienceFormProps) {
  const [form, setForm] = useState<PlayerCareerEntry>(entry);
  const [errors, setErrors] = useState<FormErrors>({});

  const occupiedSeasons = useMemo(
    () => getOccupiedPlayerSeasonLabels(existingEntries, entry.id),
    [existingEntries, entry.id],
  );
  const seasonOptions = useMemo(
    () => getPlayerSeasonSelectOptions(occupiedSeasons),
    [occupiedSeasons],
  );

  /** Stagioni che generano un blocco statistiche, in ordine discendente. */
  const detailSeasons = useMemo(() => {
    if (form.type === "CUSTOM_PERIOD") {
      return form.period ? computePlayerSeasonsFromPeriod(form.period) : [];
    }

    return [...form.seasons].sort((left, right) => right.localeCompare(left));
  }, [form.period, form.seasons, form.type]);

  const period = form.period ?? EMPTY_PERIOD;
  const startValue = playerPeriodToDateValue(period.startMonth, period.startYear);
  const endValue = playerPeriodToDateValue(period.endMonth, period.endYear);

  function getDetail(season: string): PlayerSeasonDetail {
    return (
      form.seasonDetails[season] ?? {
        ...emptyPlayerSeasonDetail(),
        category: form.category,
      }
    );
  }

  function handleToggleSeason(season: string) {
    setForm((current) => {
      const isSelected = current.seasons.includes(season);
      const nextSeasons = isSelected
        ? current.seasons.filter((entrySeason) => entrySeason !== season)
        : [...current.seasons, season];

      const nextDetails = { ...current.seasonDetails };

      if (isSelected) {
        delete nextDetails[season];
      } else if (!nextDetails[season]) {
        nextDetails[season] = {
          ...emptyPlayerSeasonDetail(),
          category: current.category,
        };
      }

      return { ...current, seasonDetails: nextDetails, seasons: nextSeasons };
    });
    setErrors((current) => ({ ...current, seasons: undefined }));
  }

  function handleSingleSeasonSelect(season: string) {
    setForm((current) => {
      const nextDetails: Record<string, PlayerSeasonDetail> = {};

      if (season) {
        nextDetails[season] = current.seasonDetails[season] ??
          Object.values(current.seasonDetails)[0] ?? {
            ...emptyPlayerSeasonDetail(),
            category: current.category,
          };
      }

      return {
        ...current,
        seasonDetails: nextDetails,
        seasons: season ? [season] : [],
      };
    });
    setErrors((current) => ({ ...current, seasons: undefined }));
  }

  function handlePeriodChange(patch: Partial<Period>) {
    const requested = { ...(form.period ?? EMPTY_PERIOD), ...patch };
    const sanitized = sanitizePlayerPeriodSelection(requested, occupiedSeasons);
    /**
     * `sanitizePlayerPeriodSelection` azzera l'estremo opposto quando la
     * nuova data lo renderebbe impossibile. Senza dirlo, la data scomparsa
     * sembrerebbe un bug: qui la perdita diventa un messaggio (§CC).
     */
    const clearedStart = Boolean(requested.startYear) && !sanitized.startYear;
    const clearedEnd = Boolean(requested.endYear) && !sanitized.endYear;

    setForm((current) => {
      const nextPeriod = sanitizePlayerPeriodSelection(
        { ...(current.period ?? EMPTY_PERIOD), ...patch },
        occupiedSeasons,
      );

      const seasons = computePlayerSeasonsFromPeriod(nextPeriod);
      const nextDetails: Record<string, PlayerSeasonDetail> = {};

      for (const season of seasons) {
        nextDetails[season] = current.seasonDetails[season] ?? {
          ...emptyPlayerSeasonDetail(),
          category: current.category,
        };
      }

      return { ...current, period: nextPeriod, seasonDetails: nextDetails };
    });
    const conflictMessage =
      "Questo periodo si sovrappone a un'esperienza già inserita: scegli di nuovo l'altra data.";

    setErrors((current) => ({
      ...current,
      endDate: clearedEnd ? conflictMessage : undefined,
      period: undefined,
      startDate: clearedStart ? conflictMessage : undefined,
    }));
  }

  function handleDetailChange(
    season: string,
    field: keyof PlayerSeasonDetail,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      seasonDetails: {
        ...current.seasonDetails,
        [season]: {
          ...(current.seasonDetails[season] ?? emptyPlayerSeasonDetail()),
          [field]: value,
        },
      },
    }));
    setErrors((current) => ({ ...current, seasonDetails: undefined }));
  }

  function handleCategoryChange(value: string) {
    setForm((current) => {
      const nextDetails = { ...current.seasonDetails };

      // La categoria di testa è il default delle stagioni non ancora toccate.
      for (const [season, detail] of Object.entries(nextDetails)) {
        if (!detail.category || detail.category === current.category) {
          nextDetails[season] = { ...detail, category: value };
        }
      }

      return { ...current, category: value, seasonDetails: nextDetails };
    });
    setErrors((current) => ({ ...current, category: undefined }));
  }

  function validate(): FormErrors {
    const nextErrors: FormErrors = {};

    if (!form.teamName.trim()) {
      nextErrors.teamName = "La squadra è obbligatoria.";
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

    if (form.type === "CUSTOM_PERIOD") {
      if (!startValue) {
        nextErrors.startDate = "Indica il mese e l'anno di inizio.";
      }

      if (!endValue) {
        nextErrors.endDate = "Indica il mese e l'anno di fine.";
      }

      // §AW: la data finale non può precedere quella iniziale.
      if (startValue && endValue && endValue < startValue) {
        nextErrors.endDate =
          "La data finale deve essere successiva alla data iniziale.";
      }

      const overlapping = getPlayerPeriodOverlapSeasons(
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

    // `getDetail` ripiega sulla categoria di testa, già obbligatoria: un
    // blocco stagione resta scoperto solo se l'utente l'ha svuotato a mano.
    for (const season of detailSeasons) {
      if (!form.seasonDetails[season]?.category && !form.category.trim()) {
        nextErrors.seasonDetails = `Seleziona una categoria per la stagione ${formatSeasonShort(season)}.`;
        break;
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

    onSave({ ...form, id: form.id || generatePlayerEntryId() });
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
                teamLogoUrl: "",
                teamName: value,
              }))
            }
            onSelectTeam={(team) =>
              setForm((current) => ({
                ...current,
                clubId: team.id,
                teamCity: team.city ?? "",
                teamLogoUrl: team.logoUrl ?? "",
                teamName: team.name,
              }))
            }
            placeholder={teamPlaceholder}
            searchTeams={searchTeams}
            value={form.teamName}
          />
        </FieldShell>

        <OnboardingSelectField
          errorMessage={errors.category}
          helperText={
            form.type === "MULTI_SEASON"
              ? "Puoi cambiarla per singola stagione qui sotto."
              : undefined
          }
          label={categoryLabel}
          onChange={handleCategoryChange}
          options={PLAYER_EXPERIENCE_CATEGORY_OPTIONS}
          placeholder={categoryPlaceholder}
          searchable
          sheetTitle="Categoria"
          testID="experience-category"
          value={form.category}
        />

        {form.type === "MULTI_SEASON" ? (
          <MultiSeasonSelector
            disabledSeasons={occupiedSeasons}
            errorMessage={errors.seasons}
            helperText="Seleziona tutte le stagioni giocate nella stessa squadra."
            onToggle={handleToggleSeason}
            selectedSeasons={form.seasons}
            testID="multi-season-selector"
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
            testID="single-season-select"
            value={form.seasons[0] ?? ""}
          />
        ) : null}

        {form.type === "CUSTOM_PERIOD" ? (
          <>
            {/* §AV: due soli campi, ognuno sceglie mese e anno insieme. */}
            <PeriodField
              endErrorMessage={errors.endDate}
              endLabel="A"
              endPlaceholder="Mese e anno di fine"
              endTestID="custom-period-end"
              endValue={endValue}
              mode="monthYear"
              onEndChange={(value) => {
                const { month, year } = playerPeriodFromDateValue(value);

                handlePeriodChange({ endMonth: month, endYear: year });
              }}
              onStartChange={(value) => {
                const { month, year } = playerPeriodFromDateValue(value);

                handlePeriodChange({ startMonth: month, startYear: year });
              }}
              startErrorMessage={errors.startDate}
              startLabel="Da"
              startPlaceholder="Mese e anno di inizio"
              startTestID="custom-period-start"
              startValue={startValue}
            />

            {errors.period ? <InlineError message={errors.period} /> : null}
          </>
        ) : null}
      </OnboardingSection>

      {detailSeasons.length > 0 ? (
        <OnboardingSection
          description={
            detailSeasons.length > 1
              ? "Completa i dati per ogni stagione selezionata."
              : undefined
          }
          title={
            detailSeasons.length > 1 ? "Statistiche per stagione" : "Statistiche"
          }
        >
          {detailSeasons.length > 1 ? (
            detailSeasons.map((season) => (
              <SeasonStatisticsBlock
                detail={getDetail(season)}
                key={season}
                onChange={(field, value) =>
                  handleDetailChange(season, field, value)
                }
                season={season}
              />
            ))
          ) : (
            <ExperienceStatisticsStepper
              detail={getDetail(detailSeasons[0])}
              onChange={(field, value) =>
                handleDetailChange(detailSeasons[0], field, value)
              }
              testID="experience-stats"
            />
          )}

          {errors.seasonDetails ? (
            <InlineError message={errors.seasonDetails} />
          ) : null}
        </OnboardingSection>
      ) : null}

      <View style={styles.actions}>
        <Button
          fullWidth
          label={isEditing ? "Salva modifiche" : "Salva esperienza"}
          onPress={handleSave}
          size="lg"
          testID="save-experience"
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
  seasonBlock: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: onboardingRadius.card,
    borderWidth: onboardingBorderWidth.hairline,
    gap: onboardingSpacing.m,
    padding: onboardingSpacing.m - 2,
  },
  seasonBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: onboardingRadius.pill,
    paddingHorizontal: onboardingSpacing.s + 2,
    paddingVertical: onboardingSpacing.xs,
  },
  actions: {
    gap: onboardingSpacing.s,
    paddingTop: onboardingSpacing.s,
  },
});
