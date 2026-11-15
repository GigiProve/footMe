/**
 * Stato e azioni del flusso Condividi (HOM-09 §9, §40–§42, §125–§143, §176–§181).
 *
 * Un'istanza per apertura del pannello (il chiamante rimonta con una `key`):
 * nasce lo `batchId` (§127) e con lui le `delivery_key` (§128), che restano le
 * stesse per doppio tap, retry e timeout ambiguo (§129). Il flusso vive sopra
 * la superficie di origine, che resta montata: nessuna navigazione, quindi
 * scroll, tab e stato del Feed non cambiano (§176–§179).
 *
 * Passi: `sheet` (pannello) → `pick` («Invia a») → `compose` («Condividi»).
 * Un tap su un Recente salta direttamente a `compose` e NON invia (§40–§42).
 * Il pannello e i passi a schermo intero sono due Modal diversi: il passaggio
 * passa dallo stato `transit` e si completa quando il primo si è chiuso
 * (`onDismiss` su iOS; su Android e web, che non lo consegnano in modo
 * affidabile, dopo le interazioni) — lo stesso handoff sheet → modale già usato
 * dalla Shortlist.
 *
 * Esiti (§130–§139): successo → il flusso si chiude e un toast sull'origine dice
 * «Inviato» / «Inviato a N conversazioni», senza aprire la chat (§132–§134);
 * errore totale e parziale restano nel passo con i dati preservati e «Riprova»
 * rimanda solo le destinazioni fallite e ritentabili con le STESSE chiavi
 * (§141–§142). La metrica Condivisioni la calcola il server (§207–§208).
 *
 * Link e share esterno: «Copia link» copia l'URL canonico e registra l'evento
 * dedicato; «Condividi tramite…» apre la sheet di sistema e registra solo
 * l'apertura (§202–§203). Nessuno dei due aspetta i Recenti (§81).
 */

import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, InteractionManager, Platform } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../ui";
import { useSession } from "../auth/use-session";
import { MESSAGING_QK } from "../messaging/messaging-keys";
import { fetchInboxConversations } from "../messaging/messaging-service";
import { trackRepost } from "../repost/repost-analytics";
import { trackShare } from "./share-analytics";
import {
  composeStatusOf,
  deliveredConversationIds,
  deliveryCount,
  evaluateBatch,
  isMalformedInputError,
  mergeOutcomes,
  newShareId,
  planDestinations,
  recipientsToRetry,
  transientFailureOutcomes,
  unroutableOutcomes,
  withAliasedOutcomes,
  type ComposeStatus,
} from "./share-batch";
import { SHARE_QK } from "./share-keys";
import { buildContentUrl, copyContentLink, openExternalShare } from "./share-links";
import {
  buildExternalShareMessage,
  externalShareTitle,
  selectRecentRecipients,
  SHARE_COPY,
  successMessage,
  toggleRecipient,
} from "./share-presentation";
import { recordContentShareEvent, sendContentShare } from "./share-service";
import type {
  ShareDeliveryOutcome,
  ShareOrigin,
  ShareRecipient,
  ShareTarget,
} from "./share-types";

export type ShareStep = "sheet" | "pick" | "compose" | "transit" | "closed";

export function useShareFlow(input: {
  origin: ShareOrigin;
  target: ShareTarget;
  onClosed: () => void;
}) {
  const { origin, target, onClosed } = input;
  const { profile } = useSession();
  const profileId = profile?.id ?? "";
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  // Il batch nasce all'apertura del pannello e resta fino alla chiusura: un
  // timeout ambiguo può aver già consegnato, e con un batch nuovo il retry
  // duplicherebbe. Destinatari o testo diversi sullo stesso batch sono ammessi.
  const [batchId] = useState(newShareId);
  const [step, setStep] = useState<ShareStep>("sheet");
  // Il contenuto del Modal a schermo intero resta quello dell'ultimo passo anche
  // mentre il Modal si chiude: senza, durante l'animazione si vedrebbe un bianco.
  const [fullScreen, setFullScreen] = useState<"pick" | "compose">("pick");
  const [selected, setSelected] = useState<ShareRecipient[]>([]);
  const [composeFrom, setComposeFrom] = useState<"recent" | "pick">("pick");
  const [text, setText] = useState("");
  const [outcomes, setOutcomes] = useState<ReadonlyMap<string, ShareDeliveryOutcome>>(
    () => new Map(),
  );
  const [status, setStatus] = useState<ComposeStatus>({ kind: "idle" });
  // Un tentativo con esito ambiguo (rete, timeout) può aver consegnato il testo:
  // da lì il testo non cambia più, come dopo un successo noto.
  const [ambiguousAttempt, setAmbiguousAttempt] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  const inFlight = useRef(false);

  const hasDelivered = Array.from(outcomes.values()).some((outcome) => outcome.ok);
  const surface = { contentId: target.contentId, contentType: target.contentType, origin };
  const batch = { batchId, contentId: target.contentId, contentType: target.contentType };

  // §204: aprire il pannello non è una condivisione; è solo un evento di prodotto.
  useEffect(() => {
    trackShare({
      contentId: target.contentId,
      contentType: target.contentType,
      name: "share_sheet_open",
      origin,
    });
  }, [origin, target.contentId, target.contentType]);

  useEffect(() => {
    if (step === "closed") {
      onClosed();
    }
  }, [onClosed, step]);

  // §220: i Recenti sono la cache dell'Inbox. §81, §218: il pannello si apre
  // subito; i Recenti arrivano dopo, senza bloccare Copia link e share esterno.
  const inbox = useQuery({
    enabled: !!profileId && step !== "closed",
    queryFn: () => fetchInboxConversations(),
    queryKey: SHARE_QK.recents(profileId),
  });
  const recents = selectRecentRecipients(inbox.data ?? []);

  const flushPending = () => {
    const next = pending.current;
    pending.current = null;
    next?.();
  };

  /** Chiude il Modal corrente e, a chiusura avvenuta, esegue `next`. */
  const afterModalClosed = (next: () => void) => {
    pending.current = next;
    setStep("transit");

    if (Platform.OS !== "ios") {
      void InteractionManager.runAfterInteractions(flushPending);
    }
  };

  const closeAll = () => setStep("closed");

  const showFull = (next: "pick" | "compose") => {
    setFullScreen(next);
    setStep(next);
  };

  const announce = (message: string) => {
    void AccessibilityInfo.announceForAccessibility(message);
  };

  // ── Pannello ────────────────────────────────────────────────

  const selectRecent = (recipient: ShareRecipient, position: number) => {
    trackShare({ name: "recent_recipient_selected", position, recipientKind: recipient.kind });
    trackShare({ name: "share_message_step_open", recipientCount: 1 });
    setSelected([recipient]);
    setComposeFrom("recent");
    afterModalClosed(() => showFull("compose"));
  };

  const openMore = () => {
    trackShare({ name: "share_more_open" });
    afterModalClosed(() => showFull("pick"));
  };

  /**
   * HOM-10 §14, §123, §243: «Repost» chiude il pannello e passa il controllo al composer, che è una
   * route a schermo intero sopra l'origine (stesso handoff sheet → modale delle altre azioni: si
   * naviga a pannello chiuso). Il flusso si chiude: al ritorno l'origine è com'era (§248) e il
   * pannello si può riaprire, con `Repost ✓` già aggiornato dalla cache.
   */
  const openRepost = (alreadyReposted: boolean, navigate: () => void) => {
    trackRepost({ alreadyReposted, name: "repost_entry_selected", ...surface });
    afterModalClosed(() => {
      navigate();
      closeAll();
    });
  };

  const copyLink = async () => {
    const url = buildContentUrl(target.contentType, target.contentId);
    closeAll();

    const copied = url ? await copyContentLink(url) : false;

    if (!copied) {
      showToast({ message: SHARE_COPY.copyLinkFailed });
      return;
    }

    trackShare({ name: "copy_link_success", ...surface });
    showToast({ icon: "link-outline", message: SHARE_COPY.copyLinkDone });
    announce(SHARE_COPY.copyLinkDone);
    // Metrica, non funzione: un errore qui non cambia ciò che l'utente ha fatto.
    void recordContentShareEvent({
      contentId: target.contentId,
      contentType: target.contentType,
      eventId: newShareId(),
      kind: "copy_link",
    }).catch(() => undefined);
  };

  const externalShare = () => {
    const url = buildContentUrl(target.contentType, target.contentId);

    if (!url) {
      closeAll();
      showToast({ message: SHARE_COPY.externalShareFailed });
      return;
    }

    // §202–§203: si registra l'apertura della sheet, mai un «completato».
    trackShare({ name: "external_share_sheet_open", ...surface });
    void recordContentShareEvent({
      contentId: target.contentId,
      contentType: target.contentType,
      eventId: newShareId(),
      kind: "external_sheet_open",
    }).catch(() => undefined);

    afterModalClosed(() => {
      void openExternalShare({
        message: buildExternalShareMessage(target.preview, url),
        title: externalShareTitle(target.preview),
      })
        .then((outcome) => {
          if (outcome === "unavailable") {
            showToast({ message: SHARE_COPY.externalShareFailed });
          }
        })
        .finally(closeAll);
    });
  };

  // ── Invia a ─────────────────────────────────────────────────

  const toggle = (recipient: ShareRecipient) => {
    const next = toggleRecipient(selected, recipient);

    if (next.length === selected.length && next.every((item, i) => item === selected[i])) {
      return;
    }

    const isSelected = next.some((item) => item.key === recipient.key);

    trackShare({
      name: "share_recipient_selected",
      recipientKind: recipient.kind,
      selected: isSelected,
    });

    if (isSelected && next.length > 1) {
      trackShare({ count: next.length, name: "share_multi_select" });
    }

    setSelected(next);
  };

  const goToCompose = () => {
    if (selected.length === 0) {
      return;
    }

    trackShare({ name: "share_message_step_open", recipientCount: selected.length });
    setComposeFrom("pick");
    showFull("compose");
  };

  // ── Condividi: invio ────────────────────────────────────────

  const runSend = async (toSend: ShareRecipient[], isRetry: boolean) => {
    // §126, §298: un solo invio alla volta, anche se il tap arriva due volte.
    if (inFlight.current || toSend.length === 0) {
      return;
    }

    inFlight.current = true;
    setStatus({ kind: "sending" });

    // Persona P e Società di cui P è titolare sono una sola consegna (dedup per
    // identità); la riga scartata riceve l'esito di quella che la copre.
    const { aliases, destinations } = planDestinations(toSend, batchId);
    const okBefore = evaluateBatch(selected, batchId, outcomes).okCount;

    if (isRetry) {
      trackShare({
        name: "internal_share_retry",
        retryCount: deliveryCount(toSend, batchId),
        ...batch,
      });
    } else {
      trackShare({
        deliveryCount: deliveryCount(toSend, batchId),
        name: "internal_share_attempt",
        ...batch,
      });
    }

    let merged = mergeOutcomes(outcomes, unroutableOutcomes(toSend, batchId));

    try {
      const result =
        destinations.length > 0
          ? await sendContentShare({
              batchId,
              contentId: target.contentId,
              contentType: target.contentType,
              destinations,
              text,
            })
          : null;

      // §212–§213: contenuto sparito prima dell'invio, nulla è partito.
      // Gli esiti già riusciti restano (`outcomes` non viene toccato) e la UI li elenca.
      if (result?.status === "content_unavailable") {
        setStatus({
          kind: "unavailable",
          statuses:
            okBefore > 0 ? evaluateBatch(selected, batchId, outcomes).statuses : null,
        });
        return;
      }

      if (result) {
        // `failed` senza alcun esito (es. batch_conflict) è un rifiuto del
        // batch intero, non un guasto transitorio: niente «Riprova» che
        // fallirebbe di nuovo allo stesso modo.
        const outcomesOrFinal =
          result.status === "failed" && result.outcomes.length === 0
            ? transientFailureOutcomes(destinations, false)
            : result.outcomes;

        merged = mergeOutcomes(merged, withAliasedOutcomes(outcomesOrFinal, aliases));

        const delivered = deliveredConversationIds(result);

        if (delivered.length > 0) {
          void queryClient.invalidateQueries({ queryKey: MESSAGING_QK.inbox(profileId) });
          for (const conversationId of delivered) {
            void queryClient.invalidateQueries({
              queryKey: MESSAGING_QK.conversationMessages(conversationId),
            });
          }
        }
      }
    } catch (error) {
      // Rete o timeout: esito ignoto, ritentabile con le stesse chiavi, quindi
      // sicuro (§129). Input malformato (22023) no: ritentarlo non cambia nulla;
      // la UI dice solo «Invio non riuscito», mai il codice (§217).
      const malformed = isMalformedInputError(error);

      if (!malformed) {
        setAmbiguousAttempt(true);
      }

      merged = mergeOutcomes(
        merged,
        withAliasedOutcomes(transientFailureOutcomes(destinations, !malformed), aliases),
      );
    } finally {
      inFlight.current = false;
    }

    setOutcomes(merged);
    const evaluation = evaluateBatch(selected, batchId, merged);

    if (evaluation.kind === "success") {
      trackShare({ deliveryCount: evaluation.total, name: "internal_share_success", ...batch });
      const message = successMessage(evaluation.total);
      closeAll();
      // §246: toast neutro con la sola icona di successo verde, non un fondo verde.
      showToast({ icon: "checkmark-circle", iconTone: "success", message });
      announce(message);
      return;
    }

    // §143: il batch è una share action sola. Sul retry l'esito si emette solo
    // se è cambiato (più consegne riuscite): un secondo «parziale» o «fallito»
    // identico non è un'altra azione.
    if (evaluation.kind === "partial" && (!isRetry || evaluation.okCount > okBefore)) {
      trackShare({
        deliveryCount: evaluation.total,
        failedCount: evaluation.failedCount,
        name: "internal_share_partial_success",
        successCount: evaluation.okCount,
        ...batch,
      });
    } else if (evaluation.kind === "failed" && !isRetry) {
      trackShare({ deliveryCount: evaluation.total, name: "internal_share_failure", ...batch });
    }

    setStatus(composeStatusOf(evaluation));
  };

  const send = () => void runSend(selected, false);

  const retry = () =>
    void runSend(recipientsToRetry(selected, evaluateBatch(selected, batchId, outcomes)), true);

  /** Indietro dal passo corrente; durante l'invio non si cambia passo. */
  const back = () => {
    if (status.kind === "sending") {
      return;
    }

    if (step === "pick") {
      setSelected([]);
      afterModalClosed(() => setStep("sheet"));
      return;
    }

    if (step !== "compose") {
      return;
    }

    // Dopo una consegna riuscita (parziale, o retry su contenuto sparito) i
    // destinatari raggiunti hanno ricevuto questo testo e questa selezione: si
    // esce, non si ricomincia (§138, §142).
    if (hasDelivered) {
      closeAll();
      return;
    }

    // Nessuna consegna nota: si può cambiare selezione. Lo stesso batch resta
    // (vedi sopra): le `delivery_key` dei destinatari già provati sono le stesse.
    setStatus({ kind: "idle" });

    if (composeFrom === "pick") {
      showFull("pick");
    } else {
      setSelected([]);
      afterModalClosed(() => setStep("sheet"));
    }
  };

  return {
    back,
    closeAll,
    composeFrom,
    copyLink,
    // Consegne reali della selezione (dedup): CTA, riepilogo, toast e analytics.
    deliveryCount: deliveryCount(selected, batchId),
    hasDelivered,
    externalShare,
    flushPending,
    fullScreen,
    goToCompose,
    openMore,
    openRepost,
    profileId,
    recents,
    recentsLoading: inbox.isLoading,
    retry,
    selectRecent,
    selected,
    send,
    setText,
    status,
    step,
    text,
    textLocked: hasDelivered || ambiguousAttempt,
    toggle,
  };
}
