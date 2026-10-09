/**
 * Modello di dominio della gestione assistiti (REV-PROF-14).
 *
 * Un solo posto per i cataloghi e per le regole di lettura degli stati: le
 * schermate non ridefiniscono le etichette dei tipi di rapporto né decidono da
 * sole cosa sia "attivo". Le descrizioni dei tipi sono quelle approvate nella
 * task e vivono qui, non dentro i form.
 */
import type { PlayerPosition } from "../../profiles/player-sports";
import type {
  RelationshipType,
  RepresentationStatus,
  RepresentationVisibility,
} from "../agent-representation-service";

export type { RelationshipType, RepresentationStatus, RepresentationVisibility };

/** Stato di un invito. Volutamente disgiunto dagli stati della richiesta. */
export type InviteStatus =
  | "created"
  | "shared"
  | "opened"
  | "registered"
  | "accepted"
  | "expired"
  | "revoked";

export type InviteChannel = "whatsapp" | "sms" | "copy_link" | "other";

/** Riga dell'elenco unico: una relazione o un record manuale. */
export type AssistitoKind = "representation" | "manual";

export type AssistitoRow = {
  avatar_url: string | null;
  created_at: string;
  ended_on: string | null;
  full_name: string | null;
  id: string;
  invite_channel: InviteChannel | null;
  invite_expires_at: string | null;
  invite_id: string | null;
  invite_shared_at: string | null;
  invite_status: InviteStatus | null;
  kind: AssistitoKind;
  player_profile_id: string | null;
  primary_position: PlayerPosition | null;
  relationship_type: RelationshipType;
  started_on: string | null;
  status: string;
  team_label: string | null;
  visibility: RepresentationVisibility;
};

export type AssistitiCounts = {
  active_count: number;
  ended_count: number;
  invite_count: number;
  pending_count: number;
  private_count: number;
  public_count: number;
};

export const EMPTY_ASSISTITI_COUNTS: AssistitiCounts = {
  active_count: 0,
  ended_count: 0,
  invite_count: 0,
  pending_count: 0,
  private_count: 0,
  public_count: 0,
};

/**
 * Catalogo centralizzato dei tipi di rapporto, con le descrizioni approvate.
 * Le schermate leggono da qui: nessun form riscrive queste stringhe.
 */
export const RELATIONSHIP_TYPE_OPTIONS: readonly {
  description: string;
  label: string;
  value: RelationshipType;
}[] = [
  {
    description: "Rappresentanza professionale principale.",
    label: "Procuratore",
    value: "procuratore",
  },
  {
    description: "Supporto nella ricerca e gestione di opportunità.",
    label: "Intermediario",
    value: "intermediario",
  },
  {
    description: "Contatto professionale di riferimento.",
    label: "Referente sportivo",
    value: "referente_sportivo",
  },
] as const;

/** Etichetta breve usata sulle card, dove non c'è spazio per la descrizione. */
const RELATIONSHIP_SHORT_LABELS: Record<RelationshipType, string> = {
  intermediario: "Intermediazione",
  procuratore: "Procura",
  referente_sportivo: "Referente sportivo",
};

export function getRelationshipShortLabel(value: RelationshipType): string {
  return RELATIONSHIP_SHORT_LABELS[value] ?? value;
}

export function getRelationshipDescription(value: RelationshipType): string {
  return (
    RELATIONSHIP_TYPE_OPTIONS.find((option) => option.value === value)
      ?.description ?? ""
  );
}

export const VISIBILITY_OPTIONS: readonly {
  description: string;
  label: string;
  value: RepresentationVisibility;
}[] = [
  {
    description:
      "Il rapporto sarà visibile nei profili pubblici dopo l'accettazione.",
    label: "Pubblico",
    value: "public",
  },
  {
    description: "Il rapporto sarà visibile soltanto a te e al Calciatore.",
    label: "Privato",
    value: "private",
  },
] as const;

/** Filtri dell'hub. Sono filtri, non tab: restano chip. */
export type AssistitiFilter =
  | "all"
  | "public"
  | "private"
  | "pending"
  | "invites";

export const ASSISTITI_FILTERS: readonly {
  label: string;
  value: AssistitiFilter;
}[] = [
  { label: "Tutti", value: "all" },
  { label: "Pubblici", value: "public" },
  { label: "Privati", value: "private" },
  { label: "In attesa", value: "pending" },
  { label: "Inviti", value: "invites" },
] as const;

/** Sezioni della schermata "Richieste e inviti". */
export type RequestsTab = "requests" | "invites" | "closed";

export const REQUESTS_TABS: readonly { label: string; value: RequestsTab }[] = [
  { label: "Richieste", value: "requests" },
  { label: "Inviti", value: "invites" },
  { label: "Conclusi", value: "closed" },
] as const;

export function isActiveRepresentation(row: AssistitoRow): boolean {
  return row.kind === "representation" && row.status === "accepted";
}

export function isPendingRepresentation(row: AssistitoRow): boolean {
  return row.kind === "representation" && row.status === "pending";
}

/**
 * Un record manuale è "concluso" quando il suo invito è scaduto o revocato,
 * finché il link è vivo resta lavoro in corso, non storia.
 *
 * Il database non scrive mai lo stato "expired" (la scadenza è derivata),
 * quindi un invito con `invite_expires_at` nel passato resterebbe per sempre
 * fra gli attivi se guardassimo solo lo stato memorizzato. Trattiamo quindi
 * come concluse anche le righe "created"/"shared" già scadute, escludendo le
 * righe senza scadenza (`invite_expires_at` nullo), che non sono mai chiuse
 * per questo motivo.
 */
export function isClosedRow(row: AssistitoRow, now: Date = new Date()): boolean {
  if (row.kind === "representation") {
    return ["rejected", "removed", "revoked", "terminated"].includes(row.status);
  }

  if (row.invite_status === "expired" || row.invite_status === "revoked") {
    return true;
  }

  if (row.invite_expires_at) {
    const expiresAt = new Date(row.invite_expires_at);

    if (!Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime()) {
      return true;
    }
  }

  return false;
}

export function filterAssistiti(
  rows: readonly AssistitoRow[],
  filter: AssistitiFilter,
): AssistitoRow[] {
  switch (filter) {
    case "public":
      return rows.filter(
        (row) => isActiveRepresentation(row) && row.visibility === "public",
      );
    case "private":
      return rows.filter(
        (row) => isActiveRepresentation(row) && row.visibility === "private",
      );
    case "pending":
      return rows.filter(isPendingRepresentation);
    case "invites":
      return rows.filter((row) => row.kind === "manual" && !isClosedRow(row));
    case "all":
    default:
      // "Tutti" è il portfolio in corso: niente storia, che vive in
      // "Richieste e inviti".
      return rows.filter((row) => !isClosedRow(row));
  }
}

const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  accepted: "Collegato",
  created: "Invito creato",
  expired: "Invito scaduto",
  opened: "Link aperto",
  registered: "Registrazione avviata",
  revoked: "Invito revocato",
  // Lo stato "shared" dice solo che l'app ha tentato la condivisione: non sa
  // se il link è stato davvero recapitato, quindi la label resta neutra.
  shared: "Condivisione completata",
};

export function getInviteStatusLabel(status: InviteStatus | null): string {
  if (!status) {
    return "Invito da creare";
  }

  return INVITE_STATUS_LABELS[status] ?? "Invito";
}

const CHANNEL_LABELS: Record<InviteChannel, string> = {
  copy_link: "Link copiato",
  other: "Condivisione",
  sms: "SMS",
  whatsapp: "WhatsApp",
};

export function getInviteChannelLabel(channel: InviteChannel | null): string {
  return channel ? CHANNEL_LABELS[channel] : "Nessun canale";
}

/**
 * Data relativa breve per le righe di invito. Non usa librerie: tre casi
 * coprono tutto quello che la schermata mostra davvero.
 */
export function formatRelativeDay(
  iso: string | null,
  now: Date = new Date(),
): string {
  if (!iso) {
    return "—";
  }

  const value = new Date(iso);

  if (Number.isNaN(value.getTime())) {
    return "—";
  }

  const startOfDay = (date: Date) =>
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const days = Math.round(
    (startOfDay(now) - startOfDay(value)) / (24 * 60 * 60 * 1000),
  );

  if (days <= 0) {
    return "oggi";
  }

  if (days === 1) {
    return "ieri";
  }

  if (days < 30) {
    return `${days} giorni fa`;
  }

  return value.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** "2024-03-01" → "01/03/2024". Vuoto quando la data manca. */
export function formatIsoDate(iso: string | null): string {
  if (!iso) {
    return "";
  }

  const [year, month, day] = iso.split("-");

  if (!year || !month || !day) {
    return "";
  }

  return `${day}/${month}/${year}`;
}

/** "01/03/2024" o "2024" → ISO, oppure null se non è una data valida. */
export function parseStartDateInput(input: string): string | null {
  const trimmed = input.trim();

  if (!trimmed) {
    return null;
  }

  const yearOnly = /^(\d{4})$/.exec(trimmed);

  if (yearOnly) {
    return `${yearOnly[1]}-01-01`;
  }

  const full = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(trimmed);

  if (!full) {
    return null;
  }

  const [, day, month, year] = full;
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return iso;
}

export function isFutureDate(iso: string, now: Date = new Date()): boolean {
  const parsed = new Date(`${iso}T00:00:00Z`);

  return !Number.isNaN(parsed.getTime()) && parsed.getTime() > now.getTime();
}

/** Normalizzazione del nome, identica a quella del database. */
export function normalizeAssistitoName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Messaggi d'errore del backend tradotti in testo per l'utente.
 * I codici tecnici non devono mai arrivare a schermo.
 */
export function describeAssistitiError(
  error: unknown,
  fallback: string,
): string {
  const raw = error instanceof Error ? error.message : "";

  if (raw.includes("RATE_LIMIT")) {
    return "Hai effettuato troppi tentativi. Riprova più tardi.";
  }

  if (raw.includes("DUPLICATE_SUSPECTED")) {
    return "Questo record potrebbe essere già presente.";
  }

  if (raw.includes("INVITE_EXPIRED")) {
    return "Il link non è più valido.";
  }

  if (raw.includes("INVITE_INVALID") || raw.includes("INVITE_SELF")) {
    return "Il link non è più valido.";
  }

  return fallback;
}
