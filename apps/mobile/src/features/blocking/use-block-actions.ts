/**
 * Blocca e Sblocca: ottimismo, rollback, idempotenza (HOM-12 §22–§23, §152–§156,
 * §198–§207, §250).
 *
 * La logica sta in `createBlockActions`, senza React e con le dipendenze iniettate,
 * così si prova senza renderizzare. `useBlockActions` la lega a store, RPC, Toast,
 * eventi e invalidazione cache.
 *
 *  • Blocca → la conferma è già avvenuta (§23). La cella nasce `pending_block` e la UI
 *    passa subito allo stato bloccato (§198). Errore → rollback completo e messaggio
 *    (§199–§201): nessuno stato parziale, e le cache non vengono toccate;
 *  • Sblocca → nessuna conferma (§152): la UI resta bloccata finché il server non
 *    risponde (§205); errore → il Block resta (§203) e il messaggio compare;
 *  • doppio tap → la cella in volo ritorna `null`: nessuna seconda richiesta (§206–§207);
 *  • nessuna Follow, nessun Report, nessuna cascata (§165–§170). Il Follow non si
 *    ripristina allo Sblocca (§40): non c'è niente da richiamare.
 */

import { useQueryClient } from "@tanstack/react-query";

import { useToast } from "../../ui";
import { useSession } from "../auth/use-session";
import { blockedIdentityStore, type BlockedIdentityStore } from "./blocked-identity-store";
import {
  trackBlocking,
  type BlockFailureReason,
  type BlockingAnalyticsEvent,
} from "./blocking-analytics";
import { BLOCK_COPY, blockTargetKey, unblockedMessage } from "./blocking-presentation";
import { blockIdentity, unblockIdentity } from "./blocking-service";
import type { BlockIdentityRef, BlockResult, BlockSurface, UnblockStatus } from "./blocking-types";
import { invalidateBlockCaches } from "./invalidate-block-caches";
import { newBlockOperationKey } from "./operation-key";

export type BlockTarget = BlockIdentityRef & { name: string | null };

type Deps = {
  store: BlockedIdentityStore;
  service: {
    block: (input: {
      operationKey: string;
      blocker: BlockIdentityRef;
      target: BlockIdentityRef;
    }) => Promise<BlockResult>;
    unblock: (input: { blocker: BlockIdentityRef; target: BlockIdentityRef }) => Promise<UnblockStatus>;
  };
  notify: (id: string, message: string) => void;
  track: (event: BlockingAnalyticsEvent) => void;
  newKey: () => string;
  now: () => number;
  /** Dopo un esito CONFERMATO dal server: invalida le cache (§195–§196). */
  onChanged: () => void;
};

export type BlockActions = {
  /** Esito `true` se il Block è attivo (anche `already_blocked`). */
  block: (input: { blocker: BlockIdentityRef; target: BlockTarget; surface: BlockSurface }) => Promise<boolean>;
  /** Esito `true` se il Block è stato rimosso (anche `not_blocked`). */
  unblock: (input: {
    blocker: BlockIdentityRef;
    target: BlockTarget;
    surface: BlockSurface;
    blockId?: string | null;
  }) => Promise<boolean>;
};

function failureReason(status: BlockResult["status"]): BlockFailureReason {
  return status === "target_unavailable" ? "unavailable" : "not_allowed";
}

export function createBlockActions(deps: Deps): BlockActions {
  const { newKey, notify, now, onChanged, service, store, track } = deps;

  async function block(input: {
    blocker: BlockIdentityRef;
    target: BlockTarget;
    surface: BlockSurface;
  }): Promise<boolean> {
    const { blocker, surface, target } = input;
    const key = blockTargetKey(target);
    const attempt = store.beginBlock(key);
    if (attempt === null) {
      return store.isBlocked(key) === true;
    }
    const epoch = store.epoch();
    const props = { identityType: target.type, surface };

    track({ ...props, name: "block_submit" });

    try {
      const result = await service.block({
        blocker: { id: blocker.id, type: blocker.type },
        operationKey: newKey(),
        target: { id: target.id, type: target.type },
      });

      if (store.epoch() !== epoch) {
        return false;
      }

      if (result.status === "blocked" || result.status === "already_blocked") {
        store.settleBlock(key, attempt, result.blockId, now());
        track({ ...props, name: "block_success" });
        onChanged();
        return true;
      }

      if (store.failBlock(key, attempt)) {
        track({ ...props, name: "block_failure", reason: failureReason(result.status) });
        notify("block-error", BLOCK_COPY.blockError);
      }
      return false;
    } catch {
      if (store.epoch() !== epoch) {
        return false;
      }
      // §199–§201: rollback completo, nessuno stato parziale.
      if (store.failBlock(key, attempt)) {
        track({ ...props, name: "block_failure", reason: "network" });
        notify("block-error", BLOCK_COPY.blockError);
      }
      return false;
    }
  }

  async function unblock(input: {
    blocker: BlockIdentityRef;
    target: BlockTarget;
    surface: BlockSurface;
    blockId?: string | null;
  }): Promise<boolean> {
    const { blocker, surface, target } = input;
    const key = blockTargetKey(target);
    const attempt = store.beginUnblock(key, input.blockId ?? null);
    if (attempt === null) {
      return store.isBlocked(key) === false;
    }
    const epoch = store.epoch();
    const props = { identityType: target.type, surface };

    try {
      const status = await service.unblock({
        blocker: { id: blocker.id, type: blocker.type },
        target: { id: target.id, type: target.type },
      });

      if (store.epoch() !== epoch) {
        return false;
      }

      if (status === "unblocked" || status === "not_blocked") {
        store.settleUnblock(key, attempt, now());
        track({ ...props, name: "unblock_success" });
        notify("unblock-success", unblockedMessage(target.name));
        onChanged();
        return true;
      }

      if (store.failUnblock(key, attempt)) {
        track({ ...props, name: "unblock_failure" });
        notify("unblock-error", BLOCK_COPY.unblockError);
      }
      return false;
    } catch {
      if (store.epoch() !== epoch) {
        return false;
      }
      // §203: il Block resta attivo.
      if (store.failUnblock(key, attempt)) {
        track({ ...props, name: "unblock_failure" });
        notify("unblock-error", BLOCK_COPY.unblockError);
      }
      return false;
    }
  }

  return { block, unblock };
}

/** Le azioni legate a store, RPC, Toast, eventi e cache. */
export function useBlockActions(): BlockActions {
  const { showToast } = useToast();
  const { profile, session } = useSession();
  const queryClient = useQueryClient();
  const viewerId = session?.user?.id ?? profile?.id ?? "";

  return createBlockActions({
    newKey: newBlockOperationKey,
    notify: (id, message) => showToast({ id, message, tone: "neutral" }),
    now: Date.now,
    onChanged: () => invalidateBlockCaches(queryClient, viewerId),
    service: { block: blockIdentity, unblock: unblockIdentity },
    store: blockedIdentityStore,
    track: trackBlocking,
  });
}
