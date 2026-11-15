/**
 * Il flusso Condividi montato dalla superficie di origine (HOM-09 §4, §10–§11,
 * §174–§178).
 *
 * Due Modal sopra l'origine, che resta montata e visibile dietro il pannello
 * (§11): il `BottomSheet` del pannello principale (§12) e un Modal a schermo
 * intero per «Invia a» e «Condividi» (§43, §82). Chiudere il flusso riporta
 * esattamente alla superficie di prima, con lo stesso scroll e lo stesso tab
 * (§176–§178): non c'è alcuna navigazione. Tutta la logica è in `useShareFlow`.
 */

import { Modal } from "react-native";

import { BottomSheet } from "../../../ui";
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
  const flow = useShareFlow({ onClosed, origin, target });
  const fullScreenVisible = flow.step === "pick" || flow.step === "compose";

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
