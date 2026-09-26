/**
 * Onboarding Procuratore (REV-ONB-06).
 *
 * Il profilo resta l'identity `agent` del modello dati — l'enum legacy non
 * cambia (§B) — ma in superficie esiste soltanto "Procuratore".
 */
export { AgentOnboardingFlow, isAgentMasterStep } from "./AgentOnboardingFlow";
export { trackAgentOnboardingEvent } from "./agent-onboarding-analytics";
export {
  AGENT_PREVIOUS_ROLE_OPTIONS,
  buildAgentPreviousRolesPatch,
  getNextAgentStepAfterPreviousRoles,
  readAgentPreviousRoles,
  toggleAgentPreviousRole,
  type AgentPreviousRole,
} from "./agent-previous-roles";
export {
  AGENT_ACTIVITY_SCOPE_OPTIONS,
  AGENT_PORTFOLIO_RANGE_OPTIONS,
  AGENT_PROFESSIONAL_MODE_OPTIONS,
  fromLegacyManagedPlayersCount,
  toLegacyManagedPlayersCount,
  type AgentActivityScope,
  type AgentPortfolioRange,
  type AgentProfessionalMode,
} from "./agent-taxonomy";
