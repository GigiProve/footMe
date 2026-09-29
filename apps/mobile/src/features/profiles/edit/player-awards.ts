/**
 * Palmarès: tipi, etichette e titolo editoriale.
 *
 * L'enum era dichiarato due volte, identico, nei due editor a modal del
 * Palmarès che REV-PROF-02 ha sostituito. Vive qui una volta sola.
 *
 * `player_palmares.palmares_type` è `text` con default `'trophy'` e nessun
 * vincolo: il backend accetterebbe altro, quindi l'elenco delle scelte è
 * responsabilità del client e non va ampliato senza una decisione di dominio.
 */
import { formatSeasonShort } from "../../onboarding/career/player-career-utils";
import type { PlayerPalmaresRecord } from "../profile-service";

export type PlayerAwardType = "trophy" | "medal" | "top_scorer";

export const PLAYER_AWARD_OPTIONS: readonly {
  icon: "trophy-outline" | "medal-outline" | "football-outline";
  label: string;
  value: PlayerAwardType;
}[] = [
  { icon: "trophy-outline", label: "Trofeo", value: "trophy" },
  { icon: "medal-outline", label: "Medaglia", value: "medal" },
  { icon: "football-outline", label: "Capocannoniere", value: "top_scorer" },
] as const;

export function getAwardIcon(type: string): "trophy-outline" | "medal-outline" | "football-outline" {
  return (
    PLAYER_AWARD_OPTIONS.find((option) => option.value === type)?.icon ??
    "trophy-outline"
  );
}

/**
 * "Capocannoniere Serie B 2023/24".
 *
 * Il titolo si costruisce dai dati strutturati invece di essere un campo a
 * parte: un titolo scrivibile a mano divergerebbe da competizione e stagione
 * alla prima modifica.
 */
export function buildAwardTitle(input: {
  competition_name: string;
  palmares_type: string;
  season_label: string;
}): string {
  const prefix =
    input.palmares_type === "top_scorer"
      ? "Capocannoniere"
      : input.palmares_type === "medal"
        ? "Medaglia"
        : "Vincitore";

  return [prefix, input.competition_name.trim(), formatSeasonShort(input.season_label)]
    .filter((part) => part.length > 0)
    .join(" ");
}

/**
 * Stagione più recente prima, i record senza stagione in fondo: un
 * riconoscimento legacy senza stagione non deve sparire né finire in testa.
 */
export function sortAwardsByRecency(
  awards: readonly PlayerPalmaresRecord[],
): PlayerPalmaresRecord[] {
  return [...awards].sort((a, b) => {
    const left = a.season_label?.trim() ?? "";
    const right = b.season_label?.trim() ?? "";

    if (!left && !right) {
      return 0;
    }

    if (!left) {
      return 1;
    }

    if (!right) {
      return -1;
    }

    return right.localeCompare(left);
  });
}
