/**
 * Bottom sheet «Pubblica come» (HOM-06.1 §17–20, §184–185, mockup screen 2).
 *
 * Riusa `BottomSheet` del design system. Mostra solo le identità che il
 * chiamante ha già filtrato per `can_publish_post` (§18, §20): qui non c'è
 * nessuna riga in sola lettura. Ogni riga: avatar/logo, nome + check standard,
 * etichetta di contesto («Profilo personale», «Società», «Media», §19), check
 * a destra per la selezionata. Densità medium/arieggiata (§185): righe da 64pt
 * con hairline `divider`. Nessun colore per ruolo (§182).
 *
 * Il tap seleziona e lascia al chiamante la chiusura (`onSelect` poi `onClose`),
 * così il cambio identità resta una decisione del reducer (§26–29).
 */

import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, BottomSheet, VerifiedCheck } from "../../../ui";
import type { ComposerIdentity, ComposerIdentityType } from "../composer-types";
import { ComposerAvatar } from "./ComposerAvatar";

type PublishAsSheetProps = {
  visible: boolean;
  identities: ComposerIdentity[];
  selected: { type: ComposerIdentityType; id: string } | null;
  onSelect: (identity: ComposerIdentity) => void;
  onClose: () => void;
};

function rowLabel(identity: ComposerIdentity, isSelected: boolean): string {
  return [
    identity.name,
    identity.isVerified ? "profilo verificato" : null,
    identity.contextLabel,
    isSelected ? "selezionato" : null,
  ]
    .filter(Boolean)
    .join(", ");
}

export function PublishAsSheet({
  visible,
  identities,
  selected,
  onSelect,
  onClose,
}: PublishAsSheetProps) {
  return (
    <BottomSheet onClose={onClose} title="Pubblica come" visible={visible}>
      <ScrollView bounces={false} style={styles.list}>
        {identities.map((identity, index) => {
          const isSelected = selected?.type === identity.type && selected.id === identity.id;
          const isLast = index === identities.length - 1;

          return (
            <Pressable
              accessibilityLabel={rowLabel(identity, isSelected)}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              key={`${identity.type}:${identity.id}`}
              onPress={() => onSelect(identity)}
              style={({ pressed }) => [
                styles.row,
                isLast ? null : styles.rowDivider,
                pressed ? styles.pressed : null,
              ]}
              testID={`composer-publish-as-${identity.type}-${identity.id}`}
            >
              <ComposerAvatar
                name={identity.name}
                size="md"
                square={identity.type !== "person"}
                uri={identity.avatarUrl}
              />
              <View style={styles.text}>
                <View style={styles.nameRow}>
                  <AppText numberOfLines={1} style={styles.name} variant="titleSm">
                    {identity.name}
                  </AppText>
                  {identity.isVerified ? <VerifiedCheck size={14} /> : null}
                </View>
                <AppText color="secondary" numberOfLines={1} variant="feedMeta">
                  {identity.contextLabel}
                </AppText>
              </View>
              {isSelected ? (
                <Ionicons color={colors.accent} name="checkmark-circle" size={24} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  list: {
    maxHeight: 360,
  },
  name: {
    flexShrink: 1,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  pressed: {
    opacity: 0.7,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingVertical: spacing[12],
  },
  rowDivider: {
    borderBottomColor: colors.divider,
    borderBottomWidth: 1,
  },
  text: {
    flex: 1,
    gap: spacing[4],
  },
});
