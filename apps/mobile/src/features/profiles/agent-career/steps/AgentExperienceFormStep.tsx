/**
 * Schermate 4, 5 e 7 — Esperienza in agenzia, Attività indipendente e Modifica
 * esperienza (REV-PROF-15).
 *
 * Una schermata sola per tre usi, perché sono lo stesso record. Cambia la
 * testa — la card dell'organizzazione oppure l'avviso dell'attività
 * indipendente — e cambia l'etichetta del toggle "in corso"; i campi, il loro
 * ordine e le regole sono identici. Duplicarla avrebbe prodotto tre copie che
 * divergono alla prima modifica, ed è esattamente il modo in cui nascono due
 * validazioni diverse per lo stesso dato.
 *
 * Ordine dei campi fissato dalla task: Ruolo, Da, A, in corso, esperienza
 * principale, descrizione facoltativa.
 */
import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { colors, radius, spacing } from "../../../../theme/tokens";
import { AppText } from "../../../../ui";
import {
  InfoMessage,
  OnboardingSection,
  OnboardingSelectField,
  OnboardingTextField,
  PeriodField,
  ToggleRow,
} from "../../../onboarding/ui";
import {
  AGENT_DESCRIPTION_MAX_LENGTH,
  AGENT_INDEPENDENT_LABEL,
  agentPeriodFromDateValue,
  agentPeriodToDateValue,
  type AgentAssignmentErrors,
  type AgentCareerAssignment,
} from "../agent-assignment-model";

type AgentExperienceFormStepProps = {
  assignment: AgentCareerAssignment;
  errors: AgentAssignmentErrors;
  onChange: (patch: Partial<AgentCareerAssignment>) => void;
  /** Apre il selettore organizzazione dalla modifica (§Screen 7). */
  onChangeOrganization?: () => void;
  roleOptions: { label: string; value: string }[];
};

export function AgentExperienceFormStep({
  assignment,
  errors,
  onChange,
  onChangeOrganization,
  roleOptions,
}: AgentExperienceFormStepProps) {
  const isIndependent = assignment.organizationMode === "independent";
  const startValue = agentPeriodToDateValue(
    assignment.startMonth,
    assignment.startYear,
  );
  const endValue = agentPeriodToDateValue(assignment.endMonth, assignment.endYear);

  return (
    <View style={styles.container}>
      {isIndependent ? (
        <InfoMessage message={`Nel profilo verrà mostrato "${AGENT_INDEPENDENT_LABEL}". Non sarà creata un'agenzia.`} />
      ) : (
        <OrganizationCard
          city={assignment.organizationCity}
          logoUrl={assignment.organizationLogoUrl}
          name={assignment.organizationName}
          onChange={onChangeOrganization}
        />
      )}

      {errors.organization ? (
        <AppText
          accessibilityLiveRegion="polite"
          color="danger"
          variant="bodySm"
        >
          {errors.organization}
        </AppText>
      ) : null}

      <OnboardingSection>
        <OnboardingSelectField
          errorMessage={errors.role}
          label="Ruolo"
          onChange={(value) => onChange({ role: value })}
          options={roleOptions}
          placeholder="Seleziona ruolo"
          sheetTitle="Ruolo"
          testID="agent-experience-role"
          value={assignment.role}
        />

        <PeriodField
          currentLabel={isIndependent ? "Attività in corso" : "Incarico in corso"}
          endErrorMessage={errors.endDate}
          endLabel="A"
          endPlaceholder="Mese e anno di fine"
          endTestID="agent-experience-end"
          endValue={endValue}
          isCurrent={assignment.isCurrent}
          mode="monthYear"
          onCurrentChange={(value) =>
            onChange({
              // Un incarico in corso non porta una data di fine: viene tolta,
              // non lasciata a schermo disattivata e ambigua. E se si conclude,
              // smette di poter essere l'esperienza principale.
              endMonth: value ? "" : assignment.endMonth,
              endYear: value ? "" : assignment.endYear,
              isCurrent: value,
              isPrimary: value ? assignment.isPrimary : false,
            })
          }
          onEndChange={(value) => {
            const { month, year } = agentPeriodFromDateValue(value);

            onChange({ endMonth: month, endPrecision: "month", endYear: year });
          }}
          onStartChange={(value) => {
            const { month, year } = agentPeriodFromDateValue(value);

            onChange({
              startMonth: month,
              // §"Date e precisione temporale": riscrivere il periodo di un
              // dato legacy lo porta alla precisione al mese. Il mese non viene
              // dedotto, viene chiesto.
              startPrecision: "month",
              startYear: year,
            });
          }}
          startErrorMessage={errors.startDate}
          startLabel="Da"
          startPlaceholder="Mese e anno di inizio"
          startTestID="agent-experience-start"
          startValue={startValue}
        />

        <ToggleRow
          description="L'esperienza principale viene mostrata nell'header del profilo."
          // Un'esperienza conclusa non può essere la situazione attuale: il
          // toggle resta visibile ma spento, così la regola si vede invece di
          // essere indovinata da un campo che sparisce.
          disabled={!assignment.isCurrent}
          label="Esperienza principale"
          onValueChange={(value) => onChange({ isPrimary: value })}
          testID="agent-experience-primary"
          value={assignment.isPrimary}
        />

        <OnboardingTextField
          label="Descrizione del ruolo"
          maxLength={AGENT_DESCRIPTION_MAX_LENGTH}
          multiline
          numberOfLines={3}
          onChangeText={(value) => onChange({ description: value })}
          optional
          placeholder="Attività svolte, deleghe, ambito di lavoro."
          testID="agent-experience-description"
          value={assignment.description}
        />
      </OnboardingSection>
    </View>
  );
}

/**
 * Card dell'organizzazione selezionata (§Screen 4): logo, nome, località.
 * In modifica porta anche l'azione per cambiarla — che sposta soltanto questo
 * incarico, non gli altri svolti nella stessa agenzia.
 */
function OrganizationCard({
  city,
  logoUrl,
  name,
  onChange,
}: {
  city: string;
  logoUrl: string;
  name: string;
  onChange?: () => void;
}) {
  return (
    <View style={styles.organization} testID="agent-experience-organization">
      <View style={styles.logo}>
        {logoUrl ? (
          <Image
            accessibilityElementsHidden
            importantForAccessibility="no"
            source={{ uri: logoUrl }}
            style={styles.logoImage}
          />
        ) : (
          <View style={styles.logoFallback}>
            <Ionicons color={colors.accent} name="business-outline" size={18} />
          </View>
        )}
      </View>

      <View style={styles.organizationBody}>
        <AppText numberOfLines={2} variant="titleSm">
          {name || "Organizzazione da selezionare"}
        </AppText>
        {city ? (
          <AppText color="secondary" numberOfLines={1} variant="meta">
            {city}
          </AppText>
        ) : null}
      </View>

      {onChange ? (
        <Pressable
          accessibilityHint="Apre la ricerca delle organizzazioni"
          accessibilityLabel="Cambia organizzazione"
          accessibilityRole="button"
          onPress={onChange}
          style={({ pressed }) => [
            styles.changeAction,
            pressed ? styles.changeActionPressed : null,
          ]}
          testID="agent-experience-change-organization"
        >
          <AppText color="accent" variant="metaStrong">
            Cambia
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[16],
  },
  organization: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[16],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[12],
    minHeight: 64,
    paddingHorizontal: spacing[12],
    paddingVertical: spacing[12],
  },
  organizationBody: {
    flex: 1,
    gap: spacing[4],
    minWidth: 0,
  },
  changeAction: {
    alignItems: "center",
    borderRadius: radius.full,
    flexShrink: 0,
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: spacing[8],
  },
  changeActionPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  logo: {
    borderRadius: radius.full,
    flexShrink: 0,
    height: 40,
    overflow: "hidden",
    width: 40,
  },
  logoFallback: {
    alignItems: "center",
    backgroundColor: colors.accentSoft,
    height: "100%",
    justifyContent: "center",
    width: "100%",
  },
  logoImage: {
    height: "100%",
    width: "100%",
  },
});
