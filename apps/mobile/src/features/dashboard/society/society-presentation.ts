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

import {
  SELECTION_EVENTS_MODULE_DESCRIPTION,
  SELECTION_EVENTS_MODULE_TITLE,
} from "../events/events-copy";
import { SELECTION_EVENTS_HREFS } from "../events/events-routes";
import { POSITIONS_HREFS } from "../positions/positions-routes";
import { hasSomeCapability, type DashboardIdentity } from "../dashboard-types";
import { isFeatureAvailable } from "../modules/dashboard-features";
import type { QuickActionId } from "../modules/composition";
import type { SocietyOverview } from "../adapters/society-adapter";
import { hasStructuralDomain } from "../structure/structure-presentation";

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
  /**
   * Centro Rete societaria (DAS-REV-11 §2).
   *
   * «La voce Società collegate già prevista nella Dashboard apre
   * direttamente il nuovo centro Rete societaria. Non mantenere una pagina
   * intermedia con un secondo elenco delle stesse relazioni.» Puntava a
   * `/club-admin/affiliates`, che apriva l'editor manuale delle affiliate:
   * quella era la seconda lista, e ora non esiste più.
   */
  affiliates: "/(tabs)/dashboard/network",
  /**
   * Centro Candidature, eventualmente ristretto a una Posizione.
   *
   * DAS-REV-22 §12: «Ingresso: Dashboard della Society → Candidature
   * ricevute. Le preview del widget aprono lo stesso dettaglio; Vedi tutte
   * apre il centro secondo il contesto esplicito.» Era
   * `/(tabs)/announcements?focus=applications`, gated su `owns_club` e non
   * sulle capability.
   */
  applications: (adId?: string | null) =>
    adId
      ? `/(tabs)/dashboard/applications/position/${encodeURIComponent(adId)}`
      : "/(tabs)/dashboard/applications?from=dashboard",
  contentComposer: "/(tabs)/profile?compose=club",
  /** Centro Provini, stage e open day (DAS-REV-28 §7). */
  events: SELECTION_EVENTS_HREFS.center({ from: "dashboard" }),
  /**
   * Centro Inviti e richieste (DAS-REV-19 §6).
   *
   * Era `/club-admin/invites`, lo schermo legacy costruito su righe
   * `club_members` pending e gated sul ruolo `club_admin`. Il centro
   * canonico vive ora nello Stack della Dashboard ed è gated sulle
   * capability: un amministratore con `invites_view` ma senza la proprietà
   * non viene più rimbalzato.
   */
  invites: "/(tabs)/dashboard/invites?from=dashboard",
  /** Primo passo del composer: §6 lo vuole raggiungibile direttamente. */
  invitePerson: "/member-invite/search?from=dashboard",
  /**
   * Centro Amministratori (DAS-REV-13 §6).
   *
   * Era `/club-admin/permissions`, una schermata gated sul ruolo
   * `club_admin`. Il centro canonico vive ora nello Stack della Dashboard,
   * è gated sulle capability e conserva l'origine: §6 chiede che i due
   * ingressi — questo e l'hub — passino «la stessa Society canonica» senza
   * «una pagina intermedia tra l'entry e il centro».
   */
  permissions: "/(tabs)/dashboard/admins?from=dashboard",
  /**
   * Centro Posizioni aperte (DAS-REV-15 §5, §20).
   *
   * «Aggiorna gli ingressi della DAS-REV-07 e DAS-REV-09 in modo che
   * Gestisci/Vedi posizioni aprano questo Centro condiviso.» Puntava a
   * `/(tabs)/announcements`, che è owner-gated e mescola Posizioni e
   * Candidature: un amministratore con la capability ma senza la proprietà
   * veniva rimbalzato.
   *
   * Con un `adId` la destinazione è il **dettaglio gestionale** della
   * Position, non il Centro filtrato: §18 chiede che la riga apra «il
   * dettaglio gestionale della stessa Position».
   */
  positions: (adId?: string | null) =>
    adId
      ? POSITIONS_HREFS.detail(adId, { from: "dashboard" })
      : "/(tabs)/dashboard/positions?from=dashboard",
  /** Centro Stagioni e storico (DAS-REV-10 §9). */
  seasons: "/(tabs)/dashboard/seasons",
  /**
   * Centro Shortlist (DAS-REV-24 §8, §25).
   *
   * Puntava a `/shortlist`, fuori dalle tab: la bottom navigation spariva,
   * e §25 la vuole visibile con Dashboard selezionata. Il vecchio percorso
   * resta come reindirizzamento per i link già emessi (§26).
   */
  shortlist: "/(tabs)/dashboard/shortlist",
  societyProfile: (clubId: string) => `/club/${clubId}`,
  /**
   * Hub Struttura societaria (DAS-REV-12 §5).
   *
   * «Il tap apre direttamente la pagina Struttura societaria. Gestione
   * società è il nome della riga di ingresso, non una schermata intermedia.»
   */
  structure: "/(tabs)/dashboard/structure",
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
 * Due quantità **distinte**, ciascuna presente solo se consultabile, e §14
 * chiede di omettere l'aggregato non consultabile invece di mostrarlo a zero.
 *
 * `invitesIncomingCount` era sempre `null`: il dominio non modellava una
 * richiesta di adesione in attesa. DAS-REV-19 §15 la legge dal modello
 * canonico delle richieste avviate dalla persona, quindi il numero è ora
 * reale — e resta `null` per chi non ha `member_requests_view`.
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

/**
 * DAS-REV-24 §30: la copy della riga vive accanto alle altre stringhe
 * centralizzate. Non viene importata dal modulo Shortlist per non legare la
 * composizione della Dashboard al caricamento di quel feature module.
 */
export const SHORTLIST_MODULE_DESCRIPTION =
  "Profili selezionati e valutazioni interne";

export type ManagementAreaItem = {
  href: string;
  icon: IconName;
  id: string;
  /** DAS-REV-24 §8: solo dove la task che possiede la riga la prescrive. */
  subtitle?: string;
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
   * DAS-REV-12 §5: «Integra Gestione società › nella parte inferiore della
   * Dashboard Società, all'interno di Aree di gestione», in prima posizione
   * quando tutte le destinazioni del master 01 sono autorizzate.
   *
   * La riga **non** sostituisce le scorciatoie che seguono: §5 è esplicito —
   * «Il nuovo hub non deve rendere obbligatorio un passaggio aggiuntivo per
   * le scorciatoie già definite». Stagioni, Amministratori e Società
   * collegate restano raggiungibili in un tap da qui.
   *
   * `hasStructuralDomain` decide la riga, la RPC rivalida l'accesso: §5
   * chiede di omettere l'ingresso quando «nessun dominio strutturale è
   * disponibile per l'actor», e i soli dati master non sono un dominio
   * strutturale.
   */
  if (hasStructuralDomain(identity)) {
    items.push({
      href: SOCIETY_HREFS.structure,
      icon: "grid-outline",
      id: "structure",
      title: "Gestione società",
    });
  }

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

  /**
   * Shortlist (DAS-REV-24 §8).
   *
   * «Aggiungi o aggiorna la voce Shortlist nel modulo di navigazione della
   * Dashboard Società … titolo: Shortlist; descrizione: Profili selezionati
   * e valutazioni interne; icona coerente con il sistema condiviso.»
   *
   * §35: «L'icona Shortlist è distinta dal bookmark, coerente con la stella
   * del modulo» — `star-outline`, non `bookmark-outline`, che appartiene ai
   * Salvati personali e non va confuso con uno strumento della Società.
   *
   * §8: «Con accesso Shortlist assente, non mostrare la riga disabilitata.»
  */
  if (identity.capabilities.includes("shortlist_view")) {
    items.push({
      href: SOCIETY_HREFS.shortlist,
      icon: "star-outline",
      id: "shortlist",
      subtitle: SHORTLIST_MODULE_DESCRIPTION,
      title: "Shortlist",
    });
  }

  /**
   * Centro Provini, stage e open day (DAS-REV-28 §7).
   *
   * «Integra nella composizione Foundation la voce Centro Provini, stage e
   * open day, sottotitolo Organizza eventi di selezione e gestisci i
   * partecipanti, chevron. Usa area operativa coerente con
   * recruiting/scouting» — accanto a Shortlist, quindi.
   *
   * La chiave è la sola lettura: §7 vuole il modulo «visibile a chi può
   * consultarlo anche se il Centro è vuoto». Creare è deciso dentro, dal
   * backend.
   */
  if (
    identity.capabilities.includes("selection_events_view") &&
    isFeatureAvailable("society_selection_events")
  ) {
    items.push({
      href: SOCIETY_HREFS.events,
      icon: "calendar-number-outline",
      id: "selection_events",
      subtitle: SELECTION_EVENTS_MODULE_DESCRIPTION,
      title: SELECTION_EVENTS_MODULE_TITLE,
    });
  }

  /**
   * Amministratori e permessi (DAS-REV-13 §7.3).
   *
   * Era gated su `isOwner` perché la destinazione era owner-gated sul ruolo.
   * Il centro ha ora chiavi proprie, e §7.3 chiede che «la possibilità di
   * leggere gli attivi, leggere gli inviti, invitare e aprire Ruoli e
   * permessi» sia distinta: basta una delle tre letture perché la riga abbia
   * senso. Chi non ne ha nessuna non vede la voce — non una disabilitata.
   */
  if (
    identity.isOwner ||
    hasSomeCapability(identity, [
      "admins_view",
      "admin_invites_view",
      "admins_invite",
    ])
  ) {
    items.push({
      href: SOCIETY_HREFS.permissions,
      icon: "people-outline",
      id: "permissions",
      title: "Amministratori e permessi",
    });
  }

  /**
   * Società collegate (DAS-REV-11 §5).
   *
   * Era gated su `isOwner` perché `/club-admin/affiliates` è protetta dal
   * ruolo e non da una capability. Il centro ha ora una chiave propria, e
   * `network_view` è Society-level per costruzione: una delega limitata a un
   * Team non la ottiene (§5).
   */
  if (identity.isOwner || identity.capabilities.includes("network_view")) {
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
        "Invita calciatori, allenatori, staff e dirigenti già su PROLINK.",
      href: SOCIETY_HREFS.invitePerson,
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
