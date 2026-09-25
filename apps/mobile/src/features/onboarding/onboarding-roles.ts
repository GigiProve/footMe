import type Ionicons from "@expo/vector-icons/Ionicons";

import type { AppRole } from "./create-initial-profile";

/**
 * Le sette macro-voci della prima schermata di onboarding (§U).
 *
 * "Media e appassionati" è una voce sola: un tifoso e un creator scelgono la
 * stessa card e vengono distinti più avanti, nel flusso dedicato. Non esistono
 * due macro-profili separati a questo livello.
 *
 * Le icone evitano simboli ambigui (§T): l'allenatore è una lavagna tattica,
 * non un fischietto.
 */
export type OnboardingRoleValue = AppRole | "community";

export type OnboardingRoleOption = {
  value: OnboardingRoleValue;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const ONBOARDING_ROLE_OPTIONS: OnboardingRoleOption[] = [
  {
    description: "Gioca e sviluppa la tua carriera.",
    icon: "person-outline",
    label: "Calciatore",
    value: "player",
  },
  {
    description: "Allena e guida la tua squadra.",
    icon: "easel-outline",
    label: "Allenatore",
    value: "coach",
  },
  {
    description: "Preparatore, scout e specialisti.",
    icon: "barbell-outline",
    label: "Staff tecnico",
    value: "staff",
  },
  {
    description: "Gestisci e prendi decisioni.",
    icon: "business-outline",
    label: "Dirigente",
    value: "director",
  },
  {
    description: "Rappresenta e supporta talenti.",
    icon: "briefcase-outline",
    label: "Procuratore",
    value: "agent",
  },
  {
    description: "Club, accademie e organizzazioni.",
    icon: "shield-outline",
    label: "Società",
    value: "club_admin",
  },
  {
    description: "Per tifosi, creator, giornalisti e pagine che vivono e raccontano il calcio.",
    icon: "megaphone-outline",
    label: "Media e appassionati",
    value: "community",
  },
];
