/**
 * Destinazioni del Dettaglio operativo Squadra (§18).
 *
 * «Tutti i collegamenti trasferiscono i riferimenti canonici necessari, non
 * copie dei dati visualizzati»: qui passa il **Team ID**, mai il nome della
 * squadra, la classificazione o i conteggi già a schermo. Il centro di
 * destinazione risolve il resto dal proprio dominio.
 *
 * Nessuna destinazione nuova: sono le stesse di `SOCIETY_HREFS`, con il
 * filtro Team aggiunto. §4 vieta di costruire un secondo Organico, un
 * secondo composer Posizioni o un secondo dettaglio Position.
 *
 * Perché ogni voce è gated anche su `isOwner`: `/club-admin/*` è
 * protetto da `profile.role === 'club_admin'` e le sezioni gestionali di
 * `/(tabs)/announcements` caricano il club tramite `clubs.owner_profile_id`.
 * Un membro con la capability giusta ma senza la proprietà verrebbe
 * rimbalzato dalla route, e §35 vieta i link che non portano da nessuna
 * parte. È lo stesso `requiresOwner` che DAS-REV-07 applica alle aree di
 * gestione.
 */

export const TEAM_DETAIL_HREFS = {
  /** Centro Candidature filtrato sulla squadra. */
  applications: (teamId: string) =>
    `/(tabs)/announcements?focus=applications&teamId=${encodeURIComponent(teamId)}`,
  /** Form condiviso di DAS-REV-08, stesso Team ID. */
  edit: (teamId: string) => `/club-teams/${encodeURIComponent(teamId)}`,
  /** Conversazione di gruppo nel dominio Messaggi. */
  group: (conversationId: string) =>
    `/messages/${encodeURIComponent(conversationId)}`,
  /** Centro Inviti e richieste filtrato sulla squadra. */
  invites: (teamId: string) =>
    `/club-admin/invites?teamId=${encodeURIComponent(teamId)}`,
  /**
   * Flusso Inviti condiviso con Team preimpostato (§12).
   *
   * Apre la gestione dell'Organico e vi chiede di aprire il modulo di
   * collegamento già posizionato sulla squadra. Non collega nessuno da solo:
   * la scelta della persona e la conferma restano nel flusso proprietario.
   */
  invitePerson: (teamId: string) =>
    `/club-admin/roster?teamId=${encodeURIComponent(teamId)}&invite=player`,
  /** Composer condiviso delle Posizioni con la squadra preselezionata. */
  newPosition: (teamId: string) =>
    `/(tabs)/announcements?focus=positions&compose=1&teamId=${encodeURIComponent(teamId)}`,
  /** Dettaglio gestionale della singola Posizione nel centro proprietario. */
  position: (teamId: string, adId: string) =>
    `/(tabs)/announcements?focus=positions&teamId=${encodeURIComponent(
      teamId,
    )}&adId=${encodeURIComponent(adId)}`,
  /** Centro Posizioni filtrato sulla squadra. */
  positions: (teamId: string) =>
    `/(tabs)/announcements?focus=positions&teamId=${encodeURIComponent(teamId)}`,
  /** Gestione canonica dell'Organico della stessa squadra. */
  roster: (teamId: string) =>
    `/club-admin/roster?teamId=${encodeURIComponent(teamId)}`,
  /** Ritorno senza origine nello stack (§18). */
  teamsCenter: "/(tabs)/dashboard/teams",
} as const;
