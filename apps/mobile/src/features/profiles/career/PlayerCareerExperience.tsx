/**
 * Un'esperienza della Carriera (REV-PROF-01 §13–§17).
 *
 * Il logo compare una volta sola per esperienza, tutte le stagioni sono
 * visibili — niente accordion, niente "Mostra tutte" — e la categoria sta
 * sulla singola stagione, non sotto il nome della società.
 */
import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { CareerSeasonRow } from "./CareerSeasonRow";
import type { CareerExperience } from "./player-career-model";

type PlayerCareerExperienceProps = {
  experience: CareerExperience;
  isLast: boolean;
};

export function PlayerCareerExperience({
  experience,
  isLast,
}: PlayerCareerExperienceProps) {
  return (
    <View
      style={[styles.container, isLast ? styles.containerLast : null]}
      testID={`career-experience-${experience.id}`}
    >
      <View
        accessible
        accessibilityLabel={`${experience.clubName}, ${experience.periodLabel}`}
        style={styles.header}
      >
        <ClubLogo logoUrl={experience.logoUrl} />
        <View style={styles.headerText}>
          <AppText numberOfLines={2} variant="titleMd">
            {experience.clubName}
          </AppText>
          <AppText color="muted" variant="meta">
            {experience.periodLabel}
          </AppText>
        </View>
      </View>

      <View style={styles.seasons}>
        {experience.seasons.map((season, index) => (
          <CareerSeasonRow
            isFirst={index === 0}
            isLast={index === experience.seasons.length - 1}
            key={season.seasonKey}
            season={season}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Il logo appartiene all'esperienza, non alla stagione: se lo stesso club
 * torna in una seconda esperienza il logo ricompare lì, una volta (§13).
 */
function ClubLogo({ logoUrl }: { logoUrl: string }) {
  if (logoUrl) {
    return (
      <View style={styles.logo}>
        <Image source={{ uri: logoUrl }} style={styles.logoImage} />
      </View>
    );
  }

  return (
    <View style={[styles.logo, styles.logoFallback]}>
      <Ionicons color={colors.accent} name="shield-outline" size={18} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomColor: colors.divider,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing[10],
    paddingBottom: spacing[18],
    paddingTop: spacing[16],
  },
  containerLast: {
    borderBottomWidth: 0,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
  },
  headerText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  logo: {
    borderRadius: radius.full,
    flexShrink: 0,
    height: 36,
    overflow: "hidden",
    width: 36,
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    justifyContent: "center",
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
  seasons: {
    paddingLeft: spacing[4],
  },
});
