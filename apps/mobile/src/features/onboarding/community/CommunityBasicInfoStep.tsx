import { StyleSheet, View } from "react-native";

import { DatePickerField } from "../../../components/ui/date-picker-field";
import { spacing } from "../../../theme/tokens";
import { AppText, Input } from "../../../ui";
import { OnboardingSectionCard } from "../onboarding-ui";

type CommunityBasicInfoStepProps = {
  birthDate: string;
  firstName: string;
  lastName: string;
  subtitle: string;
  title: string;
  validationErrors: Partial<Record<string, string>>;
  onFormattedNameBlur: (field: "firstName" | "lastName") => void;
  onUpdate: (
    patch: Partial<{
      birthDate: string;
      firstName: string;
      lastName: string;
    }>,
    fieldsToClear?: string[],
  ) => void;
};

export function CommunityBasicInfoStep({
  birthDate,
  firstName,
  lastName,
  subtitle,
  title,
  validationErrors,
  onFormattedNameBlur,
  onUpdate,
}: CommunityBasicInfoStepProps) {
  return (
    <OnboardingSectionCard title={title} subtitle={subtitle}>
      <View style={styles.fieldGroup}>
        <Input
          autoCapitalize="words"
          autoCorrect={false}
          label="Nome"
          onBlur={() => onFormattedNameBlur("firstName")}
          onChangeText={(value) => onUpdate({ firstName: value }, ["firstName"])}
          placeholder="Es. Mario"
          value={firstName}
        />
        {validationErrors.firstName ? (
          <AppText variant="caption" color="danger">
            {validationErrors.firstName}
          </AppText>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <Input
          autoCapitalize="words"
          autoCorrect={false}
          label="Cognome"
          onBlur={() => onFormattedNameBlur("lastName")}
          onChangeText={(value) => onUpdate({ lastName: value }, ["lastName"])}
          placeholder="Es. Rossi"
          value={lastName}
        />
        {validationErrors.lastName ? (
          <AppText variant="caption" color="danger">
            {validationErrors.lastName}
          </AppText>
        ) : null}
      </View>

      <View style={styles.fieldGroup}>
        <DatePickerField
          label="Data di nascita"
          onChange={(value) => onUpdate({ birthDate: value }, ["birthDate"])}
          value={birthDate}
        />
        {validationErrors.birthDate ? (
          <AppText variant="caption" color="danger">
            {validationErrors.birthDate}
          </AppText>
        ) : null}
      </View>
    </OnboardingSectionCard>
  );
}

const styles = StyleSheet.create({
  fieldGroup: {
    gap: spacing[8],
  },
});
