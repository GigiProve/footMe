import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { ContactSection } from "../contact-section";
import { getOptionLabel, REGION_OPTIONS } from "../profile-form-utils";
import { computePlayerBackground } from "../profile-display-helpers";
import type { CoachAchievementRecord, CompleteProfessionalProfile } from "../profile-service";
import type { EditSection } from "../ProfileReadonlyView";

type CoachInfoTabProps = {
  completeProfile: CompleteProfessionalProfile;
  isOwner: boolean;
  onEdit: (section: EditSection) => void;
};

const ACHIEVEMENT_ICONS: Record<CoachAchievementRecord["achievement_type"], string> = {
  campionato: "trophy-outline",
  promozione: "arrow-up-circle-outline",
  coppa: "shield-outline",
  playoff: "star-outline",
  altro: "ribbon-outline",
};

const ACHIEVEMENT_LABELS: Record<CoachAchievementRecord["achievement_type"], string> = {
  campionato: "Campionato",
  promozione: "Promozione",
  coppa: "Coppa",
  playoff: "Playoff",
  altro: "Risultato",
};

function SectionLabel({ children }: { children: string }) {
  return (
    <AppText style={styles.sectionLabel}>
      {children.toUpperCase()}
    </AppText>
  );
}

export function CoachInfoTab({
  completeProfile,
  isOwner,
  onEdit,
}: CoachInfoTabProps) {
  const coachProfile = completeProfile.coachProfile;
  const playerCareerEntries = completeProfile.coachPlayerCareerEntries ?? [];
  const playerBg = computePlayerBackground(playerCareerEntries);

  const regionLabels = (coachProfile?.preferred_regions ?? []).map((code) =>
    getOptionLabel(REGION_OPTIONS, code),
  );

  const achievements = coachProfile?.achievements ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. STATUS & DISPONIBILITÀ */}
      <View style={styles.section}>
        {(coachProfile?.current_club || completeProfile.profile.role) ? (
          <AppText style={styles.statusTitle}>
            {[coachProfile?.current_club, "Allenatore"].filter(Boolean).join(" • ")}
          </AppText>
        ) : null}
        {coachProfile?.contract_end ? (
          <AppText color="secondary" variant="bodySm" style={styles.statusSub}>
            Contratto fino a {coachProfile.contract_end}
          </AppText>
        ) : null}

        <View style={styles.divider} />

        {coachProfile?.open_to_new_role ? (
          <View style={styles.availItem}>
            <View style={styles.statusDot} />
            <AppText style={styles.availText}>Disponibile</AppText>
          </View>
        ) : (
          <View style={styles.availItem}>
            <View style={[styles.statusDot, styles.statusDotInactive]} />
            <AppText color="secondary" style={styles.availText}>Non disponibile</AppText>
          </View>
        )}

        {regionLabels.length > 0 ? (
          <View style={styles.availItem}>
            <Ionicons color={colors.textSecondary} name="location-outline" size={18} />
            <AppText variant="bodySm" style={styles.availText}>
              {regionLabels.slice(0, 2).join(", ")}
              {regionLabels.length > 2 ? (
                <AppText variant="bodySm" style={styles.moreText}>
                  {" "}+{regionLabels.length - 2}
                </AppText>
              ) : null}
            </AppText>
          </View>
        ) : null}

        {(coachProfile?.preferred_categories ?? []).length > 0 ? (
          <View style={styles.availItem}>
            <Ionicons color={colors.textSecondary} name="layers-outline" size={18} />
            <AppText variant="bodySm" style={styles.availText}>
              {coachProfile!.preferred_categories.join(" • ")}
            </AppText>
          </View>
        ) : null}

        {isOwner ? (
          <Pressable
            accessibilityLabel="Modifica disponibilità"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => onEdit("coachInfo")}
            style={styles.editButton}
          >
            <Ionicons color={colors.textSecondary} name="pencil" size={16} />
          </Pressable>
        ) : null}
      </View>

      {/* 2. IDENTITÀ TECNICA */}
      {(coachProfile?.preferred_formation ||
        (coachProfile?.licenses ?? []).length > 0 ||
        (coachProfile?.play_styles ?? []).length > 0) ? (
        <View style={styles.section}>
          <SectionLabel>Identità Tecnica</SectionLabel>
          <View style={styles.identityRow}>
            <View style={styles.formationCol}>
              {coachProfile?.preferred_formation ? (
                <AppText style={styles.formationBig}>
                  {coachProfile.preferred_formation}
                </AppText>
              ) : null}
              {(coachProfile?.secondary_formations ?? []).length > 0 ? (
                <AppText color="secondary" variant="bodySm" style={styles.formationAlt}>
                  {coachProfile!.secondary_formations.join(" • ")}
                </AppText>
              ) : null}
            </View>
            {(coachProfile?.licenses ?? []).length > 0 ? (
              <View style={styles.licensesCol}>
                {coachProfile!.licenses.map((lic) => (
                  <View key={lic} style={styles.licenseBadge}>
                    <AppText style={styles.licenseBadgeText}>{lic}</AppText>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
          {(coachProfile?.play_styles ?? []).length > 0 ? (
            <View style={styles.chipsWrap}>
              {coachProfile!.play_styles.map((style) => (
                <View key={style} style={styles.chip}>
                  <AppText variant="caption" style={styles.chipText}>{style}</AppText>
                </View>
              ))}
            </View>
          ) : null}
          {isOwner ? (
            <Pressable
              accessibilityLabel="Modifica identità tecnica"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onEdit("coachInfo")}
              style={styles.editButton}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* 3. RISULTATI ALLENATORE */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <SectionLabel>Risultati Allenatore</SectionLabel>
          {isOwner ? (
            <Pressable
              accessibilityLabel="Modifica risultati"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onEdit("coachAchievements")}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
          ) : null}
        </View>
        {achievements.length > 0 ? (
          <View style={styles.resultsList}>
            {achievements.map((a) => (
              <View key={a.id} style={styles.resultItem}>
                <Ionicons
                  color={colors.textPrimary}
                  name={ACHIEVEMENT_ICONS[a.achievement_type] as any}
                  size={20}
                />
                <View style={styles.resultContent}>
                  <AppText variant="bodySm" style={styles.resultTitle}>
                    {a.label || ACHIEVEMENT_LABELS[a.achievement_type]}
                  </AppText>
                  {a.description ? (
                    <AppText variant="caption" color="secondary">
                      {a.description}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <AppText color="secondary" variant="bodySm">
            {isOwner
              ? "Aggiungi i tuoi risultati da allenatore."
              : "Nessun risultato inserito."}
          </AppText>
        )}
      </View>

      {/* 4. BACKGROUND GIOCATORE */}
      {playerBg.careerYears > 0 ? (
        <View style={styles.section}>
          <SectionLabel>Background Giocatore</SectionLabel>
          <View style={styles.playerRoleRow}>
            {playerBg.primaryPosition ? (
              <AppText style={styles.playerRole}>{playerBg.primaryPosition}</AppText>
            ) : null}
            <AppText color="secondary" variant="bodySm">
              {" "}• {playerBg.careerYears} {playerBg.careerYears === 1 ? "anno" : "anni"} carriera
            </AppText>
          </View>
          {playerBg.topCategory ? (
            <AppText variant="bodySm" style={styles.playerLevel}>
              Top: <AppText variant="bodySm" style={styles.playerLevelStrong}>{playerBg.topCategory}</AppText>
            </AppText>
          ) : null}
          <View style={styles.playerStats}>
            {playerBg.totalAppearances > 0 ? (
              <AppText variant="bodySm" color="secondary">
                <AppText variant="bodySm" style={styles.statNumber}>{playerBg.totalAppearances}</AppText> presenze
              </AppText>
            ) : null}
            {playerBg.totalGoals > 0 ? (
              <AppText variant="bodySm" color="secondary">
                <AppText variant="bodySm" style={styles.statNumber}>{playerBg.totalGoals}</AppText> gol
              </AppText>
            ) : null}
            {playerBg.totalAssists > 0 ? (
              <AppText variant="bodySm" color="secondary">
                <AppText variant="bodySm" style={styles.statNumber}>{playerBg.totalAssists}</AppText> assist
              </AppText>
            ) : null}
          </View>
        </View>
      ) : null}

      {/* 5. CONTATTI */}
      <View style={styles.section}>
        <SectionLabel>Contatti</SectionLabel>
        <View style={styles.contactsWrapper}>
          <ContactSection contacts={completeProfile.userContacts} variant="flat" />
          {isOwner ? (
            <Pressable
              accessibilityLabel="Modifica contatti"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => onEdit("contact")}
              style={styles.editButton}
            >
              <Ionicons color={colors.textSecondary} name="pencil" size={16} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[36],
    paddingBottom: spacing[48],
    paddingHorizontal: spacing[20],
    paddingTop: spacing[24],
  },
  section: {
    position: "relative",
  },
  sectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginBottom: spacing[16],
    textTransform: "uppercase",
  },
  sectionHeaderRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing[16],
  },
  // Section 1
  statusTitle: {
    color: colors.textPrimary,
    fontSize: 20,
    fontWeight: "700",
  },
  statusSub: {
    marginTop: spacing[4],
  },
  divider: {
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: spacing[16],
  },
  availItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    marginBottom: spacing[10],
  },
  availText: {
    color: colors.textPrimary,
    flex: 1,
    fontWeight: "500",
  },
  statusDot: {
    backgroundColor: colors.success,
    borderRadius: radius[16],
    height: 8,
    width: 8,
  },
  statusDotInactive: {
    backgroundColor: colors.textSecondary,
  },
  moreText: {
    color: colors.accent,
    fontWeight: "600",
  },
  editButton: {
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[16],
    bottom: 0,
    height: 36,
    justifyContent: "center",
    position: "absolute",
    right: 0,
    width: 36,
  },
  // Section 2
  identityRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  formationCol: {
    flex: 1,
  },
  formationBig: {
    color: colors.textPrimary,
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
    lineHeight: 40,
  },
  formationAlt: {
    marginTop: spacing[8],
  },
  licensesCol: {
    alignItems: "flex-end",
    gap: spacing[8],
  },
  licenseBadge: {
    backgroundColor: colors.textPrimary,
    borderRadius: radius[4],
    paddingHorizontal: spacing[10],
    paddingVertical: spacing[4],
  },
  licenseBadgeText: {
    color: colors.inkInvert,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[8],
    marginTop: spacing[16],
  },
  chip: {
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[6],
  },
  chipText: {
    color: colors.textPrimary,
    fontWeight: "500",
  },
  // Section 3
  resultsList: {
    gap: spacing[16],
  },
  resultItem: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing[14],
  },
  resultContent: {
    flex: 1,
    gap: spacing[4],
  },
  resultTitle: {
    fontWeight: "600",
  },
  // Section 4
  playerRoleRow: {
    alignItems: "baseline",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  playerRole: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: "600",
  },
  playerLevel: {
    color: colors.textSecondary,
    marginTop: spacing[4],
  },
  playerLevelStrong: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  playerStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing[16],
    marginTop: spacing[16],
  },
  statNumber: {
    color: colors.textPrimary,
    fontWeight: "700",
  },
  // Section 5
  contactsWrapper: {
    position: "relative",
  },
});
