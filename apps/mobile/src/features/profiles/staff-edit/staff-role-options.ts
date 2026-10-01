/**
 * Ruoli selezionabili nel "Profilo professionale" dello Staff tecnico
 * (REV-PROF-08, schermata 3).
 *
 * La lista non nasce qui: è `STAFF_ROLE_OPTIONS`, la stessa tassonomia che usa
 * l'onboarding e che la gestione carriera legge. Qui si aggiunge soltanto
 * l'icona di ciascuna card, che è una scelta di resa e non un dato.
 *
 * Un ruolo già dichiarato ma non più in tassonomia resta comunque
 * selezionabile: salvare questa schermata non deve cancellare in silenzio una
 * dichiarazione dell'utente solo perché la lista nel frattempo è cambiata.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

import { STAFF_ROLE_OPTIONS } from "../../onboarding/onboarding-types";

export type StaffRoleOption = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

const ROLE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  "Collaboratore tecnico": "person-outline",
  Fisioterapista: "medkit-outline",
  "Match analyst": "desktop-outline",
  "Preparatore atletico": "walk-outline",
  "Preparatore dei portieri": "hand-left-outline",
  "Team manager": "people-outline",
};

const FALLBACK_ICON: keyof typeof Ionicons.glyphMap = "ellipse-outline";

export function getStaffProfileRoleOptions(
  declaredRoles: readonly string[] = [],
): StaffRoleOption[] {
  const options: StaffRoleOption[] = STAFF_ROLE_OPTIONS.map((option) => ({
    icon: ROLE_ICONS[option.value] ?? FALLBACK_ICON,
    label: option.label,
    value: option.value,
  }));

  for (const declared of declaredRoles) {
    const role = declared?.trim();

    if (role && !options.some((option) => option.value === role)) {
      options.push({ icon: FALLBACK_ICON, label: role, value: role });
    }
  }

  return options;
}
