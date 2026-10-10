/**
 * Modello di identità e capability della Foundation Dashboard (DAS-REV-01).
 *
 * Tre concetti che il prodotto teneva confusi in un solo `profile.role`:
 *
 *   · **actor**            la persona autenticata che usa l'app;
 *   · **Dashboard Identity** il soggetto di cui sta gestendo le attività;
 *   · **capability/scope** ciò che quell'actor può fare per quella identità.
 *
 * Il `kind` è il tipo canonico PERSON / SOCIETY / MEDIA richiesto dal Common
 * Contract. Non è un rename di `app_role`: la mappatura vive nel database
 * (`fetch_dashboard_identities`) e l'enum resta quello che è.
 */

export type DashboardIdentityKind = "person" | "society" | "media";

/**
 * Chiavi di capability leggibili dalla Dashboard. Devono restare allineate al
 * CHECK di `club_member_permissions` (20261012090000_dashboard_foundation.sql,
 * esteso da 20261018090000_dashboard_society_overview.sql): una chiave che il
 * database non accetta non potrà mai essere concessa.
 */
export const DASHBOARD_CAPABILITIES = [
  "dashboard_view",
  "positions_view",
  "positions_create",
  "applications_view",
  "teams_view",
  "content_view",
  "content_create",
  "invites_create",
  // DAS-REV-07 §14: leggere lo stato degli inviti non è spedirne. Un
  // amministratore può sapere a che punto è l'organico senza poter invitare.
  "invites_view",
  // DAS-REV-07 §16: la riga "Shortlist" di Aree di gestione si decide con la
  // chiave del dominio Shortlist, che esiste dal 20260717090000, non con una
  // regola nuova inventata nella Dashboard.
  "shortlist_view",
  // DAS-REV-08 §5: quattro capability distinte sulle Squadre. Consultare non
  // è creare, e leggere i conteggi dell'organico è una terza cosa ancora —
  // `teams_view` da sola non autorizza nessuna delle altre due.
  "teams_create",
  "teams_edit",
  "roster_view",
] as const;

export type DashboardCapability = (typeof DASHBOARD_CAPABILITIES)[number];

export type DashboardIdentity = {
  avatarUrl: string | null;
  /**
   * Vuoto per l'identità personale: le risorse personali sono protette dalla
   * RLS dell'actor su se stesso, e capability fittizie darebbero l'illusione
   * di un controllo che non esiste.
   */
  capabilities: DashboardCapability[];
  id: string;
  isOwner: boolean;
  isVerified: boolean;
  kind: DashboardIdentityKind;
  name: string;
  /**
   * Limitazione comprensibile mostrata sotto il contesto ("Ambito: Primavera").
   * Null quando l'actor opera sull'intera Società. Lo scope non entra mai nel
   * nome dell'identità: una Squadra non è una Dashboard Identity (§10).
   */
  scopeLabel: string | null;
};

/** Etichetta di tipo mostrata sotto il nome nella riga identità e nel selector. */
export const IDENTITY_KIND_LABELS: Record<DashboardIdentityKind, string> = {
  media: "Media",
  person: "Personale",
  society: "Società",
};

export function hasCapability(
  identity: DashboardIdentity | null,
  capability: DashboardCapability,
): boolean {
  return identity?.capabilities.includes(capability) ?? false;
}

/**
 * Valutazione ALL: il modulo richiede tutte le capability indicate.
 * Un elenco vuoto è sempre soddisfatto — serve ai moduli personali, che non
 * sono governati da grant.
 */
export function hasEveryCapability(
  identity: DashboardIdentity | null,
  capabilities: readonly DashboardCapability[],
): boolean {
  return capabilities.every((capability) => hasCapability(identity, capability));
}

/** Valutazione ANY: almeno una delle capability indicate. */
export function hasSomeCapability(
  identity: DashboardIdentity | null,
  capabilities: readonly DashboardCapability[],
): boolean {
  return capabilities.some((capability) => hasCapability(identity, capability));
}
