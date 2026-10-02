/**
 * Ruoli selezionabili nel "Profilo professionale" del Dirigente
 * (REV-PROF-11, schermata 3).
 *
 * La lista non nasce qui: è `DIRECTOR_CLUB_ROLE_OPTIONS`, la stessa tassonomia
 * che usa l'onboarding e che la gestione carriera legge. Qui si aggiunge
 * soltanto l'icona di ciascuna card, che è una scelta di resa e non un dato.
 *
 * Un ruolo già dichiarato ma non più in tassonomia resta comunque
 * selezionabile: salvare questa schermata non deve cancellare in silenzio una
 * dichiarazione dell'utente solo perché la lista nel frattempo è cambiata.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

import { DIRECTOR_CLUB_ROLE_OPTIONS } from "../../onboarding/director/director-taxonomy";

export type DirectorRoleOption = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

const ROLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  Altro: "ellipsis-horizontal-outline",
  "Direttore generale": "bar-chart-outline",
  "Direttore sportivo": "person-outline",
  "Direttore tecnico": "construct-outline",
  "Dirigente generico": "briefcase-outline",
  Presidente: "ribbon-outline",
  "Responsabile scouting": "binoculars-outline",
  "Responsabile settore giovanile": "school-outline",
  "Segretario generale": "document-text-outline",
  "Team manager": "people-outline",
  Vicepresidente: "star-outline",
};

const FALLBACK_ICON: keyof typeof Ionicons.glyphMap = "ellipse-outline";

export function getDirectorProfileRoleOptions(
  declaredRoles: readonly string[] = [],
): DirectorRoleOption[] {
  const options: DirectorRoleOption[] = DIRECTOR_CLUB_ROLE_OPTIONS.map(
    (option) => ({
      icon: ROLE_ICONS[option.value] ?? FALLBACK_ICON,
      label: option.label,
      value: option.value,
    }),
  );

  for (const declared of declaredRoles) {
    const role = declared?.trim();

    if (role && !options.some((option) => option.value === role)) {
      options.push({ icon: FALLBACK_ICON, label: role, value: role });
    }
  }

  return options;
}
