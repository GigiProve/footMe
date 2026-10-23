/**
 * Presentazione dell'hub Struttura societaria (DAS-REV-12).
 *
 * Funzioni pure, fuori dal componente: le regole che la task verifica —
 * quali domini compaiono, come si legge ogni summary, dove porta ogni azione
 * — si controllano senza montare la pagina, e restano leggibili accanto al
 * paragrafo che le impone.
 *
 * Nessuna di queste funzioni interroga il backend, e nessuna converte un
 * `null` in zero: §15 tiene separati «dato assente per permission, dato non
 * caricato e dato fallito».
 */

import type Ionicons from "@expo/vector-icons/Ionicons";

import type { DashboardIdentity } from "../dashboard-types";
import { isFeatureAvailable } from "../modules/dashboard-features";
import type {
  SocietyStructure,
  StructureDomain,
  StructureSignal,
} from "./structure-types";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Destinazioni canoniche dell'hub (§14).
 *
 * Un posto solo, perché l'hub, la Dashboard e i segnali non possano
 * divergere. Ogni valore è una route reale del progetto: §2 vieta «chevron
 * verso pagine inesistenti o funzioni simulate».
 */
export const STRUCTURE_HREFS = {
  /**
   * Centro Amministratori (DAS-REV-13 §6).
   *
   * `from=structure` conserva l'origine: §24 vuole che il back torni «stesso
   * hub, Society e posizione di scorrimento quando validi», e non alla
   * Dashboard solo perché è l'altro ingresso allo stesso centro.
   */
  admins: "/(tabs)/dashboard/admins?from=structure",
  /** Modifica profilo **della Società**, non della persona autenticata. */
  companyEdit: (clubId: string) =>
    `/profile/society-edit?clubId=${encodeURIComponent(clubId)}`,
  /** Centro unico Rete societaria: una sola pagina per tutto il dominio. */
  network: "/(tabs)/dashboard/network",
  /** Rete societaria aperta sulla tab Richieste (gruppo di richieste). */
  networkRequests: "/(tabs)/dashboard/network?focus=requests",
  /** Hub stesso: ingresso dalla Dashboard. */
  self: "/(tabs)/dashboard/structure",
  /** Centro Stagioni e storico. */
  seasons: "/(tabs)/dashboard/seasons",
  /** Revisione di una richiesta ricevuta. */
  requestReview: (clubId: string, relationshipId: string) =>
    `/society-link/review?clubId=${encodeURIComponent(clubId)}&relationshipId=${encodeURIComponent(relationshipId)}`,
  /** Centro Squadre. */
  teams: "/(tabs)/dashboard/teams",
  /** Prepara o configura la stagione di una squadra. */
  teamSeason: (teamId: string, target: "current" | "next") =>
    `/team-seasons/config?teamId=${encodeURIComponent(teamId)}&target=${target}`,
} as const;

/** Plurale minimo, senza concatenazioni fragili. */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Riepilogo di "Squadre del club" (§8, §19).
 *
 * Lo scope non cambia il conteggio: cambia la **frase**. «Con scope limitato
 * usa una formulazione che non suggerisca un totale globale», perché "1
 * squadra attiva" letto da chi vede solo la Primavera direbbe che il club ne
 * ha una sola.
 *
 * `null` non produce testo: significa che il totale non è leggibile, e §8
 * vieta di scriverlo a zero.
 */
export function teamsSummary(
  count: number | null,
  isScoped: boolean,
): string | null {
  if (count === null) {
    return null;
  }

  if (isScoped) {
    return count === 0
      ? "Nessuna squadra disponibile nel tuo ambito"
      : `${count} ${plural(count, "squadra", "squadre")} nel tuo ambito`;
  }

  return count === 0
    ? "Nessuna squadra attiva"
    : `${count} ${plural(count, "squadra attiva", "squadre attive")}`;
}

/**
 * Riepilogo di "Società collegate" (§10, §19).
 *
 * Due valori **distinti**: relazioni attive e richieste ancora in attesa.
 * Ciascuno compare solo se leggibile, e la parte pending sparisce quando vale
 * zero — «Ometti la parte pending se vale zero».
 *
 * Le richieste sono la somma di ricevute e inviate: entrambe sono "in
 * attesa" per la Società, e una sola delle due può essere valutata da qui
 * (per quella esiste il segnale di §13, non questo numero).
 */
export function networkSummary(
  activeCount: number | null,
  pendingCount: number | null,
): string | null {
  const parts: string[] = [];

  if (activeCount !== null) {
    parts.push(
      activeCount === 0
        ? "Nessun collegamento attivo"
        : `${activeCount} ${plural(activeCount, "collegamento attivo", "collegamenti attivi")}`,
    );
  }

  if (pendingCount !== null && pendingCount > 0) {
    parts.push(
      `${pendingCount} ${plural(pendingCount, "richiesta in attesa", "richieste in attesa")}`,
    );
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Riepilogo di "Amministrazione e accessi" (§11, §19).
 *
 * «Non mostrare 0 inviti in attesa.» Un invito pending è un'informazione;
 * la sua assenza non lo è.
 */
export function adminsSummary(
  adminsCount: number | null,
  invitesCount: number | null,
): string | null {
  const parts: string[] = [];

  if (adminsCount !== null) {
    parts.push(
      `${adminsCount} ${plural(adminsCount, "amministratore", "amministratori")}`,
    );
  }

  if (invitesCount !== null && invitesCount > 0) {
    parts.push(
      `${invitesCount} ${plural(invitesCount, "invito in attesa", "inviti in attesa")}`,
    );
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Destinazione di un segnale strutturale (§13, §14).
 *
 * Il `kind` è un identificativo chiuso risolto qui in una route reale. Un
 * segnale che non corrisponde a nessun target noto non viene instradato:
 * l'adapter lo ha già scartato, e questa funzione non inventa un fallback.
 */
export function signalHref(signal: StructureSignal): string | null {
  switch (signal.kind) {
    case "network_request":
      return signal.relationshipId
        ? STRUCTURE_HREFS.requestReview(signal.clubId, signal.relationshipId)
        : null;

    case "network_requests":
      return STRUCTURE_HREFS.networkRequests;

    case "team_season":
      return signal.teamId && signal.seasonTarget
        ? STRUCTURE_HREFS.teamSeason(signal.teamId, signal.seasonTarget)
        : null;

    case "seasons_center":
      return STRUCTURE_HREFS.seasons;

    default:
      return null;
  }
}

/**
 * Nome accessibile della primaria di un segnale (§28).
 *
 * «La primaria Valuta richiesta deve avere un nome accessibile che renda
 * chiaro il contesto, includendo il riferimento della richiesta quando serve
 * a distinguerla.»
 */
export function signalActionLabel(signal: StructureSignal): string {
  return signal.context
    ? `${signal.actionLabel}: ${signal.context}`
    : `${signal.actionLabel}: ${signal.title}`;
}

export type StructureRowSpec = {
  href: string;
  icon: IconName;
  id: string;
  title: string;
};

/**
 * Righe di un dominio (§9, §10, §11, §12).
 *
 * Ogni riga è filtrata per conto proprio: §9 chiede di «rivalidare ogni
 * accesso in modo indipendente», e una riga non autorizzata è **assente** —
 * non disabilitata, senza lucchetto e senza spazio riservato.
 */
export function domainRows(
  domain: StructureDomain,
  structure: SocietyStructure,
): StructureRowSpec[] {
  switch (domain) {
    case "teams": {
      const rows: StructureRowSpec[] = [];

      if (structure.canViewTeams) {
        rows.push({
          href: STRUCTURE_HREFS.teams,
          icon: "briefcase-outline",
          id: "teams",
          title: "Gestisci squadre",
        });
      }

      // La riga esiste solo se il Centro Stagioni è una destinazione reale:
      // §2 vieta i chevron verso pagine non rilasciate.
      if (structure.canViewSeasons && isFeatureAvailable("society_seasons")) {
        rows.push({
          href: STRUCTURE_HREFS.seasons,
          icon: "calendar-outline",
          id: "seasons",
          title: "Stagioni e storico",
        });
      }

      return rows;
    }

    case "network":
      // §10: «Non creare due pagine distinte Gestisci collegamenti e Rete
      // societaria.» Una sola azione, e la tab la sceglie il centro in base a
      // ciò che l'actor può leggere.
      return structure.canViewNetwork || structure.canViewRequests
        ? [
            {
              href: structure.canViewNetwork
                ? STRUCTURE_HREFS.network
                : STRUCTURE_HREFS.networkRequests,
              icon: "link-outline",
              id: "network",
              title: "Apri rete societaria",
            },
          ]
        : [];

    case "admins":
      return structure.canOpenAdminCenter
        ? [
            {
              href: STRUCTURE_HREFS.admins,
              icon: "people-outline",
              id: "admins",
              title: "Amministratori, ruoli e permessi",
            },
          ]
        : [];

    case "company":
      // §12: «Chi può leggere ma non modificare può vedere la sintesi
      // autorizzata, senza l'azione di modifica. Non mostrare un pulsante
      // disabled per mancanza di permesso.»
      return structure.canEditCompanyData
        ? [
            {
              href: STRUCTURE_HREFS.companyEdit(structure.clubId),
              icon: "create-outline",
              id: "company_edit",
              title: "Modifica dati società",
            },
          ]
        : [];

    default:
      return [];
  }
}

/**
 * Un dominio è presente quando è autorizzato (§6, §7).
 *
 * «Le varianti di scope omettono soltanto le parti non autorizzate o non
 * disponibili.» Un dominio leggibile senza azioni resta consultabile — §7:
 * «Se una sezione contiene dati leggibili ma nessuna azione di modifica
 * autorizzata, può restare consultabile. Non inventare CTA per riempirla.»
 */
export function isDomainVisible(
  domain: StructureDomain,
  structure: SocietyStructure,
): boolean {
  switch (domain) {
    case "teams":
      return structure.canViewTeams || structure.canViewSeasons;
    case "network":
      return structure.canViewNetwork || structure.canViewRequests;
    case "admins":
      return structure.canViewAdmins || structure.canOpenAdminCenter;
    case "company":
      return structure.canViewCompanyData;
    default:
      return false;
  }
}

/**
 * L'ingresso "Gestione società" nella Dashboard (§5).
 *
 * «Se nessun dominio strutturale è disponibile per l'actor, ometti Gestione
 * società.» I dati master della Società non sono un dominio strutturale: sono
 * già leggibili sul profilo pubblico, e da soli non giustificano l'hub.
 *
 * Questa funzione decide la **riga**; l'accesso effettivo lo rivalida la RPC,
 * che per lo stesso insieme vuoto solleva `STRUCTURE_NOT_AUTHORIZED`.
 */
export function hasStructuralDomain(identity: DashboardIdentity): boolean {
  if (identity.kind !== "society") {
    return false;
  }

  return (
    identity.isOwner ||
    identity.capabilities.includes("teams_view") ||
    identity.capabilities.includes("network_view") ||
    identity.capabilities.includes("network_requests_view")
  );
}

/** Copy degli stati generali (§18, §19, §21). */
export const STRUCTURE_COPY = {
  globalErrorBody: "Riprova tra poco.",
  globalErrorTitle: "Non siamo riusciti a caricare la struttura societaria.",
  notAvailableBody: "Questa sezione non è disponibile.",
  notAvailableTitle: "Struttura societaria",
  offlineBody: "Connettiti a Internet per caricare la struttura societaria.",
  offlineTitle: "Sei offline",
  refreshFailed:
    "Non è stato possibile aggiornare la struttura societaria. Riprova.",
  summaryError: "Riepilogo non disponibile.",
} as const;
