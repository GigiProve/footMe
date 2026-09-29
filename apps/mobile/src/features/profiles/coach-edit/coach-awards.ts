/**
 * Palmarès dell'Allenatore (REV-PROF-05, schermate 6 e 7).
 *
 * Modulo puro: tipi, titolo editoriale, ordinamento e riconoscimento dei
 * duplicati. Nessuna rete, nessun componente — sono le regole che vale la pena
 * provare senza montare una schermata.
 *
 * Il titolo non è un campo: si compone da tipo, competizione e stagione. Un
 * titolo scrivibile a mano divergerebbe dagli altri campi alla prima modifica,
 * ed è esattamente quello che faceva la vecchia modale del palmarès.
 */
import type { ComponentProps } from "react";
import type Ionicons from "@expo/vector-icons/Ionicons";

import { formatSeasonShort } from "../../onboarding/career/player-career-utils";
import type { CoachAchievementRecord } from "../profile-service";

export type CoachAwardType = CoachAchievementRecord["achievement_type"];

/**
 * I quattro tipi offerti dall'editor.
 *
 * `playoff` e `altro` non compaiono: non fanno parte della tassonomia
 * approvata, ma restano leggibili perché esistono già sul database e un
 * riconoscimento salvato prima non deve sparire dal profilo.
 */
export const COACH_AWARD_OPTIONS: readonly {
  /** Etichetta del campo "Competizione", che cambia col tipo scelto. */
  competitionLabel: string;
  competitionPlaceholder: string;
  label: string;
  /** Parola che apre il titolo: "Vincitore campionato Eccellenza 2023/24". */
  titlePrefix: string;
  value: CoachAwardType;
}[] = [
  {
    competitionLabel: "Competizione",
    competitionPlaceholder: "Es. Eccellenza girone B",
    label: "Campionato",
    titlePrefix: "Vincitore campionato",
    value: "campionato",
  },
  {
    competitionLabel: "Competizione",
    competitionPlaceholder: "Es. Coppa Italia Dilettanti",
    label: "Coppa",
    titlePrefix: "Vittoria",
    value: "coppa",
  },
  {
    competitionLabel: "Competizione",
    competitionPlaceholder: "Es. Promozione",
    label: "Promozione",
    titlePrefix: "Promozione",
    value: "promozione",
  },
  {
    // Un premio individuale non ha una competizione: ha un nome.
    competitionLabel: "Premio",
    competitionPlaceholder: "Es. Allenatore dell'anno",
    label: "Premio personale",
    titlePrefix: "Premio",
    value: "premio_personale",
  },
] as const;

/**
 * Icone per tipo. Sono le stesse del Master Profile Allenatore: lo stesso
 * riconoscimento non può avere due icone diverse a seconda della schermata.
 */
const AWARD_ICONS: Record<
  CoachAwardType,
  ComponentProps<typeof Ionicons>["name"]
> = {
  altro: "ribbon-outline",
  campionato: "trophy-outline",
  coppa: "shield-outline",
  playoff: "star-outline",
  premio_personale: "medal-outline",
  promozione: "arrow-up-circle-outline",
};

export function getCoachAwardIcon(
  type: string,
): ComponentProps<typeof Ionicons>["name"] {
  return AWARD_ICONS[type as CoachAwardType] ?? "ribbon-outline";
}

export function getCoachAwardTypeLabel(type: string): string {
  return (
    COACH_AWARD_OPTIONS.find((option) => option.value === type)?.label ??
    "Riconoscimento"
  );
}

export function getCoachAwardTypeMeta(type: CoachAwardType) {
  return (
    COACH_AWARD_OPTIONS.find((option) => option.value === type) ??
    COACH_AWARD_OPTIONS[0]
  );
}

/**
 * "Vincitore campionato Eccellenza 2023/24".
 *
 * La stagione è resa nella forma breve del prodotto: sul database resta la
 * chiave canonica "2023/2024", a schermo si legge "2023/24".
 */
export function buildCoachAwardTitle(input: {
  achievement_type: string;
  competition_name: string | null;
  season_label: string | null;
}): string {
  const prefix =
    COACH_AWARD_OPTIONS.find((option) => option.value === input.achievement_type)
      ?.titlePrefix ?? "";
  const competition = input.competition_name?.trim() ?? "";
  const season = input.season_label?.trim()
    ? formatSeasonShort(input.season_label.trim())
    : "";

  return [prefix, competition, season].filter((part) => part.length > 0).join(" ");
}

function normalizeKeyPart(value: string | null | undefined): string {
  return (value ?? "").trim().toLocaleLowerCase("it-IT");
}

/**
 * Chiave di un duplicato esatto: stesso tipo, stessa competizione, stessa
 * stagione, stessa società.
 *
 * Due riconoscimenti diversi ottenuti nella stessa stagione hanno chiavi
 * diverse e non si bloccano a vicenda — è il caso normale di chi vince
 * campionato e coppa nello stesso anno.
 */
export function buildCoachAwardKey(input: {
  achievement_type: string;
  club_name: string | null;
  competition_name: string | null;
  season_label: string | null;
}): string {
  return [
    normalizeKeyPart(input.achievement_type),
    normalizeKeyPart(input.competition_name),
    normalizeKeyPart(input.season_label),
    normalizeKeyPart(input.club_name),
  ].join("|");
}

export function isDuplicateCoachAward(
  candidate: Parameters<typeof buildCoachAwardKey>[0] & { id?: string },
  existing: readonly CoachAchievementRecord[],
): boolean {
  const key = buildCoachAwardKey(candidate);

  return existing.some(
    (record) => record.id !== candidate.id && buildCoachAwardKey(record) === key,
  );
}

/**
 * Stagione più recente prima; a parità, il riconoscimento creato più di
 * recente. I record senza stagione restano in fondo invece di sparire o di
 * finire in testa.
 */
export function sortCoachAwards(
  awards: readonly CoachAchievementRecord[],
): CoachAchievementRecord[] {
  return [...awards].sort((left, right) => {
    const leftSeason = left.season_label?.trim() ?? "";
    const rightSeason = right.season_label?.trim() ?? "";

    if (leftSeason !== rightSeason) {
      if (!leftSeason) {
        return 1;
      }

      if (!rightSeason) {
        return -1;
      }

      return rightSeason.localeCompare(leftSeason);
    }

    return (right.created_at ?? "").localeCompare(left.created_at ?? "");
  });
}
