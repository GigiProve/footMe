/**
 * Azioni sugli elementi di «Bozze e programmati» (HOM-06.2 §147–§153, §162–§179,
 * §195–§198, §263–§266).
 *
 * Un solo posto per i comandi di gestione: Modifica, Programma / Cambia data e ora,
 * Pubblica ora, Riprova, Sposta nelle bozze, Elimina. Ogni comando è una RPC
 * rivalidata dal server (capability, stato, versione): qui si traduce l'esito in
 * feedback — toast sobrio, copy non tecnica (§233), nessuna schermata
 * celebrativa (§212).
 *
 *  • dopo OGNI azione si rileggono liste e contatori del «+» (§234) e le superfici
 *    che mostrano il contenuto (Feed, Salvati, Profilo, Cerca) si marcano stale
 *    senza spostare nulla (stessa funzione del composer, `applyPublishToCaches`);
 *  • `content_version_conflict`, `content_invalid_state` e `content_not_found`
 *    significano «lo stato è cambiato altrove» (worker, altro amministratore,
 *    §262–§266): si rilegge la lista, il comando non si ritenta da solo;
 *  • «Cambia data e ora» restituisce l'esito al foglio, che mostra l'errore sotto i
 *    campi invece di un toast (§169: lo stesso foglio del composer).
 */

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useState } from "react";

import { useToast } from "../../ui";
import { applyPublishToCaches } from "../post-composer/composer-cache";
import { trackPublishing } from "./publishing-analytics";
import { publishingKeys } from "./publishing-keys";
import { publishingErrorCopy, submitSuccessCopy } from "./publishing-presentation";
import { openDraftHref } from "./publishing-routes";
import {
  deleteContentDraft,
  moveContentToDraft,
  publishContentNow,
  PublishingRequestError,
  scheduleContent,
} from "./publishing-service";
import type { DraftListItem, Publication, PublishingErrorKind } from "./publishing-types";

export type DraftActionOutcome = { ok: true } | { ok: false; kind: PublishingErrorKind; message: string };

/** L'identità stabile di un elemento: lo stesso id può esistere in tre tabelle (§188). */
export function draftItemKey(item: Pick<DraftListItem, "ref">): string {
  return `${item.ref.contentType}:${item.ref.contentId}`;
}

/** Lo stato è cambiato altrove: l'elenco si rilegge, il comando non si ritenta (§262–§266). */
const STALE_STATE_KINDS: readonly PublishingErrorKind[] = [
  "content_version_conflict",
  "content_invalid_state",
  "content_not_found",
];

export function useDraftActions({ userId, profileId }: { userId: string; profileId: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();
  /** L'elemento su cui un comando è in corso: niente secondo comando sullo stesso (§263–§264). */
  const [busyKey, setBusyKey] = useState<string | null>(null);

  async function refreshAfterChange() {
    applyPublishToCaches(queryClient, { profileId });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: publishingKeys.lists(userId) }),
      queryClient.invalidateQueries({ queryKey: publishingKeys.launcher(userId) }),
    ]);
  }

  async function perform(
    item: DraftListItem,
    operation: () => Promise<unknown>,
    options: { success: string | null; toastOnError: boolean },
  ): Promise<DraftActionOutcome> {
    setBusyKey(draftItemKey(item));

    try {
      await operation();
      await refreshAfterChange();

      if (options.success) {
        showToast({ message: options.success, tone: "success" });
      }

      return { ok: true };
    } catch (error) {
      const kind: PublishingErrorKind = error instanceof PublishingRequestError ? error.parsed.kind : "unknown";
      const message = publishingErrorCopy(kind, item.format);

      if (STALE_STATE_KINDS.includes(kind)) {
        await refreshAfterChange();
      }

      if (options.toastOnError) {
        showToast({ message, tone: "neutral" });
      }

      return { kind, message, ok: false };
    } finally {
      setBusyKey(null);
    }
  }

  /** §147: Post → composer HOM-06.1 sulla bozza; Articolo → editor nella modalità salvata. */
  function edit(item: DraftListItem) {
    trackPublishing({ format: item.format, name: item.status === "draft" ? "draft_opened" : "scheduled_opened_item" });
    router.push(openDraftHref(item.format, item.ref, item.creationMode) as never);
  }

  /** §171–§174: «Pubblica ora» su un programmato. Una sola transizione vincente (§264). */
  async function publishNow(item: DraftListItem): Promise<DraftActionOutcome> {
    trackPublishing({ format: item.format, name: "publish_now_selected" });

    return perform(item, () => publishContentNow(item.ref, item.version), {
      success: submitSuccessCopy(item.format, { mode: "now" }),
      toastOnError: true,
    });
  }

  /** §196–§198: «Riprova» di un fallito. Se non riesce il contenuto resta disponibile (§198). */
  async function retry(item: DraftListItem): Promise<DraftActionOutcome> {
    const outcome = await perform(item, () => publishContentNow(item.ref, item.version), {
      success: submitSuccessCopy(item.format, { mode: "now" }),
      toastOnError: true,
    });

    trackPublishing({ format: item.format, name: "scheduled_retry", success: outcome.ok });
    return outcome;
  }

  /** §175–§177: SCHEDULED/FAILED → DRAFT, dati e asset conservati. */
  async function moveToDraft(item: DraftListItem): Promise<DraftActionOutcome> {
    const outcome = await perform(item, () => moveContentToDraft(item.ref, item.version), {
      success: "Spostato nelle bozze",
      toastOnError: true,
    });

    if (outcome.ok) {
      trackPublishing({ format: item.format, name: "scheduled_to_draft" });
    }

    return outcome;
  }

  /** §153, §178–§179: elimina; il job futuro non vede più il contenuto. */
  async function remove(item: DraftListItem): Promise<DraftActionOutcome> {
    const outcome = await perform(item, () => deleteContentDraft(item.ref, item.version), {
      success: item.status === "draft" ? "Bozza eliminata" : "Contenuto eliminato",
      toastOnError: true,
    });

    if (outcome.ok) {
      trackPublishing({ format: item.format, name: "draft_deleted" });
    }

    return outcome;
  }

  /**
   * §150, §168–§170: «Programma» da una bozza e «Cambia data e ora» da un
   * programmato, con lo STESSO foglio del composer (§169). L'errore torna al
   * foglio, che lo mostra sotto i campi.
   */
  async function reschedule(item: DraftListItem, publication: Publication): Promise<DraftActionOutcome> {
    if (publication.mode !== "scheduled") {
      return { kind: "schedule_in_past", message: publishingErrorCopy("schedule_in_past"), ok: false };
    }

    const fromDraft = item.status === "draft";
    const outcome = await perform(item, () => scheduleContent(item.ref, item.version, publication.scheduledAt, publication.timezone), {
      success: fromDraft ? submitSuccessCopy(item.format, publication) : "Programmazione aggiornata",
      toastOnError: false,
    });

    if (outcome.ok) {
      trackPublishing(
        fromDraft
          ? { format: item.format, identityType: item.identity.type, name: "schedule_confirmed" }
          : { format: item.format, name: "scheduled_time_changed" },
      );
    }

    return outcome;
  }

  return { busyKey, edit, moveToDraft, publishNow, remove, reschedule, retry };
}
