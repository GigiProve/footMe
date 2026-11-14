/**
 * Derivazioni pure di bozze e programmazione (HOM-06.2). Niente React, niente
 * rete: è qui che vivono le regole testabili.
 *
 *  • CTA (§77–§80, §88, §92–§94, §203–§206, §282–§286): «Ora» → «Pubblica»,
 *    data futura → «Programma». MAI «Programma» con Ora selezionato, anche se
 *    un mockup lo mostra (§80, criterio 102). «Pubblica ora» è solo l'azione su
 *    un contenuto già programmato (§93, §171) e non è mai la CTA del composer.
 *  • Scheduling (§95–§102): l'istante è scelto in data e ora civili nel fuso del
 *    dispositivo (nessun selector di fuso in V1, §101) e convertito in UTC una
 *    volta sola; il server rivalida lead time e orizzonte (§96–§98).
 *  • Lista (§140–§146, §156–§160): titoli di ripiego umani, mai id o null (§145).
 *  • Launcher (§4–§10): fast path solo quando il Post è l'unica azione.
 */

import type {
  ContentFormat,
  ContentLauncherState,
  DraftListItem,
  Publication,
  PublishingErrorKind,
  SchedulePolicy,
  UnschedulableReason,
  WirePublication,
} from "./publishing-types";

/**
 * Ripiego quando il server non manda la policy (§96: la fonte di verità resta
 * `app_policy_settings`; il server rivalida comunque lead time e orizzonte).
 */
export const DEFAULT_SCHEDULE_POLICY: SchedulePolicy = { maxHorizonDays: 365, minLeadMinutes: 5 };

/**
 * Publication → jsonb delle RPC. Vive qui (pura, senza supabase) perché il
 * composer Post la usa per il payload della bozza senza importare il client di
 * rete; `publishing-service` la riesporta.
 */
export function toWirePublication(publication: Publication | "keep"): WirePublication {
  if (publication === "keep") {
    return { mode: "keep" };
  }
  return publication.mode === "scheduled"
    ? { mode: "scheduled", scheduled_at: publication.scheduledAt, timezone: publication.timezone }
    : { mode: "now" };
}

/* ------------------------------------------------------------------ */
/* CTA e riga Pubblicazione                                            */
/* ------------------------------------------------------------------ */

export type CtaContext = {
  /** Modifica di un contenuto già programmato (§163–§167) o di un Articolo pubblicato (§218). */
  editing?: "scheduled" | "published" | null;
};

/**
 * §79: la CTA riflette SEMPRE il tipo di pubblicazione selezionato.
 * In modifica di un programmato o di un pubblicato la CTA è «Salva» (§167, §218).
 */
export function primaryCtaLabel(publication: Publication, context: CtaContext = {}): string {
  if (context.editing === "scheduled" || context.editing === "published") {
    return "Salva";
  }
  return publication.mode === "scheduled" ? "Programma" : "Pubblica";
}

const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const MONTHS_LONG = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Parti civili di un istante nel fuso indicato (§100: si mostra nel fuso
 * corrente dell'utente). Senza fuso: quello del dispositivo.
 */
export function civilParts(
  iso: string,
  timeZone?: string,
): { year: number; month: number; day: number; hour: number; minute: number } | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        month: "2-digit",
        timeZone,
        year: "numeric",
      }).formatToParts(date);
      const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? NaN);
      const result = {
        day: read("day"),
        hour: read("hour"),
        minute: read("minute"),
        month: read("month"),
        year: read("year"),
      };
      if (Object.values(result).every((value) => Number.isFinite(value))) {
        return result;
      }
    } catch {
      // Fuso sconosciuto al runtime: si ripiega sul dispositivo.
    }
  }

  return {
    day: date.getDate(),
    hour: date.getHours(),
    minute: date.getMinutes(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

/** «20 ago · 18:30» (§91, §159). */
export function formatScheduleShort(iso: string, timeZone?: string): string {
  const parts = civilParts(iso, timeZone);
  if (!parts) {
    return "";
  }
  return `${parts.day} ${MONTHS_SHORT[parts.month - 1]} · ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** Le due righe della lista Programmati: «20 ago» e «18:30» (§157, mockup 7). */
export function formatScheduleStacked(iso: string, timeZone?: string): { day: string; time: string } {
  const parts = civilParts(iso, timeZone);
  if (!parts) {
    return { day: "", time: "" };
  }
  return { day: `${parts.day} ${MONTHS_SHORT[parts.month - 1]}`, time: `${pad(parts.hour)}:${pad(parts.minute)}` };
}

/** «21 agosto 2026 · 08:00» (mockup 8). */
export function formatScheduleFull(iso: string, timeZone?: string): string {
  const parts = civilParts(iso, timeZone);
  if (!parts) {
    return "";
  }
  return `${parts.day} ${MONTHS_LONG[parts.month - 1]} ${parts.year} · ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** §253: «Pubblicazione programmata per 20 agosto 2026 alle 18:30». */
export function formatScheduleAccessible(iso: string, timeZone?: string): string {
  const parts = civilParts(iso, timeZone);
  if (!parts) {
    return "Pubblicazione programmata";
  }
  return `Pubblicazione programmata per ${parts.day} ${MONTHS_LONG[parts.month - 1]} ${parts.year} alle ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/** §81, §91: «Pubblicazione · Ora» / «Pubblicazione · 20 ago · 18:30». */
export function publicationRowLabel(publication: Publication): string {
  return publication.mode === "scheduled"
    ? `Pubblicazione · ${formatScheduleShort(publication.scheduledAt)}`
    : "Pubblicazione · Ora";
}

/** §209–§211: feedback di successo, nessuna schermata celebrativa (§212). */
export function submitSuccessCopy(format: ContentFormat, publication: Publication): string {
  const noun = format === "article" ? "Articolo" : "Post";

  if (publication.mode === "now") {
    return format === "article" ? "Articolo pubblicato" : "Post pubblicato";
  }

  const parts = civilParts(publication.scheduledAt);
  if (!parts) {
    return `${noun} programmato`;
  }
  return `${noun} programmato per il ${parts.day} ${MONTHS_LONG[parts.month - 1]} alle ${pad(parts.hour)}:${pad(parts.minute)}`;
}

/* ------------------------------------------------------------------ */
/* Scelta di data e ora                                                */
/* ------------------------------------------------------------------ */

/** Data civile `YYYY-MM-DD` e ora `HH:MM` nel fuso del dispositivo. */
export type CivilChoice = { date: string; time: string };

export type ScheduleValidation =
  | { ok: true; scheduledAt: string }
  | { ok: false; reason: "invalid" | "past" | "too_soon" | "too_far" };

/** Istante UTC delle parti civili nel fuso del dispositivo (§99, §102). */
export function civilToInstant(choice: CivilChoice): Date | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(choice.date);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(choice.time);
  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [year, month, day] = [Number(dateMatch[1]), Number(dateMatch[2]), Number(dateMatch[3])];
  const [hour, minute] = [Number(timeMatch[1]), Number(timeMatch[2])];
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);

  // Un giorno inesistente (31 febbraio) o un'ora saltata dal cambio d'ora non torna uguale.
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }
  return date;
}

/** Civile del dispositivo da un istante (riapertura di una bozza programmata). */
export function instantToCivil(iso: string): CivilChoice | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return {
    date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    time: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

/**
 * §95–§98: futura oltre il lead time minimo, entro l'orizzonte. Si rivalida
 * alla conferma (§98: l'ora può passare a composer aperto). Il server ha
 * l'ultima parola con il proprio orologio.
 */
export function validateScheduleChoice(
  choice: CivilChoice,
  policy: SchedulePolicy,
  now: Date = new Date(),
): ScheduleValidation {
  const instant = civilToInstant(choice);
  if (!instant) {
    return { ok: false, reason: "invalid" };
  }

  const diffMs = instant.getTime() - now.getTime();
  if (diffMs <= 0) {
    return { ok: false, reason: "past" };
  }
  if (diffMs < policy.minLeadMinutes * 60_000) {
    return { ok: false, reason: "too_soon" };
  }
  if (diffMs > policy.maxHorizonDays * 86_400_000) {
    return { ok: false, reason: "too_far" };
  }
  return { ok: true, scheduledAt: instant.toISOString() };
}

export function scheduleValidationCopy(
  reason: Exclude<ScheduleValidation, { ok: true }>["reason"],
  policy: SchedulePolicy,
): string {
  switch (reason) {
    case "past":
      return "Scegli una data e un'ora future.";
    case "too_soon":
      return `Programma almeno ${policy.minLeadMinutes} minuti più avanti.`;
    case "too_far":
      return `Puoi programmare al massimo ${policy.maxHorizonDays} giorni in avanti.`;
    default:
      return "Data o ora non valide.";
  }
}

/** Proposta iniziale del sheet: domani alla stessa ora arrotondata ai 30 minuti. */
export function defaultScheduleChoice(now: Date = new Date()): CivilChoice {
  const next = new Date(now.getTime() + 86_400_000);
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() < 30 ? 30 : 0);
  if (next.getMinutes() === 0) {
    next.setHours(next.getHours() + 1);
  }
  return instantToCivil(next.toISOString()) ?? { date: "", time: "" };
}

/** Fuso IANA del dispositivo (§99 `schedule_timezone`), `UTC` se non determinabile. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/* ------------------------------------------------------------------ */
/* Lista Bozze e programmati                                           */
/* ------------------------------------------------------------------ */

/** §141–§145: titolo o prima parte; ripieghi umani, mai id/null/Untitled. */
export function draftRowTitle(item: Pick<DraftListItem, "format" | "title" | "previewText">): string {
  const title = item.title?.trim();
  if (title) {
    return title;
  }
  if (item.format === "article") {
    return "Articolo senza titolo";
  }
  const preview = item.previewText?.trim();
  return preview ? preview : "Post senza testo";
}

/** §140, §7V: content type sempre «Post» / «Articolo»; la modalità solo come nota sobria. */
export function draftTypeLabel(item: Pick<DraftListItem, "format" | "creationMode">): string {
  if (item.format === "post") {
    return "Post";
  }
  if (item.creationMode === "external_link") {
    return "Articolo · Da link";
  }
  if (item.creationMode === "imported_text") {
    return "Articolo · Testo importato";
  }
  return "Articolo";
}

/** §141–§142: «Modificato 12 min fa», «Modificato ieri», «Modificato 2 giorni fa». */
export function editedAgoLabel(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "Modificato ora";
  if (minutes < 60) return `Modificato ${minutes} min fa`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Modificato ${hours} h fa`;
  if (hours < 48) return "Modificato ieri";

  const days = Math.floor(hours / 24);
  if (days < 7) return `Modificato ${days} giorni fa`;

  return `Modificato il ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** §191, §194: stato di un elemento della tab Programmati. */
export function scheduledStatusLabel(item: Pick<DraftListItem, "status">): string {
  if (item.status === "failed") return "Pubblicazione non riuscita";
  if (item.status === "publishing") return "Pubblicazione in corso";
  return "Programmato";
}

export function unschedulableCopy(reason: UnschedulableReason | null): string {
  switch (reason) {
    case "missing_title":
      return "Aggiungi un titolo per programmare l'articolo.";
    case "empty":
      return "Aggiungi un contenuto per programmarlo.";
    case "media_not_ready":
      return "Preparazione del video in corso";
    case "rights":
      return "Conferma i diritti sul contenuto per programmarlo.";
    case "source":
      return "Completa la fonte originale per programmarlo.";
    case "capability":
      return "Non è stato possibile programmare questo contenuto con l'identità selezionata.";
    default:
      return "Questo contenuto non può ancora essere programmato.";
  }
}

/** «4 bozze» / «1 bozza», «3 programmati» / «1 programmato» in fondo alla lista (mockup 6–7). */
export function listCountLabel(tab: "drafts" | "scheduled", count: number): string {
  if (tab === "drafts") {
    return count === 1 ? "1 bozza" : `${count} bozze`;
  }
  return count === 1 ? "1 programmato" : `${count} programmati`;
}

/**
 * §254: ogni bozza/programmato si legge come UNITÀ coerente, nell'ordine in cui
 * si vede: titolo, autore (con la verifica a parole, non solo l'icona), tipo, poi
 * lo stato o la data (§253) o l'ultima modifica. La data è nel fuso corrente
 * dell'utente (§100).
 */
export function draftRowAccessibilityLabel(
  item: Pick<DraftListItem, "format" | "title" | "previewText" | "creationMode" | "identity" | "status" | "scheduledAt" | "updatedAt">,
  now: Date = new Date(),
): string {
  const parts = [
    draftRowTitle(item),
    item.identity.isVerified ? `${item.identity.name}, profilo verificato` : item.identity.name,
    draftTypeLabel(item),
  ];

  if (item.status === "failed") {
    parts.push("Pubblicazione non riuscita");
  } else if (item.status === "publishing") {
    parts.push("Pubblicazione in corso");
  }

  if (item.status === "draft") {
    parts.push(editedAgoLabel(item.updatedAt, now));
  } else if (item.scheduledAt) {
    parts.push(formatScheduleAccessible(item.scheduledAt));
  }

  return parts.filter((part) => part.length > 0).join(". ");
}

export type ItemMenuActionId = "edit" | "schedule" | "reschedule" | "publish_now" | "move_to_draft" | "retry" | "delete";

export type ItemMenuEntry = { id: ItemMenuActionId; label: string; destructive: boolean; dividerBefore: boolean };

/**
 * Le voci del menu ••• con le loro etichette (§149, §162, §195): Bozza →
 * Modifica · Programma · (divisore) Elimina bozza; Programmato → Modifica
 * contenuto · Cambia data e ora · Pubblica ora · Sposta nelle bozze · (divisore)
 * Elimina; Fallito → Riprova · Modifica · Sposta nelle bozze · (divisore) Elimina.
 * Quali esistono dipende dalle capability dell'elemento, non dal ruolo.
 */
export function itemMenu(
  item: Pick<DraftListItem, "status" | "canEdit" | "canSchedule" | "canDelete">,
): ItemMenuEntry[] {
  const draft = item.status === "draft";
  const ids: ItemMenuActionId[] = draft
    ? draftMenuActions(item)
    : item.status === "failed"
      ? failedMenuActions(item)
      : scheduledMenuActions(item);

  const labels: Record<ItemMenuActionId, string> = {
    delete: draft ? "Elimina bozza" : "Elimina",
    edit: item.status === "scheduled" ? "Modifica contenuto" : "Modifica",
    move_to_draft: "Sposta nelle bozze",
    publish_now: "Pubblica ora",
    reschedule: "Cambia data e ora",
    retry: "Riprova",
    schedule: "Programma",
  };

  return ids.map((id) => ({ dividerBefore: id === "delete", destructive: id === "delete", id, label: labels[id] }));
}

export type DraftMenuAction = "edit" | "schedule" | "delete";
export type ScheduledMenuAction = "edit" | "reschedule" | "publish_now" | "move_to_draft" | "delete";
export type FailedMenuAction = "retry" | "edit" | "move_to_draft" | "delete";

/** §149: Modifica, Programma se consentito/applicabile, Elimina bozza. */
export function draftMenuActions(item: Pick<DraftListItem, "canEdit" | "canSchedule" | "canDelete">): DraftMenuAction[] {
  const actions: DraftMenuAction[] = [];
  if (item.canEdit) actions.push("edit");
  if (item.canSchedule) actions.push("schedule");
  if (item.canDelete) actions.push("delete");
  return actions;
}

/** §162: Modifica contenuto, Cambia data e ora, Pubblica ora, Sposta nelle bozze, Elimina. */
export function scheduledMenuActions(
  item: Pick<DraftListItem, "status" | "canEdit" | "canSchedule" | "canDelete">,
): ScheduledMenuAction[] {
  // §263: durante PUBLISHING nessuna operazione che creerebbe inconsistenza.
  if (item.status === "publishing") {
    return [];
  }
  const actions: ScheduledMenuAction[] = [];
  if (item.canEdit) actions.push("edit");
  if (item.canSchedule) actions.push("reschedule", "publish_now");
  if (item.canEdit) actions.push("move_to_draft");
  if (item.canDelete) actions.push("delete");
  return actions;
}

/** §195: Riprova, Modifica, Sposta nelle bozze (+ Elimina nel menu). */
export function failedMenuActions(
  item: Pick<DraftListItem, "canEdit" | "canSchedule" | "canDelete">,
): FailedMenuAction[] {
  const actions: FailedMenuAction[] = [];
  if (item.canSchedule) actions.push("retry");
  if (item.canEdit) actions.push("edit", "move_to_draft");
  if (item.canDelete) actions.push("delete");
  return actions;
}

/* ------------------------------------------------------------------ */
/* Launcher «+»                                                        */
/* ------------------------------------------------------------------ */

export type LauncherMode = "direct_post" | "sheet";

/**
 * §4–§10. Fast path (§5): il Post è l'unica creazione possibile E non c'è
 * nient'altro da raggiungere dal launcher — nessuna bozza, programmato o
 * fallito (§9: Bozze e programmati non dipende dall'Articolo). Con stato
 * sconosciuto (rete) si apre direttamente il Post come HOM-06.1.
 */
export function resolveLauncherMode(
  state: ContentLauncherState | null,
  extraActions: readonly string[] = [],
): LauncherMode {
  if (!state) {
    return extraActions.length > 0 ? "sheet" : "direct_post";
  }
  const pending = state.draftsCount + state.scheduledCount + state.failedCount;
  const onlyPost = !state.canPublishArticle && extraActions.length === 0;
  return onlyPost && pending === 0 ? "direct_post" : "sheet";
}

export type LauncherRowId = "post" | "article" | "drafts" | "open_position";

/**
 * §7–§10: le righe del foglio «Crea contenuto», dalle capability reali (§8).
 *  • sopra il divisore le CREAZIONI: Post (se non si sa che manca la capability) e
 *    Articolo solo con `can_publish_article` (§8);
 *  • sotto, ciò che si raggiunge: «Bozze e programmati» solo con `can_view_drafts`,
 *    indipendente dall'Articolo (§9); «Posizione aperta» per chi ha quell'azione
 *    (azione reale del club_admin, non una voce di mockup).
 * Con lo stato non ancora noto (rete) resta solo il Post, come HOM-06.1.
 */
export function launcherRows(
  state: ContentLauncherState | null,
  extraActions: readonly string[] = [],
): { primary: LauncherRowId[]; secondary: LauncherRowId[] } {
  const primary: LauncherRowId[] = [];
  const secondary: LauncherRowId[] = [];

  if (!state || state.canPublishPost) {
    primary.push("post");
  }
  if (state?.canPublishArticle) {
    primary.push("article");
  }
  if (state?.canViewDrafts) {
    secondary.push("drafts");
  }
  if (extraActions.includes("open_position")) {
    secondary.push("open_position");
  }

  return { primary, secondary };
}

/**
 * La tab con cui si apre «Bozze e programmati» dal «+»: Bozze, salvo che ci
 * siano solo programmati/falliti (i falliti stanno in Programmati, §191).
 */
export function draftsEntryTab(state: ContentLauncherState | null): "drafts" | "scheduled" {
  return state && state.draftsCount === 0 && state.scheduledCount + state.failedCount > 0 ? "scheduled" : "drafts";
}

/** Sottotitolo della riga «Bozze e programmati» (mockup 1: «I tuoi contenuti salvati»). */
export function draftsEntrySubtitle(state: ContentLauncherState | null): string {
  if (state && state.failedCount > 0) {
    return state.failedCount === 1
      ? "1 pubblicazione non riuscita"
      : `${state.failedCount} pubblicazioni non riuscite`;
  }
  return "I tuoi contenuti salvati";
}

/* ------------------------------------------------------------------ */
/* Errori                                                              */
/* ------------------------------------------------------------------ */

/** Copy non tecnica per ogni esito (§233, §237). */
export function publishingErrorCopy(kind: PublishingErrorKind, format: ContentFormat = "post"): string {
  switch (kind) {
    case "content_permission_denied":
    case "post_permission_denied":
    case "schedule_not_allowed":
    case "article_mode_not_allowed":
      return "Non è stato possibile pubblicare questo contenuto con l'identità selezionata.";
    case "content_not_found":
      return "Il contenuto non è più disponibile.";
    case "content_version_conflict":
      return "Il contenuto è stato modificato altrove. Ricarica per vedere l'ultima versione.";
    case "content_operation_conflict":
      return "L'operazione è già stata eseguita. Aggiorna per vedere lo stato attuale.";
    case "content_invalid_state":
      return "Lo stato del contenuto è cambiato. Aggiorna e riprova.";
    case "content_empty":
    case "post_invalid_content":
      return format === "article" ? "Aggiungi un testo all'articolo." : "Aggiungi un testo, un media o un link.";
    case "content_identity_change_requires_draft":
      return "Sposta il contenuto nelle bozze per cambiare identità.";
    case "schedule_in_past":
      return "Scegli una data e un'ora future.";
    case "schedule_too_soon":
      return "La data scelta è troppo vicina. Scegli un orario più avanti.";
    case "schedule_too_far":
      return "La data scelta è troppo lontana.";
    case "schedule_media_not_ready":
      return "Preparazione del video in corso";
    case "publication_invalid":
      return "Data o ora non valide.";
    case "article_missing_title":
      return "Inserisci un titolo";
    case "article_title_too_long":
      return "Il titolo è troppo lungo.";
    case "article_invalid_document":
      return "Alcuni elementi dell'articolo non sono validi. Controlla il testo.";
    case "article_body_too_long":
      return "L'articolo supera la lunghezza massima.";
    case "article_invalid_source":
      return "Non è stato possibile caricare l'anteprima. Controlla il link o inserisci i dati mancanti.";
    case "article_source_required":
      return "Indica la fonte originale.";
    case "article_rights_required":
      return "Conferma di avere i diritti sul contenuto.";
    case "article_duplicate":
      return "Questo articolo è già stato collegato.";
    case "article_cover_not_allowed":
      return "Un articolo collegato usa l'immagine della fonte originale.";
    case "post_media_limit":
      return "Hai superato il numero massimo di media.";
    case "post_invalid_media":
      return "Uno dei media non è valido. Rimuovilo e riprova.";
    case "post_invalid_mention":
    case "post_invalid_tag":
      return "Uno dei tag non è più valido. Controlla e riprova.";
    case "post_invalid_link":
      return "Il link non è valido.";
    case "network":
      return "Connessione assente. Riprova quando sei online.";
    default:
      return "Si è verificato un errore. Riprova.";
  }
}
