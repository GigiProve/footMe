/**
 * Il flusso Condividi montato dalla superficie di origine (HOM-09 §4, §10–§11,
 * §174–§178).
 *
 * Due Modal sopra l'origine, che resta montata e visibile dietro il pannello
 * (§11): il `BottomSheet` del pannello principale (§12) e un Modal a schermo
 * intero per «Invia a» e «Condividi» (§43, §82). Chiudere il flusso riporta
 * esattamente alla superficie di prima, con lo stesso scroll e lo stesso tab
 * (§176–§178): non c'è alcuna navigazione. Tutta la logica è in `useShareFlow`.
 *
 * HOM-10 §2–§5, §14, §120–§123: lo STESSO pannello ospita «Repost» come prima azione.
 * Lo stato (ripostabile? già ripostato dall'identità Home?) viene da
 * `fetch_repost_state` e non blocca il pannello: finché non c'è, la riga non c'è. Il
 * tap è l'unica navigazione di questo flusso: chiude il pannello e apre il composer
 * Repost sopra l'origine (`repostComposerHref`).
 */

import { Modal } from "react-native";
import { useRouter } from "expo-router";

import { BottomSheet } from "../../../ui";
import { useSession } from "../../auth/use-session";
import { useInteractionIdentity } from "../../interactions/use-interaction-identity";
import { composerOriginForContent, repostComposerHref } from "../../post-composer/composer-routes";
import { shareRepostRow } from "../../repost/repost-presentation";
import { useRepostState } from "../../repost/use-repost-state";
import { useShareFlow } from "../use-share-flow";
import type { ShareOrigin, ShareTarget } from "../share-types";
import { ShareComposeStep } from "./ShareComposeStep";
import { ShareRecipientPicker } from "./ShareRecipientPicker";
import { ShareSheetContent } from "./ShareSheetContent";

type ContentShareHostProps = {
  origin: ShareOrigin;
  target: ShareTarget;
  /** Il flusso è arrivato a «chiuso»: chi lo ha aperto può riaprirlo. */
  onClosed: () => void;
};

export function ContentShareHost({ origin, target, onClosed }: ContentShareHostProps) {
  const router = useRouter();
  const { profile } = useSession();
  const flow = useShareFlow({ onClosed, origin, target });
  const fullScreenVisible = flow.step === "pick" || flow.step === "compose";

  // HOM-10 §2, §122: «Repost» / «Repost ✓». L'identità Home è quella di interazione (HOM-07 §10).
  const repostState = useRepostState({ contentId: target.contentId, contentType: target.contentType });
  const { identity: homeIdentity } = useInteractionIdentity(profile?.id ?? "");
  const repostRow = shareRepostRow(repostState.data, homeIdentity);

  return (
    <>
      <BottomSheet
        onClose={flow.closeAll}
        onDismiss={flow.flushPending}
        scrollable
        showHandle
        visible={flow.step === "sheet"}
      >
        <ShareSheetContent
          onCopyLink={() => void flow.copyLink()}
          onExternalShare={flow.externalShare}
          onMore={flow.openMore}
          onSelectRecent={flow.selectRecent}
          preview={target.preview}
          recents={flow.recents}
          recentsLoading={flow.recentsLoading}
          repost={
            repostRow
              ? {
                  onPress: () =>
                    flow.openRepost(repostRow.active, () =>
                      router.push(
                        repostComposerHref({
                          identityId: repostRow.identityId,
                          origin: composerOriginForContent(origin),
                          ref: { contentId: target.contentId, contentType: target.contentType },
                        }) as never,
                      ),
                    ),
                  row: repostRow,
                }
              : undefined
          }
        />
      </BottomSheet>

      <Modal
        animationType="slide"
        onDismiss={flow.flushPending}
        onRequestClose={flow.back}
        visible={fullScreenVisible}
      >
        {flow.fullScreen === "pick" ? (
          <ShareRecipientPicker
            onBack={flow.back}
            onNext={flow.goToCompose}
            onToggle={flow.toggle}
            profileId={flow.profileId}
            selected={flow.selected}
          />
        ) : (
          <ShareComposeStep
            deliveryCount={flow.deliveryCount}
            leading={flow.hasDelivered ? "close" : "back"}
            onChangeText={flow.setText}
            onClose={flow.closeAll}
            onLeadingPress={flow.back}
            onRetry={flow.retry}
            onSend={flow.send}
            preview={target.preview}
            recipients={flow.selected}
            status={flow.status}
            text={flow.text}
            textLocked={flow.textLocked}
          />
        )}
      </Modal>
    </>
  );
}
