/**
 * Riga di «Profili bloccati» (HOM-12 §144–§148, §227, §230–§231, §247–§249): una
 * normale riga Settings, non una card. Avatar · nome + check standard · metadata breve ·
 * pillola «Sblocca» accent (§228). Stesso linguaggio per PERSON, SOCIETY e MEDIA (§231).
 * Con i font grandi il blocco testo e la CTA vanno a capo (§248); la CTA resta a 44pt.
 * La riga annuncia identità, tipo e azione (§247).
 */

import { StyleSheet, View } from "react-native";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button, VerifiedCheck } from "../../../ui";
import {
  BLOCK_COPY,
  blockedRowA11yLabel,
  blockedSubtitle,
  unblockA11yLabel,
} from "../blocking-presentation";
import type { BlockedIdentity } from "../blocking-types";

type BlockedIdentityRowProps = {
  item: BlockedIdentity;
  isBusy: boolean;
  onUnblock: () => void;
};

const UNBLOCK_HIT_SLOP = { bottom: 6, left: 4, right: 4, top: 6 };

export function BlockedIdentityRow({ isBusy, item, onUnblock }: BlockedIdentityRowProps) {
  return (
    <View style={styles.row} testID={`blocked-row-${item.identityId}`}>
      <View
        accessibilityLabel={blockedRowA11yLabel(item)}
        accessible
        style={styles.identity}
      >
        <Avatar
          name={item.name}
          size="md"
          square={item.identityType === "society"}
          tone={item.identityType === "society" ? "ink" : "accent"}
          uri={item.avatarUrl}
        />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <AppText style={styles.name} variant="titleSm">
              {item.name}
            </AppText>
            {item.isVerified ? <VerifiedCheck /> : null}
          </View>
          <AppText color="secondary" variant="meta">
            {blockedSubtitle(item)}
          </AppText>
        </View>
      </View>
      <Button
        accessibilityLabel={unblockA11yLabel(item.name)}
        disabled={isBusy}
        label={BLOCK_COPY.unblock}
        loading={isBusy}
        // §249: pill da 32pt per non appesantire la riga Settings (§148), area di
        // tocco portata a 44pt. §228: Sblocca usa l'accent PROLINK, non il grigio.
        hitSlop={UNBLOCK_HIT_SLOP}
        onPress={onUnblock}
        size="sm"
        testID={`blocked-unblock-${item.identityId}`}
        variant="tertiary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    gap: spacing[12],
    minWidth: 160,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
  },
  row: {
    alignItems: "center",
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
    columnGap: spacing[12],
    flexDirection: "row",
    flexWrap: "wrap",
    paddingVertical: spacing[12],
    rowGap: spacing[8],
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
