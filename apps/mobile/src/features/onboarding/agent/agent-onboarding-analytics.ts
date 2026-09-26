/**
 * Eventi dell'onboarding Procuratore (REV-ONB-06 §BS).
 *
 * Misurano l'avanzamento e la forma del profilo, mai i suoi dati: telefono,
 * numero di licenza, bio e testi liberi non entrano nel payload. Le selezioni
 * viaggiano come token di tassonomia o come conteggio.
 */
import { trackEvent } from "../../../lib/analytics";
import type { AgentPortfolioRange } from "./agent-taxonomy";

export type AgentOnboardingEvent =
  | { name: "onboarding_procurator_started" }
  | { name: "professional_mode_selected"; mode: "independent" | "agency" }
  | { name: "qualification_state_selected"; licensed: boolean }
  | {
      name: "portfolio_range_selected";
      range: Exclude<AgentPortfolioRange, "">;
    }
  | { name: "portfolio_player_linked"; count: number }
  | { name: "activity_scope_selected"; scopes: string }
  | {
      name: "geographic_scope_selected";
      mode: "ITALY" | "REGIONS" | "PROVINCES";
      count: number;
    }
  | { name: "international_scope_selected"; count: number }
  | { name: "previous_roles_selected"; roles: string }
  | { name: "player_career_started" }
  | {
      name: "contact_preferences_completed";
      openToClubs: boolean;
      openToPlayers: boolean;
    }
  | { name: "onboarding_procurator_completed" };

export function trackAgentOnboardingEvent(event: AgentOnboardingEvent) {
  const { name, ...props } = event;

  trackEvent(name, props);
}
