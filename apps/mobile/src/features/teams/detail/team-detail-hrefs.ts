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

import { POSITIONS_HREFS } from "../../dashboard/positions/positions-routes";

export const TEAM_DETAIL_HREFS = {
  /** Centro Candidature filtrato sulla squadra. */
  applications: (teamId: string) =>
    `/(tabs)/announcements?focus=applications&teamId=${encodeURIComponent(teamId)}`,
  /** Form condiviso di DAS-REV-08, stesso Team ID. */
  edit: (teamId: string) => `/club-teams/${encodeURIComponent(teamId)}`,
  /** Conversazione di gruppo nel dominio Messaggi. */
  group: (conversationId: string) =>
    `/messages/${encodeURIComponent(conversationId)}`,
  /**
   * Centro Inviti e richieste filtrato sulla squadra (DAS-REV-19 §6).
   *
   * Non più `/club-admin/invites`: il Centro canonico è gated sulle
   * capability e il filtro per squadra è quello reale del dominio, non un
   * `filter()` sul client.
   */
  invites: (teamId: string) =>
    `/(tabs)/dashboard/invites?from=team&teamId=${encodeURIComponent(teamId)}`,
  /**
   * Composer dell'invito con Team preimpostato (DAS-REV-19 §16).
   *
   * «Dal Dettaglio squadra preimposta il Team canonico quando il tipo di
   * incarico selezionato lo consente; non sostituire la scelta con una copia
   * del suo nome.» Passa quindi il Team ID, e il composer risolve il resto.
   *
   * Prima apriva la gestione dell'Organico con un parametro che le chiedeva
   * di aprire un modulo: due schermate per arrivare a una.
   */
  invitePerson: (teamId: string) =>
    `/member-invite/search?from=team&teamId=${encodeURIComponent(teamId)}`,
  /** Composer condiviso delle Posizioni con la squadra preselezionata. */
  newPosition: (teamId: string) =>
    `/(tabs)/announcements?focus=positions&compose=1&teamId=${encodeURIComponent(teamId)}`,
  /**
   * Dettaglio gestionale della singola Posizione (DAS-REV-15 §18).
   *
   * Lo stesso Position ID del Centro, della Dashboard e di Cerca: §18 vieta
   * di «creare un oggetto gestionale separato» per la stessa ricerca.
   */
  position: (adId: string) => POSITIONS_HREFS.detail(adId, { from: "team" }),
  /**
   * Centro Posizioni con la squadra preselezionata (DAS-REV-15 §5).
   *
   * «Dettaglio operativo squadra → Vedi posizioni: Centro con Team
   * preselezionato.» Il Centro è gated sulle capability e non sulla
   * proprietà, quindi questa voce non richiede più `isOwner`.
   */
  positions: (teamId: string) =>
    `/(tabs)/dashboard/positions?from=team&teamId=${encodeURIComponent(teamId)}`,
  /** Gestione canonica dell'Organico della stessa squadra. */
  roster: (teamId: string) =>
    `/club-admin/roster?teamId=${encodeURIComponent(teamId)}`,
  /** Ritorno senza origine nello stack (§18). */
  teamsCenter: "/(tabs)/dashboard/teams",
} as const;
