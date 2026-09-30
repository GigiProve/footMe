/**
 * Tab Dettagli del Master Profile Allenatore (REV-PROF-03).
 *
 * Sei macroaree, nell'ordine fissato dalla task: Opportunità, Profilo tecnico,
 * Situazione attuale, Filosofia di gioco, Palmarès e Contatti pubblici.
 *
 * Valgono le stesse regole del Master Profile Calciatore: una macroarea senza
 * dati non viene mostrata a nessuno dei due viewer, e niente viene duplicato —
 * patentino, disponibilità e situazione professionale compaiono una volta sola,
 * qui o nell'header, mai in tutti e due.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, spacing } from "../../../theme/tokens";
import { AppText } from "../../../ui";
import { ProfileCurrentClubRow } from "../master/ProfileCurrentClubRow";
import {
  buildPublicContacts,
  hasPrivateContacts,
  PublicContactsList,
  type PublicContact,
} from "../master/PublicContactsList";
import {
  ProfileDetailRow,
  ProfileFactRow,
  ProfileSectionBlock,
} from "../master/ProfileSectionBlock";
import {
  buildAvailabilityZonesLabel,
  formatCoachAvailableFrom,
  summarizeList,
} from "../profile-display-helpers";
import type {
  CoachAchievementRecord,
  CompleteProfessionalProfile,
} from "../profile-service";
import { getCoachAwardIcon, sortCoachAwards } from "../coach-edit/coach-awards";
import type { CoachCareerView } from "./coach-career-model";
import { getCurrentCoachExperience } from "./coach-career-model";

const PHILOSOPHY_COLLAPSED_LINES = 3;

type CoachDetailsTabProps = {
  careerView: CoachCareerView;
  completeProfile: CompleteProfessionalProfile;
  isOwner?: boolean;
  onContactPress?: (contact: PublicContact) => void;
  /** Assente quando la società non ha una pagina PROLINK: niente chevron. */
  onOpenClub?: (clubId: string) => void;
};

export function CoachDetailsTab({
  careerView,
  completeProfile,
  isOwner = false,
  onContactPress,
  onOpenClub,
}: CoachDetailsTabProps) {
  const { coachProfile, profile, userContacts } = completeProfile;

  // ---- Opportunità -------------------------------------------------------
  const isOpenToNewRole = Boolean(coachProfile?.open_to_new_role);
  const zonesLabel = isOpenToNewRole
    ? buildAvailabilityZonesLabel(
        coachProfile?.availability_type ?? "",
        coachProfile?.preferred_regions ?? [],
        coachProfile?.preferred_provinces ?? [],
      )
    : null;
  const availableFromLabel = formatCoachAvailableFrom(
    coachProfile?.available_from,
    isOpenToNewRole,
  );
  const hasOpportunities =
    isOpenToNewRole || Boolean(zonesLabel) || Boolean(availableFromLabel);

  // ---- Profilo tecnico ---------------------------------------------------
  const technicalFacts = [
    { key: "license", label: "Patentino", value: summarizeList(coachProfile?.licenses ?? []) },
    {
      key: "categories",
      label: "Categorie allenate",
      value: summarizeList(coachProfile?.coached_categories ?? []),
    },
    {
      key: "formation",
      label: "Modulo preferito",
      value: coachProfile?.preferred_formation?.trim() || null,
    },
    {
      key: "style",
      label: "Stile di gioco",
      value: summarizeList(coachProfile?.play_styles ?? []),
    },
    { key: "languages", label: "Lingue", value: summarizeList(profile.languages ?? []) },
  ].filter((fact): fact is { key: string; label: string; value: string } =>
    Boolean(fact.value),
  );

  // ---- Situazione attuale ------------------------------------------------
  // Deriva dall'incarico in corso, mai da un secondo set di campi: se non c'è
  // un incarico attuale la sezione tace invece di mostrare una card vuota.
  const currentExperience = getCurrentCoachExperience(careerView);
  const currentClubId = currentExperience?.clubId ?? null;
  const canOpenClub = Boolean(currentClubId && onOpenClub);

  // ---- Filosofia di gioco ------------------------------------------------
  const philosophy = coachProfile?.game_philosophy?.trim() || "";

  // ---- Palmarès ----------------------------------------------------------
  // Stesso ordine dell editor: stagione più recente in cima. L API restituisce
  // per `sort_order`, che dopo modifiche ed eliminazioni non dice più molto.
  const achievements = sortCoachAwards(coachProfile?.achievements ?? []);

  // ---- Contatti pubblici -------------------------------------------------
  const publicContacts = buildPublicContacts(userContacts);
  /*
    Al Visitor non arriva niente di un contatto non pubblico. All'Owner, che i
    propri contatti li ha inseriti, va detto perché non compaiono: nessun
    valore viene renderizzato, solo il fatto che esistono.
  */
  const showsPrivateContactsHint = isOwner && hasPrivateContacts(userContacts);

  return (
    <View testID="coach-details-tab">
      {hasOpportunities ? (
        <ProfileSectionBlock testID="coach-details-opportunities" title="Opportunità">
          {/* Lo stato non è affidato al colore: icona più testo (§accessibilità). */}
          {isOpenToNewRole ? (
            <ProfileDetailRow
              icon="radio-button-on-outline"
              label="Disponibile per una nuova squadra"
            />
          ) : null}
          {zonesLabel ? (
            <ProfileDetailRow
              icon="map-outline"
              label="Zone disponibili"
              value={zonesLabel}
            />
          ) : null}
          {availableFromLabel ? (
            <ProfileDetailRow
              icon="calendar-outline"
              label="Disponibile da"
              value={availableFromLabel}
            />
          ) : null}
        </ProfileSectionBlock>
      ) : null}

      {technicalFacts.length > 0 ? (
        <ProfileSectionBlock testID="coach-details-technical" title="Profilo tecnico">
          {technicalFacts.map((fact, index) => (
            <ProfileFactRow
              isLast={index === technicalFacts.length - 1}
              key={fact.key}
              label={fact.label}
              value={fact.value}
            />
          ))}
        </ProfileSectionBlock>
      ) : null}

      {currentExperience ? (
        <ProfileSectionBlock testID="coach-details-situation" title="Situazione attuale">
          <ProfileCurrentClubRow
            category={currentExperience.category}
            clubName={currentExperience.clubName}
            logoUrl={currentExperience.logoUrl}
            onPress={
              canOpenClub
                ? () => onOpenClub?.(currentClubId as string)
                : undefined
            }
            role={currentExperience.role}
          />
        </ProfileSectionBlock>
      ) : null}

      {philosophy ? (
        <ProfileSectionBlock testID="coach-details-philosophy" title="Filosofia di gioco">
          <ExpandableText text={philosophy} />
        </ProfileSectionBlock>
      ) : null}

      {/*
        Il Palmarès resta visibile anche vuoto, nella forma compatta del
        mockup: "Nessuna voce" è una riga, non una card grande.
      */}
      <ProfileSectionBlock testID="coach-details-palmares" title="Palmarès">
        {achievements.length > 0 ? (
          achievements.map((achievement) => (
            <AchievementRow achievement={achievement} key={achievement.id} />
          ))
        ) : (
          <View style={styles.palmaresRow}>
            <Ionicons color={colors.textMuted} name="trophy-outline" size={16} />
            <AppText color="muted" style={styles.palmaresText} variant="bodySm">
              Nessuna voce
            </AppText>
          </View>
        )}
      </ProfileSectionBlock>

      {publicContacts.length > 0 || showsPrivateContactsHint ? (
        <ProfileSectionBlock testID="coach-details-contacts" title="Contatti pubblici">
          <PublicContactsList
            contacts={publicContacts}
            onContactPress={onContactPress}
          />
          {showsPrivateContactsHint ? (
            <AppText color="secondary" variant="bodySm">
              I tuoi contatti sono privati. Rendili visibili da Modifica
              profilo.
            </AppText>
          ) : null}
        </ProfileSectionBlock>
      ) : null}
    </View>
  );
}

/**
 * Testo lungo con "Mostra altro" / "Mostra meno" (REV-PROF-03, "Filosofia di
 * gioco"). I ritorni a capo restano quelli scritti dall'Allenatore: il testo
 * non viene normalizzato né spezzato a metà parola.
 */
function ExpandableText({ text }: { text: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  // `onTextLayout` non è affidabile su tutte le piattaforme: la soglia è una
  // stima sul contenuto, e il pulsante appare solo quando serve davvero.
  const isLong = text.length > 160 || text.split("\n").length > PHILOSOPHY_COLLAPSED_LINES;

  return (
    <View style={styles.philosophy}>
      <AppText
        numberOfLines={isExpanded ? undefined : PHILOSOPHY_COLLAPSED_LINES}
        variant="bodyLg"
      >
        {text}
      </AppText>
      {isLong ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isExpanded }}
          hitSlop={8}
          onPress={() => setIsExpanded((previous) => !previous)}
          style={styles.philosophyToggle}
          testID="coach-philosophy-toggle"
        >
          <AppText color="accent" variant="metaStrong">
            {isExpanded ? "Mostra meno" : "Mostra altro"}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

function AchievementRow({
  achievement,
}: {
  achievement: CoachAchievementRecord;
}) {
  /*
    Dopo REV-PROF-05 il riconoscimento porta la società come campo: è quella
    la seconda riga. `description` resta il fallback delle voci salvate prima,
    che una società non ce l avevano.
  */
  const description =
    achievement.club_name?.trim() || achievement.description?.trim() || "";

  return (
    <View
      accessible
      accessibilityLabel={[achievement.label, description].filter(Boolean).join(", ")}
      style={styles.palmaresRow}
    >
      <Ionicons
        color={colors.accent}
        name={getCoachAwardIcon(achievement.achievement_type)}
        size={16}
      />
      <View style={styles.palmaresText}>
        <AppText variant="bodyLg">{achievement.label}</AppText>
        {description ? (
          <AppText color="secondary" variant="meta">
            {description}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  palmaresRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[10],
    minHeight: 32,
    paddingVertical: spacing[4],
  },
  palmaresText: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  philosophy: {
    gap: spacing[6],
  },
  philosophyToggle: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
