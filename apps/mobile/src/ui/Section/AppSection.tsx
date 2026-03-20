import { type PropsWithChildren } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { colors, radius, spacing } from "../../styles";
import { AppDivider } from "../Divider/AppDivider";
import { AppText } from "../Text/AppText";

type AppSectionProps = PropsWithChildren<{
  description?: string;
  style?: StyleProp<ViewStyle>;
  title: string;
}>;

/**
 * LinkedIn-style section card — a white surface with a title, optional
 * description, a divider, and child content.
 *
 * Replaces ad-hoc "sectionCard" styles scattered across screens.
 *
 * Usage:
 *   <AppSection title="Esperienze">
 *     <ExperienceCard … />
 *   </AppSection>
 */
export function AppSection({ children, description, style, title }: AppSectionProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <AppText preset="h3">{title}</AppText>
        {description ? (
          <AppText preset="bodySmall">{description}</AppText>
        ) : null}
      </View>
      <AppDivider />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[12],
    padding: spacing[18],
    borderRadius: radius[24],
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  content: {
    gap: spacing[14],
  },
  header: {
    gap: spacing[4],
  },
});
