/**
 * Eventi dell'onboarding Società (REV-ONB-05 §BG).
 *
 * Misurano l'avanzamento del flusso e la forma del club, mai i suoi dati:
 * nessun nome, recapito, indirizzo o testo libero entra nel payload. Le
 * categorie viaggiano come conteggio, la struttura come tassonomia chiusa.
 */
import { trackEvent } from "../../../lib/analytics";
import type { ClubStructure } from "./club-structure";

export type ClubOnboardingEvent =
  | { name: "onboarding_society_started" }
  | { name: "society_referent_completed" }
  | { name: "society_identity_completed"; colorCount: number }
  | { name: "society_structure_selected"; structure: Exclude<ClubStructure, ""> }
  | { name: "first_team_category_selected"; category: string }
  | { name: "youth_categories_selected"; count: number }
  | { name: "society_contacts_completed" }
  | { name: "society_optional_profile_completed"; channelCount: number }
  | { name: "onboarding_society_completed"; structure: Exclude<ClubStructure, ""> };

export function trackClubOnboardingEvent(event: ClubOnboardingEvent) {
  const { name, ...props } = event;

  trackEvent(name, props);
}
