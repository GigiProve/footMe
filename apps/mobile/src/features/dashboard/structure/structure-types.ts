/**
 * Contratto dell'hub Struttura societaria (DAS-REV-12 §15).
 *
 * Tre regole che i tipi devono rendere **impossibili da violare**:
 *
 *  1. un conteggio è `number | null`, mai `number` con zero di comodo —
 *     `null` significa "non autorizzato" e §15 vieta di serializzarlo come 0;
 *  2. lo **stato** non vive nel conteggio: loading, errore e stale sono del
 *     provider, e il tipo del dato non li rappresenta;
 *  3. le azioni sono identificate da un `kind` chiuso, non da un URL del
 *     backend — §14: «Ogni azione deve risolvere un target noto, non un URL
 *     arbitrario inviato dal backend».
 */

/** Tipi di segnale strutturale che questa build sa rendere e instradare. */
export const STRUCTURE_SIGNAL_KINDS = [
  /** Una singola richiesta ricevuta da valutare. */
  "network_request",
  /** Più richieste ricevute: destinazione di gruppo. */
  "network_requests",
  /** Una squadra con la stagione corrente o successiva da configurare. */
  "team_season",
  /** Più squadre nella stessa condizione: destinazione di gruppo. */
  "seasons_center",
] as const;

export type StructureSignalKind = (typeof STRUCTURE_SIGNAL_KINDS)[number];

export type StructureSignal = {
  actionLabel: string;
  clubId: string;
  /** Quante attività reali rappresenta: 1 per il singolo, N per il gruppo. */
  count: number;
  context: string | null;
  /** Chiave stabile di deduplica e di ordine, non un indice di riga. */
  id: string;
  kind: StructureSignalKind;
  relationshipId: string | null;
  seasonTarget: "current" | "next" | null;
  teamId: string | null;
  title: string;
};

/**
 * Composizione, dati master e summary amministrativo.
 *
 * I conteggi di squadre, relazioni e richieste **non** sono qui: restano ai
 * provider canonici dei rispettivi centri (§15), così un loro errore resta
 * locale al dominio invece di affondare tutta la pagina (screen 06).
 */
export type SocietyStructure = {
  /** Istante della verifica server-side di accesso e scope (§20). */
  accessVerifiedAt: number;
  /** `null` = non autorizzato. Mai zero. */
  adminInvitesPendingCount: number | null;
  /** `null` = non autorizzato. Mai zero. */
  adminsCount: number | null;
  canEditCompanyData: boolean;
  canOpenAdminCenter: boolean;
  canViewAdminInvites: boolean;
  canViewAdmins: boolean;
  canViewCompanyData: boolean;
  canViewNetwork: boolean;
  canViewRequests: boolean;
  canViewSeasons: boolean;
  canViewTeams: boolean;
  city: string | null;
  clubId: string;
  dataRevision: number;
  isVerified: boolean;
  logoUrl: string | null;
  name: string;
  /** "Primavera": limitazione mostrata, mai interattiva (§7). */
  scopeLabel: string | null;
  /** Già filtrati, ordinati e limitati a tre dal backend (§13). */
  signals: StructureSignal[];
};

/**
 * I quattro domini, nell'ordine prescritto da §6.
 *
 * L'ordine è una costante e non una proprietà dei dati: §16 chiede che «un
 * nuovo count non deve spostare continuamente le sezioni».
 */
export const STRUCTURE_DOMAINS = [
  "teams",
  "network",
  "admins",
  "company",
] as const;

export type StructureDomain = (typeof STRUCTURE_DOMAINS)[number];
