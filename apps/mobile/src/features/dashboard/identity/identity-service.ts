import { supabase } from "../../../lib/supabase";
import {
  DASHBOARD_CAPABILITIES,
  type DashboardCapability,
  type DashboardIdentity,
  type DashboardIdentityKind,
} from "../dashboard-types";

type IdentityRow = {
  avatar_url: string | null;
  capabilities: string[] | null;
  identity_id: string;
  identity_kind: string;
  is_owner: boolean;
  is_verified: boolean;
  name: string;
};

const KINDS: readonly DashboardIdentityKind[] = ["person", "society", "media"];

function isKnownKind(value: string): value is DashboardIdentityKind {
  return (KINDS as readonly string[]).includes(value);
}

function isKnownCapability(value: string): value is DashboardCapability {
  return (DASHBOARD_CAPABILITIES as readonly string[]).includes(value);
}

/**
 * Le identità che l'actor autenticato può aprire.
 *
 * L'elenco arriva intero dal database: il client non filtra, non deduce e non
 * aggiunge. Una Società seguita, affiliata o semplicemente collegata non
 * compare, perché la RPC non la restituisce — non perché il client la nasconda.
 *
 * Un `identity_kind` sconosciuto (client più vecchio del backend) viene
 * scartato invece di essere reso: §15 chiede che un elemento non
 * interpretabile non faccia crashare la pagina. Lo stesso vale per una
 * capability che questa versione del client non conosce.
 */
export async function fetchDashboardIdentities(): Promise<DashboardIdentity[]> {
  const { data, error } = await supabase.rpc("fetch_dashboard_identities");

  if (error) {
    throw error;
  }

  const rows = (data ?? []) as IdentityRow[];

  return rows.reduce<DashboardIdentity[]>((identities, row) => {
    if (!isKnownKind(row.identity_kind)) {
      return identities;
    }

    identities.push({
      avatarUrl: row.avatar_url,
      capabilities: (row.capabilities ?? []).filter(isKnownCapability),
      id: row.identity_id,
      isOwner: row.is_owner,
      isVerified: row.is_verified,
      kind: row.identity_kind,
      name: row.name,
      // Lo scope multiplo non è ancora modellato nel backend: la colonna
      // esiste nel tipo client perché §10 la richiede, e resta null finché
      // il pack competente non introduce l'assegnazione per Squadra.
      scopeLabel: null,
    });

    return identities;
  }, []);
}

export type SocietyApplicationPreview = {
  adId: string;
  adTitle: string;
  avatarUrl: string | null;
  id: string;
  name: string;
  role: string;
  status: string;
};

export type SocietyContentPreview = {
  id: string;
  kind: string;
  publishedAt: string | null;
  status: string;
  thumbnailUrl: string | null;
  title: string;
};

export type SocietyOverview = {
  applicationsCount: number | null;
  /** null = non autorizzato; [] = autorizzato e nessuna candidatura. */
  applicationsPreview: SocietyApplicationPreview[] | null;
  draftsCount: number | null;
  draftsPreview: SocietyContentPreview[] | null;
  positionsOpenCount: number | null;
  priorityAdId: string | null;
  priorityAdTitle: string | null;
  priorityNewApplications: number | null;
  recentContentPreview: SocietyContentPreview[] | null;
  scheduledCount: number | null;
  teamsCount: number | null;
};

type RawApplication = {
  ad_id?: unknown;
  ad_title?: unknown;
  avatar_url?: unknown;
  id?: unknown;
  name?: unknown;
  role?: unknown;
  status?: unknown;
};

type RawContent = {
  id?: unknown;
  kind?: unknown;
  published_at?: unknown;
  status?: unknown;
  thumbnail_url?: unknown;
  title?: unknown;
};

type OverviewRow = {
  applications_count: number | null;
  applications_preview: RawApplication[] | null;
  drafts_count: number | null;
  drafts_preview: RawContent[] | null;
  positions_open_count: number | null;
  priority_ad_id: string | null;
  priority_ad_title: string | null;
  priority_new_applications: number | null;
  recent_content_preview: RawContent[] | null;
  scheduled_count: number | null;
  teams_count: number | null;
};

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function nullableText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Le preview arrivano come jsonb: una riga malformata viene scartata, non
 * resa. §15 chiede che un payload incompatibile non faccia crashare la
 * pagina; qui il danno massimo è una preview più corta del conteggio, che la
 * CTA "Vedi tutte" risolve.
 */
function mapApplications(
  rows: RawApplication[] | null,
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
      },
    ];
  });
}

function mapContent(rows: RawContent[] | null): SocietyContentPreview[] | null {
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

/**
 * Riepilogo e priorità di una Società.
 *
 * Ogni campo è `null` quando la capability corrispondente manca. La
 * distinzione fra `null` e `0` è il punto: `0` significa "nessuna attività" ed
 * è un'informazione legittima da mostrare; `null` significa "non autorizzato"
 * e la metrica non deve comparire affatto.
 */
export async function fetchSocietyOverview(
  clubId: string,
): Promise<SocietyOverview> {
  const { data, error } = await supabase
    .rpc("fetch_dashboard_society_overview", { p_club_id: clubId })
    .maybeSingle();

  if (error) {
    throw error;
  }

  const row = (data ?? null) as OverviewRow | null;

  return {
    applicationsCount: row?.applications_count ?? null,
    applicationsPreview: mapApplications(row?.applications_preview ?? null),
    draftsCount: row?.drafts_count ?? null,
    draftsPreview: mapContent(row?.drafts_preview ?? null),
    positionsOpenCount: row?.positions_open_count ?? null,
    priorityAdId: row?.priority_ad_id ?? null,
    priorityAdTitle: row?.priority_ad_title ?? null,
    priorityNewApplications: row?.priority_new_applications ?? null,
    recentContentPreview: mapContent(row?.recent_content_preview ?? null),
    scheduledCount: row?.scheduled_count ?? null,
    teamsCount: row?.teams_count ?? null,
  };
}
