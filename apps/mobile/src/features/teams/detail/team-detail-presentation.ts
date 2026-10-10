/**
 * Presentazione del Dettaglio operativo Squadra (DAS-REV-09).
 *
 * Funzioni pure: le regole che la task verifica davvero — l'header che non
 * ripete se stesso, i conteggi che distinguono assenza da zero, la
 * composizione dei moduli derivata dai permessi — si controllano senza
 * montare una schermata.
 *
 * Qui non si decide **se** l'actor può vedere qualcosa: quello lo stabilisce
 * il backend. Qui si decide che cosa è **pertinente** mostrare dei dati che
 * ha già restituito (§10).
 */
import { teamClassificationLine } from "../teams-presentation";
import type { TeamDetailPayload, TeamPositionsPayload } from "./team-detail-service";

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("it-IT");
}

/**
 * Riga di classificazione dell'header (§8, §23).
 *
 * Due regole che il mockup mostra insieme e che è facile confondere:
 *
 *   master 01  "Under 18 · Élite"  — Tipo e Livello sono cose diverse;
 *   master 04  "Under 17 · Regionale" — il nome contiene il Tipo, ma il
 *              Livello non lo esprime: il Tipo resta;
 *   master 05  "Primavera 2"       — il Livello **inizia** con il Tipo, e
 *              ripeterlo darebbe "Primavera · Primavera 2".
 *
 * La discriminante quindi non è il nome della squadra ma il Livello: §23
 * chiede di non ripetere il Tipo «se già sufficientemente espresso», e
 * l'unico caso in cui lo è davvero è quello in cui il campionato lo contiene.
 * Resta una semplificazione visuale: i campi del modello non si fondono.
 */
export function teamDetailClassification(team: {
  hasSeasonConfig: boolean;
  levelLabel: string | null;
  name: string;
  typeLabel: string | null;
}): string | null {
  if (team.hasSeasonConfig && team.typeLabel && team.levelLabel) {
    if (normalize(team.levelLabel).startsWith(normalize(team.typeLabel))) {
      return team.levelLabel;
    }
  }

  // Gli altri casi — stagione non configurata, Livello assente, nome uguale
  // al Tipo — sono già risolti dal Centro Squadre e non vanno duplicati.
  return teamClassificationLine(team);
}

/** "Squadra di AC Como". La verifica appartiene alla parent, mai al Team (§8). */
export function teamParentLine(clubName: string): string | null {
  return clubName.trim().length > 0 ? `Squadra di ${clubName.trim()}` : null;
}

/**
 * "Cantù · 2026/27" (§8).
 *
 * Città assente: resta la sola stagione, senza separatore pendente. Stagione
 * assente: resta la sola città. Entrambe assenti: nessuna riga.
 */
export function teamPlaceSeasonLine(team: {
  city: string | null;
  seasonLabel: string | null;
}): string | null {
  const parts = [team.city, team.seasonLabel].filter(
    (part): part is string => !!part && part.trim().length > 0,
  );

  return parts.length > 0 ? parts.join(" · ") : null;
}

/**
 * Lettura dell'header per lo screen reader (§29).
 *
 * «Comashi, squadra di AC Como, Under 18, Élite, Cantù, stagione 2026/27»,
 * con la verifica associata alla **Società**: il check non è un attributo
 * del Team e non deve essere annunciato come tale.
 */
export function teamHeaderAccessibilityLabel(team: {
  city: string | null;
  clubIsVerified: boolean;
  clubName: string;
  hasSeasonConfig: boolean;
  levelLabel: string | null;
  name: string;
  seasonLabel: string | null;
  typeLabel: string | null;
}): string {
  const parent = teamParentLine(team.clubName);

  return [
    team.name,
    parent
      ? team.clubIsVerified
        ? `${parent}, società verificata`
        : parent
      : null,
    teamDetailClassification(team),
    team.city,
    team.seasonLabel ? `stagione ${team.seasonLabel}` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/** "19 calciatori · 4 staff". `null` = non consultabile, mai zero (§11). */
export function rosterSummaryLine(team: {
  rosterPlayersCount: number | null;
  rosterStaffCount: number | null;
}): string | null {
  const parts: string[] = [];

  if (team.rosterPlayersCount !== null) {
    parts.push(
      `${team.rosterPlayersCount} ${plural(
        team.rosterPlayersCount,
        "calciatore",
        "calciatori",
      )}`,
    );
  }

  if (team.rosterStaffCount !== null) {
    parts.push(`${team.rosterStaffCount} staff`);
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** "19 calciatori e 4 membri dello staff" (§29): "staff" letto per esteso. */
export function rosterSummaryAccessibilityLabel(team: {
  rosterPlayersCount: number | null;
  rosterStaffCount: number | null;
}): string | null {
  const parts: string[] = [];

  if (team.rosterPlayersCount !== null) {
    parts.push(
      `${team.rosterPlayersCount} ${plural(
        team.rosterPlayersCount,
        "calciatore",
        "calciatori",
      )}`,
    );
  }

  if (team.rosterStaffCount !== null) {
    parts.push(
      `${team.rosterStaffCount} ${plural(
        team.rosterStaffCount,
        "membro dello staff",
        "membri dello staff",
      )}`,
    );
  }

  return parts.length > 0 ? parts.join(" e ") : null;
}

/**
 * L'Organico è realmente vuoto (§12)?
 *
 * Vero solo con **entrambi** i conteggi noti e pari a zero: un conteggio
 * assente è "non consultabile" e non autorizza la frase "Nessuna persona
 * ancora collegata".
 */
export function isRosterEmpty(team: {
  rosterPlayersCount: number | null;
  rosterStaffCount: number | null;
}): boolean {
  return team.rosterPlayersCount === 0 && team.rosterStaffCount === 0;
}

/**
 * "2 attive" · "1 attiva". Metadato grigio, non interattivo (§13).
 *
 * Tre esiti distinti, e il terzo è quello che il mockup rende esplicito:
 *
 *   `null`  non consultabile o non caricato — nessun metadato;
 *   `0`     zero confermato — nessun metadato, perché accanto a "Nessuna
 *           posizione aperta" lo "0 attive" del master 04 non compare: §14
 *           non vuole che lo zero diventi un dato da leggere due volte;
 *   `n > 0` il conteggio del backend, che non dipende dalle anteprime.
 */
export function positionsCountLabel(activeCount: number | null): string | null {
  if (activeCount === null || activeCount === 0) {
    return null;
  }

  return `${activeCount} ${plural(activeCount, "attiva", "attive")}`;
}

/** "Calciatore" · "Allenatore" · "Staff" (§13). */
export function positionRoleLabel(targetRole: string | null): string | null {
  switch (targetRole) {
    case "player":
      return "Calciatore";
    case "coach":
      return "Allenatore";
    case "staff":
      return "Staff";
    default:
      return null;
  }
}

/**
 * "7 candidature · 3 nuove" (§15).
 *
 * Senza candidature nuove resta il solo totale: "7 candidature · 0 nuove"
 * sarebbe uno zero decorativo. I due valori restano comunque separati, e
 * aprire la pagina non azzera il secondo.
 */
export function applicationsSummaryLine(team: {
  applicationsCount: number | null;
  applicationsNewCount: number | null;
}): string | null {
  if (team.applicationsCount === null) {
    return null;
  }

  const total = `${team.applicationsCount} ${plural(
    team.applicationsCount,
    "candidatura",
    "candidature",
  )}`;

  if (!team.applicationsNewCount) {
    return total;
  }

  return `${total} · ${team.applicationsNewCount} ${plural(
    team.applicationsNewCount,
    "nuova",
    "nuove",
  )}`;
}

/** "2 in attesa" (§16). */
export function invitesSummaryLine(pending: number | null): string | null {
  return pending === null ? null : `${pending} in attesa`;
}

/**
 * Composizione autorizzata e pertinente dei moduli (§10).
 *
 * L'ordine è fisso e non si riordina al variare dei numeri. Quello che
 * cambia è **quali** moduli esistono, e per tre ragioni diverse che non
 * vanno confuse:
 *
 *   · non autorizzato        → assente, senza lock né placeholder (§9);
 *   · autorizzato e in errore → presente, con il proprio stato locale (§24);
 *   · autorizzato e vuoto     → dipende dal modulo: Organico e Posizioni
 *                               hanno un empty con CTA, Candidature e Inviti
 *                               si omettono perché non c'è utilità operativa
 *                               (§15, §16).
 *
 * Il caso "squadra appena creata" del master 04 nasce proprio da qui: una
 * sola CTA "Invita persona", nessun secondo empty di Inviti.
 */
export type TeamDetailModule =
  | "roster"
  | "positions"
  | "applications"
  | "invites"
  | "group";

export function teamDetailComposition(input: {
  /** Le Posizioni sono un provider a parte: può fallire da solo (§24). */
  positions: TeamPositionsPayload | null;
  positionsFailed: boolean;
  team: TeamDetailPayload;
}): TeamDetailModule[] {
  const { positions, positionsFailed, team } = input;
  const modules: TeamDetailModule[] = [];

  if (team.canViewRoster) {
    modules.push("roster");
  }

  // Autorizzato: il modulo resta anche quando il caricamento è fallito —
  // §14 vieta di dichiarare "Nessuna posizione aperta" al posto di un errore.
  if (team.canViewPositions && (positionsFailed || positions?.canView !== false)) {
    modules.push("positions");
  }

  // Zero candidature senza utilità operativa: modulo omesso, non zero
  // decorativo (§15). L'omissione deriva da una risposta valida.
  if (team.canViewApplications && (team.applicationsCount ?? 0) > 0) {
    modules.push("applications");
  }

  // Idem per gli inviti (§16): la squadra appena creata non mostra un
  // secondo empty accanto a quello dell'Organico.
  if (team.canViewInvites && (team.invitesPendingCount ?? 0) > 0) {
    modules.push("invites");
  }

  // Il dominio non conosce le squadre: finché `groupSupported` è falso il
  // modulo non esiste, né come riga né come empty con CTA (§17, §35).
  if (team.groupSupported) {
    modules.push("group");
  }

  return modules;
}
