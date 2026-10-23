/**
 * I campi di dettaglio di uno schema Position, con i loro selector
 * (DAS-REV-16 §11-§20; DAS-REV-17 §11, §20).
 *
 * Esiste come componente e non come blocco dentro una schermata perché due
 * superfici lo montano: lo step 2 del composer e l'editor di una Position
 * già persistita. DAS-REV-17 §20 lo chiede per lettera — «Il form attivo
 * utilizza lo stesso schema di dettaglio della bozza e lo stesso ordine dei
 * campi, con whitelist diversa per lifecycle» — e §8 vieta di «duplicare
 * tassonomie o obbligatorietà».
 *
 * Il componente possiede i propri sheet e non il proprio valore: chi lo
 * monta tiene il buffer, decide cosa sia una modifica e quando salvare. È
 * ciò che permette alla stessa UI di produrre una patch di bozza o una
 * patch ristretta di Position attiva senza saperlo.
 *
 * Quali campi mostrare lo decide `fields`, non il componente: una whitelist
 * si applica togliendo righe dall'elenco, non aggiungendo un `if` qui
 * dentro.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { spacing } from "../../../../../theme/tokens";
import { AppText, Button } from "../../../../../ui";
import {
  PLAYER_EXPERIENCE_LABELS,
  PLAYER_SITUATION_LABELS,
  SOCIETY_DESCRIPTION_PLACEHOLDER,
  type PositionField,
} from "../compose-schema";
import {
  ageSummary,
  availabilitySummary,
  experienceSummary,
  listNames,
  playerExperienceSummary,
  secondaryTeamsHelper,
} from "../compose-presentation";
import type {
  PositionCatalogs,
  PositionDetailsForm,
  PositionEligibleTeam,
  PositionLimits,
  PositionPlayerSituation,
  PositionProfileType,
  PositionScope,
} from "../compose-types";
import { AgeRangeSheet, type AgeRangeValue } from "./AgeRangeSheet";
import { AvailabilitySheet } from "./AvailabilitySheet";
import { ComposerFieldRow } from "./ComposerFieldRow";
import { ComposerOptionSheet } from "./ComposerOptionSheet";
import { ComposerTextField } from "./ComposerTextField";

type Props = {
  catalogs: PositionCatalogs | null;
  /** Il contesto sportivo dell'incarico, non quello dell'actor. */
  context: {
    contextLabel: string | null;
    primaryTeamId: string | null;
    primaryTeamName: string | null;
    profileType: PositionProfileType;
    scope: PositionScope;
  };
  errors: Record<string, string | null>;
  fields: readonly PositionField[];
  limits: PositionLimits;
  onChange: (patch: Partial<PositionDetailsForm>) => void;
  /**
   * DAS-REV-17 §6: «Dettaglio bozza → singolo elemento mancante: stesso
   * editor, sul campo pertinente.» Il chiamante registra la posizione di
   * ogni campo e ci porta lo scroll; il componente non conosce la
   * ScrollView che lo contiene.
   */
  onLayoutField?: (key: string, y: number) => void;
  teams: readonly PositionEligibleTeam[];
  value: PositionDetailsForm;
};

export function PositionSchemaFields({
  catalogs,
  context,
  errors,
  fields,
  limits,
  onChange,
  onLayoutField,
  teams,
  value,
}: Props) {
  const [ageSheetVisible, setAgeSheetVisible] = useState(false);
  const [availabilitySheetVisible, setAvailabilitySheetVisible] = useState(false);
  const [playerExperienceSheetVisible, setPlayerExperienceSheetVisible] = useState(false);
  const [playerExperienceCategoryVisible, setPlayerExperienceCategoryVisible] = useState(false);
  const [playerSituationSheetVisible, setPlayerSituationSheetVisible] = useState(false);
  const [coachQualificationSheetVisible, setCoachQualificationSheetVisible] = useState(false);
  const [experienceSheetVisible, setExperienceSheetVisible] = useState(false);
  const [experienceDraftSelection, setExperienceDraftSelection] = useState<string[]>([]);
  const [secondaryTeamsSheetVisible, setSecondaryTeamsSheetVisible] = useState(false);
  const [secondaryTeamsDraftSelection, setSecondaryTeamsDraftSelection] = useState<string[]>([]);

  function handleAgeConfirm(next: AgeRangeValue) {
    if (next.mode === "unrestricted") {
      onChange({ ageMax: "", ageMin: "", ageMode: "unrestricted" });
    } else {
      onChange({ ageMax: next.max, ageMin: next.min, ageMode: "range" });
    }

    setAgeSheetVisible(false);
  }

  function handlePlayerExperienceOption(id: string) {
    if (id === "none") {
      onChange({ playerExperience: null });
      setPlayerExperienceSheetVisible(false);

      return;
    }

    if (id === "from_category") {
      /* §14: la scelta «da categoria» non si applica da sola, serve il
         secondo livello col catalogo categorie. */
      setPlayerExperienceSheetVisible(false);
      setPlayerExperienceCategoryVisible(true);

      return;
    }

    onChange({
      playerExperience: { mode: id as "higher_categories" | "in_category" },
    });
    setPlayerExperienceSheetVisible(false);
  }

  const secondaryNames = secondaryTeamNames(value.secondaryTeamIds, teams);

  const secondaryOptions = teams
    .filter((team) => team.teamId !== context.primaryTeamId && team.canCreate)
    .map((team) => ({ id: team.teamId, label: team.teamName }));

  const playerExperienceSelected = !value.playerExperience
    ? ["none"]
    : value.playerExperience.mode === "from_category"
      ? ["from_category"]
      : [value.playerExperience.mode];

  const playerExperienceOptions = [
    ...Object.entries(PLAYER_EXPERIENCE_LABELS).map(([id, label]) => ({ id, label })),
    { id: "none", label: "Nessuna preferenza" },
  ];

  const playerSituationOptions = [
    ...Object.entries(PLAYER_SITUATION_LABELS).map(([id, label]) => ({ id, label })),
    { id: "none", label: "Nessuna preferenza" },
  ];

  const qualificationOptions = [
    ...(catalogs?.qualifications ?? []).map((item) => ({ id: item.id, label: item.label })),
    { id: "none", label: "Nessuna preferenza" },
  ];

  /* §17: un incarico SOCIETY non ha una categoria di riferimento, quindi le
     opzioni di esperienza che la richiedono non hanno senso. */
  const experienceOptions = (catalogs?.experiences ?? [])
    .filter((item) => context.scope !== "society" || !item.needsContext)
    .map((item) => ({ id: item.id, label: item.label }));

  const ageRangeValid =
    value.ageMode === "range" &&
    value.ageMin !== "" &&
    value.ageMax !== "" &&
    Number(value.ageMin) <= Number(value.ageMax);

  return (
    <View style={styles.block}>
      {fields.map((field) => (
        <View
          key={field.key}
          onLayout={(event) =>
            onLayoutField?.(field.key, event.nativeEvent.layout.y)
          }
        >
          {renderField(field)}
        </View>
      ))}

      <AgeRangeSheet
        initial={
          value.ageMode === "unrestricted"
            ? { mode: "unrestricted" }
            : value.ageMode === "range"
              ? { max: value.ageMax, min: value.ageMin, mode: "range" }
              : null
        }
        limits={limits}
        onClose={() => setAgeSheetVisible(false)}
        onConfirm={handleAgeConfirm}
        visible={ageSheetVisible}
      />

      <AvailabilitySheet
        initial={value.availability}
        onClose={() => setAvailabilitySheetVisible(false)}
        onConfirm={(next) => {
          onChange({ availability: next });
          setAvailabilitySheetVisible(false);
        }}
        seasons={catalogs?.seasons ?? []}
        visible={availabilitySheetVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna opzione disponibile."
        onClose={() => setPlayerExperienceSheetVisible(false)}
        onToggle={handlePlayerExperienceOption}
        options={playerExperienceOptions}
        selected={playerExperienceSelected}
        title="Esperienza richiesta"
        visible={playerExperienceSheetVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna categoria disponibile."
        onClose={() => setPlayerExperienceCategoryVisible(false)}
        onToggle={(levelId) => {
          onChange({ playerExperience: { levelId, mode: "from_category" } });
          setPlayerExperienceCategoryVisible(false);
        }}
        options={(catalogs?.categories ?? []).map((item) => ({
          id: item.id,
          label: item.label,
        }))}
        selected={
          value.playerExperience?.mode === "from_category" &&
          value.playerExperience.levelId
            ? [value.playerExperience.levelId]
            : []
        }
        title="Esperienza richiesta"
        visible={playerExperienceCategoryVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna opzione disponibile."
        onClose={() => setPlayerSituationSheetVisible(false)}
        onToggle={(id) => {
          onChange({
            playerSituation:
              id === "none" ? null : (id as PositionPlayerSituation),
          });
          setPlayerSituationSheetVisible(false);
        }}
        options={playerSituationOptions}
        selected={value.playerSituation ? [value.playerSituation] : ["none"]}
        title="Situazione del calciatore"
        visible={playerSituationSheetVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna qualifica disponibile."
        onClose={() => setCoachQualificationSheetVisible(false)}
        onToggle={(id) => {
          onChange({ coachQualificationId: id === "none" ? null : id });
          setCoachQualificationSheetVisible(false);
        }}
        options={qualificationOptions}
        selected={
          value.coachQualificationId ? [value.coachQualificationId] : ["none"]
        }
        title="Patentino / qualifica richiesta"
        visible={coachQualificationSheetVisible}
      />

      <ComposerOptionSheet
        emptyMessage="Nessuna esperienza disponibile."
        multiple
        onClose={() => setExperienceSheetVisible(false)}
        onConfirm={() => {
          onChange({ experience: experienceDraftSelection });
          setExperienceSheetVisible(false);
        }}
        onToggle={(id) =>
          setExperienceDraftSelection((prev) =>
            prev.includes(id)
              ? prev.filter((entry) => entry !== id)
              : [...prev, id],
          )
        }
        options={experienceOptions}
        selected={experienceDraftSelection}
        title="Esperienza richiesta"
        visible={experienceSheetVisible}
      />

      <ComposerOptionSheet
        contextLabel="Squadra principale"
        contextValue={context.primaryTeamName}
        emptyMessage="Nessun'altra squadra disponibile."
        helper={
          context.profileType === "coach"
            ? "Seleziona altre squadre solo se lo stesso allenatore seguirà anche queste squadre."
            : "Seleziona altre squadre solo se la stessa persona seguirà anche queste squadre."
        }
        multiple
        onClose={() => setSecondaryTeamsSheetVisible(false)}
        onConfirm={() => {
          onChange({ secondaryTeamIds: secondaryTeamsDraftSelection });
          setSecondaryTeamsSheetVisible(false);
        }}
        onToggle={(id) =>
          setSecondaryTeamsDraftSelection((prev) =>
            prev.includes(id)
              ? prev.filter((entry) => entry !== id)
              : [...prev, id],
          )
        }
        options={secondaryOptions}
        selected={secondaryTeamsDraftSelection}
        title="Altre squadre coinvolte nell'incarico"
        visible={secondaryTeamsSheetVisible}
      />
    </View>
  );

  function renderField(field: PositionField) {
    switch (field.kind) {
      case "ageRange":
        return (
          <View>
            <ComposerFieldRow
              error={errors.ageRange}
              label={field.label}
              onPress={() => setAgeSheetVisible(true)}
              optional={false}
              testID="position-field-ageRange"
              value={ageSummary({
                ageMax: value.ageMax === "" ? null : Number(value.ageMax),
                ageMin: value.ageMin === "" ? null : Number(value.ageMin),
                ageMode: value.ageMode,
              })}
            />

            {ageRangeValid && context.contextLabel ? (
              <AppText color="neutralMuted" variant="meta">
                {`Questa fascia d'età potrebbe non essere compatibile con ${context.contextLabel}. Verifica le regole della competizione.`}
              </AppText>
            ) : null}
          </View>
        );

      case "availability":
        return (
          <ComposerFieldRow
            label={field.label}
            onPress={() => setAvailabilitySheetVisible(true)}
            optional
            testID="position-field-availability"
            value={availabilitySummary(
              value.availability ?? undefined,
              catalogs?.seasons ?? [],
            )}
          />
        );

      case "playerExperience":
        return (
          <ComposerFieldRow
            label={field.label}
            onPress={() => setPlayerExperienceSheetVisible(true)}
            optional
            testID="position-field-playerExperience"
            value={playerExperienceSummary(
              value.playerExperience ?? undefined,
              catalogs?.categories ?? [],
            )}
          />
        );

      case "playerSituation":
        return (
          <ComposerFieldRow
            label={field.label}
            onPress={() => setPlayerSituationSheetVisible(true)}
            optional
            testID="position-field-playerSituation"
            value={
              value.playerSituation
                ? (PLAYER_SITUATION_LABELS[value.playerSituation] ?? null)
                : null
            }
          />
        );

      case "coachQualification":
        return (
          <ComposerFieldRow
            label={field.label}
            onPress={() => setCoachQualificationSheetVisible(true)}
            optional
            testID="position-field-coachQualificationId"
            value={
              catalogs?.qualifications.find(
                (item) => item.id === value.coachQualificationId,
              )?.label ?? null
            }
          />
        );

      case "experienceMulti":
        return (
          <ComposerFieldRow
            label={field.label}
            onPress={() => {
              setExperienceDraftSelection(value.experience);
              setExperienceSheetVisible(true);
            }}
            optional
            testID="position-field-experience"
            value={experienceSummary(
              value.experience,
              catalogs?.experiences ?? [],
            )}
          />
        );

      case "secondaryTeams":
        return (
          <ComposerFieldRow
            helper={secondaryTeamsHelper(context.profileType, secondaryNames)}
            label={field.label}
            onPress={() => {
              setSecondaryTeamsDraftSelection(value.secondaryTeamIds);
              setSecondaryTeamsSheetVisible(true);
            }}
            optional
            testID="position-field-secondaryTeams"
            value={secondaryNames.length > 0 ? listNames(secondaryNames) : null}
          />
        );

      default: {
        const text = (value as unknown as Record<string, string>)[field.key] ?? "";
        const placeholder =
          field.key === "description" && context.scope === "society"
            ? SOCIETY_DESCRIPTION_PLACEHOLDER
            : field.placeholder;

        return (
          <ComposerTextField
            error={errors[field.key]}
            label={field.label}
            limit={field.limitKey ? limits[field.limitKey] : 0}
            multiline={field.kind === "longText"}
            onChangeText={(next: string) =>
              onChange({ [field.key]: next } as Partial<PositionDetailsForm>)
            }
            optional={field.optional}
            placeholder={placeholder}
            testID={`position-field-${field.key}`}
            value={text}
          />
        );
      }
    }
  }
}

/**
 * I nomi delle secondarie.
 *
 * Il fallback sulle sole squadre eleggibili non basta: una secondaria
 * disattivata non compare in quell'elenco, e §27 vieta di «usare una lista
 * di opzioni vuota come prova che le relazioni sono state rimosse». Chi
 * monta il componente passa quindi anche le squadre già collegate.
 */
function secondaryTeamNames(
  ids: readonly string[],
  teams: readonly PositionEligibleTeam[],
): string[] {
  return ids
    .map((id) => teams.find((team) => team.teamId === id)?.teamName)
    .filter((name): name is string => !!name);
}

/** Riesportato perché l'errore di caricamento cataloghi è del chiamante. */
export function PositionSchemaFieldsError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View style={styles.errorBlock}>
      <AppText color="neutral" variant="bodySm">
        {message}
      </AppText>

      <Button label="Riprova" onPress={onRetry} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing[16],
  },
  errorBlock: {
    gap: spacing[12],
    paddingVertical: spacing[16],
  },
});
