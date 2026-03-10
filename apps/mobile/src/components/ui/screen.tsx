import { PropsWithChildren } from "react";
import { SafeAreaView, View } from "react-native";

import { colors } from "../../theme/tokens";

export function Screen({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -80,
          right: -40,
          width: 220,
          height: 220,
          borderRadius: 999,
          backgroundColor: colors.heroSoft,
          opacity: 0.5,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -120,
          left: -70,
          width: 260,
          height: 260,
          borderRadius: 999,
          backgroundColor: colors.accentSoft,
          opacity: 0.8,
        }}
      />
      <View style={{ flex: 1, paddingHorizontal: 20, paddingVertical: 24 }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
