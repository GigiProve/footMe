/**
 * Adapter della Dashboard Società (DAS-REV-02).
 *
 * Estratto da `identity/identity-service.ts`, dove DAS-REV-01 lo aveva
 * collocato: il riepilogo di una Società non è un fatto di identità, ed è
 * l'unico adapter di dominio rimasto fuori da `adapters/`.
 *
 * Restituisce **proiezioni leggere**, non copie del dominio (§5): conteggi,
 * preview e segnali operativi normalizzati. I lifecycle restano dove sono —
 * leggere la Dashboard non valuta candidature, aggiornare una cache non
 * pubblica contenuti.
 */

import { supabase } from "../../../lib/supabase";
import type {
  PrioritySignal,
  PriorityTargetKind,
} from "../priority/priority-types";
import { isKnownPriorityType } from "../priority/priority-registry";
import { MODULE_TIMEOUT_MS, withTimeout } from "../state/retry-policy";
import { DashboardTimeoutError } from "../state/error-classification";

export type SocietyApplicationPreview = {
  adId: string;
  adTitle: string;
  avatarUrl: string | null;
  id: string;
  name: string;
  role: string;
  status: string;
  teamName: string | null;
};


export type SocietyContentPreview = {
  id: string;
  kind: string;
  publishedAt: string | null;
  status: string;
  thumbnailUrl: string | null;
  title: string;
};

/**
 * Riga di "Squadre del club" (DAS-REV-07 §15).
 *
 * Nome canonico e contesto leggero, niente altro: §15 vieta esplicitamente
 * conteggi di giocatori o staff nella preview, e un campo restituito è un
 * campo che prima o poi qualcuno disegna.
 */
export type SocietyTeamPreview = {
  category: string | null;
  id: string;
  logoUrl: string | null;
  name: string;
};

export type SocietyOverview = {
  /** Istante della verifica server-side di accesso e scope (§15). */
  accessVerifiedAt: string | null;
  applicationsCount: number | null;
  /** null = non autorizzato; [] = autorizzato e nessuna candidatura. */
  applicationsPreview: SocietyApplicationPreview[] | null;
  /** Conteggio canonico "da gestire": risolverlo non azzera il totale (§24). */
  applicationsToHandleCount: number | null;
  /** Revisione monotona della risposta, per scartare risposte obsolete. */
  dataRevision: number;
  draftsCount: number | null;
  draftsPreview: SocietyContentPreview[] | null;
  /**
   * Richieste in ingresso ancora da gestire (DAS-REV-07 §14).
   *
   * Oggi sempre `null`: il dominio non modella una richiesta di adesione in
   * attesa — l'unico scrittore di `added_by = 'self_request'` inserisce una
   * membership già `active`. §14 chiede di omettere l'aggregato non
   * consultabile, non di mostrarlo a zero.
   */
  invitesIncomingCount: number | null;
  /** Inviti in uscita ancora pendenti: `club_members.status = 'pending'`. */
  invitesPendingCount: number | null;
  positionsOpenCount: number | null;
  /** Segnali normalizzati, già filtrati server-side per capability e scope. */
  prioritySignals: PrioritySignal[];
  /** Totale dopo eligibility e dedup, prima del limite visuale (§9). */
  priorityTotalCount: number;
  recentContentPreview: SocietyContentPreview[] | null;
  scheduledCount: number | null;
  teamsCount: number | null;
  /** null = non autorizzato; [] = autorizzato e nessuna squadra corrente. */
  teamsPreview: SocietyTeamPreview[] | null;
};

type RawRecord = Record<string, unknown>;

type OverviewRow = {
  access_verified_at: string | null;
  applications_count: number | null;
  applications_preview: RawRecord[] | null;
  applications_to_handle_count: number | null;
  data_revision: number | string | null;
  drafts_count: number | null;
  drafts_preview: RawRecord[] | null;
  invites_incoming_count: number | null;
  invites_pending_count: number | null;
  positions_open_count: number | null;
  priority_signals: RawRecord[] | null;
  priority_total_count: number | null;
  recent_content_preview: RawRecord[] | null;
  scheduled_count: number | null;
  teams_count: number | null;
  teams_preview: RawRecord[] | null;
};

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function wholeNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }

  return fallback;
}

/**
 * Contesto localizzabile della priorità: "Attaccante · Prima squadra".
 *
 * Composto qui dalle sue parti e non nel database (§7: titolo e contesto
 * localizzabili). Una Posizione senza Squadra non produce un separatore
 * penzolante.
 */
function contextLabel(role: string | null, teamName: string | null): string | null {
  const parts = [role, teamName].filter(
    (part): part is string => !!part && part.length > 0,
  );

  return parts.length > 0 ? parts.join(" · ") : null;
}

const TARGET_KINDS: readonly PriorityTargetKind[] = [
  "position",
  "content",
  "profile_section",
];

function isTargetKind(value: unknown): value is PriorityTargetKind {
  return typeof value === "string" && (TARGET_KINDS as readonly string[]).includes(value);
}

/**
 * Normalizzazione dei segnali.
 *
 * Un `type_id` che questa build non conosce viene **omesso**, non reso con un
 * renderer arbitrario: §7 vieta di usare un renderer noto se payload e
 * destinazione non sono compatibili, e un tipo sconosciuto non deve far
 * crashare la pagina.
 *
 * `revision` viene stampigliata dal chiamante con la revisione della
 * risposta: è così che due consegne dello stesso evento da fonti diverse si
 * deduplicano tenendo la più recente (§9).
 */
function mapSignals(
  rows: RawRecord[] | null,
  revision: number,
  roleLabel: (role: string) => string,
): PrioritySignal[] {
  if (!rows) {
    return [];
  }

  return rows.flatMap((row) => {
    const typeId = text(row.type_id);
    const aggregationKey = nullableText(row.aggregation_key);
    const targetId = nullableText(row.target_id);
    const occurredAt = nullableText(row.occurred_at);

    if (
      !isKnownPriorityType(typeId) ||
      !aggregationKey ||
      !targetId ||
      !occurredAt ||
      !isTargetKind(row.target_kind)
    ) {
      return [];
    }

    const count = wholeNumber(row.count);

    if (count <= 0) {
      return [];
    }

    const role = nullableText(row.role);

    return [
      {
        aggregationKey,
        contextLabel: contextLabel(
          role ? roleLabel(role) : null,
          nullableText(row.team_name),
        ),
        count,
        deadlineAt: nullableText(row.deadline_at),
        impact: typeof row.impact === "number" ? row.impact : null,
        occurredAt,
        revision,
        targetId,
        targetKind: row.target_kind,
        typeId,
      },
    ];
  });
}

/**
 * Le preview arrivano come jsonb: una riga malformata viene scartata, non
 * resa. Il danno massimo è una preview più corta del conteggio, che la CTA
 * "Vedi tutte" risolve — ed è preferibile a una pagina che non si apre.
 */
function mapApplications(
  rows: RawRecord[] | null,
): SocietyApplicationPreview[] | null {
  if (rows === null) {
    return null;
  }

  return rows.flatMap((row) => {
    const id = nullableText(row.id);
    const adId = nullableText(row.ad_id);

    if (!id || !adId) {
      return [];
    }

    return [
      {
        adId,
        adTitle: text(row.ad_title),
        avatarUrl: nullableText(row.avatar_url),
        id,
        name: text(row.name, "Candidato"),
        role: text(row.role),
        status: text(row.status),
        teamName: nullableText(row.team_name),
      },
    ];
  });
}

function mapTeams(rows: RawRecord[] | null): SocietyTeamPreview[] | null {
  if (rows === null) {
    return null;
  }

  return rows.flatMap((row) => {
    const id = nullableText(row.id);

    if (!id) {
      return [];
    }

    return [
      {
        category: nullableText(row.category),
        id,
        logoUrl: nullableText(row.logo_url),
        name: text(row.name, "Squadra"),
      },
    ];
  });
}

function mapContent(rows: RawRecord[] | null): SocietyContentPreview[] | null {
  if (rows === null) {
    return null;
  }

  return rows.flatMap((row) => {
    const id = nullableText(row.id);

    if (!id) {
      return [];
    }

    return [
      {
        id,
        kind: text(row.kind),
        publishedAt: nullableText(row.published_at),
        status: text(row.status),
        thumbnailUrl: nullableText(row.thumbnail_url),
        title: text(row.title, "Senza titolo"),
      },
    ];
  });
}

/** Forma minima accettata per riusare un record di cache (§14). */
export function isSocietyOverview(value: unknown): value is SocietyOverview {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Partial<SocietyOverview>;

  return (
    Array.isArray(candidate.prioritySignals) &&
    typeof candidate.dataRevision === "number"
  );
}

/**
 * Riepilogo, segnali e preview di una Società.
 *
 * Ogni campo è `null` quando la capability corrispondente manca. La
 * distinzione fra `null` e `0` è il punto: `0` significa "nessuna attività"
 * ed è un'informazione legittima; `null` significa "non autorizzato" e la
 * metrica non deve comparire affatto.
 *
 * Il timeout non interrompe la richiesta sottostante — Supabase non espone
 * un AbortSignal — ma impedisce alla Dashboard di restare in loading oltre il
 * budget di §18.
 */
export async function fetchSocietyOverview(
  clubId: string,
  roleLabel: (role: string) => string = (role) => role,
): Promise<SocietyOverview> {
  const { data, error } = await withTimeout(
    supabase
      .rpc("fetch_dashboard_society_overview", { p_club_id: clubId })
      .maybeSingle(),
    MODULE_TIMEOUT_MS,
    () => new DashboardTimeoutError("fetch_dashboard_society_overview"),
  );

  if (error) {
    throw error;
  }

  const row = (data ?? null) as OverviewRow | null;
  const revision = wholeNumber(row?.data_revision, 0);

  return {
    accessVerifiedAt: row?.access_verified_at ?? null,
    applicationsCount: row?.applications_count ?? null,
    applicationsPreview: mapApplications(row?.applications_preview ?? null),
    applicationsToHandleCount: row?.applications_to_handle_count ?? null,
    dataRevision: revision,
    draftsCount: row?.drafts_count ?? null,
    draftsPreview: mapContent(row?.drafts_preview ?? null),
    invitesIncomingCount: row?.invites_incoming_count ?? null,
    invitesPendingCount: row?.invites_pending_count ?? null,
    positionsOpenCount: row?.positions_open_count ?? null,
    prioritySignals: mapSignals(row?.priority_signals ?? null, revision, roleLabel),
    priorityTotalCount: wholeNumber(row?.priority_total_count, 0),
    recentContentPreview: mapContent(row?.recent_content_preview ?? null),
    scheduledCount: row?.scheduled_count ?? null,
    teamsCount: row?.teams_count ?? null,
    teamsPreview: mapTeams(row?.teams_preview ?? null),
  };
}
