import { Image, Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import type { AgentCareerEntryDraft } from "../../profiles/agent-profile";
import { AgentCareerEntriesEditor } from "../../profiles/agent/AgentCareerEntriesEditor";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button, Input } from "../../../ui";
import { OnboardingEyebrow, OnboardingInfoCard, OnboardingSectionCard } from "../onboarding-ui";

type AgentAgencyStepProps = {
  agencyRole: string;
  agencyStartYear: string;
  careerEntries: AgentCareerEntryDraft[];
  agencyLogoUrl: string;
  agencyName: string;
  errorMessage?: Partial<Record<string, string>>;
  isUploading: boolean;
  onCareerEntriesChange: (entries: AgentCareerEntryDraft[]) => void;
  onContinue: () => void;
  onPickLogo: () => void;
  onUpdate: (patch: {
    agentAgencyName?: string;
    agentAgencyLogoUrl?: string;
    agentAgencyRole?: string;
    agentAgencyStartYear?: string;
  }) => void;
};

export function AgentAgencyStep({
  agencyRole,
  agencyStartYear,
  careerEntries,
  agencyLogoUrl,
  agencyName,
  errorMessage,
  isUploading,
  onCareerEntriesChange,
  onContinue,
  onPickLogo,
  onUpdate,
}: AgentAgencyStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <OnboardingEyebrow>Profilo procuratore</OnboardingEyebrow>
        <AppText variant="displaySm">Profilo professionale</AppText>
        <AppText variant="bodySm" color="secondary">
          Completa i dettagli della tua agenzia o del tuo studio per rendere il
          profilo riconoscibile e coerente con il mockup Banani.
        </AppText>
      </View>

      <OnboardingSectionCard>
        <Input
          error={Boolean(errorMessage?.agentAgencyName)}
          helperText={errorMessage?.agentAgencyName}
          label="Agenzia / Studio *"
          onChangeText={(value) => onUpdate({ agentAgencyName: value })}
          placeholder="Es. MB Football Management"
          value={agencyName}
        />

        <Input
          error={Boolean(errorMessage?.agentAgencyRole)}
          helperText={errorMessage?.agentAgencyRole}
          label="Ruolo attuale *"
          onChangeText={(value) => onUpdate({ agentAgencyRole: value })}
          placeholder="Es. Founder, agente, partner"
          value={agencyRole}
        />

        <Input
          keyboardType="number-pad"
          label="Anno di inizio"
          onChangeText={(value) =>
            onUpdate({ agentAgencyStartYear: value.replace(/[^\d]/g, "").slice(0, 4) })
          }
          placeholder="2021"
          value={agencyStartYear}
        />

        <Pressable onPress={onPickLogo} style={styles.uploadArea}>
          {agencyLogoUrl ? (
            <Image source={{ uri: agencyLogoUrl }} style={styles.logoPreview} />
          ) : (
            <>
              <Ionicons
                color={colors.textSecondary}
                name="cloud-upload-outline"
                size={28}
              />
              <AppText variant="titleSm">Carica logo agenzia</AppText>
              <AppText variant="bodySm" color="secondary" style={styles.center}>
                PNG o JPG. Puoi aggiungerlo ora o sostituirlo piu&apos; avanti.
              </AppText>
            </>
          )}
        </Pressable>

        {!agencyLogoUrl ? (
          <OnboardingInfoCard message="Il logo non e' obbligatorio, ma aiuta club e calciatori a riconoscere il tuo profilo." />
        ) : null}

        <View style={styles.previousSection}>
          <AppText variant="titleSm">Esperienze precedenti</AppText>
          <AgentCareerEntriesEditor
            addButtonLabel="Aggiungi esperienza precedente"
            entries={careerEntries}
            onChange={onCareerEntriesChange}
          />
        </View>
      </OnboardingSectionCard>

      <Button
        disabled={isUploading}
        fullWidth
        label={isUploading ? "Caricamento logo..." : "Continua"}
        onPress={onContinue}
        variant="primary"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    textAlign: "center",
  },
  container: {
    gap: spacing[16],
  },
  header: {
    gap: spacing[8],
  },
  logoPreview: {
    borderRadius: radius[12],
    height: 88,
    width: 88,
  },
  previousSection: {
    gap: spacing[10],
  },
  uploadArea: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radius[12],
    borderStyle: "dashed",
    borderWidth: 2,
    gap: spacing[8],
    justifyContent: "center",
    minHeight: 120,
    paddingHorizontal: spacing[16],
    paddingVertical: spacing[20],
  },
});
