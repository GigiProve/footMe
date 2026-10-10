/**
 * Presentazione della Dashboard Società (DAS-REV-07).
 *
 * Funzioni pure, fuori dal componente: le regole che la task verifica —
 * perimetro dei conteggi, righe autorizzate, destinazioni con il contesto
 * giusto — si controllano senza montare la Dashboard, e restano leggibili
 * accanto al paragrafo che le impone.
 *
 * Nessuna di queste funzioni interroga il backend. Un aggregato `null` resta
 * `null`: significa "non autorizzato", e §8 vieta di convertirlo in zero.
 */

import type Ionicons from "@expo/vector-icons/Ionicons";

import type { DashboardIdentity } from "../dashboard-types";
import { isFeatureAvailable } from "../modules/dashboard-features";
import type { QuickActionId } from "../modules/composition";
import type { SocietyOverview } from "../adapters/society-adapter";

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * Destinazioni canoniche (§20).
 *
 * Un posto solo, così "Gestisci", la priorità e la riga non possono divergere
 * silenziosamente. I riferimenti sono **strutturati** — id di risorsa, mai
 * nome visualizzato o indice di riga.
 *
 * Il centro Posizioni e il centro Candidature sono oggi la stessa schermata
 * (`app/(tabs)/announcements.tsx`): il parametro `focus` dice quale gruppo
 * aprire, perché §13 vieta di «aprire una lista vuota o estranea al gruppo
 * mostrato».
 */
export const SOCIETY_HREFS = {
  affiliates: "/club-admin/affiliates",
  /** Centro Candidature, eventualmente ristretto a una Posizione. */
  applications: (adId?: string | null) =>
    adId
      ? `/(tabs)/announcements?focus=applications&adId=${encodeURIComponent(adId)}`
      : "/(tabs)/announcements?focus=applications",
  contentComposer: "/(tabs)/profile?compose=club",
  invites: "/club-admin/invites",
  permissions: "/club-admin/permissions",
  /** Centro Posizioni, filtrato sulle aperte. */
  positions: (adId?: string | null) =>
    adId
      ? `/(tabs)/announcements?focus=positions&adId=${encodeURIComponent(adId)}`
      : "/(tabs)/announcements?focus=positions",
  /** Centro Stagioni e storico (DAS-REV-10 §9). */
  seasons: "/(tabs)/dashboard/seasons",
  shortlist: "/shortlist",
  societyProfile: (clubId: string) => `/club/${clubId}`,
  teams: "/(tabs)/dashboard/teams",
} as const;

/** Plurale minimo, senza concatenazioni fragili. */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

/**
 * Label della riga candidatura **dal lato Società** (§10).
 *
 * Non è un nuovo `application_status`: §10 è categorico — «Non creare
 * application_status = NEW per riprodurre la label Nuova». Gli stati sono
 * quelli canonici dell'Application; cambia chi li legge.
 *
 * `APPLICATION_STATUS_LABELS` racconta il percorso del **candidato**
 * ("Inviata", "In lettura"): è la frase giusta in "Le tue candidature" e la
 * frase sbagliata nella Dashboard del club, dove la stessa riga significa
 * "arrivata, non ancora valutata". Due vocabolari sullo stesso lifecycle, non
 * due lifecycle.
 *
 * L'indicatore di novità resta quindi derivato dallo stato canonico e non da
 * un flag Dashboard indipendente: rimuoverlo richiede che il dominio faccia
 * avanzare la candidatura, non che qualcuno apra la Dashboard.
 */
const SOCIETY_APPLICATION_STATUS_LABELS: Record<string, string> = {
  accepted: "Accettata",
  rejected: "Rifiutata",
  reviewing: "In valutazione",
  shortlisted: "In shortlist",
  submitted: "Nuova",
  withdrawn: "Ritirata",
};

export function societyApplicationStatusLabel(status: string): string | null {
  // Uno stato che questa build non conosce non viene reso con un'etichetta
  // arbitraria: la riga resta senza label invece di dichiarare il falso.
  return SOCIETY_APPLICATION_STATUS_LABELS[status] ?? null;
}

/**
 * Frasi del modulo "Inviti e richieste" (§14).
 *
 * Due quantità **distinte**, ciascuna presente solo se consultabile. Oggi
 * `invitesIncomingCount` è sempre `null` — il dominio non modella una
 * richiesta di adesione in attesa — e §14 chiede di omettere l'aggregato non
 * consultabile invece di mostrarlo a zero.
 */
export function societyInviteLines(overview: SocietyOverview): string[] {
  const lines: string[] = [];

  if (overview.invitesIncomingCount !== null) {
    lines.push(
      `${overview.invitesIncomingCount} ${plural(
        overview.invitesIncomingCount,
        "richiesta ricevuta",
        "richieste ricevute",
      )}`,
    );
  }

  if (overview.invitesPendingCount !== null) {
    lines.push(
      `${overview.invitesPendingCount} ${plural(
        overview.invitesPendingCount,
        "invito in attesa",
        "inviti in attesa",
      )}`,
    );
  }

  return lines;
}

/**
 * Contesto leggero di una squadra nella preview (§15).
 *
 * "Prima squadra — Serie D", "Primavera — Settore giovanile": la categoria
 * aggiunge qualcosa solo quando non ripete il nome. Nel dominio i due
 * coincidono spesso ("Under 17" categorizzata "Under 17"), e ripeterli
 * produrrebbe una riga che non dice nulla due volte.
 */
export function teamContextLabel(
  name: string,
  category: string | null,
): string | null {
  if (!category) {
    return null;
  }

  const normalize = (value: string) => value.trim().toLocaleLowerCase("it-IT");

  return normalize(category) === normalize(name) ? null : category;
}

export type ManagementAreaItem = {
  href: string;
  icon: IconName;
  id: string;
  title: string;
};

/**
 * Righe di "Aree di gestione" (§16).
 *
 * Ogni voce è filtrata per conto proprio: §16 vieta di esporre "Amministratori
 * e permessi" a chi può soltanto gestire una squadra, e una riga non
 * autorizzata è **assente** — non disabilitata, senza lucchetto e senza spazio
 * riservato (§14 della composizione).
 *
 * "Profilo della società" non ha capability proprie: chi apre la Dashboard
 * della Società può raggiungerne il profilo canonico, che è pubblico.
 *
 * `isOwner` non è un permesso inventato qui: `app/club-admin/_layout` redirige
 * chi non ha `profile.role === 'club_admin'`, quindi per un membro autorizzato
 * quelle due righe sarebbero un rimbalzo immediato.
 */
export function buildManagementAreas(
  identity: DashboardIdentity,
): ManagementAreaItem[] {
  const items: ManagementAreaItem[] = [];

  /**
   * DAS-REV-10 §9: «Integrare nella composizione Dashboard una riga
   * operativa leggera Stagioni e storico, autorizzata e con destinazione
   * reale. Non imporre Dashboard → Squadre → Dettaglio operativo come
   * passaggio obbligatorio.»
   *
   * La chiave è `teams_view`, la stessa con cui il Centro Stagioni filtra
   * l'elenco: la riga non deve essere visibile a chi aprendola troverebbe
   * zero squadre consultabili. Le capability di scrittura — preparare,
   * correggere, disattivare — sono verificate dentro, squadra per squadra.
   */
  if (
    identity.capabilities.includes("teams_view") &&
    isFeatureAvailable("society_seasons")
  ) {
    items.push({
      href: SOCIETY_HREFS.seasons,
      icon: "calendar-outline",
      id: "seasons",
      title: "Stagioni e storico",
    });
  }

  if (identity.capabilities.includes("shortlist_view")) {
    items.push({
      href: SOCIETY_HREFS.shortlist,
      icon: "clipboard-outline",
      id: "shortlist",
      title: "Shortlist",
    });
  }

  if (identity.isOwner) {
    items.push({
      href: SOCIETY_HREFS.permissions,
      icon: "people-outline",
      id: "permissions",
      title: "Amministratori e permessi",
    });

    items.push({
      href: SOCIETY_HREFS.affiliates,
      icon: "link-outline",
      id: "affiliates",
      title: "Società collegate",
    });
  }

  items.push({
    href: SOCIETY_HREFS.societyProfile(identity.id),
    icon: "settings-outline",
    id: "society_profile",
    title: "Profilo della società",
  });

  return items;
}

export type FirstRunProposalSpec = {
  actionLabel: string;
  body: string;
  href: string;
  icon: IconName;
  id: string;
  title: string;
};

/**
 * Proposte del primo utilizzo (§18, master 04).
 *
 * Derivano dalle **azioni rapide già autorizzate**, non dal ruolo: §18 chiede
 * di mostrare «soltanto le proposte autorizzate e tecnicamente disponibili», e
 * il secondo testo «presuppone il supporto effettivo agli inviti esterni» —
 * che qui esiste, perché il centro Inviti genera link condivisibili.
 *
 * Con soli permessi di consultazione l'elenco è vuoto e il chiamante ricade
 * sull'empty informativo senza azioni.
 */
export function societyFirstRunProposals(
  quickActions: QuickActionId[],
): FirstRunProposalSpec[] {
  const proposals: FirstRunProposalSpec[] = [];

  if (quickActions.includes("society_new_position")) {
    proposals.push({
      actionLabel: "Nuova posizione",
      body: "Trova calciatori, allenatori e staff per il club.",
      href: SOCIETY_HREFS.positions(),
      icon: "briefcase-outline",
      id: "first_position",
      title: "Pubblica la tua prima posizione",
    });
  }

  if (quickActions.includes("society_invite_person")) {
    proposals.push({
      actionLabel: "Invita persona",
      body:
        "Invita calciatori, allenatori, staff e dirigenti, anche se non sono " +
        "su PROLINK.",
      href: SOCIETY_HREFS.invites,
      icon: "people-outline",
      id: "first_invite",
      title: "Costruisci l'organico",
    });
  }

  if (
    proposals.length === 0 &&
    quickActions.includes("society_new_post") &&
    isFeatureAvailable("society_content_create")
  ) {
    // §18: «Con soli permessi editoriali proporre l'avvio di contenuti
    // attraverso il sistema condiviso, senza suggerire operazioni sportive.»
    proposals.push({
      actionLabel: "Nuovo contenuto",
      body: "Racconta la stagione del club con post e contenuti.",
      href: SOCIETY_HREFS.contentComposer,
      icon: "create-outline",
      id: "first_content",
      title: "Pubblica il primo contenuto",
    });
  }

  return proposals.slice(0, 2);
}
