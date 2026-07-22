import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Ionicons from "@expo/vector-icons/Ionicons";

import { Screen } from "../../../src/components/ui/screen";
import { KeyboardAwareForm } from "../../../src/components/ui/keyboard-aware-form";
import {
  AppText,
  Avatar,
  Badge,
  Button,
  ConfirmModal,
  Divider,
  Input,
  SectionCard,
  ScreenHeader,
  useToast,
} from "../../../src/ui";
import {
  fetchRepresentationDetail,
  getRelationshipTypeLabel,
  removeRepresentation,
  setPrivateNote,
} from "../../../src/features/relationships/agent-representation-service";
import { supabase } from "../../../src/lib/supabase";
import { colors, radius, shadows, spacing } from "../../../src/theme/tokens";

type PlayerProfile = {
  avatar_url: string | null;
  full_name: string | null;
};

async function fetchPlayerProfile(profileId: string): Promise<PlayerProfile> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", profileId)
    .maybeSingle();

  return {
    avatar_url: data?.avatar_url ?? null,
    full_name: data?.full_name ?? null,
  };
}

export default function AssistitoDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { showToast } = useToast();

  const backAction = (
    <Pressable
      accessibilityLabel="Indietro"
      accessibilityRole="button"
      hitSlop={8}
      onPress={() => router.back()}
      style={({ pressed }) => [styles.backButton, pressed ? styles.pressedOp : null]}
    >
      <Ionicons color={colors.textPrimary} name="arrow-back" size={20} />
    </Pressable>
  );

  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof fetchRepresentationDetail>
  > | null>(null);
  const [player, setPlayer] = useState<PlayerProfile>({
    avatar_url: null,
    full_name: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [showConfirm, setShowConfirm] = useState(false);
  const [terminating, setTerminating] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const rep = await fetchRepresentationDetail(id as string);
        if (cancelled) return;
        if (!rep) {
          setError("Collegamento non trovato.");
          return;
        }
        setDetail(rep);
        setNote(rep.private_note ?? "");
        const prof = await fetchPlayerProfile(rep.player_profile_id);
        if (!cancelled) {
          setPlayer(prof);
        }
      } catch {
        if (!cancelled) {
          setError("Impossibile caricare i dati.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSaveNote() {
    if (!id) return;
    setSavingNote(true);
    try {
      await setPrivateNote(id as string, note.trim());
      showToast({ message: "Nota salvata." });
    } catch {
      showToast({ message: "Errore nel salvataggio della nota." });
    } finally {
      setSavingNote(false);
    }
  }

  async function handleTerminate() {
    if (!id) return;
    setTerminating(true);
    try {
      await removeRepresentation(id as string);
      showToast({ message: "Collegamento terminato." });
      setShowConfirm(false);
      router.back();
    } catch {
      showToast({ message: "Errore nella terminazione del collegamento." });
      setShowConfirm(false);
    } finally {
      setTerminating(false);
    }
  }

  const playerName = player.full_name ?? "Calciatore";

  if (loading) {
    return (
      <Screen>
        <ScreenHeader title="Dettaglio assistito" action={backAction} />
        <View style={styles.centered}>
          <AppText variant="bodySm" color="secondary">
            Caricamento...
          </AppText>
        </View>
      </Screen>
    );
  }

  if (error || !detail) {
    return (
      <Screen>
        <ScreenHeader title="Dettaglio assistito" action={backAction} />
        <View style={styles.centered}>
          <AppText variant="bodySm" color="secondary">
            {error ?? "Collegamento non trovato."}
          </AppText>
        </View>
      </Screen>
    );
  }

  const visibilityLabel =
    detail.visibility === "public" ? "Pubblico" : "Privato";
  const relationshipLabel = getRelationshipTypeLabel(detail.relationship_type);
  const subtitleLine = `${relationshipLabel} • ${visibilityLabel}`;

  const isActive =
    detail.status === "accepted" || detail.status === "pending";
  const statusLabel = detail.status === "accepted" ? "Attivo" : "In attesa";
  const statusBadgeVariant =
    detail.status === "accepted" ? "success" : "warning";

  return (
    <Screen>
      <ScreenHeader title="Dettaglio assistito" action={backAction} />

      <KeyboardAwareForm contentContainerStyle={styles.scrollContent}>
        {/* Player header card */}
        <View style={styles.playerCard}>
          <Avatar uri={player.avatar_url ?? undefined} name={playerName} size="lg" />
          <View style={styles.playerInfo}>
            <AppText variant="titleSm" numberOfLines={1}>
              {playerName}
            </AppText>
            <AppText variant="bodySm" color="secondary" numberOfLines={1}>
              {subtitleLine}
            </AppText>
            <Badge label={statusLabel} variant={statusBadgeVariant} />
          </View>
        </View>

        {/* Vedi profilo link */}
        <Button
          label="Vedi profilo"
          onPress={() =>
            router.push({
              pathname: "/profile/[id]",
              params: { id: detail.player_profile_id },
            })
          }
          size="sm"
          variant="outline"
        />

        <Divider />

        {/* Nota privata */}
        <SectionCard title="Nota privata">
          <AppText variant="caption" color="secondary" style={styles.noteHelp}>
            Visibile solo a te.
          </AppText>
          <Input
            multiline
            placeholder="Aggiungi una nota privata su questo assistito..."
            value={note}
            onChangeText={setNote}
          />
          <Button
            label="Salva nota"
            loading={savingNote}
            onPress={handleSaveNote}
            variant="primary"
            fullWidth
          />
        </SectionCard>

        {/* Termina collegamento */}
        {isActive ? (
          <>
            <Divider />
            <Button
              label="Termina collegamento"
              onPress={() => setShowConfirm(true)}
              variant="danger"
              fullWidth
            />
          </>
        ) : null}
      </KeyboardAwareForm>

      <ConfirmModal
        cancelLabel="Annulla"
        confirmLabel="Termina"
        isBusy={terminating}
        message={`${playerName} non comparirà più tra i tuoi assistiti. Il collegamento sarà rimosso anche dal profilo del calciatore.`}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleTerminate}
        title="Terminare collegamento?"
        visible={showConfirm}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: "center",
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  pressedOp: {
    opacity: 0.6,
  },
  scrollContent: {
    gap: spacing[16],
    paddingBottom: spacing[40],
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  playerCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius[8],
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing[14],
    padding: spacing[16],
    ...shadows.subtle,
  },
  playerInfo: {
    flex: 1,
    gap: spacing[6],
  },
  noteHelp: {
    marginBottom: spacing[8],
  },
});
