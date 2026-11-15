/**
 * «Non mi interessa»: hide ottimistico, Annulla, motivo facoltativo (HOM-11 §28–§53,
 * §168–§170, §177, §186, §198–§199).
 *
 * La logica sta in `createNotInterestedActions`, senza React, con le dipendenze
 * iniettate: così si prova senza renderizzare niente. `useNotInterested` la lega allo
 * store di sessione, alle RPC, al Toast e agli eventi.
 *
 *  • tap → nessuna conferma (§28) e hide IMMEDIATO (§29): la cella nasce `pending` e
 *    il placeholder compare nella stessa posizione (§33). La mutation parte subito;
 *  • errore → rollback e messaggio (§51–§52): la cella sparisce, il contenuto torna;
 *  • Annulla → il contenuto torna subito, anche con l'hide in volo (§34); la riga lato
 *    server si cancella quando c'è l'id (§53), o appena arriva se la risposta era in
 *    ritardo (`stale`);
 *  • il motivo (§50) è facoltativo e posteriore: un fallimento lascia l'hide com'è e
 *    ripristina solo il link;
 *  • mai Follow, mai Segnala: tre domini, nessuna cascata (§42, §41, §167).
 */

import { useToast } from "../../ui";
import { useSession } from "../auth/use-session";
import type { ContentOrigin } from "../feed/content-routes";
import { removeContentFromCachedScope } from "../feed/feed-cache";
import type { FeedContentType } from "../feed/feed-types";
import {
  trackFeedFeedback,
  type FeedFeedbackAnalyticsEvent,
} from "./feed-feedback-analytics";
import { NOT_INTERESTED_ERROR, hiddenTargetKey } from "./feed-feedback-presentation";
import {
  markContentNotInterested,
  setNotInterestedReason,
  undoNotInterested,
} from "./feed-feedback-service";
import type { MarkNotInterestedInput, NotInterestedReposter } from "./feed-feedback-types";
import { hiddenContentStore, type HiddenContentStore } from "./hidden-content-store";
import { newNotInterestedOperationKey } from "./operation-key";

/** Il contenuto su cui si agisce, come lo conosce chi apre il menu. */
export type NotInterestedTarget = {
  contentType: FeedContentType;
  contentId: string;
  origin: ContentOrigin;
  reposter: NotInterestedReposter | null;
};

type Deps = {
  store: HiddenContentStore;
  service: {
    mark: typeof markContentNotInterested;
    setReason: typeof setNotInterestedReason;
    undo: typeof undoNotInterested;
  };
  notify: (message: string) => void;
  track: (event: FeedFeedbackAnalyticsEvent) => void;
  newKey: () => string;
  /**
   * Hide CONFERMATO dal server (anche `unavailable`): serve a togliere il contenuto dalla copia
   * del Feed su disco, senza toccare la lista visibile (§169–§170). Assente = nessun effetto.
   */
  onHidden?: (target: NotInterestedTarget) => void;
};

export type NotInterestedActions = {
  /** Nasconde subito e registra il segnale. Risolve a operazione conclusa. */
  mark: (target: NotInterestedTarget) => Promise<void>;
  /** Annulla l'hide: ripristino immediato, poi la riga lato server (best effort). */
  undo: (target: NotInterestedTarget) => Promise<void>;
  /** §50: associa un motivo all'hide già registrato. */
  selectReason: (target: NotInterestedTarget, reasonId: string) => Promise<void>;
  /** §46: apertura del foglio dei motivi (solo evento). */
  trackReasonsOpen: (target: NotInterestedTarget) => void;
};

function baseOf(target: NotInterestedTarget) {
  return {
    contentId: target.contentId,
    contentType: target.contentType,
    origin: target.origin,
    simpleRepost: target.reposter !== null,
  };
}

export function createNotInterestedActions(deps: Deps): NotInterestedActions {
  const { newKey, notify, service, store, track } = deps;

  async function mark(target: NotInterestedTarget): Promise<void> {
    const key = hiddenTargetKey(target.contentType, target.contentId);
    const base = baseOf(target);
    // Doppio tap: la cella esiste già, nessuna seconda richiesta (§177).
    const attempt = store.begin(key);
    if (attempt === null) {
      return;
    }
    const epoch = store.epoch();

    track({ ...base, name: "not_interested_selected" });

    const input: MarkNotInterestedInput = {
      contentId: target.contentId,
      contentType: target.contentType,
      operationKey: newKey(),
      origin: target.origin,
      reposter: target.reposter,
    };

    try {
      const result = await service.mark(input);

      // Logout o cambio utente nel frattempo: la risposta non è più di questa sessione.
      if (store.epoch() !== epoch) {
        return;
      }

      if (result.status === "not_allowed") {
        if (store.fail(key, attempt)) {
          track({ ...base, name: "not_interested_failure", reason: "not_allowed" });
          notify(NOT_INTERESTED_ERROR);
        }
        return;
      }

      const outcome = store.settle(key, attempt, result.feedbackId);
      if (outcome === "stale") {
        // Annulla è arrivato prima della risposta: la riga appena creata va tolta, ma
        // solo se nessun nuovo hide dello stesso target ne è diventato proprietario.
        if (result.feedbackId && !store.has(key)) {
          await service.undo(result.feedbackId).catch(() => undefined);
        }
        return;
      }

      track({ ...base, name: "not_interested_success", unavailable: result.status === "unavailable" });
      deps.onHidden?.(target);
    } catch {
      if (store.epoch() !== epoch) {
        return;
      }
      // §51: rollback — il contenuto torna, nessun feedback locale resta.
      if (store.fail(key, attempt)) {
        track({ ...base, name: "not_interested_failure", reason: "network" });
        notify(NOT_INTERESTED_ERROR);
      }
    }
  }

  async function undo(target: NotInterestedTarget): Promise<void> {
    const key = hiddenTargetKey(target.contentType, target.contentId);
    // §34–§35: il ripristino è locale e immediato; il server segue.
    const entry = store.restore(key);
    if (!entry) {
      return;
    }

    track({ ...baseOf(target), name: "not_interested_undo" });

    if (entry.feedbackId) {
      // §53, §176: se la cancellazione fallisce l'Annulla locale resta fatto; lo stato
      // finale è del server e al prossimo caricamento prevale. Nessun messaggio: il
      // contenuto è già tornato.
      await service.undo(entry.feedbackId).catch(() => undefined);
    }
  }

  async function selectReason(target: NotInterestedTarget, reasonId: string): Promise<void> {
    const key = hiddenTargetKey(target.contentType, target.contentId);
    const entry = store.get(key);
    const epoch = store.epoch();

    // Senza hide confermato non c'è un feedback a cui associare il motivo.
    if (!entry || !entry.feedbackId || !store.setReason(key, reasonId)) {
      return;
    }

    track({ ...baseOf(target), name: "not_interested_reason_selected", reasonId });

    try {
      const status = await service.setReason(entry.feedbackId, reasonId);
      if (status !== "updated" && store.epoch() === epoch) {
        // `not_found`/`invalid_reason`: l'hide resta, il link torna disponibile.
        store.setReason(key, null);
        notify(NOT_INTERESTED_ERROR);
      }
    } catch {
      if (store.epoch() === epoch) {
        store.setReason(key, null);
        notify(NOT_INTERESTED_ERROR);
      }
    }
  }

  return {
    mark,
    selectReason,
    trackReasonsOpen: (target) => track({ ...baseOf(target), name: "not_interested_reason_open" }),
    undo,
  };
}

/** Le azioni legate allo store reale, alle RPC, al Toast e agli eventi. */
export function useNotInterested(): NotInterestedActions {
  const { showToast } = useToast();
  const { profile } = useSession();
  const profileId = profile?.id ?? "";

  return createNotInterestedActions({
    newKey: newNotInterestedOperationKey,
    notify: (message) => showToast({ id: "not-interested-error", message }),
    // §169–§170, §36: via dalla copia su disco di Per te; la query in memoria e il placeholder
    // restano finché la lista non si ricarica, così Annulla non sposta nulla.
    onHidden: (target) => {
      if (profileId) {
        void removeContentFromCachedScope(profileId, "per_te", target.contentType, target.contentId);
      }
    },
    service: { mark: markContentNotInterested, setReason: setNotInterestedReason, undo: undoNotInterested },
    store: hiddenContentStore,
    track: trackFeedFeedback,
  });
}
