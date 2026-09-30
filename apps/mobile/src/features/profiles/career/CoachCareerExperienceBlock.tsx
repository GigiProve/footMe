/**
 * Un incarico della Carriera (REV-PROF-03, sezioni "Gruppo società" e "Riga
 * stagione"; REV-PROF-06 per lo Staff tecnico).
 *
 * Ricalca uno a uno il blocco del Master Profile Calciatore — logo una volta
 * sola per incarico, tutte le stagioni visibili, nessun accordion — e cambia
 * solo il contenuto della riga: stagione, ruolo e categoria al posto delle
 * statistiche, che in una carriera di incarichi non esistono.
 *
 * Lo Staff tecnico usa questo stesso blocco: cambia solo il prefisso dei
 * testID, perché i due percorsi possono convivere nello stesso profilo.
 */
import { Image, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type {
  CoachCareerExperience,
  CoachCareerSeason,
} from "./coach-career-model";

type CoachCareerExperienceBlockProps = {
  experience: CoachCareerExperience;
  isLast: boolean;
  /** Prefisso dei testID: distingue i percorsi dentro uno stesso profilo. */
  testIDPrefix?: string;
};

export function CoachCareerExperienceBlock({
  experience,
  isLast,
  testIDPrefix = "coach",
}: CoachCareerExperienceBlockProps) {
  return (
    <View
      style={[styles.container, isLast ? styles.containerLast : null]}
      testID={`${testIDPrefix}-career-experience-${experience.id}`}
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
          <CoachSeasonRow
            isFirst={index === 0}
            isLast={index === experience.seasons.length - 1}
            key={season.seasonKey}
            season={season}
            testIDPrefix={testIDPrefix}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Ruolo e categoria vengono dalla stagione, non dall'incarico: la stessa
 * società può comparire con ruoli e categorie diversi da un anno all'altro.
 */
function CoachSeasonRow({
  isFirst,
  isLast,
  season,
  testIDPrefix,
}: {
  isFirst: boolean;
  isLast: boolean;
  season: CoachCareerSeason;
  testIDPrefix: string;
}) {
  return (
    <View
      accessible
      accessibilityLabel={[
        `Stagione ${season.seasonKey.replace("/", "-")}`,
        season.role,
        season.category,
      ]
        .filter(Boolean)
        .join(", ")}
      style={styles.row}
      testID={`${testIDPrefix}-career-season-${season.seasonKey}`}
    >
      <View style={styles.timeline}>
        <View
          style={[
            styles.timelineLine,
            isFirst ? styles.timelineLineFirst : null,
            isLast ? styles.timelineLineLast : null,
          ]}
        />
        <View style={styles.timelineDot} />
      </View>

      <AppText numberOfLines={1} style={styles.season} variant="metaStrong">
        {season.label}
      </AppText>

      {/* Ruolo o categoria mancanti non lasciano una colonna vuota: la riga
          resta in equilibrio perché le due colonne restano comunque allineate. */}
      <AppText
        color="secondary"
        numberOfLines={1}
        style={styles.role}
        variant="meta"
      >
        {season.role}
      </AppText>

      <AppText
        color="muted"
        numberOfLines={1}
        style={styles.category}
        variant="meta"
      >
        {season.category}
      </AppText>
    </View>
  );
}

/**
 * Logo assente: il placeholder ufficiale del design system, mai un'immagine
 * rotta e mai una misura diversa.
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
  category: {
    flexShrink: 1,
    minWidth: 0,
    textAlign: "right",
    width: "34%",
  },
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
  role: {
    flexShrink: 1,
    minWidth: 0,
    paddingRight: spacing[8],
    width: "34%",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 44,
    paddingVertical: spacing[6],
  },
  season: {
    flexShrink: 1,
    minWidth: 0,
    paddingRight: spacing[8],
    width: "32%",
  },
  seasons: {
    paddingLeft: spacing[4],
  },
  timeline: {
    alignItems: "center",
    alignSelf: "stretch",
    justifyContent: "center",
    marginRight: spacing[12],
    width: 10,
  },
  timelineDot: {
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    height: 7,
    width: 7,
  },
  timelineLine: {
    backgroundColor: colors.border,
    bottom: 0,
    position: "absolute",
    top: 0,
    width: 1,
  },
  timelineLineFirst: {
    top: "50%",
  },
  timelineLineLast: {
    bottom: "50%",
  },
});
