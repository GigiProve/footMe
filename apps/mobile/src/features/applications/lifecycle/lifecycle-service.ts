/**
 * I comandi del lifecycle della propria candidatura (DAS-REV-23 §11, §12,
 * §13, §24).
 *
 * Tre sole operazioni, tutte sul contratto già esistente: il dettaglio
 * personale autorevole, il ritiro e la ricandidatura. §24 — «Estendi gli
 * endpoint/comandi esistenti, senza imporre nuovi URL o una seconda
 * infrastruttura.»
 *
 * Ogni comando porta una **chiave di operazione** stabile (§13): la stessa
 * intenzione ritentata dopo un timeout riusa la stessa chiave e il server
 * riconosce la ricevuta invece di ripetere l'effetto. La chiave vive nello
 * stato della schermata, non qui: una nuova intenzione deve avere una nuova
 * chiave, e solo chi conosce il ciclo di vita della UI sa quando l'intenzione
 * cambia.
 */
import { supabase } from "../../../lib/supabase";

/** §4: due soli valori nel vocabolario del lifecycle. */
export type ApplicationLifecycleState = "active" | "withdrawn";

/** §30: il motivo del diniego, perché le copy di scadenza e chiusura differiscono. */
export type ApplicationBlockedReason =
  | "closed"
  | "deadline"
  | "not_available"
  | "not_eligible";

export type MyApplicationDetail = {
  adId: string;
  adStatus: "closed" | "draft" | "published";
  /** §16: la classificazione Attive/Concluse, distinta dallo stato. */
  applicationGroup: "active" | "completed";
  blockedReason: ApplicationBlockedReason | null;
  /** §6: capacità effettive, decise dal server. */
  canApply: boolean;
  canWithdraw: boolean;
  categoryLabel: string | null;
  clubId: string;
  clubIsVerified: boolean;
  clubLogoUrl: string | null;
  clubName: string;
  concludedAt: string | null;
  createdAt: string;
  deadlineAt: string | null;
  id: string;
  /** §19: la data della submission corrente, non il primo invio storico. */
  latestSubmittedAt: string | null;
  outcome: "selection_completed" | "status" | null;
  personAvatarUrl: string | null;
  personId: string;
  personName: string;
  /** §19: il ruolo sportivo della persona, non quello della ricerca. */
  personPosition: string | null;
  personRole: string | null;
  personSituation: string | null;
  positionScope: "society" | "team";
  /** §14: deciso con l'orologio del server, mai con quello del dispositivo. */
  receivingOpen: boolean;
  roleLabel: string;
  roleRequired: string | null;
  serverNow: string;
  state: ApplicationLifecycleState;
  status: string;
  submissionRevision: number;
  teamLabel: string | null;
  withdrawnAt: string | null;
};

export type LifecycleCommandResult = {
  latestSubmittedAt: string | null;
  /** §13: la ricevuta di un'operazione già committata, non un nuovo effetto. */
  replayed: boolean;
  state: ApplicationLifecycleState;
  status: string;
  submissionRevision: number;
  withdrawnAt: string | null;
};

type DetailRow = {
  ad_id: string;
  ad_status: string;
  application_group: string;
  application_id: string;
  blocked_reason: string | null;
  can_apply: boolean;
  can_withdraw: boolean;
  category_label: string | null;
  club_id: string;
  club_is_verified: boolean;
  club_logo_url: string | null;
  club_name: string;
  concluded_at: string | null;
  created_at: string;
  deadline_at: string | null;
  latest_submitted_at: string | null;
  outcome: string | null;
  person_avatar_url: string | null;
  person_id: string;
  person_name: string | null;
  person_position: string | null;
  person_role: string | null;
  person_situation: string | null;
  position_scope: string | null;
  receiving_open: boolean;
  role_label: string;
  role_required: string | null;
  server_now: string;
  state: string;
  status: string;
  submission_revision: number;
  team_label: string | null;
  withdrawn_at: string | null;
};

/**
 * §23: un accesso negato e una candidatura inesistente danno lo **stesso**
 * stato. La distinzione serve al client solo per non trattarli come un errore
 * tecnico da ritentare all'infinito (§27).
 */
export class ApplicationUnavailableError extends Error {
  constructor() {
    super("APPLICATION_NOT_AVAILABLE");
    this.name = "ApplicationUnavailableError";
  }
}

function isUnavailable(message: string | undefined): boolean {
  return (
    !!message &&
    (message.includes("APPLICATION_NOT_AVAILABLE") ||
      message.includes("APPLICATION_WITHDRAW_NOT_OWNER"))
  );
}

export async function fetchMyApplicationDetail(
  applicationId: string,
): Promise<MyApplicationDetail> {
  const { data, error } = await supabase
    .rpc("fetch_my_application_detail", { p_application_id: applicationId })
    .maybeSingle();

  if (error) {
    throw isUnavailable(error.message) ? new ApplicationUnavailableError() : error;
  }

  if (!data) {
    throw new ApplicationUnavailableError();
  }

  const row = data as DetailRow;

  return {
    adId: row.ad_id,
    adStatus:
      row.ad_status === "closed"
        ? "closed"
        : row.ad_status === "draft"
          ? "draft"
          : "published",
    applicationGroup: row.application_group === "completed" ? "completed" : "active",
    blockedReason: (row.blocked_reason as ApplicationBlockedReason | null) ?? null,
    canApply: row.can_apply === true,
    canWithdraw: row.can_withdraw === true,
    categoryLabel: row.category_label,
    clubId: row.club_id,
    clubIsVerified: row.club_is_verified === true,
    clubLogoUrl: row.club_logo_url,
    clubName: row.club_name ?? "",
    concludedAt: row.concluded_at,
    createdAt: row.created_at,
    deadlineAt: row.deadline_at,
    id: row.application_id,
    latestSubmittedAt: row.latest_submitted_at,
    outcome:
      row.outcome === "selection_completed" || row.outcome === "status"
        ? row.outcome
        : null,
    personAvatarUrl: row.person_avatar_url,
    personId: row.person_id,
    personName: row.person_name ?? "",
    personPosition: row.person_position,
    personRole: row.person_role,
    personSituation: row.person_situation,
    positionScope: row.position_scope === "society" ? "society" : "team",
    receivingOpen: row.receiving_open === true,
    roleLabel: row.role_label,
    roleRequired: row.role_required,
    serverNow: row.server_now,
    state: row.state === "withdrawn" ? "withdrawn" : "active",
    status: row.status,
    submissionRevision: row.submission_revision,
    teamLabel: row.team_label,
    withdrawnAt: row.withdrawn_at,
  };
}

type CommandRow = {
  latest_submitted_at: string | null;
  replayed: boolean;
  status: string;
  submission_revision: number;
  withdrawn_at?: string | null;
};

function toResult(row: CommandRow): LifecycleCommandResult {
  return {
    latestSubmittedAt: row.latest_submitted_at,
    replayed: row.replayed === true,
    state: row.status === "withdrawn" ? "withdrawn" : "active",
    status: row.status,
    submissionRevision: row.submission_revision,
    withdrawnAt: row.withdrawn_at ?? null,
  };
}

/**
 * §11: il ritiro porta la revisione osservata. «Se nel frattempo esiste una
 * nuova submission, una richiesta basata su quella precedente non può
 * ritirarla silenziosamente.»
 */
export async function withdrawApplication(input: {
  applicationId: string;
  expectedRevision: number;
  operationKey: string;
}): Promise<LifecycleCommandResult> {
  const { data, error } = await supabase.rpc("withdraw_application", {
    p_application_id: input.applicationId,
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
  });

  if (error) {
    throw isUnavailable(error.message) ? new ApplicationUnavailableError() : error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as CommandRow | null;

  if (!row) {
    throw new ApplicationUnavailableError();
  }

  return toResult(row);
}

/**
 * §12: la ricandidatura riusa `apply_to_position`, la stessa candidatura
 * rapida del primo invio. Nessun editor, nessun allegato, nessun secondo
 * endpoint.
 */
export async function reapplyToPosition(input: {
  adId: string;
  expectedRevision: number;
  operationKey: string;
}): Promise<LifecycleCommandResult> {
  const { data, error } = await supabase.rpc("apply_to_position", {
    p_ad_id: input.adId,
    p_cover_message: null,
    p_expected_revision: input.expectedRevision,
    p_idempotency_key: input.operationKey,
  });

  if (error) {
    throw error;
  }

  const row = (Array.isArray(data) ? data[0] : data) as CommandRow | null;

  if (!row) {
    throw new Error("APPLICATION_NOT_AVAILABLE");
  }

  return toResult(row);
}

/**
 * Chiave stabile di un'intenzione (§13).
 *
 * Deve essere **la stessa** per ogni retry della stessa intenzione e
 * **diversa** quando l'intenzione cambia: la revisione osservata entra nella
 * chiave perché ritirare la revisione 2 non è ritirare la revisione 3, e un
 * suffisso casuale distingue due intenzioni successive sulla stessa
 * revisione — che esistono, se la prima è fallita con un errore certo.
 */
export function operationKey(
  command: "apply" | "withdraw",
  applicationId: string,
  revision: number,
): string {
  const nonce = Math.random().toString(36).slice(2, 10);

  return `${command}:${applicationId}:${revision}:${nonce}`;
}
