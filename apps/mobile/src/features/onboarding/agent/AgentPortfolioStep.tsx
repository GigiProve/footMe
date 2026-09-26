import { StyleSheet, View } from "react-native";

import type {
  AgentManagedPlayerEntryDraft,
  AgentPlayerCandidate,
} from "../../profiles/agent-profile";
import { AppText } from "../../../ui";
import {
  InlineError,
  OnboardingPage,
  OnboardingSection,
  SelectionRow,
} from "../ui";
import { onboardingLayout, onboardingSpacing } from "../ui/onboarding-tokens";
import { AgentPortfolioLinkField } from "./AgentPortfolioLinkField";
import {
  AGENT_PORTFOLIO_RANGE_OPTIONS,
  type AgentPortfolioRange,
} from "./agent-taxonomy";

type AgentPortfolioStepProps = {
  currentStep: number;
  isBusy: boolean;
  managedPlayerEntries: AgentManagedPlayerEntryDraft[];
  onBack: () => void;
  onContinue: () => void;
  onManagedPlayerEntriesChange: (
    entries: AgentManagedPlayerEntryDraft[],
  ) => void;
  onPlayerLinked?: (count: number) => void;
  onRangeChange: (range: Exclude<AgentPortfolioRange, "">) => void;
  range: AgentPortfolioRange;
  searchPlayers: (query: string) => Promise<AgentPlayerCandidate[]>;
  stepLabel: string;
  totalSteps: number;
  validationErrors: Partial<Record<string, string>>;
};

/**
 * "Il tuo portfolio" (REV-ONB-06 §R–§W).
 *
 * La dimensione del portfolio e i calciatori effettivamente collegati sono
 * due cose distinte (§U): si può dichiarare "6–15" e completare la
 * registrazione senza collegare nessuno. Ricostruire il portfolio a mano non
 * è un requisito per entrare sulla piattaforma (§V).
 */
export function AgentPortfolioStep({
  currentStep,
  isBusy,
  managedPlayerEntries,
  onBack,
  onContinue,
  onManagedPlayerEntriesChange,
  onPlayerLinked,
  onRangeChange,
  range,
  searchPlayers,
  stepLabel,
  totalSteps,
  validationErrors,
}: AgentPortfolioStepProps) {
  return (
    <OnboardingPage
      currentStep={currentStep}
      footer={{
        onPrimaryPress: onContinue,
        primaryLabel: "Continua",
        primaryLoading: isBusy,
        primaryTestID: "agent-portfolio-continue",
      }}
      onBack={onBack}
      stepLabel={stepLabel}
      subtitle="Indica la dimensione del tuo portfolio e, se vuoi, collega i calciatori già presenti su ProLink."
      testID="agent-portfolio-step"
      title="Il tuo portfolio"
      totalSteps={totalSteps}
    >
      <OnboardingSection title="Quanti calciatori rappresenti attualmente?">
        <View accessibilityRole="radiogroup" style={styles.options}>
          {AGENT_PORTFOLIO_RANGE_OPTIONS.map((option) => (
            <SelectionRow
              control="radio"
              key={option.value}
              label={option.label}
              onPress={() => onRangeChange(option.value)}
              selected={range === option.value}
              testID={`agent-portfolio-range-${option.value}`}
            />
          ))}
        </View>

        <InlineError message={validationErrors.agentPortfolioRange} />
      </OnboardingSection>

      <OnboardingSection title="Calciatori su ProLink">
        {/* §U: il collegamento è facoltativo e lo si dice prima di chiederlo. */}
        <AppText color="secondary" style={styles.hint} variant="meta">
          Puoi collegarli ora o più avanti dal tuo profilo.
        </AppText>

        <AgentPortfolioLinkField
          entries={managedPlayerEntries}
          onChange={onManagedPlayerEntriesChange}
          onLinked={onPlayerLinked}
          searchPlayers={searchPlayers}
        />
      </OnboardingSection>
    </OnboardingPage>
  );
}

const styles = StyleSheet.create({
  hint: {
    marginBottom: onboardingSpacing.xs,
  },
  options: {
    gap: onboardingLayout.labelGap + 2,
  },
});
