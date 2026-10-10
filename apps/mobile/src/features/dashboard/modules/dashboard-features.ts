/**
 * Disponibilità reale delle destinazioni della Dashboard.
 *
 * §4 della task: «Se una funzione di destinazione è già disponibile, integra
 * il percorso reale. Se è prevista ma non implementata, registra il blocco e
 * il pack responsabile, implementa il contratto di integrazione e mantieni la
 * funzione non disponibile nella composizione di produzione tramite
 * configurazione.»
 *
 * Questo file è quella configurazione. Un modulo con `available: false` non
 * viene composto in produzione: non diventa una CTA morta, una schermata
 * "Prossimamente" o un dato finto. Il contratto esiste già (tipi, adapter,
 * colonne nella RPC), così il pack competente deve solo invertire il flag.
 *
 * Ogni voce falsa dichiara **perché** è falsa e **chi** la risolve: un flag
 * senza quelle due informazioni diventa debito invisibile.
 */

export type DashboardFeatureKey =
  | "personal_applications"
  | "personal_availability"
  | "personal_event_registrations"
  | "personal_profile_requirements"
  | "personal_recent_updates"
  | "personal_saved_positions"
  | "society_applications"
  | "society_content_create"
  | "society_drafts"
  | "society_article_composer"
  | "society_invites"
  | "society_management_areas"
  | "society_positions"
  | "society_recent_content"
  | "society_scheduled_content"
  | "society_team_detail"
  | "society_teams";

type FeatureConfig = {
  available: boolean;
  /** Perché non è disponibile, e quale pack la rende tale. Vuoto se available. */
  blockedReason?: string;
  owner?: string;
};

export const DASHBOARD_FEATURES: Record<DashboardFeatureKey, FeatureConfig> = {
  // ── Disponibili: la destinazione esiste e funziona oggi ────────────────
  personal_applications: { available: true },
  personal_saved_positions: { available: true },
  personal_availability: { available: true },
  personal_profile_requirements: { available: true },
  personal_recent_updates: { available: true },
  society_positions: { available: true },
  society_applications: { available: true },
  society_teams: { available: true },
  society_drafts: { available: true },
  society_recent_content: { available: true },
  society_content_create: { available: true },
  society_management_areas: { available: true },
  /**
   * DAS-REV-07 §14: il centro "Inviti e richieste" esiste
   * (`app/club-admin/invites.tsx`) e il modulo ne mostra il riepilogo.
   *
   * Resta `requiresOwner` nel registry, non bloccato qui: la funzione c'è,
   * ma la sua route è ancora gated sul ruolo `club_admin`. Distinguere le due
   * cose conta — "non esiste" e "esiste per il solo proprietario" non si
   * risolvono con lo stesso lavoro.
   */
  society_invites: { available: true },

  // ── Non disponibili: contratto pronto, dominio assente ─────────────────
  /**
   * DAS-REV-03 §16: «Se provini o registrazioni non sono ancora disponibili
   * nel progetto: mantenere dichiarata l'integrazione; proteggerne la
   * disponibilità con il meccanismo esistente; non mostrare CTA non
   * funzionanti in produzione.»
   *
   * `dashboard_position_action_state` conosce già l'action type `register` nel
   * suo vocabolario e non lo emette mai: non esiste un Event con iscrizione.
   * Le scadenze promosse oggi sono quindi solo quelle delle Posizioni con
   * `application_deadline_at`, e nessuna CTA "Iscriviti" viene disegnata.
   */
  personal_event_registrations: {
    available: false,
    blockedReason:
      "Il dominio Eventi/provini non esiste: nessuna tabella di evento, " +
      "nessuna iscrizione, nessun termine di registrazione. La scadenza " +
      "promossa resta quella della Posizione (application_deadline_at) e " +
      "l'action type 'register' non viene mai emesso.",
    owner: "Pack Eventi (DAS-REV-28–31)",
  },
  society_scheduled_content: {
    available: false,
    blockedReason:
      "club_media_posts.status ammette solo draft/published/archived: non " +
      "esiste uno stato 'scheduled' né un istante di pubblicazione futura. " +
      "La colonna scheduled_count della RPC resta null finché non esiste.",
    owner: "Pack editoriale Società (HOM)",
  },
  society_team_detail: {
    available: false,
    blockedReason:
      "DAS-REV-07 §15 chiede che la riga Squadra apra il dettaglio operativo " +
      "con Society ID, Team ID e stagione. Esiste solo /club/team/[id], che è " +
      "il profilo pubblico della squadra, e §15 vieta di sostituire la " +
      "destinazione gestionale con quello. Le righe della preview restano " +
      "informative finché il centro Squadre non espone un dettaglio proprio.\n" +
      "DAS-REV-08: il Centro Squadre esiste e la sua riga apre il form di " +
      "modifica di quel pack quando l'actor può modificarla — una " +
      "destinazione reale, non un sostituto pubblico. Il dettaglio " +
      "operativo vero (organico, attività, stagioni) resta di DAS-REV-09 e " +
      "il flag resta falso finché non esiste.",
    owner: "DAS-REV-09 — dettaglio operativo squadra",
  },
  society_article_composer: {
    available: false,
    blockedReason:
      "club_media_posts.kind ammette highlights/interview/market/statement/" +
      "training/event: il dominio editoriale della Società non distingue POST " +
      "da ARTICLE e ha un solo composer. Due pulsanti porterebbero alla stessa " +
      "destinazione, quindi §11 ne mostra uno finché HOM-06.1/06.2 non " +
      "introducono le due tipologie.",
    owner: "HOM-06.1 / HOM-06.2 — pack editoriale",
  },
};

export function isFeatureAvailable(key: DashboardFeatureKey): boolean {
  return DASHBOARD_FEATURES[key]?.available ?? false;
}

/** Elenco dei blocchi attivi, per la diagnostica e la consegna del pack. */
export function listBlockedFeatures(): {
  key: DashboardFeatureKey;
  owner: string;
  reason: string;
}[] {
  return (
    Object.entries(DASHBOARD_FEATURES) as [DashboardFeatureKey, FeatureConfig][]
  )
    .filter(([, config]) => !config.available)
    .map(([key, config]) => ({
      key,
      owner: config.owner ?? "non assegnato",
      reason: config.blockedReason ?? "non documentato",
    }));
}
