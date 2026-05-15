import { type ComponentProps } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import {
  DIRECTOR_CATEGORY_OPTIONS,
} from "../../onboarding/onboarding-types";
import { radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import type { CompleteProfessionalProfile } from "../profile-service";

type DirectorInfoTabProps = {
  completeProfile: CompleteProfessionalProfile;
  isConnecting?: boolean;
  isMessaging?: boolean;
  isOwner?: boolean;
  onConnect?: () => void;
  onMessage?: () => void;
};

type ActivityMeta = {
  iconName: ComponentProps<typeof Ionicons>["name"];
  key: string;
  subtitle: string;
  title: string;
};

const MAX_VISIBLE_ACTIVITIES = 4;

const bananiColors = {
  background: "#F7FAFD",
  border: "#00000014",
  foreground: "#061223",
  mutedForeground: "#2F3B45",
  primary: "#0A66CC",
  primaryForeground: "#FFFFFF",
  secondary: "#EAF6FF",
} as const;

const RESPONSIBILITY_META: Record<string, ActivityMeta> = {
  "Gestione rose e contratti": {
    iconName: "people-outline",
    key: "squad-building",
    subtitle: "Prima squadra",
    title: "Costruzione rosa",
  },
  "Mercato calciatori": {
    iconName: "search-outline",
    key: "market-opportunities",
    subtitle: "Mercato e prospetti",
    title: "Valutazione opportunita",
  },
  "Scouting e osservazione": {
    iconName: "eye-outline",
    key: "scouting",
    subtitle: "Osservazione giocatori",
    title: "Scouting",
  },
  "Gestione allenatori e staff": {
    iconName: "clipboard-outline",
    key: "technical-staff",
    subtitle: "Area tecnica",
    title: "Coordinamento staff",
  },
  "Relazioni con la federazione": {
    iconName: "briefcase-outline",
    key: "institutional-relations",
    subtitle: "Federazione e norme",
    title: "Relazioni istituzionali",
  },
  "Settore giovanile": {
    iconName: "trending-up-outline",
    key: "youth-development",
    subtitle: "Giovanile",
    title: "Sviluppo settore",
  },
  "Budget e finanze": {
    iconName: "stats-chart-outline",
    key: "budget",
    subtitle: "Sostenibilita",
    title: "Pianificazione budget",
  },
  "Comunicazione e sponsor": {
    iconName: "megaphone-outline",
    key: "partnerships",
    subtitle: "Sponsor e media",
    title: "Partnership",
  },
  "Organizzazione logistica": {
    iconName: "calendar-outline",
    key: "operations",
    subtitle: "Operativita club",
    title: "Organizzazione",
  },
  Altro: {
    iconName: "grid-outline",
    key: "other",
    subtitle: "Area operativa",
    title: "Gestione club",
  },
};

const CATEGORY_ORDER = DIRECTOR_CATEGORY_OPTIONS.map((value) => value.toLowerCase());

const REGION_MACRO_AREAS: Record<string, string> = {
  "Abruzzo": "Centro Italia",
  "Basilicata": "Sud Italia",
  "Calabria": "Sud Italia",
  "Campania": "Sud Italia",
  "Emilia-Romagna": "Nord Italia",
  "Friuli-Venezia Giulia": "Nord Italia",
  "Lazio": "Centro Italia",
  "Liguria": "Nord Italia",
  "Lombardia": "Nord Italia",
  "Marche": "Centro Italia",
  "Molise": "Sud Italia",
  "Piemonte": "Nord Italia",
  "Puglia": "Sud Italia",
  "Sardegna": "Isole",
  "Sicilia": "Isole",
  "Toscana": "Centro Italia",
  "Trentino-Alto Adige": "Nord Italia",
  "Umbria": "Centro Italia",
  "Valle d'Aosta": "Nord Italia",
  "Veneto": "Nord Italia",
};

function SectionLabel({ children }: { children: string }) {
  return (
    <AppText style={styles.sectionLabel}>
      {children.toUpperCase()}
    </AppText>
  );
}

function normalizeValues(values: (string | null | undefined)[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const normalized = value?.trim();
    if (!normalized) {
      return;
    }

    const key = normalized.toLowerCase();
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(normalized);
  });

  return result;
}

function sortDirectorCategories(values: string[]) {
  return [...values].sort((left, right) => {
    const leftIndex = CATEGORY_ORDER.indexOf(left.toLowerCase());
    const rightIndex = CATEGORY_ORDER.indexOf(right.toLowerCase());

    if (leftIndex === -1 && rightIndex === -1) {
      return left.localeCompare(right, "it");
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function buildActivityItems(responsibilities: string[]) {
  return normalizeValues(responsibilities)
    .map((responsibility) => {
      const meta = RESPONSIBILITY_META[responsibility];

      return (
        meta ?? {
          iconName: "grid-outline" as const,
          key: responsibility,
          subtitle: "Area operativa",
          title: responsibility,
        }
      );
    })
    .slice(0, MAX_VISIBLE_ACTIVITIES);
}

function getMainFocusLabel(value: string | null | undefined) {
  if (value?.trim() === "Entrambi") {
    return "Prima squadra e settore giovanile";
  }

  return value?.trim() || null;
}

function buildAreaBadges(completeProfile: CompleteProfessionalProfile) {
  const region = completeProfile.profile.region?.trim();
  const locationFallback =
    completeProfile.profile.residence?.trim() ||
    completeProfile.profile.city?.trim() ||
    completeProfile.profile.current_location_city?.trim();
  const macroArea = region ? REGION_MACRO_AREAS[region] : null;

  return normalizeValues([region, macroArea, region ? null : locationFallback]);
}

export function DirectorInfoTab({
  completeProfile,
  isConnecting = false,
  isMessaging = false,
  isOwner = false,
  onConnect,
  onMessage,
}: DirectorInfoTabProps) {
  const directorProfile = completeProfile.directorProfile;
  const primaryRole =
    directorProfile?.primary_role?.trim() ||
    directorProfile?.director_roles.find((role) => role.trim())?.trim() ||
    "Dirigente";
  const focusLabel = getMainFocusLabel(directorProfile?.main_focus);
  const activityItems = buildActivityItems(directorProfile?.responsibilities ?? []);
  const categories = sortDirectorCategories(
    normalizeValues(directorProfile?.experience_categories ?? []),
  );
  const areaBadges = buildAreaBadges(completeProfile);
  const bio = completeProfile.profile.bio?.trim() || null;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {!isOwner && (onConnect || onMessage) ? (
        <View style={styles.actionsRow}>
          {onConnect ? (
            <DirectorActionButton
              iconName="person-add-outline"
              label={isConnecting ? "Invio..." : "Collegati"}
              loading={isConnecting}
              onPress={onConnect}
              variant="primary"
            />
          ) : null}
          {onMessage ? (
            <DirectorActionButton
              iconName="chatbubble-outline"
              label={isMessaging ? "Apertura..." : "Invia un messaggio"}
              loading={isMessaging}
              onPress={onMessage}
              variant="secondary"
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.identityHero}>
        <AppText style={styles.heroRole}>{primaryRole}</AppText>
        {focusLabel ? (
          <View style={styles.focusBadge}>
            <Ionicons
              color={bananiColors.mutedForeground}
              name="briefcase-outline"
              size={16}
            />
            <AppText style={styles.focusText} variant="bodySm">
              {focusLabel}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <SectionLabel>Attivita principali</SectionLabel>
        {activityItems.length > 0 ? (
          <View style={styles.activityGrid}>
            {activityItems.map((item, index) => {
              const shouldSpan =
                activityItems.length % 2 === 1 &&
                index === activityItems.length - 1;

              return (
                <View
                  key={item.key}
                  style={[
                    styles.activityCard,
                    shouldSpan ? styles.activityCardWide : null,
                  ]}
                >
                  <View style={styles.activityIcon}>
                    <Ionicons
                      color={bananiColors.foreground}
                      name={item.iconName}
                      size={20}
                    />
                  </View>
                  <View style={styles.activityCopy}>
                    <AppText style={styles.activityTitle}>{item.title}</AppText>
                    <AppText style={styles.activitySubtitle} variant="bodySm">
                      {item.subtitle}
                    </AppText>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <AppText style={styles.emptyText} variant="bodySm">
            Attivita operative in definizione.
          </AppText>
        )}
      </View>

      {categories.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel>Categorie</SectionLabel>
          <View style={styles.tagsRow}>
            {categories.map((category) => (
              <View key={category} style={styles.categoryTag}>
                <AppText style={styles.categoryText} variant="bodySm">
                  {category}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {areaBadges.length > 0 ? (
        <View style={styles.section}>
          <SectionLabel>Area operativa</SectionLabel>
          <View style={styles.areaRow}>
            {areaBadges.map((area) => (
              <View key={area} style={styles.areaBadge}>
                <Ionicons
                  color={bananiColors.mutedForeground}
                  name="location-outline"
                  size={16}
                />
                <AppText style={styles.areaText}>{area}</AppText>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {bio ? (
        <View style={styles.section}>
          <SectionLabel>Descrizione</SectionLabel>
          <AppText numberOfLines={2} style={styles.description}>
            {bio}
          </AppText>
        </View>
      ) : null}
    </ScrollView>
  );
}

function DirectorActionButton({
  iconName,
  label,
  loading,
  onPress,
  variant,
}: {
  iconName: ComponentProps<typeof Ionicons>["name"];
  label: string;
  loading: boolean;
  onPress: () => void;
  variant: "primary" | "secondary";
}) {
  const isPrimary = variant === "primary";

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: loading }}
      disabled={loading}
      onPress={onPress}
      style={[
        styles.actionButton,
        isPrimary ? styles.actionPrimary : styles.actionSecondary,
      ]}
    >
      <Ionicons
        color={isPrimary ? bananiColors.primaryForeground : bananiColors.foreground}
        name={iconName}
        size={16}
      />
      <AppText
        numberOfLines={1}
        style={[
          styles.actionLabel,
          isPrimary ? styles.actionLabelPrimary : styles.actionLabelSecondary,
        ]}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionButton: {
    alignItems: "center",
    borderRadius: radius[6],
    flex: 1,
    flexDirection: "row",
    gap: spacing[6],
    height: 44,
    justifyContent: "center",
    minWidth: 0,
    paddingHorizontal: spacing[8],
  },
  actionLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
  },
  actionLabelPrimary: {
    color: bananiColors.primaryForeground,
  },
  actionLabelSecondary: {
    color: bananiColors.foreground,
  },
  actionPrimary: {
    backgroundColor: bananiColors.primary,
  },
  actionSecondary: {
    backgroundColor: bananiColors.background,
    borderColor: bananiColors.border,
    borderWidth: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing[12],
  },
  activityCard: {
    backgroundColor: bananiColors.background,
    borderColor: bananiColors.border,
    borderRadius: radius[12],
    borderWidth: 1,
    gap: spacing[12],
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[18],
    width: "48%",
  },
  activityCardWide: {
    alignItems: "center",
    flexDirection: "row",
    paddingVertical: spacing[16],
    width: "100%",
  },
  activityCopy: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  activityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[12],
  },
  activityIcon: {
    alignItems: "center",
    backgroundColor: bananiColors.secondary,
    borderRadius: radius[8],
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  activitySubtitle: {
    color: bananiColors.mutedForeground,
    lineHeight: 18,
  },
  activityTitle: {
    color: bananiColors.foreground,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 20,
  },
  areaBadge: {
    alignItems: "center",
    backgroundColor: bananiColors.secondary,
    borderRadius: radius[14],
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[14],
    paddingVertical: spacing[10],
  },
  areaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[10],
  },
  areaText: {
    color: bananiColors.foreground,
    fontSize: 14,
    fontWeight: "600",
  },
  categoryTag: {
    borderColor: bananiColors.border,
    borderRadius: radius[14],
    borderWidth: 1,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[10],
  },
  categoryText: {
    color: bananiColors.foreground,
    fontWeight: "600",
  },
  container: {
    backgroundColor: bananiColors.background,
    gap: spacing[32],
    paddingBottom: spacing[48],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  description: {
    color: bananiColors.mutedForeground,
    fontSize: 15,
    lineHeight: 24,
  },
  emptyText: {
    color: bananiColors.mutedForeground,
  },
  focusBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: bananiColors.secondary,
    borderRadius: radius[6],
    flexDirection: "row",
    gap: spacing[6],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[8],
  },
  focusText: {
    color: bananiColors.foreground,
    fontWeight: "700",
  },
  heroRole: {
    color: bananiColors.foreground,
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
  },
  identityHero: {
    gap: spacing[14],
  },
  section: {
    gap: spacing[14],
  },
  sectionLabel: {
    color: bananiColors.mutedForeground,
    fontSize: 12,
    fontWeight: "800",
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[10],
  },
});
