import { supabase } from "../../lib/supabase";

/**
 * Accesso canonico alle **proprie** candidature (DAS-REV-03 §9, DAS-REV-04
 * §14, §18).
 *
 * DAS-REV-03 leggeva `recruiting_applications` direttamente, con il filtro
 * "attive" espresso come un `in` sugli stati. DAS-REV-04 §6 separa tre
 * concetti che quel filtro confondeva — stato della candidatura,
 * disponibilità della posizione, conclusione della selezione — e Attive /
 * Concluse diventa una **classificazione derivata**, non un elenco di stati.
 *
 * Una classificazione derivata non è esprimibile in PostgREST: né il filtro
 * (serve `application_group()`), né l'ordinamento dello storico (serve la
 * data reale di conclusione, che vive su un evento o sulla posizione). Da qui
 * la RPC, che §18 chiede comunque: «Autorizzare prima di contare, ordinare e
 * applicare il limite» e «Non caricare l'intero dataset per filtrarlo nel
 * client».
 *
 * Il **dettaglio** non vive più qui. DAS-REV-23 §14 vieta di decidere nel
 * client se la posizione accetti ancora candidature — «Non fidarti del
 * timestamp del tap, del clock del dispositivo o di can_apply cached» — e
 * quella era esattamente la riga che questa select calcolava con
 * `Date.now()`. La lettura autorevole è ora
 * `fetchMyApplicationDetail` in `lifecycle/lifecycle-service.ts`.
 */

/** Gruppo della lista. È la classificazione del dominio, non uno stato. */
export type ApplicationGroup = "active" | "completed";

/**
 * Come il dominio spiega la conclusione (§7, §14).
 *
 * `status` — l'esito è già nello stato della candidatura (Accettata,
 * Rifiutata, Ritirata) e va mostrato con la sua label canonica.
 * `selection_completed` — la selezione è finita senza un esito per candidato:
 * vale il generico "Selezione conclusa", che §7 vieta di sostituire con
 * Rifiutata, Scartata o Non selezionato.
 */
export type ApplicationOutcome = "selection_completed" | "status";

export type ApplicationListItem = {
  adId: string;
  category: string | null;
  clubLogoUrl: string | null;
  clubName: string;
  /** Data reale della conclusione. Null = il dominio non la conosce (§14). */
  concludedAt: string | null;
  createdAt: string;
  group: ApplicationGroup;
  id: string;
  /** Evento più recente: è ciò a cui si riferisce l'acknowledgement (§12). */
  lastEventId: string | null;
  /**
   * DAS-REV-23 §19: la data della submission corrente. Dopo una
   * ricandidatura `createdAt` è il **primo** invio storico, e usarlo come
   * data dell'invio sarebbe falso.
   */
  latestSubmittedAt: string | null;
  outcome: ApplicationOutcome | null;
  /** La posizione accetta ancora nuove candidature (§7). */
  positionAccepting: boolean;
  role: string;
  status: string;
  teamName: string | null;
  /** DAS-REV-23 §16: il ritiro ha la propria data, distinta dall'invio. */
  withdrawnAt: string | null;
};

export type ApplicationPage = {
  items: ApplicationListItem[];
  nextCursor: string | null;
};

type RawListItem = {
  ad_id: string;
  category: string | null;
  club_logo_url: string | null;
  club_name: string | null;
  concluded_at: string | null;
  created_at: string;
  group: string;
  id: string;
  last_event_id: string | null;
  latest_submitted_at: string | null;
  outcome: string | null;
  position_accepting: boolean | null;
  role: string;
  status: string;
  team_name: string | null;
  withdrawn_at: string | null;
};

const PAGE_SIZE = 20;

export const APPLICATIONS_PAGE_SIZE = PAGE_SIZE;

export async function fetchMyApplicationsPage(
  group: ApplicationGroup,
  cursor: string | null,
): Promise<ApplicationPage> {
  const { data, error } = await supabase
    .rpc("fetch_my_applications_page", {
      p_cursor: cursor,
      p_group: group,
      p_limit: PAGE_SIZE,
    })
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? {}) as { items: unknown; next_cursor: string | null };
  const items = Array.isArray(row.items) ? (row.items as RawListItem[]) : [];

  return {
    items: items.map(toListItem),
    nextCursor: row.next_cursor ?? null,
  };
}

function toListItem(raw: RawListItem): ApplicationListItem {
  return {
    adId: raw.ad_id,
    category: raw.category,
    clubLogoUrl: raw.club_logo_url,
    clubName: raw.club_name ?? "",
    concludedAt: raw.concluded_at,
    createdAt: raw.created_at,
    group: raw.group === "completed" ? "completed" : "active",
    id: raw.id,
    lastEventId: raw.last_event_id,
    latestSubmittedAt: raw.latest_submitted_at ?? raw.created_at,
    outcome: toOutcome(raw.outcome),
    // In dubbio la posizione accetta: dichiararla chiusa è un'affermazione
    // sul dominio, e §6 vieta di dedurla (§7).
    positionAccepting: raw.position_accepting ?? true,
    role: raw.role,
    status: raw.status,
    teamName: raw.team_name,
    withdrawnAt: raw.withdrawn_at ?? null,
  };
}

function toOutcome(value: string | null): ApplicationOutcome | null {
  return value === "selection_completed" || value === "status" ? value : null;
}
