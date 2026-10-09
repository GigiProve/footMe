import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../theme/tokens";
import { AppText, Avatar, BottomSheet } from "../../../ui";
import {
  IDENTITY_KIND_LABELS,
  type DashboardIdentity,
} from "../dashboard-types";

type Props = {
  currentId: string | null;
  identities: DashboardIdentity[];
  onClose: () => void;
  onSelect: (identityId: string) => void;
  visible: boolean;
};

/** Oltre questa altezza la lista scorre invece di spingere fuori il footer. */
const LIST_MAX_HEIGHT = 320;

/**
 * Selector "Dashboard di" (master 04).
 *
 * È l'**unico** selector: non esiste anche "Le tue Dashboard". Non gestisce
 * account, logout, creazione o ruoli — solo quale Dashboard aprire.
 *
 * Il tap seleziona e chiude: nessun passaggio "Conferma". Il tap
 * sull'identità già corrente chiude e basta, senza uno switch duplicato — la
 * decisione sta nel provider, qui si limita a chiudere.
 */
export function DashboardIdentitySheet({
  currentId,
  identities,
  onClose,
  onSelect,
  visible,
}: Props) {
  function handlePress(identityId: string) {
    onClose();

    if (identityId !== currentId) {
      onSelect(identityId);
    }
  }

  return (
    <BottomSheet onClose={onClose} title="Dashboard di" visible={visible}>
      <AppText color="secondary" style={styles.subtitle} variant="bodyLg">
        Scegli quale Dashboard aprire.
      </AppText>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {identities.map((identity) => {
          const isSelected = identity.id === currentId;
          const typeLabel = IDENTITY_KIND_LABELS[identity.kind];

          return (
            <Pressable
              accessibilityLabel={`${identity.name}, ${typeLabel}`}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              key={identity.id}
              onPress={() => handlePress(identity.id)}
              style={({ pressed }) => [
                styles.row,
                isSelected ? styles.rowSelected : null,
                pressed ? styles.pressed : null,
              ]}
            >
              <Avatar
                name={identity.name}
                size="md"
                square={identity.kind !== "person"}
                uri={identity.avatarUrl ?? undefined}
              />

              <View style={styles.rowBody}>
                <View style={styles.nameRow}>
                  <AppText
                    numberOfLines={1}
                    style={styles.name}
                    variant="titleMd"
                  >
                    {identity.name}
                  </AppText>
                  {identity.isVerified ? (
                    <Ionicons
                      accessibilityLabel="Identità verificata"
                      color={colors.accent}
                      name="checkmark-circle"
                      size={15}
                    />
                  ) : null}
                </View>
                <AppText color="secondary" numberOfLines={1} variant="meta">
                  {typeLabel}
                </AppText>
              </View>

              {/*
                Il cerchio vuoto rende la selezione leggibile anche senza
                colore: il fondo azzurro da solo non basterebbe (§23).
              */}
              {isSelected ? (
                <Ionicons
                  color={colors.accent}
                  name="checkmark-circle"
                  size={24}
                />
              ) : (
                <View style={styles.radioEmpty} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <Ionicons
          color={colors.textMuted}
          name="information-circle-outline"
          size={16}
        />
        <AppText color="muted" style={styles.footerText} variant="caption">
          Il cambio riguarda solo la Dashboard.
        </AppText>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  subtitle: {
    marginBottom: spacing[12],
  },
  list: {
    maxHeight: LIST_MAX_HEIGHT,
  },
  listContent: {
    gap: spacing[4],
  },
  row: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius[12],
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget + spacing[12],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[10],
  },
  rowSelected: {
    backgroundColor: colors.accentSoft,
  },
  rowBody: {
    flex: 1,
    gap: spacing[4],
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  name: {
    flexShrink: 1,
  },
  radioEmpty: {
    borderColor: colors.borderStrong,
    borderRadius: radius.full,
    borderWidth: 1.5,
    height: 22,
    width: 22,
  },
  pressed: {
    opacity: 0.75,
  },
  footer: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[8],
    marginTop: spacing[16],
  },
  footerText: {
    flex: 1,
  },
});
