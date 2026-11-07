/**
 * Destinazioni canoniche del pack Candidature (§11, §29).
 *
 * Un posto solo, perché i quattro ingressi di §12 e §23 non possano
 * divergere: Dashboard Società, widget, dettaglio Position e deep link
 * portano tutti allo **stesso** dettaglio.
 *
 * Tutte le superfici vivono nello Stack annidato della tab Dashboard: §11 —
 * «Bottom navigation canonica Home | Cerca | Dashboard | Messaggi | Profilo,
 * Dashboard selezionata nelle superfici di questa task.» Non c'è nessun
 * flusso focalizzato qui: non si compone niente, si consulta.
 *
 * «I riferimenti sono ID canonici, non label» (§29), e §29 vieta di
 * «memorizzare in URL testo privato, nomi dei candidati, contatti o interi
 * oggetti serializzati»: in questi href non passa mai niente di diverso da
 * un id e da un'enumerazione.
 */

export type ApplicationsOrigin =
  | "dashboard"
  | "notification"
  | "position"
  | "widget";

function query(parts: Record<string, string | null | undefined>): string {
  const entries = Object.entries(parts).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].length > 0,
  );

  return entries.length === 0
    ? ""
    : `?${entries
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&")}`;
}

const CENTER = "/(tabs)/dashboard/applications";

export const APPLICATIONS_HREFS = {
  /** Centro generale (screen 01, 02, 04, 14, 15). */
  center: (input?: { from?: ApplicationsOrigin; tab?: "new" | "all" }) =>
    `${CENTER}${query({ from: input?.from, tab: input?.tab })}`,
  /** Dettaglio condiviso (screen 05-10, 16). */
  detail: (
    applicationId: string,
    input?: { adId?: string; from?: ApplicationsOrigin },
  ) =>
    `${CENTER}/${encodeURIComponent(applicationId)}${query({
      adId: input?.adId,
      from: input?.from,
    })}`,
  /**
   * Elenco di una singola Position (screen 12, 13).
   *
   * §23: «Per l'ingresso storico da una Position CLOSED apri Tutte, come 13.»
   * La tab arriva dalla route perché è il contesto a saperlo, non la
   * schermata: il default normale resta Nuove.
   */
  position: (positionId: string, input?: { tab?: "new" | "all" }) =>
    `${CENTER}/position/${encodeURIComponent(positionId)}${query({
      tab: input?.tab,
    })}`,
} as const;

/**
 * Destinazioni **di altri domini** raggiunte dal dettaglio (§21).
 *
 * «Il link al profilo e quello alla carriera hanno destinazioni diverse. Non
 * sostituirli entrambi con un generico Apri profilo.» Il Master Profile si
 * apre sulla tab Carriera per tutte e quattro le tipologie, quindi la
 * differenza non può essere la tab iniziale di default: il link alla
 * carriera la **chiede esplicitamente**, e può portare l'ancora di una
 * singola esperienza quando il profilo la supporta.
 */
export const CANDIDATE_HREFS = {
  /** §21: «Visualizza profilo completo apre il Master Profile canonico.» */
  profile: (personId: string) => `/profile/${encodeURIComponent(personId)}`,
  /**
   * §21: «Vedi carriera completa apre direttamente la tab Carriera.»
   *
   * L'ancora della singola esperienza non c'è: §18 la vuole «se il routing
   * supporta l'anchor; altrimenti aprono direttamente la tab Carriera», e il
   * Master Profile non espone oggi un punto di aggancio per esperienza. Il
   * parametro non viene messo in URL finché non significa qualcosa — §29
   * vieta di portarvi dati che nessuno consuma.
   */
  career: (personId: string) =>
    `/profile/${encodeURIComponent(personId)}${query({ tab: "career" })}`,
} as const;
