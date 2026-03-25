import { View } from "react-native";

import { AppText } from "../../../ui";
import { authStyles } from "./auth-styles";

type AuthDividerProps = {
  label?: string;
};

export function AuthDivider({ label = "oppure" }: AuthDividerProps) {
  return (
    <View style={authStyles.dividerRow}>
      <View style={authStyles.dividerLine} />
      <AppText variant="bodySm" color="muted" style={authStyles.dividerText}>
        {label}
      </AppText>
      <View style={authStyles.dividerLine} />
    </View>
  );
}
