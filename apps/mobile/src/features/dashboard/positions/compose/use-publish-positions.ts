/**
 * La pubblicazione, condivisa dall'anteprima singola e da quella multipla
 * (DAS-REV-16 §25, §26).
 *
 * Esiste come hook e non come due `useMutation` gemelle perché le due
 * schermate devono avere lo **stesso** comportamento su idempotenza,
 * invalidazioni e ritorno all'origin: duplicarlo significherebbe far
 * divergere il percorso singolo da quello batch al primo cambiamento.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useToast } from "../../../../ui/Toast/ToastProvider";
import { trackComposeEvent } from "./compose-analytics";
import { COMPOSE_INVALIDATION_PREFIXES } from "./compose-keys";
import {
  describeComposeError,
  publishSuccessMessage,
} from "./compose-presentation";
import {
  publishPositions,
  toComposeError,
  type ComposeError,
} from "./compose-service";

export function usePublishPositions(options: {
  onError: (error: ComposeError, message: string) => void;
  /**
   * Dove andare dopo un commit confermato.
   *
   * Il composer torna al Centro; DAS-REV-17 §6 chiede invece che
   * pubblicando da una bozza si apra «il dettaglio attivo dello stesso ID
   * con feedback leggero». Due destinazioni, una sola pubblicazione: §16
   * vieta «un endpoint che aggira validazione, idempotenza o permessi»
   * perché cambia la superficie d'ingresso, e lo stesso vale per l'hook
   * che la esegue.
   */
  onSuccessNavigate?: (published: readonly { positionId: string }[]) => void;
  operationKey: string;
  /** Sovrascrive «2 posizioni pubblicate» con la copy di §28. */
  successMessage?: (published: number, remaining: number) => string;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (input: {
      expectedVersions: readonly (number | null)[];
      positionIds: readonly string[];
      /** Quante bozze della sessione **non** vengono pubblicate (§26). */
      remaining: number;
    }) =>
      publishPositions({
        expectedVersions: input.expectedVersions,
        operationKey: options.operationKey,
        positionIds: input.positionIds,
      }).then((published) => ({ published, remaining: input.remaining })),

    onError: (error) => {
      const composeError = toComposeError(error);

      trackComposeEvent("position_compose_publish_failed", {
        errorCategory: categorize(composeError),
      });

      options.onError(composeError, describeComposeError(composeError));
    },

    onSuccess: ({ published, remaining }) => {
      trackComposeEvent("position_compose_publish_succeeded", {
        count: published.length,
        mode: published.length > 1 ? "batch" : "single",
      });

      /* §26: «Aggiorna o invalida query pertinenti.» Per prefisso perché le
         chiavi del Centro portano actor, Society, tab e filtro, e
         ricostruirle tutte qui significherebbe dimenticarne una. */
      for (const prefix of COMPOSE_INVALIDATION_PREFIXES) {
        queryClient.invalidateQueries({ queryKey: [prefix] });
      }

      /* §26: «Nessuna pagina celebrativa o confetti.» Un toast e il ritorno
         all'origin. */
      showToast({
        message: (options.successMessage ?? publishSuccessMessage)(
          published.length,
          remaining,
        ),
        tone: "success",
      });

      if (options.onSuccessNavigate) {
        options.onSuccessNavigate(published);

        return;
      }

      router.dismissAll();
      router.replace("/(tabs)/dashboard/positions" as never);
    },
  });
}

/** §33: la categoria dell'errore è un evento lecito; il messaggio no. */
function categorize(
  error: ComposeError,
): "authorization" | "conflict" | "offline" | "unknown" | "validation" {
  switch (error.code) {
    case "POSITION_NOT_AUTHORIZED":
    case "POSITION_PUBLISH_NOT_AUTHORIZED":
    case "POSITION_COMPOSER_NOT_AUTHORIZED":
      return "authorization";
    case "POSITION_VERSION_CONFLICT":
    case "POSITION_LIFECYCLE_CONFLICT":
    case "POSITION_OPERATION_CONFLICT":
      return "conflict";
    case "POSITION_NOT_PUBLISHABLE":
    case "POSITION_SELECTION_EMPTY":
      return "validation";
    default:
      return "unknown";
  }
}
