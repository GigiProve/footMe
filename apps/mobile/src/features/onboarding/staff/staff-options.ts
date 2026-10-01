/**
 * Tassonomie dello Staff tecnico (REV-ONB-04 §E, §R).
 *
 * Non introduce una seconda lista di ruoli: `STAFF_ROLE_OPTIONS` resta l'unica
 * fonte, condivisa con la ricerca e con il profilo. Qui si espone soltanto la
 * forma `{ label, value: string }` richiesta dai selector del Master, così che
 * aggiungere un ruolo in futuro non tocchi nessuna schermata (§E).
 */
import { STAFF_ROLE_OPTIONS } from "../onboarding-types";

export const STAFF_EXPERIENCE_ROLE_OPTIONS: { label: string; value: string }[] =
  STAFF_ROLE_OPTIONS.map((option) => ({
    label: option.label,
    value: option.value,
  }));

/**
 * Ruoli selezionabili in una singola esperienza (§R).
 *
 * Di norma sono i ruoli dichiarati nello Screen 4; se un'esperienza storica
 * porta un ruolo che l'utente non ha più fra i propri, quel ruolo resta
 * comunque selezionabile e non sparisce dall'elenco.
 */
export function getStaffExperienceRoleOptions(
  declaredRoles: string[],
  historicalRoles: string[] = [],
): { label: string; value: string }[] {
  const declared = declaredRoles.filter(Boolean);
  const preferred = declared.length > 0 ? declared : STAFF_ROLE_OPTIONS.map((o) => o.value);
  const extra = historicalRoles.filter(
    (role) => Boolean(role) && !preferred.includes(role),
  );

  return [...preferred, ...extra].map((role) => ({ label: role, value: role }));
}

/**
 * Ruoli selezionabili in un'esperienza della **gestione carriera**
 * (REV-PROF-07 §"Ruolo Staff tecnico").
 *
 * Differenza voluta rispetto all'onboarding: qui la tassonomia canonica c'è
 * sempre tutta. Il ruolo di una stagione può essere diverso da quelli
 * dichiarati nel profilo — un preparatore atletico che una stagione ha fatto il
 * match analyst deve poterlo registrare senza prima cambiare il proprio
 * profilo, e il profilo non deve cambiare da solo per averlo fatto.
 *
 * I ruoli dichiarati aprono l'elenco perché sono i più probabili, non perché
 * siano gli unici ammessi.
 */
export function getStaffCareerRoleOptions(
  declaredRoles: readonly string[],
  historicalRoles: readonly string[] = [],
): { label: string; value: string }[] {
  const ordered: string[] = [];

  for (const role of [
    ...declaredRoles,
    ...STAFF_ROLE_OPTIONS.map((option) => option.value),
    ...historicalRoles,
  ]) {
    const trimmed = role?.trim();

    if (trimmed && !ordered.includes(trimmed)) {
      ordered.push(trimmed);
    }
  }

  return ordered.map((role) => ({ label: role, value: role }));
}
