/**
 * I blocchi professionali del dettaglio (§15, §17, §18 — screen 05-10).
 *
 * Un solo set di componenti per tutte e quattro le tipologie: §15 vieta di
 * «creare quattro schermate indipendenti per ruolo», e §17 chiede che
 * «Calciatore, Allenatore, Staff e Dirigente condividano il sistema
 * visuale». Ciò che cambia è il **contenuto** che `buildCandidateInsight`
 * produce, non la forma.
 *
 * Ogni blocco tace quando non ha niente da dire: §16 — «Se mancano solo
 * informazioni facoltative, ometti naturalmente la sottosezione o la singola
 * metrica. Non mostrare pile di card "Nessun dato".»
 */
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, sizes, spacing } from "../../../../theme/tokens";
import { AppText, Avatar } from "../../../../ui";
import { MISSING_STAT_LABEL } from "../../../profiles/career/player-career-model";
import { APPLICATIONS_COPY } from "../applications-presentation";
import type {
  CandidateExperience,
  CandidateStat,
} from "../candidate-insight";

/** Eyebrow + corpo: il modulo che si ripete per tutta la pagina. */
export function CandidateSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <View style={styles.section}>
      <AppText style={styles.eyebrow} variant="eyebrow">
        {title}
      </AppText>
      {children}
    </View>
  );
}

export function CandidateFactLines({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) {
    return null;
  }

  return (
    <View style={styles.lines}>
      {lines.map((line, index) => (
        <AppText
          color={index === 0 ? "neutral" : "neutralMuted"}
          key={line}
          variant={index === 0 ? "bodyLg" : "bodySm"}
        >
          {line}
        </AppText>
      ))}
    </View>
  );
}

/**
 * I tre totali del Calciatore (§18, screen 05-07).
 *
 * «Totali disponibili» e non «Totali»: §18 — «La disponibilità parziale va
 * descritta senza promettere completezza.» E il trattino di
 * `MISSING_STAT_LABEL` al posto di uno zero: «Zero è mostrabile solo come
 * valore effettivo. Una metrica assente o privata non diventa zero.»
 *
 * Il trattino non è letto come «meno» dal lettore di schermo: ogni cella
 * porta la propria etichetta estesa.
 */
export function CandidateStats({ stats }: { stats: readonly CandidateStat[] }) {
  const usable = stats.filter((stat) => stat.value !== null);

  if (usable.length === 0) {
    return null;
  }

  return (
    <View style={styles.statsBox}>
      <AppText color="neutralMuted" style={styles.statsTitle} variant="meta">
        {APPLICATIONS_COPY.availableTotals}
      </AppText>

      <View style={styles.statsRow}>
        {stats.map((stat) => (
          <View
            accessible
            accessibilityLabel={
              stat.value === null
                ? `${stat.label}: dato non disponibile`
                : `${stat.label}: ${stat.value}`
            }
            key={stat.key}
            style={styles.stat}
          >
            <AppText color="neutral" variant="statValue">
              {stat.value === null ? MISSING_STAT_LABEL : String(stat.value)}
            </AppText>
            <AppText color="neutralMuted" variant="meta">
              {stat.label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Una esperienza recente (§18).
 *
 * «Le righe con chevron possono aprire la carriera canonica con
 * l'esperienza evidenziata, se il routing supporta l'anchor; altrimenti
 * aprono direttamente la tab Carriera. Non creare un nuovo dettaglio
 * esperienza specifico delle candidature.» Il tap porta quindi fuori, al
 * dominio della carriera, e non apre niente di locale.
 */
export function CandidateExperienceRow({
  experience,
  onPress,
  showDivider,
}: {
  experience: CandidateExperience;
  onPress: () => void;
  showDivider: boolean;
}) {
  return (
    <Pressable
      accessibilityHint="Apre la carriera completa"
      accessibilityLabel={`${experience.clubName}. ${experience.line}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.experience,
        showDivider ? styles.divided : null,
        pressed ? styles.pressed : null,
      ]}
      testID={`application-experience-${experience.id}`}
    >
      <Avatar
        name={experience.clubName}
        size="sm"
        uri={experience.logoUrl || undefined}
      />

      <View style={styles.experienceBody}>
        <AppText color="neutral" numberOfLines={1} variant="titleSm">
          {experience.clubName}
        </AppText>
        <AppText color="neutralMuted" numberOfLines={1} variant="bodySm">
          {experience.line}
        </AppText>
      </View>

      <Ionicons color={colors.textNeutralSoft} name="chevron-forward" size={16} />
    </Pressable>
  );
}

/** §15: i due link hanno destinazioni diverse e restano due righe distinte. */
export function CandidateLink({
  label,
  onPress,
  testID,
}: {
  label: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={onPress}
      style={({ pressed }) => [styles.link, pressed ? styles.pressed : null]}
      testID={testID}
    >
      <AppText color="accent" variant="actionLabel">
        {label}
      </AppText>
      <Ionicons color={colors.accent} name="chevron-forward" size={14} />
    </Pressable>
  );
}

/**
 * §27: «Errore di un singolo blocco della carriera: mostra il resto
 * autorizzato, un errore locale discreto e un retry mirato. Non sostituire
 * il blocco con zero o "nessuna esperienza".»
 */
export function CandidateBlockError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={styles.blockError}>
      <AppText color="neutralMuted" variant="bodySm">
        Non è stato possibile caricare questi dati.
      </AppText>
      <Pressable
        accessibilityRole="button"
        hitSlop={8}
        onPress={onRetry}
        testID="application-block-retry"
      >
        <AppText color="accent" variant="actionLabel">
          {APPLICATIONS_COPY.retry}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing[8],
    paddingVertical: spacing[16],
  },
  eyebrow: {
    color: colors.textNeutralMuted,
  },
  lines: {
    gap: spacing[4],
  },
  statsBox: {
    borderColor: colors.borderNeutral,
    borderRadius: radius[16],
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing[8],
    marginTop: spacing[4],
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  statsTitle: {
    textAlign: "left",
  },
  statsRow: {
    flexDirection: "row",
  },
  stat: {
    alignItems: "center",
    flex: 1,
    gap: spacing[4],
  },
  experience: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[12],
    minHeight: sizes.touchTarget,
    paddingVertical: spacing[8],
  },
  experienceBody: {
    flex: 1,
    gap: spacing[4],
  },
  divided: {
    borderTopColor: colors.dividerNeutral,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  link: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing[4],
    minHeight: sizes.touchTarget,
  },
  blockError: {
    alignItems: "flex-start",
    gap: spacing[8],
    paddingVertical: spacing[8],
  },
  pressed: {
    opacity: 0.6,
  },
});
