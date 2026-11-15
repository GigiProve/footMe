/**
 * Pannello principale «Condividi» (HOM-09 §10–§13, §22, §144, §157; mockup 1).
 *
 * Dentro il `BottomSheet` (la maniglia la disegna lui): preview compatta,
 * «Invia su PROLINK» con i Recenti, divider, «Copia link» e «Condividi
 * tramite…». Le tre modalità restano distinte (§22, §34): i destinatari interni
 * sono avatar, le app esterne le mostra il sistema (§160) — qui non c'è una
 * griglia di WhatsApp o Instagram.
 *
 * Copia link e share esterno non dipendono dai Recenti (§81): sono sempre
 * attivi, anche mentre i Recenti caricano o sono vuoti (§79).
 */

import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Divider } from "../../../ui";
import { SHARE_COPY } from "../share-presentation";
import type { SharePreview, ShareRecipient } from "../share-types";
import { SharePreviewCard } from "./SharePreviewCard";
import { ShareRecentsRow } from "./ShareRecentsRow";

type ShareSheetContentProps = {
  preview: SharePreview;
  recents: ShareRecipient[];
  recentsLoading: boolean;
  onCopyLink: () => void;
  onExternalShare: () => void;
  onMore: () => void;
  onSelectRecent: (recipient: ShareRecipient, position: number) => void;
};

function ActionRow({
  icon,
  label,
  onPress,
  testID,
}: {
  icon: "link-outline" | "share-outline";
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <Ionicons color={colors.textPrimary} name={icon} size={20} />
      <AppText variant="bodyLg">{label}</AppText>
    </Pressable>
  );
}

export function ShareSheetContent({
  preview,
  recents,
  recentsLoading,
  onCopyLink,
  onExternalShare,
  onMore,
  onSelectRecent,
}: ShareSheetContentProps) {
  return (
    <View style={styles.container} testID="share-sheet">
      <SharePreviewCard maxLines={1} preview={preview} />
      <Divider />

      <View style={styles.section}>
        <AppText accessibilityRole="header" variant="titleSm">
          {SHARE_COPY.sendOnProlink}
        </AppText>
        <ShareRecentsRow
          isLoading={recentsLoading}
          onMore={onMore}
          onSelect={onSelectRecent}
          recipients={recents}
        />
      </View>

      <Divider />
      <View>
        <ActionRow
          icon="link-outline"
          label={SHARE_COPY.copyLink}
          onPress={onCopyLink}
          testID="share-copy-link"
        />
        <ActionRow
          icon="share-outline"
          label={SHARE_COPY.externalShare}
          onPress={onExternalShare}
          testID="share-external"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
  },
  container: {
    gap: spacing[12],
  },
  pressed: {
    opacity: 0.6,
  },
  section: {
    gap: spacing[12],
  },
});
