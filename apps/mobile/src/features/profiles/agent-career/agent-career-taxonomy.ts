/**
 * Tassonomia dei ruoli della carriera da procuratore (REV-PROF-15 §"Ruoli").
 *
 * Un posto solo. Le schermate non contengono stringhe di ruolo: ogni incarico
 * ha il proprio ruolo preso da qui, con un id stabile e un'etichetta
 * localizzata, così un ruolo storico non cambia nome perché una schermata è
 * stata riscritta.
 *
 * Il valore coincide con l'etichetta perché la colonna `role` è testuale dal
 * primo giorno e contiene già i valori scritti dall'onboarding: introdurre
 * adesso un codice separato avrebbe reso illeggibili le righe esistenti senza
 * aggiungere niente.
 */

export const AGENT_CAREER_ROLE_VALUES = [
  "Titolare",
  "Fondatore",
  "Partner",
  "Procuratore sportivo",
  "Agente",
  "Collaboratore",
  "Intermediario",
  "Consulente",
] as const;

export type AgentCareerRole = (typeof AGENT_CAREER_ROLE_VALUES)[number];

export const AGENT_CAREER_ROLE_OPTIONS: { label: string; value: string }[] =
  AGENT_CAREER_ROLE_VALUES.map((value) => ({ label: value, value }));

/**
 * Elenco mostrato dal selettore: la tassonomia più gli eventuali ruoli storici
 * già presenti in carriera.
 *
 * Un procuratore che anni fa aveva scritto un ruolo oggi non più in elenco non
 * deve vederlo sparire aprendo la modifica: la voce resta selezionabile finché
 * è usata da almeno un incarico.
 */
export function getAgentCareerRoleOptions(
  historicalRoles: readonly string[] = [],
): { label: string; value: string }[] {
  const known = new Set<string>(AGENT_CAREER_ROLE_VALUES);
  const extra = [
    ...new Set(
      historicalRoles
        .map((role) => role.trim())
        .filter((role) => role.length > 0 && !known.has(role)),
    ),
  ].sort((left, right) => left.localeCompare(right, "it"));

  return [
    ...AGENT_CAREER_ROLE_OPTIONS,
    ...extra.map((value) => ({ label: value, value })),
  ];
}
