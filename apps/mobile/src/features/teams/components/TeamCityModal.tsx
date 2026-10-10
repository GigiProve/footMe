import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, sizes, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import { CityAutocompleteField } from "../../onboarding/ui";
import type { ItalianCityOption } from "../../profiles/profile-form-utils";

type Props = {
  initialCity: string;
  initialRegion: string;
  onClose: () => void;
  onConfirm: (value: { city: string; region: string }) => void;
  visible: boolean;
};

/**
 * Selector geografico della squadra (§18).
 *
 * Riusa il campo comuni del prodotto: §18 vieta «una geografia specifica
 * delle Squadre», quindi nessuna mappa, nessun indirizzo dell'impianto e
 * nessuna seconda tassonomia. Quello che risale è il comune normalizzato con
 * la sua regione, non la stringa digitata — il backend lo rivalida comunque.
 */
export function TeamCityModal({
  initialCity,
  initialRegion,
  onClose,
  onConfirm,
  visible,
}: Props) {
  const insets = useSafeAreaInsets();
  const [city, setCity] = useState(initialCity);
  const [region, setRegion] = useState(initialRegion);
  const [touched, setTouched] = useState(false);

  const isValid = city.trim().length > 0 && region.trim().length > 0;

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => {
        setCity(initialCity);
        setRegion(initialRegion);
        setTouched(false);
      }}
      presentationStyle="fullScreen"
      visible={visible}
    >
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.navBar}>
          <Pressable
            accessibilityLabel="Indietro"
            accessibilityRole="button"
            hitSlop={8}
            onPress={onClose}
            style={styles.backButton}
          >
            <Ionicons color={colors.textPrimary} name="chevron-back" size={24} />
          </Pressable>

          <AppText numberOfLines={1} style={styles.navTitle} variant="titleMd">
            Città della squadra
          </AppText>

          <View style={styles.backButton} />
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <CityAutocompleteField
            errorMessage={
              touched && !isValid ? "Seleziona una località valida." : undefined
            }
            onChangeText={(value) => {
              setTouched(true);
              setCity(value);
              setRegion("");
            }}
            onSelectCity={(option: ItalianCityOption) => {
              setCity(option.name);
              setRegion(option.region);
            }}
            selectedRegion={region || undefined}
            testID="team-city-field"
            value={city}
          />
        </ScrollView>

        <View
          style={[styles.footer, { paddingBottom: insets.bottom + spacing[16] }]}
        >
          <Button
            disabled={!isValid}
            fullWidth
            label="Conferma"
            onPress={() => onConfirm({ city: city.trim(), region: region.trim() })}
            testID="team-city-confirm"
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: colors.background,
    flex: 1,
  },
  navBar: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: sizes.touchTarget,
    paddingHorizontal: spacing[12],
  },
  backButton: {
    alignItems: "center",
    height: sizes.touchTarget,
    justifyContent: "center",
    width: sizes.touchTarget,
  },
  navTitle: {
    flex: 1,
    textAlign: "center",
  },
  content: {
    gap: spacing[16],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
  },
  footer: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: spacing[20],
    paddingTop: spacing[16],
  },
});
