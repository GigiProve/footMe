import { useState } from "react";
import { Alert, FlatList, Share, StyleSheet, View } from "react-native";

import { EditModalShell } from "../../profiles/edit-modals/EditModalShell";
import { SelectField } from "../../../components/ui/select-field";
import { colors, radius, spacing } from "../../../theme/tokens";
import { AppText, Button } from "../../../ui";
import {
  buildInviteUrl,
  createInviteLink,
  deactivateInviteLink,
  fetchClubInviteLinks,
} from "../invite-service";
import type { ClubInviteLink, MemberRole } from "../membership-types";

type InviteLinkModalProps = {
  clubId: string;
  createdBy: string;
  onClose: () => void;
  visible: boolean;
};

const roleOptions: { label: string; value: MemberRole }[] = [
  { label: "Giocatore", value: "player" },
  { label: "Staff", value: "staff" },
  { label: "Allenatore", value: "coach" },
  { label: "Dirigente", value: "director" },
];

export function InviteLinkModal({
  clubId,
  createdBy,
  onClose,
  visible,
}: InviteLinkModalProps) {
  const [selectedRole, setSelectedRole] = useState<MemberRole | "">("");
  const [generatedLink, setGeneratedLink] = useState<ClubInviteLink | null>(null);
  const [existingLinks, setExistingLinks] = useState<ClubInviteLink[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function loadLinks() {
    setIsLoading(true);
    try {
      const links = await fetchClubInviteLinks(clubId);
      setExistingLinks(links);
    } catch {
      // Ignore load errors
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGenerate() {
    if (!selectedRole) {
      Alert.alert("Seleziona ruolo", "Scegli il ruolo per il link di invito");
      return;
    }

    setIsGenerating(true);
    try {
      const link = await createInviteLink({
        clubId,
        createdBy,
        memberRole: selectedRole as MemberRole,
      });
      setGeneratedLink(link);
      await loadLinks();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Errore nella generazione del link";
      Alert.alert("Errore", message);
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleShare(token: string) {
    const url = buildInviteUrl(token);
    try {
      await Share.share({
        message: `Unisciti alla mia societa' su footMe: ${url}`,
        url,
      });
    } catch {
      // User cancelled share
    }
  }

  async function handleDeactivate(linkId: string) {
    Alert.alert(
      "Disattiva link",
      "Sei sicuro di voler disattivare questo link di invito?",
      [
        { style: "cancel", text: "Annulla" },
        {
          onPress: async () => {
            try {
              await deactivateInviteLink(linkId);
              await loadLinks();
              if (generatedLink?.id === linkId) {
                setGeneratedLink(null);
              }
            } catch (error) {
              const message =
                error instanceof Error ? error.message : "Errore nella disattivazione";
              Alert.alert("Errore", message);
            }
          },
          style: "destructive",
          text: "Disattiva",
        },
      ],
    );
  }

  function handleClose() {
    setSelectedRole("");
    setGeneratedLink(null);
    setExistingLinks([]);
    onClose();
  }

  // Load links when modal opens
  if (visible && existingLinks.length === 0 && !isLoading) {
    loadLinks();
  }

  const roleLabelMap: Record<string, string> = {
    coach: "Allenatore",
    director: "Dirigente",
    player: "Giocatore",
    staff: "Staff",
  };

  return (
    <EditModalShell
      isSaving={isGenerating}
      onClose={handleClose}
      onSave={handleGenerate}
      saveLabel={isGenerating ? "Generazione..." : "Genera link"}
      title="Link di invito"
      visible={visible}
    >
      <AppText variant="bodySm" color="secondary">
        Genera un link da condividere con giocatori e staff per farli registrare
        e collegare automaticamente alla tua societa'.
      </AppText>

      <SelectField<MemberRole | "">
        label="Ruolo"
        onChange={(val) => setSelectedRole(val as MemberRole | "")}
        options={roleOptions}
        placeholder="Seleziona ruolo"
        value={selectedRole}
      />

      {generatedLink ? (
        <View style={styles.generatedSection}>
          <AppText variant="titleSm">Link generato</AppText>
          <View style={styles.linkBox}>
            <AppText variant="bodySm" color="secondary">
              {buildInviteUrl(generatedLink.token)}
            </AppText>
          </View>
          <Button
            label="Condividi link"
            onPress={() => handleShare(generatedLink.token)}
            size="sm"
            variant="primary"
          />
        </View>
      ) : null}

      {existingLinks.length > 0 ? (
        <View style={styles.existingSection}>
          <AppText variant="headingSm">Link attivi</AppText>
          <FlatList
            data={existingLinks}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.linkRow}>
                <View style={styles.linkInfo}>
                  <AppText variant="titleSm">
                    {roleLabelMap[item.member_role] ?? item.member_role}
                  </AppText>
                  <AppText variant="bodySm" color="muted">
                    Scade: {new Date(item.expires_at).toLocaleDateString("it-IT")}
                  </AppText>
                </View>
                <View style={styles.linkActions}>
                  <Button
                    label="Condividi"
                    onPress={() => handleShare(item.token)}
                    size="sm"
                    variant="secondary"
                  />
                  <Button
                    label="Disattiva"
                    onPress={() => handleDeactivate(item.id)}
                    size="sm"
                    variant="danger"
                  />
                </View>
              </View>
            )}
            scrollEnabled={false}
          />
        </View>
      ) : null}
    </EditModalShell>
  );
}

const styles = StyleSheet.create({
  existingSection: {
    gap: spacing[12],
  },
  generatedSection: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius[12],
    gap: spacing[10],
    padding: spacing[14],
  },
  linkActions: {
    flexDirection: "row",
    gap: spacing[8],
  },
  linkBox: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    padding: spacing[10],
  },
  linkInfo: {
    flex: 1,
    gap: spacing[4],
  },
  linkRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: spacing[10],
    paddingVertical: spacing[12],
  },
});
