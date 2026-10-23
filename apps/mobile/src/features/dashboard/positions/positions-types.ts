/**
 * Modello del Centro Posizioni aperte (DAS-REV-15 §4, §22).
 *
 * Una Position appartiene a una **Society**. Quando l'incarico ha ambito
 * TEAM la squadra è il suo contesto operativo interno; un incarico Dirigente
 * può avere ambito SOCIETY, mostrato come «Intera società», con Team ID
 * null **intenzionale** (§4). I due casi sono distinti da `scope`, non
 * dedotti dall'assenza del Team: §22 vieta «un Team ID null ambiguo».
 */

/** I tre gruppi canonici delle tab. Nessun quarto gruppo (§8). */
export type PositionGroup = "active" | "drafts" | "closed";

/** Tipo di filtro per ambito. `society` non è `all` ristretto (§14). */
export type PositionFilterKind = "all" | "society" | "team";

export type PositionFilter =
  | { kind: "all" }
  | { kind: "society" }
  | { kind: "team"; teamId: string; label: string; isInactive: boolean };

/**
 * Intestazione del Centro: identità, scope e capability.
 *
 * `canViewCounts` è separato da tutto il resto perché §9 lo impone:
 * «Visualizzare Posizioni non implica visualizzare Candidature.»
 */
export type PositionsCenter = {
  accessVerifiedAt: number;
  canCreate: boolean;
  canViewCounts: boolean;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  /** Gli aggregati sono leggibili su tutte le squadre, non solo su alcune. */
  countsScopeAll: boolean;
  dataRevision: number;
  scopeLabel: string | null;
};

/** Opzione del bottom sheet «Filtra per ambito». */
export type PositionFilterOption =
  | { kind: "all" }
  | { kind: "society" }
  | { isInactive: boolean; kind: "team"; label: string; teamId: string };

/**
 * Una riga della lista.
 *
 * `applicationsTotal` e `applicationsNew` sono `null` quando l'actor non è
 * autorizzato **o** quando il valore non è ancora noto: `countsAvailable` li
 * distingue. §10: «Un valore nullo non significa zero.»
 */
export type PositionRow = {
  applicationsNew: number | null;
  applicationsTotal: number | null;
  closedAt: string | null;
  /** Livello/competizione, o «Settore giovanile» quando è il solo noto. */
  contextLabel: string | null;
  countsAvailable: boolean;
  id: string;
  publishedAt: string | null;
  /** `true` quando la deadline ha interrotto la ricezione (§17). */
  receivingClosed: boolean;
  roleRequired: string | null;
  scope: "society" | "team";
  /** Solo sulle Chiuse, e solo quando esiste una fotografia storica (§13). */
  seasonLabel: string | null;
  sortKey: string;
  status: string;
  targetRole: string | null;
  teamId: string | null;
  teamIsInactive: boolean;
  teamName: string | null;
  /** `null` quando il titolo manca: la UI mostra «Posizione senza titolo». */
  title: string | null;
  updatedAt: string | null;
};

export type PositionsPage = {
  asOf: string | null;
  hasMore: boolean;
  nextCursor: string | null;
  rows: PositionRow[];
};

/** Dettaglio gestionale, non la scheda visitor (§18). */
export type PositionDetail = {
  accessVerifiedAt: number;
  ageMax: number | null;
  ageMin: number | null;
  applicationsNew: number | null;
  applicationsTotal: number | null;
  canClose: boolean;
  canEdit: boolean;
  canPublish: boolean;
  closedAt: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  compensationSummary: string | null;
  contextLabel: string | null;
  countsAvailable: boolean;
  deadlineAt: string | null;
  deadlineTimezone: string | null;
  description: string | null;
  group: PositionGroup;
  id: string;
  publishedAt: string | null;
  receivingClosed: boolean;
  region: string | null;
  roleRequired: string | null;
  scope: "society" | "team";
  seasonLabel: string | null;
  status: string;
  targetRole: string | null;
  teamId: string | null;
  teamIsInactive: boolean;
  teamName: string | null;
  title: string | null;
  updatedAt: string | null;
};
