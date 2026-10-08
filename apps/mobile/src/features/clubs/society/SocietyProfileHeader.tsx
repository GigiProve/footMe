/**
 * Header del Master Profile Società (REV-PROF-17 §"Header del club").
 *
 * Stessa struttura degli altri Master Profile — cover, logo sovrapposto,
 * nome, metadati leggeri, azioni — con due differenze che vengono dal
 * dominio e non dallo stile: il logo è uno stemma, quindi non viene
 * ritagliato come un avatar personale, e i metadati non contengono mai
 * conteggi di giocatori, staff o dirigenti.
 */
import { type ReactNode } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";

const COVER_HEIGHT = 150;
const LOGO_SIZE = 84;
const LOGO_OVERLAP = 42;

export type SocietyHeaderMetaRow = {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  key: string;
  text: string;
};

type SocietyProfileHeaderProps = {
  actions?: ReactNode;
  coverUrl: string | null;
  /** "Pagina ufficiale": solo su un profilo realmente verificato. */
  isOfficial?: boolean;
  logoUrl: string | null;
  metaRows?: readonly SocietyHeaderMetaRow[];
  name: string;
  /** Categoria della prima squadra, per esempio "Serie D". */
  categoryLabel?: string | null;
  onLogoPress?: () => void;
  testID?: string;
};

export function SocietyProfileHeader({
  actions,
  categoryLabel,
  coverUrl,
  isOfficial = false,
  logoUrl,
  metaRows = [],
  name,
  onLogoPress,
  testID = "society-profile-header",
}: SocietyProfileHeaderProps) {
  const logo = (
    <View style={styles.logoShell}>
      {logoUrl ? (
        <Image
          // `contain`: uno stemma verticale non va riempito a forza in un
          // quadrato, altrimenti si deforma.
          resizeMode="contain"
          source={{ uri: logoUrl }}
          style={styles.logo}
        />
      ) : (
        <View style={styles.logoFallback} testID={`${testID}-logo-fallback`}>
          <AppText color="inverse" variant="headingMd">
            {getClubInitials(name)}
          </AppText>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container} testID={testID}>
      {/* La cover è decorativa: il nome resta la prima cosa annunciata. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.cover}
      >
        {coverUrl ? (
          <Image resizeMode="cover" source={{ uri: coverUrl }} style={styles.coverImage} />
        ) : null}
      </View>

      <View
        accessible
        accessibilityLabel={`Stemma di ${name}`}
        accessibilityRole="image"
        style={styles.logoAnchor}
      >
        {onLogoPress ? (
          <Pressable onPress={onLogoPress}>{logo}</Pressable>
        ) : (
          logo
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.nameRow}>
          <AppText numberOfLines={2} style={styles.name} variant="heroName">
            {name}
          </AppText>
          {isOfficial ? (
            <View style={styles.officialBadge} testID={`${testID}-official`}>
              <AppText color="accent" variant="metaStrong">
                Pagina ufficiale
              </AppText>
            </View>
          ) : null}
        </View>

        {categoryLabel ? (
          <View style={styles.categoryBadge}>
            <AppText color="inverse" variant="metaStrong">
              {categoryLabel}
            </AppText>
          </View>
        ) : null}

        {metaRows.length > 0 ? (
          <View style={styles.metaStack}>
            {metaRows.map((row) => (
              <View key={row.key} style={styles.metaRow}>
                {row.icon ? (
                  <Ionicons
                    color={colors.textMuted}
                    name={row.icon}
                    size={13}
                    style={styles.metaIcon}
                  />
                ) : null}
                <AppText color="secondary" style={styles.metaText} variant="meta">
                  {row.text}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}

        {actions ? <View style={styles.actionsRow}>{actions}</View> : null}
      </View>
    </View>
  );
}

export function getClubInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "?";

  return words
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase("it"))
    .join("");
}

const styles = StyleSheet.create({
  actionsRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    paddingTop: spacing[10],
  },
  body: {
    gap: spacing[6],
    paddingBottom: spacing[16],
    paddingHorizontal: spacing[16],
    paddingTop: spacing[10],
  },
  categoryBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  container: {
    backgroundColor: colors.surface,
  },
  cover: {
    backgroundColor: colors.backgroundStrong,
    height: COVER_HEIGHT,
    width: "100%",
  },
  coverImage: {
    height: "100%",
    width: "100%",
  },
  logo: {
    height: LOGO_SIZE,
    width: LOGO_SIZE,
  },
  logoAnchor: {
    marginLeft: spacing[16],
    marginTop: -LOGO_OVERLAP,
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radius[12],
    height: LOGO_SIZE,
    justifyContent: "center",
    width: LOGO_SIZE,
  },
  logoShell: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    height: LOGO_SIZE + 8,
    justifyContent: "center",
    width: LOGO_SIZE + 8,
  },
  metaIcon: {
    marginTop: 1,
  },
  metaRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[6],
  },
  metaStack: {
    gap: spacing[4],
    paddingTop: spacing[4],
  },
  metaText: {
    flexShrink: 1,
  },
  name: {
    flexShrink: 1,
    minWidth: 0,
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
  },
  officialBadge: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.full,
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
});
