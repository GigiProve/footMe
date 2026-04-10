import { StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { withDefaultProfileAvatar } from "./profile-avatar";
import { colors, radius, spacing } from "../../theme/tokens";
import { AppText, Avatar, Button } from "../../ui";

type AgentProfileHeaderProps = {
  agencyLabel?: string;
  avatarUrl: string | null | undefined;
  bio?: string | null;
  fullName: string;
  locationLabel?: string;
  onEditProfilePress?: () => void;
  primaryRole: string;
  statusBadge?: string;
};

export function AgentProfileHeader({
  agencyLabel,
  avatarUrl,
  bio,
  fullName,
  locationLabel,
  onEditProfilePress,
  primaryRole,
  statusBadge,
}: AgentProfileHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <AppText color="accent" variant="overline">
          Profilo agente
        </AppText>
        {statusBadge ? (
          <View style={styles.statusBadge}>
            <Ionicons color={colors.accent} name="shield-checkmark-outline" size={14} />
            <AppText color="accent" variant="caption">
              {statusBadge}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.identityRow}>
        <Avatar name={fullName} size="lg" uri={withDefaultProfileAvatar(avatarUrl)} />
        <View style={styles.identityContent}>
          <AppText variant="displaySm">{fullName}</AppText>
          <AppText color="accent" variant="titleSm">
            {primaryRole}
          </AppText>
          {agencyLabel ? (
            <View style={styles.metaRow}>
              <Ionicons color={colors.textSecondary} name="business-outline" size={15} />
              <AppText color="secondary" variant="bodySm">
                {agencyLabel}
              </AppText>
            </View>
          ) : null}
          {locationLabel ? (
            <View style={styles.metaRow}>
              <Ionicons color={colors.textSecondary} name="location-outline" size={15} />
              <AppText color="secondary" variant="bodySm">
                {locationLabel}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      {bio?.trim() ? (
        <AppText color="secondary" numberOfLines={3} variant="bodySm">
          {bio.trim()}
        </AppText>
      ) : null}

      <Button
        label="Modifica profilo"
        leftIcon={<Ionicons color={colors.inkInvert} name="create-outline" size={18} />}
        onPress={onEditProfilePress}
        size="sm"
        variant="primary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    gap: spacing[14],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[12],
    paddingBottom: spacing[20],
  },
  identityContent: {
    flex: 1,
    gap: spacing[4],
  },
  identityRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[14],
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[6],
  },
  statusBadge: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    flexDirection: "row",
    gap: spacing[4],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  topRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
});
