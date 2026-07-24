import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText, Avatar, Button } from "../../../ui";
import { formatLocation } from "../../profiles/profile-display-helpers";

export type ClubRowData = {
  id: string;
  kind: "club" | "team";
  name: string;
  logo_url: string | null;
  category: string | null;
  city: string | null;
  region: string | null;
  parent_club_name: string | null;
  is_affiliate: boolean;
  has_senior?: boolean | null;
  has_youth?: boolean | null;
};

export type ClubResultRowVariant = "principal" | "team" | "affiliate" | "link";

type ClubResultRowProps = {
  data: ClubRowData;
  variant: ClubResultRowVariant;
  indented?: boolean;
  follow?: { following: boolean; onToggle: () => void } | null;
  save?: { saved: boolean; onToggle: () => void } | null;
  onPress: () => void;
};

function structureSummary(data: ClubRowData): string | null {
  if (data.has_senior && data.has_youth) {
    return "Prima squadra e settore giovanile";
  }
  if (data.has_senior) {
    return "Prima squadra";
  }
  if (data.has_youth) {
    return "Settore giovanile attivo";
  }
  return null;
}

function buildMetaLines(
  data: ClubRowData,
  variant: ClubResultRowVariant,
  indented: boolean,
): string[] {
  switch (variant) {
    case "principal": {
      const line1 = ["Società", data.category].filter(Boolean).join(" • ");
      const line2 = formatLocation(data.city, data.region);
      const line3 = structureSummary(data);
      return [line1, line2, line3].filter((line): line is string => Boolean(line));
    }
    case "team": {
      const line1 = ["Squadra del club", data.category].filter(Boolean).join(" • ");
      const line2 = !indented && data.parent_club_name ? data.parent_club_name : null;
      return [line1, line2].filter((line): line is string => Boolean(line));
    }
    case "affiliate": {
      const line1 = "Società affiliata";
      const line2 = data.parent_club_name ? `Affiliata ad ${data.parent_club_name}` : null;
      const line3 = [data.category, data.city].filter(Boolean).join(" • ");
      return [line1, line2, line3].filter((line): line is string => Boolean(line));
    }
    case "link": {
      const line1 = ["Società", data.category].filter(Boolean).join(" • ");
      return [line1].filter((line): line is string => Boolean(line));
    }
    default:
      return [];
  }
}

export function ClubResultRow({
  data,
  variant,
  indented = false,
  follow = null,
  save = null,
  onPress,
}: ClubResultRowProps) {
  const lines = buildMetaLines(data, variant, indented);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        indented ? styles.indented : null,
        pressed ? styles.pressed : null,
      ]}
    >
      {indented ? <View style={styles.connector} /> : null}

      <Avatar name={data.name} size="sm" square uri={data.logo_url} />

      <View style={styles.body}>
        <AppText numberOfLines={1} variant="titleSm">
          {data.name}
        </AppText>
        {lines.map((line, index) => (
          <AppText color="muted" key={index} numberOfLines={1} variant="caption">
            {line}
          </AppText>
        ))}
        {variant === "link" ? (
          <AppText color="accent" numberOfLines={1} variant="caption">
            Apri profilo società
          </AppText>
        ) : null}
      </View>

      <View style={styles.actions}>
        {variant !== "link" && follow ? (
          <Button
            label={follow.following ? "Seguito" : "Segui"}
            onPress={follow.onToggle}
            size="sm"
            variant={follow.following ? "secondary" : "primary"}
          />
        ) : null}

        {variant !== "link" && save ? (
          <Pressable
            accessibilityLabel="Salva società"
            accessibilityRole="button"
            hitSlop={8}
            onPress={save.onToggle}
            style={styles.actionButton}
          >
            <Ionicons
              color={save.saved ? colors.accent : colors.textMuted}
              name={save.saved ? "bookmark" : "bookmark-outline"}
              size={20}
            />
          </Pressable>
        ) : null}

        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      </View>

      <View style={styles.divider} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  actions: {
    alignItems: "center",
    flexDirection: "row",
    flexShrink: 0,
    gap: spacing[10],
  },
  body: {
    flex: 1,
    gap: spacing[4],
  },
  connector: {
    backgroundColor: colors.border,
    bottom: 0,
    left: spacing[20],
    position: "absolute",
    top: 0,
    width: 1,
  },
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    paddingVertical: spacing[12],
  },
  divider: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    bottom: 0,
    left: 56,
    position: "absolute",
    right: 0,
  },
  indented: {
    paddingLeft: spacing[32],
  },
  pressed: {
    opacity: 0.82,
  },
});
