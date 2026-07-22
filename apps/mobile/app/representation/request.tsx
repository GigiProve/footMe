import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../src/components/ui/screen";
import { KeyboardAwareForm } from "../../src/components/ui/keyboard-aware-form";
import {
  AppText,
  Avatar,
  Button,
  Divider,
  Input,
  SectionCard,
  ScreenHeader,
  useToast,
} from "../../src/ui";
import {
  getRelationshipTypeLabel,
  requestRepresentation,
  type RelationshipType,
  type RepresentationVisibility,
} from "../../src/features/relationships/agent-representation-service";
import {
  getPlayerPositionLabel,
  type PlayerPosition,
} from "../../src/features/profiles/player-sports";
import { colors, radius, shadows, spacing, typography } from "../../src/theme/tokens";

type ScreenParams = {
  playerId: string;
  name?: string;
  position?: string;
  team?: string;
  birthYear?: string;
  region?: string;
};

type RelationshipOption = {
  description: string;
  label: string;
  value: RelationshipType;
};

const RELATIONSHIP_OPTIONS: RelationshipOption[] = [
  {
    description: "Rappresentanza professionale principale.",
    label: "Procuratore",
    value: "procuratore",
  },
  {
    description: "Supporto nella ricerca e gestione di opportunità.",
    label: "Intermediario",
    value: "intermediario",
  },
  {
    description: "Contatto professionale di riferimento.",
    label: "Referente sportivo",
    value: "referente_sportivo",
  },
];

type VisibilityOption = {
  description: string;
  label: string;
  value: RepresentationVisibility;
};

const VISIBILITY_OPTIONS: VisibilityOption[] = [
  {
    description:
      "Il rapporto sarà visibile nel profilo pubblico del calciatore.",
    label: "Pubblico sul profilo",
    value: "public",
  },
  {
    description: "Il rapporto sarà visibile solo a te e al calciatore.",
    label: "Privato",
    value: "private",
  },
];

export default function RequestRepresentationScreen() {
  const router = useRouter();
  const { showToast } = useToast();
  const params = useLocalSearchParams<ScreenParams>();

  const playerId = params.playerId ?? "";
  const name = params.name ?? "";
  const position = (params.position as PlayerPosition | "") || "";
  const team = params.team ?? "";
  const birthYear = params.birthYear ?? "";
  const region = params.region ?? "";

  const [relationshipType, setRelationshipType] =
    useState<RelationshipType>("procuratore");
  const [visibility, setVisibility] =
    useState<RepresentationVisibility>("public");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const positionLabel = position
    ? getPlayerPositionLabel(position as PlayerPosition)
    : "";
  const subtitleLine = [positionLabel, team].filter(Boolean).join(" • ");
  const metaLine = [
    birthYear ? `Classe ${birthYear}` : null,
    region || null,
  ]
    .filter(Boolean)
    .join(" • ");

  async function handleSend() {
    if (!playerId) return;
    setLoading(true);
    try {
      await requestRepresentation(playerId, {
        message: message.trim() || undefined,
        relationshipType,
        visibility,
      });
      setConfirmed(true);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Errore nell'invio della richiesta.";
      showToast({ message: msg });
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    if (router.dismissAll) {
      router.dismissAll();
    } else {
      router.back();
    }
  }

  if (confirmed) {
    return (
      <Screen>
        <View style={styles.confirmContainer}>
          <View style={styles.confirmIconCircle}>
            <Ionicons
              color={colors.success}
              name="checkmark-circle"
              size={40}
            />
          </View>

          <View style={styles.confirmTextBlock}>
            <AppText variant="headingMd" align="center">
              Richiesta inviata
            </AppText>
            <AppText variant="bodySm" color="secondary" align="center">
              {"La richiesta è stata inviata a "}
              <AppText variant="bodySm" color="primary">
                {name || "calciatore"}
              </AppText>
              {
                ". Il collegamento sarà attivo solo dopo la sua conferma."
              }
            </AppText>
          </View>

          <View style={styles.summaryCard}>
            <AppText variant="caption" color="muted" style={styles.summaryTitle}>
              RIEPILOGO
            </AppText>
            <Divider />
            <View style={styles.summaryRow}>
              <AppText variant="bodySm" color="secondary">
                Calciatore
              </AppText>
              <AppText variant="bodySm">{name || "—"}</AppText>
            </View>
            <Divider />
            <View style={styles.summaryRow}>
              <AppText variant="bodySm" color="secondary">
                Tipo rapporto
              </AppText>
              <AppText variant="bodySm">
                {getRelationshipTypeLabel(relationshipType)}
              </AppText>
            </View>
            <Divider />
            <View style={styles.summaryRow}>
              <AppText variant="bodySm" color="secondary">
                Visibilità
              </AppText>
              <AppText variant="bodySm">
                {visibility === "public" ? "Pubblico sul profilo" : "Privato"}
              </AppText>
            </View>
            <Divider />
            <View style={styles.summaryRow}>
              <AppText variant="bodySm" color="secondary">
                Stato
              </AppText>
              <AppText variant="bodySm" color="warning">
                In attesa
              </AppText>
            </View>
          </View>

          <View style={styles.confirmActions}>
            <Button
              fullWidth
              label="Torna ad Assistiti"
              onPress={handleDismiss}
              variant="primary"
            />
            <Button
              fullWidth
              label="Vedi richieste inviate"
              onPress={() => router.back()}
              variant="ghost"
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <ScreenHeader
          title="Richiedi collegamento"
          action={
            <Pressable
              accessibilityLabel="Indietro"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.backButton,
                pressed ? styles.pressedOp : null,
              ]}
            >
              <Ionicons
                color={colors.textPrimary}
                name="arrow-back"
                size={20}
              />
            </Pressable>
          }
        />
      </View>

      <KeyboardAwareForm contentContainerStyle={styles.formContent}>
        <View style={styles.playerPreview}>
          <Avatar uri={undefined} name={name} size="lg" />
          <View style={styles.playerInfo}>
            <AppText variant="titleSm" numberOfLines={1}>
              {name || "Calciatore"}
            </AppText>
            {subtitleLine ? (
              <AppText variant="bodySm" color="accent" numberOfLines={1}>
                {subtitleLine}
              </AppText>
            ) : null}
            {metaLine ? (
              <AppText
                variant="bodySm"
                color="muted"
                numberOfLines={1}
                style={styles.metaText}
              >
                {metaLine}
              </AppText>
            ) : null}
          </View>
        </View>

        <SectionCard title="Tipo rapporto">
          {RELATIONSHIP_OPTIONS.map((opt) => (
            <SelectableOptionRow
              key={opt.value}
              checked={relationshipType === opt.value}
              description={opt.description}
              label={opt.label}
              onPress={() => setRelationshipType(opt.value)}
            />
          ))}
        </SectionCard>

        <SectionCard title="Visibilità proposta">
          {VISIBILITY_OPTIONS.map((opt) => (
            <SelectableOptionRow
              key={opt.value}
              checked={visibility === opt.value}
              description={opt.description}
              label={opt.label}
              onPress={() => setVisibility(opt.value)}
            />
          ))}
        </SectionCard>

        <SectionCard title="Messaggio opzionale">
          <Input
            multiline
            placeholder="Ciao, confermi il collegamento come tuo procuratore?"
            value={message}
            onChangeText={setMessage}
          />
        </SectionCard>

        <Button
          fullWidth
          label="Invia richiesta"
          loading={loading}
          onPress={handleSend}
          variant="primary"
        />
      </KeyboardAwareForm>
    </Screen>
  );
}

type SelectableOptionRowProps = {
  checked: boolean;
  description: string;
  label: string;
  onPress: () => void;
};

function SelectableOptionRow({
  checked,
  description,
  label,
  onPress,
}: SelectableOptionRowProps) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionRow,
        checked ? styles.optionRowSelected : null,
        pressed ? styles.pressedOp : null,
      ]}
    >
      <View style={styles.optionRadio}>
        <View
          style={[
            styles.radioCircle,
            checked ? styles.radioCircleChecked : null,
          ]}
        />
      </View>
      <View style={styles.optionText}>
        <AppText variant="titleSm">{label}</AppText>
        <AppText variant="bodySm" color="secondary">
          {description}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    marginBottom: spacing[16],
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  pressedOp: {
    opacity: 0.75,
  },
  formContent: {
    gap: spacing[16],
    paddingBottom: spacing[40],
  },
  playerPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing[14],
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[16],
    ...shadows.subtle,
  },
  playerInfo: {
    flex: 1,
    gap: spacing[4],
  },
  metaText: {
    fontSize: typography.fontSize[12],
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing[12],
    padding: spacing[12],
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionRowSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  optionRadio: {
    paddingTop: spacing[4],
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.inputBackground,
  },
  radioCircleChecked: {
    borderColor: colors.accent,
    borderWidth: 6,
  },
  optionText: {
    flex: 1,
    gap: spacing[4],
  },
  confirmContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing[24],
    paddingHorizontal: spacing[8],
  },
  confirmIconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmTextBlock: {
    gap: spacing[8],
    alignItems: "center",
  },
  summaryCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius[8],
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing[16],
    gap: spacing[12],
    ...shadows.subtle,
  },
  summaryTitle: {
    letterSpacing: 0.8,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing[8],
  },
  confirmActions: {
    width: "100%",
    gap: spacing[8],
  },
});
