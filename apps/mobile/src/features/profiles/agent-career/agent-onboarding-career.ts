/**
 * Ponte fra l'onboarding Procuratore e la carriera canonica (REV-PROF-15).
 *
 * Fino a REV-PROF-13 l'onboarding scriveva l'incarico attuale in tre colonne di
 * `agent_profiles` e le esperienze precedenti in `agent_career_entries`: due
 * posti per lo stesso fatto. Da qui in avanti l'onboarding scrive una carriera
 * sola — la stessa che la Gestione carriera legge e modifica — e le colonne
 * legacy restano scritte per sola compatibilità in lettura.
 *
 * Due regole che valgono soprattutto qui:
 *
 *  * **Nessun mese inventato.** L'onboarding chiede solo l'anno di inizio e gli
 *    anni delle esperienze precedenti. Le righe nascono quindi con precisione
 *    annuale: niente gennaio di comodo, e il mese verrà chiesto al primo
 *    salvataggio che riscrive quel periodo.
 *  * **Un id stabile per organizzazione, non per riga.** Due esperienze
 *    precedenti nella stessa agenzia condividono il riferimento manuale e
 *    quindi il gruppo. Il raggruppamento non avviene mai per somiglianza di
 *    nome a valle: avviene per l'id deciso qui.
 */
import {
  createLocalUuid,
  type AgentCareerEntryDraft,
  type AgentCareerEntryInput,
} from "../agent-profile";

type BuildInput = {
  agencyLogoUrl: string;
  agencyName: string;
  agencyRole: string;
  agencyStartYear: number | null;
  previousEntries: readonly AgentCareerEntryDraft[];
  /** "independent" | "agency" | "" — vedi REV-ONB-06 §H. */
  professionalMode: string;
  profileId: string;
};

export function buildAgentOnboardingCareerEntries({
  agencyLogoUrl,
  agencyName,
  agencyRole,
  agencyStartYear,
  previousEntries,
  professionalMode,
  profileId,
}: BuildInput): AgentCareerEntryInput[] {
  const entries: AgentCareerEntryInput[] = [];
  /*
    Id del riferimento manuale, uno per nome normalizzato dentro QUESTO
    salvataggio. La mappa è locale di proposito: la stessa agenzia ripetuta qui
    condivide il gruppo, mentre due salvataggi diversi non si riconciliano da
    soli — quella è una procedura esplicita, non l'effetto collaterale di una
    somiglianza di nome.
  */
  const organizationIds = new Map<string, string>();

  function organizationIdFor(name: string): string {
    const key = name.trim().toLowerCase();
    const existing = organizationIds.get(key);

    if (existing) {
      return existing;
    }

    const created = createLocalUuid();

    organizationIds.set(key, created);

    return created;
  }

  const isIndependent = professionalMode === "independent";
  const currentName = agencyName.trim();
  const role = agencyRole.trim() || "Procuratore";

  /*
    Un indipendente ha un incarico anche senza nome: è il nome a non esserci,
    non l'esperienza. Un'agenzia senza nome invece non è un'esperienza, è un
    campo vuoto, e non deve generare un record fittizio.
  */
  if (isIndependent || currentName) {
    entries.push({
      agency_logo_url: isIndependent ? null : agencyLogoUrl.trim() || null,
      agency_name: isIndependent ? null : currentName,
      agent_profile_id: profileId,
      id: createLocalUuid(),
      is_current: true,
      // Primo incarico del profilo: è anche quello che l'header mostra.
      is_primary: true,
      manual_organization_id: isIndependent
        ? null
        : organizationIdFor(currentName),
      organization_mode: isIndependent ? "independent" : "agency",
      period_end_month: null,
      period_end_year: null,
      period_start_month: null,
      period_start_precision: "year",
      period_start_year: agencyStartYear,
      role,
      sort_order: 0,
    });
  }

  for (const entry of previousEntries) {
    const name = entry.agency_name.trim();

    if (!name) {
      continue;
    }

    entries.push({
      agency_logo_url: entry.agency_logo_url,
      agency_name: name,
      agent_profile_id: profileId,
      id: entry.id,
      // Un'esperienza precedente è conclusa quando porta un anno di fine. Senza
      // quell'anno resta aperta, invece di nascere con una fine inventata.
      is_current: entry.period_end_year == null,
      is_primary: false,
      manual_organization_id: organizationIdFor(name),
      organization_mode: "agency",
      period_end_month: null,
      period_end_precision: "year",
      period_end_year: entry.period_end_year,
      period_start_month: null,
      period_start_precision: "year",
      period_start_year: entry.period_start_year,
      role: entry.role.trim() || "Procuratore",
      sort_order: entries.length,
    });
  }

  return entries;
}
